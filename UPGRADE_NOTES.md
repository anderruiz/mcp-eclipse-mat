# Upgrade Notes

## Latest Version (2026-02-28)

### What's New: Enhanced Server Logging

This version adds detailed progress logging to stderr for debugging and server monitoring.

### Important: Logging Visibility

**If running server manually in terminal:**
You will see detailed progress logs with emojis and step-by-step updates.

**If using with Claude Code CLI (most users):**
You will **NOT** see these logs in the conversation. This is an MCP protocol limitation - tools can only return results when complete, not send incremental updates during execution.

### Example of Server Logs (visible only in terminal/logs)

```
🔍 Starting heap dump download...

[1/7] Checking if pod XYZ exists in namespace appsec...
✓ Pod found.
[2/7] Discovering Java process PID...
✓ Found Java PID: 1234
[3/7] Checking disk space in /tmp...
✓ Disk space:
Filesystem      Size  Used Avail Use% Mounted on
tmpfs           8.0G  2.1G  5.9G  27% /tmp
[4/7] Generating heap dump (this may take several minutes)...
⏳ Executing: jmap -dump:live,format=b,file=/tmp/heap-dump.hprof 1234
    This step can take 2-5 minutes for large heaps. Please wait...
✓ Heap dump generated successfully.
[5/7] Checking heap dump size...
✓ Heap dump size: 1.2G (1234567890 bytes)
[6/7] Copying heap dump to local machine...
📦 Destination: /Users/username/mcp-eclipse-mat/data/dumps/XYZ-2026-02-28.hprof
    Downloading 1.2G... This may take a few minutes.
✓ Heap dump copied successfully.
[7/7] Cleaning up heap dump from pod...
✓ Remote heap dump deleted.

✅ Heap dump download completed successfully!
```

### What You Will See in Claude Code CLI

```
⏺ Downloading heap dump...
✢ Razzle-dazzling… (6m 28s)
[Final result appears when complete]
```

### No Breaking Changes

This is a **backward-compatible update**. All tool signatures remain the same:
- Same input parameters
- Same output format
- Same functionality

The logging is purely additive and doesn't affect normal operation.

### How to Upgrade

1. Pull the latest code (already done if you're reading this)
2. Rebuild: `cd ~/mcp-eclipse-mat && npm run build`
3. Restart your Claude Code session to use the new version

That's it! No configuration changes needed.

### Viewing Server Logs

If you want to see the detailed progress logs:

**Option 1: Run server manually**
```bash
# In terminal, run any MCP tool manually
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_heap_dumps","arguments":{}}}' | node ~/mcp-eclipse-mat/build/index.js
```

**Option 2: Check Claude Code logs**
Claude Code may redirect server stderr to log files. Check your Claude Code settings or documentation for log file locations.

### Benefits of Logging

Even though you don't see the logs in real-time during conversations, they are useful for:

1. **Debugging**: If something goes wrong, logs help identify where it failed
2. **Monitoring**: System administrators can monitor long-running operations
3. **Development**: Developers can see exactly what the server is doing
4. **Manual testing**: Running the server in terminal shows full progress

### Technical Details

- Progress messages sent to `stderr` using `console.error()`
- Final response still returned via MCP protocol on `stdout`
- No performance impact - logging is async
- Messages use emojis for better visual scanning in logs

### Feedback

If you have suggestions for improvement, the logging code is in:
- `src/tools/download-heap-dump.ts` - Heap dump download logging
- `src/utils/mat.ts` - MAT analysis and OQL query logging
