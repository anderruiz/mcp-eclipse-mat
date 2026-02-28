# Project Status

## Summary

MCP Eclipse MAT Server - A Model Context Protocol server for analyzing Java heap dumps using Eclipse MAT.

**Status**: ✅ Production Ready
**Version**: 1.1.0
**Last Updated**: 2026-02-28

**New in v1.1.0**: Remote compression for 50-70% faster downloads!

## Key Information

### Purpose
Enables AI assistants like Claude to analyze Java heap dumps from Kubernetes pods through natural language commands.

### Architecture
- **Language**: TypeScript (compiled to Node.js)
- **Protocol**: MCP (Model Context Protocol) via STDIO
- **Integration**: Eclipse MAT batch mode + kubectl
- **Target**: Claude Code CLI

### Tools Provided
1. `download_heap_dump` - Extract heap dumps from Kubernetes pods
2. `list_heap_dumps` - List downloaded dumps with metadata
3. `analyze_heap_dump` - Run MAT analysis (suspects/overview/top_components)
4. `list_reports` - List generated analysis reports
5. `run_oql_query` - Execute OQL queries (custom or preset)
6. `get_report_summary` - Extract readable summaries from HTML reports

## Important Limitations

### MCP Protocol Limitation
Operations can take 5-15 minutes but **progress is not visible in Claude Code CLI**. This is an MCP protocol limitation - tools can only return results when complete, not send incremental updates.

**What users see:**
```
⏺ Downloading heap dump...
✢ Razzle-dazzling… (6m 28s)
[Final result appears when complete]
```

**What the server logs** (to stderr, not visible in conversation):
```
🔍 Starting heap dump download...
[1/7] Checking pod...
✓ Pod found.
[2/7] Discovering PID...
✓ Found Java PID: 1234
...
```

### Why This Matters
- Users may think the tool is frozen during long operations
- No way to cancel or check progress from Claude Code CLI
- Important to set expectations: "this may take 5-15 minutes"

## Directory Structure

```
~/mcp-eclipse-mat/
├── src/                    # TypeScript source
│   ├── index.ts           # MCP server entry point
│   ├── types.ts           # Type definitions
│   ├── tools/             # Tool implementations
│   └── utils/             # Helper functions
├── build/                 # Compiled JavaScript
├── data/                  # Runtime data
│   ├── dumps/            # Downloaded heap dumps
│   └── reports/          # Generated MAT reports
├── package.json          # NPM configuration
├── tsconfig.json        # TypeScript configuration
├── README.md            # Main documentation
├── SETUP.md             # Setup guide for Claude Code CLI
├── CHANGELOG.md         # Version history
└── UPGRADE_NOTES.md     # Upgrade guide
```

## Configuration

### Current Setup
Server is configured in `~/.claude.json` for project:
- `/Users/ander.ruiz/go/src/github.com/DataDog/logs-backend`

### To Use in Other Projects
Add to that project's section in `~/.claude.json`:
```json
{
  "mcpServers": {
    "eclipse-mat": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/ander.ruiz/mcp-eclipse-mat/build/index.js"]
    }
  }
}
```

## Dependencies

### Runtime
- Node.js 18+
- Eclipse MAT (via Homebrew)
- kubectl (configured with cluster access)

### NPM Packages
- `@modelcontextprotocol/sdk` - MCP server framework
- `zod` - Schema validation
- `typescript` - Compiler (dev)
- `@types/node` - Type definitions (dev)

## Development

### Build
```bash
cd ~/mcp-eclipse-mat
npm run build
```

### Test
```bash
# Run verification script
~/mcp-eclipse-mat/test-server.sh

# Manual server test
timeout 2 node ~/mcp-eclipse-mat/build/index.js
```

### Debug
Server logs go to stderr. To see them:
```bash
# Run server manually
node ~/mcp-eclipse-mat/build/index.js 2>&1

# Or check Claude Code logs (location varies)
```

## Known Issues

### 1. No Progress Visibility in Claude Code CLI
**Issue**: Long operations (5-15 min) show no progress
**Cause**: MCP protocol limitation
**Status**: Cannot be fixed, inherent to MCP STDIO transport
**Workaround**: Set clear expectations in tool descriptions

### 2. MAT Memory Requirements
**Issue**: Eclipse MAT may run out of memory on large dumps
**Cause**: Default JVM heap size too small
**Solution**: Increase `-Xmx` in `MemoryAnalyzer.ini` or server code

### 3. kubectl Timeouts
**Issue**: Very large dumps (>5GB) may timeout
**Cause**: 10-minute timeout in code
**Solution**: Increase `KUBECTL_TIMEOUT` in `src/utils/kubectl.ts`

## Maintenance

### Regular Tasks
- None required - server is stateless
- Heap dumps and reports persist in `data/` directory
- Can manually clean old files from `data/dumps/` and `data/reports/`

### Updates
- Rebuild after code changes: `npm run build`
- Restart Claude Code session to use new version
- No database migrations or config changes needed

## Support Resources

### Documentation
- `README.md` - Complete feature documentation
- `SETUP.md` - Claude Code CLI setup guide
- `CHANGELOG.md` - Version history
- `UPGRADE_NOTES.md` - Upgrade instructions

### Code
- Main implementation: `src/`
- Plan document: `~/.../logs-backend/.plans/mcp-eclipse-mat-heapdump-server.plan.md`

## Success Metrics

Project is successful if:
- ✅ Server starts without errors
- ✅ All 6 tools register correctly
- ✅ Can download heap dumps from Kubernetes pods
- ✅ Can analyze dumps with Eclipse MAT
- ✅ Can execute OQL queries
- ✅ Reports are generated and readable

## Future Enhancements (Optional)

Potential improvements:
1. Support for comparing multiple heap dumps
2. Automated leak pattern detection
3. Integration with Datadog APM for correlation
4. Heap dump retention policies
5. Report archival and search

Not planned currently - project meets requirements as-is.
