# Performance Notes

## Remote Compression Benefits

The heap dump download tool now compresses files on the pod before downloading, which significantly improves performance.

### Typical Results

| Heap Dump Size | Compressed Size | Compression Ratio | Time Saved |
|----------------|-----------------|-------------------|------------|
| 500 MB         | 150-200 MB      | 60-70%           | ~1-2 min   |
| 1 GB           | 300-400 MB      | 60-70%           | ~2-4 min   |
| 2 GB           | 600-800 MB      | 60-70%           | ~4-8 min   |
| 5 GB           | 1.5-2 GB        | 60-70%           | ~10-20 min |

*Times vary based on network speed and heap content (highly compressible data like strings compress better)*

### How It Works

1. **Generate heap dump**: `jmap` creates `.hprof` file on pod (2-5 minutes)
2. **Compress remotely**: `gzip` compresses the file on pod (1-3 minutes)
3. **Download**: Transfer compressed file over network (much faster!)
4. **Decompress locally**: `gunzip` extracts the file (~30 seconds)

### Trade-offs

**Pros:**
- 50-70% faster network transfer
- Less bandwidth usage
- Overall faster for dumps >500MB

**Cons:**
- Adds 1-3 minutes for compression
- Requires `gzip` in the container
- Uses disk space on pod temporarily

### When It Helps Most

Compression is most beneficial when:
- Heap dump is large (>500MB)
- Network is slow or bandwidth-limited
- Heap contains compressible data (strings, similar objects)

Compression is less beneficial when:
- Heap dump is small (<100MB)
- Network is very fast
- Heap contains random/encrypted data (less compressible)

### Requirements

The pod must have `gzip` available. This is standard in most base images:
- ✅ Alpine Linux
- ✅ Ubuntu/Debian
- ✅ Red Hat/CentOS
- ✅ Most Java base images

If `gzip` is not available, you'll see an error during step 6 (compression).

### Disk Space

Temporary disk usage on pod:
- `.hprof` file (full heap dump size)
- `.hprof.gz` file (compressed, ~30-40% of original)
- Both are cleaned up after download

Make sure the pod has enough disk space for both files temporarily.

### Network Transfer Calculation

Example for 2GB heap dump on 10 Mbps connection:

**Without compression:**
- 2GB = 16,384 Mb
- 16,384 Mb ÷ 10 Mbps = ~27 minutes

**With compression (70% reduction):**
- 600MB = 4,915 Mb
- 4,915 Mb ÷ 10 Mbps = ~8 minutes
- Plus ~2 minutes compression/decompression
- **Total: ~10 minutes** (17 minutes faster!)

### Monitoring

The tool reports compression ratio in the output:
```
✓ Compressed size: 623M (652835840 bytes)
✓ Compression ratio: 68.5% reduction
```

This helps you understand the benefit for your specific heap dump.
