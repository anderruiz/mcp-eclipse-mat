import { join } from "path";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { runMATAnalysis, type ReportType } from "../utils/mat.js";
import { REPORTS_DIR } from "../utils/paths.js";
import type { AnalysisReport } from "../types.js";

const REPORTS_METADATA_FILE = join(REPORTS_DIR, "reports-metadata.json");

function loadReportsMetadata(): AnalysisReport[] {
  if (existsSync(REPORTS_METADATA_FILE)) {
    return JSON.parse(readFileSync(REPORTS_METADATA_FILE, "utf-8"));
  }
  return [];
}

function saveReportsMetadata(reports: AnalysisReport[]): void {
  writeFileSync(REPORTS_METADATA_FILE, JSON.stringify(reports, null, 2));
}

export async function analyzeHeapDump(params: {
  heapDumpPath: string;
  reportType: ReportType;
}): Promise<{ success: boolean; message: string; report?: AnalysisReport }> {
  const { heapDumpPath, reportType } = params;

  const result = await runMATAnalysis(heapDumpPath, reportType);

  if (!result.success) {
    return { success: false, message: result.message };
  }

  // Extract heap dump ID from path if possible
  const heapDumpId = heapDumpPath.includes("dump-")
    ? heapDumpPath.match(/dump-[^/]+/)?.[0] ?? "unknown"
    : "unknown";

  const report: AnalysisReport = {
    id: result.reportId,
    heapDumpId,
    reportType,
    timestamp: new Date().toISOString(),
    reportPath: result.reportPath,
  };

  const reports = loadReportsMetadata();
  reports.push(report);
  saveReportsMetadata(reports);

  return {
    success: true,
    message: result.message,
    report,
  };
}

export function listReports(heapDumpId?: string): AnalysisReport[] {
  const reports = loadReportsMetadata();
  if (heapDumpId) {
    return reports.filter(r => r.heapDumpId === heapDumpId);
  }
  return reports;
}
