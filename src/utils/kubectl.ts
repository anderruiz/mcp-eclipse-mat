import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const KUBECTL_TIMEOUT = 600000; // 10 minutes for large heap dumps

export interface PodInfo {
  name: string;
  namespace: string;
  status: string;
}

export async function checkPodExists(
  namespace: string,
  podName: string,
  cluster?: string
): Promise<boolean> {
  const clusterArg = cluster ? `--cluster ${cluster}` : "";
  try {
    await execAsync(
      `kubectl ${clusterArg} get pod -n ${namespace} ${podName}`,
      { timeout: 30000 }
    );
    return true;
  } catch {
    return false;
  }
}

export async function getJavaPid(
  namespace: string,
  podName: string,
  cluster?: string
): Promise<number[]> {
  const clusterArg = cluster ? `--cluster ${cluster}` : "";
  const { stdout } = await execAsync(
    `kubectl ${clusterArg} exec -n ${namespace} ${podName} -- jps -l`,
    { timeout: 30000 }
  );

  const pids: number[] = [];
  for (const line of stdout.split("\n")) {
    const match = line.match(/^(\d+)\s+/);
    if (match) {
      const pid = parseInt(match[1], 10);
      // Skip Jps itself
      if (!line.includes("Jps") && !line.includes("jps")) {
        pids.push(pid);
      }
    }
  }
  return pids;
}

export async function checkDiskSpace(
  namespace: string,
  podName: string,
  cluster?: string
): Promise<string> {
  const clusterArg = cluster ? `--cluster ${cluster}` : "";
  const { stdout } = await execAsync(
    `kubectl ${clusterArg} exec -n ${namespace} ${podName} -- df -h /tmp`,
    { timeout: 30000 }
  );
  return stdout;
}

export async function generateHeapDump(
  namespace: string,
  podName: string,
  javaPid: number,
  remotePath: string,
  cluster?: string
): Promise<void> {
  const clusterArg = cluster ? `--cluster ${cluster}` : "";
  await execAsync(
    `kubectl ${clusterArg} exec -n ${namespace} ${podName} -- jmap -dump:live,format=b,file=${remotePath} ${javaPid}`,
    { timeout: KUBECTL_TIMEOUT }
  );
}

export async function getRemoteFileSize(
  namespace: string,
  podName: string,
  remotePath: string,
  cluster?: string
): Promise<{ size: string; bytes: number }> {
  const clusterArg = cluster ? `--cluster ${cluster}` : "";
  const { stdout } = await execAsync(
    `kubectl ${clusterArg} exec -n ${namespace} ${podName} -- ls -lh ${remotePath}`,
    { timeout: 30000 }
  );
  const parts = stdout.trim().split(/\s+/);
  const humanSize = parts[4] || "unknown";

  // Also get exact byte count
  const { stdout: bytesOut } = await execAsync(
    `kubectl ${clusterArg} exec -n ${namespace} ${podName} -- stat -c%s ${remotePath}`,
    { timeout: 30000 }
  );
  const bytes = parseInt(bytesOut.trim(), 10) || 0;

  return { size: humanSize, bytes };
}

export async function copyFromPod(
  namespace: string,
  podName: string,
  remotePath: string,
  localPath: string,
  cluster?: string
): Promise<void> {
  const clusterArg = cluster ? `--cluster ${cluster}` : "";
  await execAsync(
    `kubectl ${clusterArg} cp ${namespace}/${podName}:${remotePath} ${localPath} --retries=10`,
    { timeout: KUBECTL_TIMEOUT }
  );
}

export async function compressRemoteFile(
  namespace: string,
  podName: string,
  sourceFilePath: string,
  destZipPath: string,
  cluster?: string
): Promise<void> {
  const clusterArg = cluster ? `--cluster ${cluster}` : "";
  // Use gzip for better compression and availability (zip might not be installed)
  await execAsync(
    `kubectl ${clusterArg} exec -n ${namespace} ${podName} -- gzip -c ${sourceFilePath} > ${destZipPath}`,
    { timeout: KUBECTL_TIMEOUT }
  );
}

export async function deleteRemoteFile(
  namespace: string,
  podName: string,
  remotePath: string,
  cluster?: string
): Promise<void> {
  const clusterArg = cluster ? `--cluster ${cluster}` : "";
  try {
    await execAsync(
      `kubectl ${clusterArg} exec -n ${namespace} ${podName} -- rm -f ${remotePath}`,
      { timeout: 30000 }
    );
  } catch {
    // Ignore deletion errors
  }
}

export async function deleteMultipleRemoteFiles(
  namespace: string,
  podName: string,
  remotePaths: string[],
  cluster?: string
): Promise<void> {
  const clusterArg = cluster ? `--cluster ${cluster}` : "";
  try {
    await execAsync(
      `kubectl ${clusterArg} exec -n ${namespace} ${podName} -- rm -f ${remotePaths.join(' ')}`,
      { timeout: 30000 }
    );
  } catch {
    // Ignore deletion errors
  }
}
