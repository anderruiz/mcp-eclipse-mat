#!/bin/bash
# Test script to verify the MCP server works correctly

echo "Testing MCP Eclipse MAT Server..." >&2
echo "" >&2

# Test 1: Server starts
echo "Test 1: Checking if server starts..." >&2
timeout 2 node ~/mcp-eclipse-mat/build/index.js 2>&1 | grep -q "Eclipse MAT MCP Server" && echo "✓ Server starts successfully" >&2 || echo "✗ Server failed to start" >&2

# Test 2: Project structure
echo "" >&2
echo "Test 2: Verifying project structure..." >&2
[ -d ~/mcp-eclipse-mat/src ] && echo "✓ Source directory exists" >&2 || echo "✗ Source directory missing" >&2
[ -d ~/mcp-eclipse-mat/build ] && echo "✓ Build directory exists" >&2 || echo "✗ Build directory missing" >&2
[ -d ~/mcp-eclipse-mat/data/dumps ] && echo "✓ Dumps directory exists" >&2 || echo "✗ Dumps directory missing" >&2
[ -d ~/mcp-eclipse-mat/data/reports ] && echo "✓ Reports directory exists" >&2 || echo "✗ Reports directory missing" >&2

# Test 3: Required tools
echo "" >&2
echo "Test 3: Checking required tools..." >&2
[ -f /Applications/mat.app/Contents/Eclipse/ParseHeapDump.sh ] && echo "✓ Eclipse MAT installed" >&2 || echo "✗ Eclipse MAT not found" >&2
command -v kubectl >/dev/null 2>&1 && echo "✓ kubectl available" >&2 || echo "✗ kubectl not found" >&2
command -v node >/dev/null 2>&1 && echo "✓ Node.js available" >&2 || echo "✗ Node.js not found" >&2

echo "" >&2
echo "All checks completed!" >&2
