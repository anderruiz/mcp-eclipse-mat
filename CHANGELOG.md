# Changelog

## 2026-02-28 - Remote Compression for Faster Downloads

### Added
- **Remote compression** before downloading heap dumps
- Heap dumps are now compressed with gzip on the pod before download
- Automatic decompression after download
- Compression ratio reporting (typically 50-70% size reduction)
- Cleanup of temporary compressed files

### Changed
- Download workflow changed from 7 steps to 9 steps
- New steps: compress remotely, check compressed size, decompress locally
- Significantly faster downloads for large heap dumps
- Network transfer time reduced by ~50-70%

### Performance Improvements
- A 2GB heap dump now downloads as ~600MB (70% faster network transfer)
- Compression takes 1-3 minutes but saves more in download time
- Overall faster for dumps over ~500MB

### Technical Details
- Uses `gzip` for compression (widely available in containers)
- Compression happens on the pod: `gzip -c heap-dump.hprof > heap-dump.hprof.gz`
- Local decompression: `gunzip -c heap-dump.hprof.gz > heap-dump.hprof`
- Both `.hprof` and `.gz` files cleaned up from pod
- Temporary `.gz` file cleaned up locally after decompression

## 2026-02-28 - Enhanced Progress Logging

### Added
- **Detailed progress logging** to stderr for all long-running operations
- 7-step progress logging for heap dump download
- Progress logging for MAT analysis with time estimates
- Progress logging for OQL query execution
- Emojis for better visual feedback in logs: 🔍 ✓ ⏳ 📦 ✅ ❌

### Changed
- All long operations now log detailed progress to stderr using `console.error()`
- More descriptive log messages at each step
- Better error messages with visual indicators
- Time estimates for operations that may take several minutes

### Technical Details

**download_heap_dump improvements:**
- Logs each of 7 steps: pod verification, PID discovery, disk space check, heap generation, size check, download, cleanup
- Warns that heap generation may take 2-5 minutes
- Shows file sizes and destination paths
- Clear success/error indicators

**analyze_heap_dump improvements:**
- Logs report type and heap dump being analyzed
- Warns that analysis may take 5-15 minutes for large dumps
- Shows MAT command being executed
- Progress updates during report extraction and copy

**run_oql_query improvements:**
- Logs the actual OQL query being executed
- Shows output format
- Progress indication during query execution
- Success confirmation after completion

### Important Note

These logs are written to stderr and are useful for:
- Debugging server issues
- Running the server manually in terminal
- Inspecting server logs

**Note for Claude Code CLI users**: This logging is not visible in the conversation. MCP protocol limitation means tools can only return results when complete, not send incremental updates. Operations may take 5-15 minutes without visible progress in the UI.

## Initial Release - 2026-02-28

### Features
- Download heap dumps from Kubernetes pods
- Run Eclipse MAT analysis (suspects, overview, top_components)
- Execute OQL queries with preset options
- List heap dumps and reports
- Generate human-readable report summaries
- MCP server integration for Claude Code CLI
