export interface HeapDumpMetadata {
  id: string;
  podName: string;
  namespace: string;
  cluster: string;
  timestamp: string;
  filePath: string;
  sizeBytes: number;
}

export interface AnalysisReport {
  id: string;
  heapDumpId: string;
  reportType: "suspects" | "overview" | "top_components";
  timestamp: string;
  reportPath: string;
  summary?: string;
}

export interface OQLResult {
  query: string;
  timestamp: string;
  resultCount: number;
  results: string;
  format: "html" | "csv" | "txt";
}
