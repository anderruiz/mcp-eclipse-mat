# MCP Eclipse MAT Server

An MCP (Model Context Protocol) server that integrates Eclipse MAT (Memory Analyzer Tool)
with AI assistants like Claude for automated Java heap dump analysis.

## Features

- **Download heap dumps** from running Kubernetes pods
- **Run MAT analysis** (leak suspects, overview, top components)
- **Execute OQL queries** against heap dumps
- **Generate summaries** for AI review
- **Human-reviewable reports** in HTML format
- **Progress logging** - Server logs detailed progress to stderr (useful for debugging and manual runs)

## Prerequisites

- Node.js 18+
- Eclipse MAT (`brew install --cask mat` on macOS)
- kubectl configured with cluster access
- Java pods with jmap available

## Installation

```bash
cd ~/mcp-eclipse-mat
npm install
npm run build
```

## Configuration

### For Claude Code CLI

Add the server to your project's configuration in `~/.claude.json`:

```json
{
  "projects": {
    "/path/to/your/project": {
      "mcpServers": {
        "eclipse-mat": {
          "type": "stdio",
          "command": "node",
          "args": ["/Users/YOUR_USERNAME/mcp-eclipse-mat/build/index.js"]
        }
      }
    }
  }
}
```

Replace `YOUR_USERNAME` with your actual macOS username and `/path/to/your/project` with your project path.

**To activate**: Start a new Claude Code session (the configuration loads on startup).

**To verify**: Run `/mcp` in your new session to see available MCP servers.

### For Claude Desktop

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "eclipse-mat": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/mcp-eclipse-mat/build/index.js"]
    }
  }
}
```

Replace `YOUR_USERNAME` with your actual macOS username.

After adding the configuration, restart Claude Desktop for the changes to take effect.

## Usage Examples

Ask Claude:

1. "Download a heap dump from pod my-service-xyz in namespace production on cluster prod.us1"
2. "Analyze the heap dump for memory leaks"
3. "Run an OQL query to find all strings larger than 10KB"
4. "Summarize the leak suspects report"

## Available Tools

| Tool | Description |
|------|-------------|
| download_heap_dump | Extract heap dump from a Kubernetes pod |
| analyze_heap_dump | Run MAT analysis (suspects/overview/top_components) |
| run_oql_query | Execute custom OQL queries |
| list_heap_dumps | List available heap dumps |
| list_reports | List generated reports |
| get_report_summary | Extract text summary from HTML reports |

## OQL Query Examples

```sql
-- Find large strings
SELECT * FROM java.lang.String s WHERE s.@retainedHeapSize > 10000

-- List all threads
SELECT * FROM java.lang.Thread

-- Find large HashMaps
SELECT * FROM java.util.HashMap WHERE size > 100

-- Find class loaders (useful for metaspace issues)
SELECT * FROM java.lang.ClassLoader
```

## Preset Queries

The `run_oql_query` tool includes several preset queries:

- `largeStrings` - Find strings with retained heap size > 10KB
- `allThreads` - List all thread objects
- `topRetainedObjects` - Objects with largest retained heap size
- `classLoaders` - All ClassLoader instances
- `hashMaps` - HashMaps with more than 100 entries
- `arrayLists` - ArrayLists with more than 1000 elements
- `byteArrays` - Byte arrays larger than 1MB
- `duplicateStrings` - Strings with more than 10 duplicates

## Data Storage

- Heap dumps: `~/mcp-eclipse-mat/data/dumps/`
- Reports: `~/mcp-eclipse-mat/data/reports/`
- Metadata: `~/mcp-eclipse-mat/data/dumps/metadata.json`

## Troubleshooting

**MAT out of memory**: Edit `/Applications/mat.app/Contents/Eclipse/MemoryAnalyzer.ini`
and increase `-Xmx` value (e.g., `-Xmx15g`).

**kubectl timeout**: Large heap dumps may take several minutes to download, even with compression.
Ensure stable network connection.

**Compression requirements**: The pod must have `gzip` available (standard in most containers).
If `gzip` is not available, the download will fail.

**No visible progress**: Operations may take 5-15 minutes without visible progress in Claude Code CLI.
This is a limitation of the MCP protocol - tools can only return results when complete.
The server logs progress to stderr, which can be viewed in server logs but not in the conversation.

**Report not found**: After running `analyze_heap_dump`, the tool generates a ZIP file
in the reports directory. Use `list_reports` to see all available reports.

**OQL query fails**: Ensure the heap dump path is correct and the dump file exists.
OQL queries require Eclipse MAT to process the heap dump first.

## Development

```bash
# Build the project
npm run build

# Watch mode for development
npm run dev

# Run the server directly
npm start
```

## Project Structure

```
~/mcp-eclipse-mat/
├── package.json              # Project configuration
├── tsconfig.json            # TypeScript configuration
├── README.md                # This file
├── src/
│   ├── index.ts            # MCP server entry point
│   ├── types.ts            # TypeScript type definitions
│   ├── tools/              # Tool implementations
│   │   ├── download-heap-dump.ts
│   │   ├── analyze-heap-dump.ts
│   │   ├── run-oql-query.ts
│   │   └── get-report-summary.ts
│   └── utils/              # Utility functions
│       ├── kubectl.ts      # Kubernetes operations
│       ├── mat.ts          # Eclipse MAT operations
│       └── paths.ts        # Path management
├── build/                  # Compiled JavaScript
└── data/                   # Storage for dumps and reports
    ├── dumps/
    └── reports/
```

## How It Works

### 1. Downloading Heap Dumps

The `download_heap_dump` tool uses **remote compression** for faster downloads:
1. Verifies the pod exists in the specified namespace
2. Discovers Java process PIDs using `jps`
3. Checks available disk space in `/tmp`
4. Generates a heap dump using `jmap -dump:live,format=b` (may take 2-5 minutes)
5. **Compresses the heap dump remotely** using gzip (may take 1-3 minutes)
6. Downloads the **compressed** file (typically 50-70% smaller, much faster!)
7. Decompresses locally
8. Cleans up temporary files (local and remote)
9. Saves metadata for future reference

**Performance benefit**: Downloading a 2GB heap dump compressed to 600MB saves significant time over network.

The server logs detailed progress to stderr during execution, useful for debugging.

### 2. Running MAT Analysis

The `analyze_heap_dump` tool:
1. Runs Eclipse MAT's `ParseHeapDump.sh` in batch mode
2. Generates one of three report types (may take 5-15 minutes for large dumps):
   - **suspects**: Leak Suspects Report (identifies potential memory leaks)
   - **overview**: System Overview Report (general memory statistics)
   - **top_components**: Top Components Report (largest memory consumers)
3. Saves the report as a ZIP file containing HTML
4. Stores metadata linking the report to its source heap dump

The server logs detailed progress to stderr during execution.

### 3. Executing OQL Queries

The `run_oql_query` tool:
1. Accepts either a custom OQL query or a preset query name
2. Runs the query against the heap dump using MAT's command-line interface
3. Returns results in the specified format (txt, csv, or html)
4. Can be used for targeted investigation after reviewing MAT reports

### 4. Generating Summaries

The `get_report_summary` tool:
1. Extracts and unzips MAT report archives
2. Parses HTML content to extract key findings
3. Formats the information as readable text
4. Provides both AI-digestible and human-readable output

## License

ISC

## Contributing

This is a standalone tool created for personal use with Claude Desktop.
Feel free to fork and modify for your own needs.

## Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [Eclipse MAT Documentation](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/)
- [Eclipse MAT OQL Syntax](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/reference/oqlsyntax.html)
- [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/)