# Setup Guide for Claude Code CLI

The MCP Eclipse MAT server is ready to use with Claude Code CLI.

## ✅ Configuration Complete

The MCP server has been added to the current project (`logs-backend`) in your `~/.claude.json` file:

```json
{
  "eclipse-mat": {
    "type": "stdio",
    "command": "node",
    "args": ["/Users/ander.ruiz/mcp-eclipse-mat/build/index.js"]
  }
}
```

## 🔄 Activating the Server

**Option 1: Restart Claude Code session**
Exit this conversation and start a new session. The server should appear automatically.

**Option 2: Run `/mcp` to verify**
In your next session, run `/mcp` to see available MCP servers. You should see "eclipse-mat" listed.

## 🚀 Using the Tools

Once the server is active, you can use natural language commands:

### Example 1: Download a heap dump
```
Download a heap dump from pod oss-package-crawler-xxx in namespace appsec on cluster gizmo.us1.staging.dog
```

### Example 2: List available heap dumps
```
List the heap dumps I have downloaded
```

### Example 3: Analyze for memory leaks
```
Analyze the most recent heap dump for memory leaks
```

### Example 4: Run OQL query
```
Run an OQL query to find all strings larger than 10KB in the most recent heap dump
```

### Example 5: Use preset queries
```
Execute the "largeStrings" preset query on the latest heap dump
```

## 📦 Available Tools

| Tool | Description |
|------|-------------|
| **download_heap_dump** | Download heap dump from a Kubernetes pod using kubectl + jmap |
| **list_heap_dumps** | List all downloaded heap dumps with metadata |
| **analyze_heap_dump** | Run Eclipse MAT analysis (suspects/overview/top_components) |
| **list_reports** | List all generated reports |
| **run_oql_query** | Execute custom OQL queries or use presets |
| **get_report_summary** | Extract readable summary from HTML reports |

## 🔍 Preset OQL Queries

- `largeStrings` - Strings with retained heap > 10KB
- `allThreads` - All thread objects from heap dump
- `topRetainedObjects` - Objects with largest retained heap
- `classLoaders` - All ClassLoader instances
- `hashMaps` - HashMaps with more than 100 entries
- `arrayLists` - ArrayLists with more than 1000 elements
- `byteArrays` - Byte arrays larger than 1MB
- `duplicateStrings` - Strings with more than 10 duplicates

## 📁 Data Locations

- **Heap dumps**: `~/mcp-eclipse-mat/data/dumps/`
- **Reports**: `~/mcp-eclipse-mat/data/reports/`
- **Metadata**: JSON files in data directories

## 🔧 Verification

You can verify the server works correctly:

```bash
# Test 1: Verify server starts
timeout 2 node ~/mcp-eclipse-mat/build/index.js

# Test 2: Run all verifications
~/mcp-eclipse-mat/test-server.sh
```

Expected output:
```
✓ Server starts successfully
✓ Source directory exists
✓ Build directory exists
✓ Dumps directory exists
✓ Reports directory exists
✓ Eclipse MAT installed
✓ kubectl available
✓ Node.js available
```

## 🐛 Troubleshooting

### Server doesn't appear in `/mcp`
1. **Restart your Claude Code session** - Configuration loads on startup
2. Verify configuration is in the correct project:
   ```bash
   python3 -c "import json; print(json.load(open('/Users/ander.ruiz/.claude.json'))['projects']['/Users/ander.ruiz/go/src/github.com/DataDog/logs-backend']['mcpServers'])"
   ```

### "MAT out of memory" error
Eclipse MAT may run out of memory with large heap dumps. Increase available memory:

```bash
# Edit MAT configuration file
open -t /Applications/mat.app/Contents/Eclipse/MemoryAnalyzer.ini

# Change -Xmx4g to -Xmx15g or -Xmx32g
```

You can also adjust in the server code (`src/utils/mat.ts`):
```typescript
_JAVA_OPTIONS: "-Xmx32g"  // Increase as needed
```

### kubectl timeout
Large heap dumps may take several minutes:
- Ensure stable connection to cluster
- Timeouts are configured to 10 minutes (600000ms)
- Can be increased in `src/utils/kubectl.ts` if needed

### Pod not found
Verify:
```bash
kubectl --cluster gizmo.us1.staging.dog get pods -n appsec | grep package-crawler
```

### jmap not available in pod
Some containers don't include JDK tools. Verify pod has jmap:
```bash
kubectl --cluster CLUSTER exec -n NAMESPACE POD-NAME -- which jmap
```

## 📚 More Information

- **Complete README**: `cat ~/mcp-eclipse-mat/README.md`
- **Source code**: `~/mcp-eclipse-mat/src/`
- **Implementation plan**: `~/go/src/github.com/DataDog/logs-backend/.plans/mcp-eclipse-mat-heapdump-server.plan.md`

## 💡 Usage Tips

1. **Typical workflow**:
   - Download heap dump → Analyze with "suspects" → Review summary → Run specific OQL queries

2. **For quick analysis**:
   - Use `analyze_heap_dump` with "suspects" type to identify memory leaks

3. **For deep investigation**:
   - Generate all 3 report types (suspects, overview, top_components)
   - Use custom OQL queries for specific cases

4. **Reports are interactive**:
   - Generated ZIPs contain HTML with interactive charts
   - Can be opened in browser for manual analysis

## 🎯 Complete Example

```
# 1. Download heap dump
Download a heap dump from pod oss-package-crawler-abc123 in namespace appsec on cluster gizmo.us1.staging.dog

# 2. List available dumps
List downloaded heap dumps

# 3. Analyze for memory leaks
Analyze the most recent heap dump using the "suspects" report

# 4. View summary
Give me the summary of the last generated report

# 5. Investigate further
Run an OQL query to find all HashMap instances with more than 100 entries
```

## ⚠️ Real-time Feedback Limitation

**Note**: While the server logs progress to stderr during long operations (heap dump download, MAT analysis), this feedback is **not visible in Claude Code CLI conversations**. You will only see the final result when the operation completes.

The progress logging is useful for:
- Debugging (check server logs)
- Running the server manually in terminal
- Understanding what's happening if you inspect logs

For Claude Code CLI users: operations may take 5-15 minutes without visible progress. This is a limitation of the MCP protocol - tools can only return results when complete, not send incremental updates.
