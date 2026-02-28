import { join } from "path";
import { homedir } from "os";
import { mkdirSync, existsSync } from "fs";

const PROJECT_ROOT = join(homedir(), "mcp-eclipse-mat");
export const DATA_DIR = join(PROJECT_ROOT, "data");
export const DUMPS_DIR = join(DATA_DIR, "dumps");
export const REPORTS_DIR = join(DATA_DIR, "reports");

export const MAT_PATH = "/Applications/mat.app/Contents/Eclipse";
export const PARSE_HEAP_DUMP_SCRIPT = join(MAT_PATH, "ParseHeapDump.sh");

export function ensureDirectories(): void {
  for (const dir of [DATA_DIR, DUMPS_DIR, REPORTS_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export function generateDumpId(): string {
  return `dump-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateReportId(): string {
  return `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
