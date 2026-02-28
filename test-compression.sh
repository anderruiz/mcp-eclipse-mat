#!/bin/bash
# Test script to verify compression functionality

echo "Testing compression workflow..."
echo ""

# Test gzip availability (simulates what happens on pod)
echo "1. Testing gzip availability..."
if command -v gzip &> /dev/null; then
    echo "✓ gzip is available"
else
    echo "✗ gzip not found"
    exit 1
fi

# Create test file
echo "2. Creating test file..."
dd if=/dev/urandom of=/tmp/test-heap.hprof bs=1M count=10 2>/dev/null
ORIGINAL_SIZE=$(stat -f%z /tmp/test-heap.hprof 2>/dev/null || stat -c%s /tmp/test-heap.hprof)
echo "✓ Created test file: $(ls -lh /tmp/test-heap.hprof | awk '{print $5}')"

# Compress
echo "3. Compressing..."
gzip -c /tmp/test-heap.hprof > /tmp/test-heap.hprof.gz
COMPRESSED_SIZE=$(stat -f%z /tmp/test-heap.hprof.gz 2>/dev/null || stat -c%s /tmp/test-heap.hprof.gz)
echo "✓ Compressed to: $(ls -lh /tmp/test-heap.hprof.gz | awk '{print $5}')"

# Calculate ratio
RATIO=$(echo "scale=1; (1 - $COMPRESSED_SIZE / $ORIGINAL_SIZE) * 100" | bc)
echo "✓ Compression ratio: ${RATIO}%"

# Decompress
echo "4. Decompressing..."
gunzip -c /tmp/test-heap.hprof.gz > /tmp/test-heap-restored.hprof
RESTORED_SIZE=$(stat -f%z /tmp/test-heap-restored.hprof 2>/dev/null || stat -c%s /tmp/test-heap-restored.hprof)
echo "✓ Restored size: $(ls -lh /tmp/test-heap-restored.hprof | awk '{print $5}')"

# Verify
echo "5. Verifying integrity..."
if [ "$ORIGINAL_SIZE" -eq "$RESTORED_SIZE" ]; then
    echo "✓ File sizes match!"
    if diff /tmp/test-heap.hprof /tmp/test-heap-restored.hprof &>/dev/null; then
        echo "✓ Files are identical!"
    else
        echo "✗ Files differ"
        exit 1
    fi
else
    echo "✗ Size mismatch"
    exit 1
fi

# Cleanup
echo "6. Cleaning up..."
rm -f /tmp/test-heap.hprof /tmp/test-heap.hprof.gz /tmp/test-heap-restored.hprof
echo "✓ Cleanup complete"

echo ""
echo "✅ All compression tests passed!"
