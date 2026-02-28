import { join } from "path";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import {
  checkPodExists,
  getJavaPid,
  checkDiskSpace,
  generateHeapDump,
  getRemoteFileSize,
  copyFromPod,
  deleteMultipleRemoteFiles,
} from "../utils/kubectl.js";
import { DUMPS_DIR, generateDumpId } from "../utils/paths.js";
import type { HeapDumpMetadata } from "../types.js";

const execAsync = promisify(exec);

const METADATA_FILE = join(DUMPS_DIR, "metadata.json");

function loadMetadata(): HeapDumpMetadata[] {
  if (existsSync(METADATA_FILE)) {
    return JSON.parse(readFileSync(METADATA_FILE, "utf-8"));
  }
  return [];
}

function saveMetadata(metadata: HeapDumpMetadata[]): void {
  writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

function logProgress(message: string, steps: string[]): void {
  steps.push(message);
  console.error(message);
}

export async function downloadHeapDump(params: {
  namespace: string;
  podName: string;
  cluster: string;
  javaPid?: number;
}): Promise<{ success: boolean; message: string; metadata?: HeapDumpMetadata }> {
  const { namespace, podName, cluster, javaPid } = params;
  const steps: string[] = [];

  console.error("\n🔍 Starting heap dump download with compression...\n");

  try {
    // Step 1: Verify pod exists
    logProgress(`[1/9] Checking if pod ${podName} exists in namespace ${namespace}...`, steps);
    const podExists = await checkPodExists(namespace, podName, cluster);
    if (!podExists) {
      const errorMsg = `Pod ${podName} not found in namespace ${namespace} on cluster ${cluster}`;
      console.error(`❌ ${errorMsg}`);
      return {
        success: false,
        message: errorMsg,
      };
    }
    logProgress(`✓ Pod found.`, steps);

    // Step 2: Get Java PID if not provided
    let pid = javaPid ?? 1;
    if (!javaPid) {
      logProgress(`[2/9] Discovering Java process PID...`, steps);
      const pids = await getJavaPid(namespace, podName, cluster);
      if (pids.length === 0) {
        const errorMsg = "No Java processes found in pod. Available PIDs could not be determined.";
        console.error(`❌ ${errorMsg}`);
        return {
          success: false,
          message: errorMsg,
        };
      }
      pid = pids[0];
      logProgress(`✓ Found Java PID: ${pid}`, steps);
    } else {
      logProgress(`[2/9] Using provided Java PID: ${pid}`, steps);
    }

    // Step 3: Check disk space
    logProgress(`[3/9] Checking disk space in /tmp...`, steps);
    const diskSpace = await checkDiskSpace(namespace, podName, cluster);
    logProgress(`✓ Disk space:\n${diskSpace}`, steps);

    // Step 4: Generate heap dump
    const remotePath = "/tmp/heap-dump.hprof";
    logProgress(`[4/9] Generating heap dump (this may take several minutes)...`, steps);
    logProgress(`⏳ Executing: jmap -dump:live,format=b,file=${remotePath} ${pid}`, steps);
    console.error(`    This step can take 2-5 minutes for large heaps. Please wait...`);
    await generateHeapDump(namespace, podName, pid, remotePath, cluster);
    logProgress(`✓ Heap dump generated successfully.`, steps);

    // Step 5: Check uncompressed heap dump size
    logProgress(`[5/9] Checking heap dump size...`, steps);
    const { size: uncompressedSize, bytes: uncompressedBytes } = await getRemoteFileSize(namespace, podName, remotePath, cluster);
    logProgress(`✓ Uncompressed heap dump size: ${uncompressedSize} (${uncompressedBytes} bytes)`, steps);

    // Step 6: Compress heap dump remotely
    const remoteGzPath = "/tmp/heap-dump.hprof.gz";
    logProgress(`[6/9] Compressing heap dump remotely (this may take 1-3 minutes)...`, steps);
    logProgress(`⏳ Executing: gzip -c ${remotePath} > ${remoteGzPath}`, steps);
    console.error(`    Compressing ${uncompressedSize}... Please wait...`);

    const clusterArg = cluster ? `--cluster ${cluster}` : "";
    await execAsync(
      `kubectl ${clusterArg} exec -n ${namespace} ${podName} -- sh -c "gzip -c ${remotePath} > ${remoteGzPath}"`,
      { timeout: 600000 }
    );
    logProgress(`✓ Heap dump compressed successfully.`, steps);

    // Step 7: Check compressed size
    logProgress(`[7/9] Checking compressed size...`, steps);
    const { size: compressedSize, bytes: compressedBytes } = await getRemoteFileSize(namespace, podName, remoteGzPath, cluster);
    const compressionRatio = ((1 - compressedBytes / uncompressedBytes) * 100).toFixed(1);
    logProgress(`✓ Compressed size: ${compressedSize} (${compressedBytes} bytes)`, steps);
    logProgress(`✓ Compression ratio: ${compressionRatio}% reduction`, steps);

    // Step 8: Download compressed file
    const dumpId = generateDumpId();
    const timestamp = new Date().toISOString();
    const localGzFileName = `${podName}-${timestamp.replace(/[:.]/g, "-")}.hprof.gz`;
    const localGzPath = join(DUMPS_DIR, localGzFileName);
    const localFileName = `${podName}-${timestamp.replace(/[:.]/g, "-")}.hprof`;
    const localPath = join(DUMPS_DIR, localFileName);

    logProgress(`[8/9] Downloading compressed heap dump...`, steps);
    logProgress(`📦 Downloading: ${compressedSize} (was ${uncompressedSize} uncompressed)`, steps);
    console.error(`    This should be much faster than downloading uncompressed!`);
    await copyFromPod(namespace, podName, remoteGzPath, localGzPath, cluster);
    logProgress(`✓ Compressed file downloaded successfully.`, steps);

    // Step 9: Decompress locally
    logProgress(`[9/9] Decompressing heap dump locally...`, steps);
    await execAsync(`gunzip -c "${localGzPath}" > "${localPath}"`, { timeout: 300000 });
    logProgress(`✓ Heap dump decompressed.`, steps);

    // Cleanup local compressed file
    logProgress(`Cleaning up temporary files...`, steps);
    unlinkSync(localGzPath);
    logProgress(`✓ Local compressed file deleted.`, steps);

    // Cleanup remote files (both .hprof and .gz)
    await deleteMultipleRemoteFiles(namespace, podName, [remotePath, remoteGzPath], cluster);
    logProgress(`✓ Remote files cleaned up.`, steps);

    // Save metadata
    const metadata: HeapDumpMetadata = {
      id: dumpId,
      podName,
      namespace,
      cluster,
      timestamp,
      filePath: localPath,
      sizeBytes: uncompressedBytes,
    };

    const allMetadata = loadMetadata();
    allMetadata.push(metadata);
    saveMetadata(allMetadata);

    console.error(`\n✅ Heap dump download completed successfully!\n`);

    return {
      success: true,
      message: steps.join("\n") + `\n\n✅ Heap dump saved to: ${localPath}\n📋 Dump ID: ${dumpId}\n💾 Original size: ${uncompressedSize}\n📦 Downloaded: ${compressedSize} (${compressionRatio}% smaller)`,
      metadata,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Error: ${errorMessage}\n`);
    return {
      success: false,
      message: steps.join("\n") + `\n\n❌ Error: ${errorMessage}`,
    };
  }
}

export function listHeapDumps(): HeapDumpMetadata[] {
  return loadMetadata();
}
