import { runOQLQuery } from "../utils/mat.js";

export interface OQLQueryResult {
  success: boolean;
  query: string;
  output: string;
  format: "html" | "csv" | "txt";
}

export async function executeOQLQuery(params: {
  heapDumpPath: string;
  query: string;
  outputFormat?: "html" | "csv" | "txt";
}): Promise<OQLQueryResult> {
  const { heapDumpPath, query, outputFormat = "txt" } = params;

  const result = await runOQLQuery(heapDumpPath, query, outputFormat);

  return {
    success: result.success,
    query,
    output: result.output,
    format: outputFormat,
  };
}

// Common useful OQL queries for reference
export const COMMON_OQL_QUERIES = {
  largeStrings: "SELECT * FROM java.lang.String s WHERE s.@retainedHeapSize > 10000",
  allThreads: "SELECT * FROM java.lang.Thread",
  topRetainedObjects: "SELECT * FROM OBJECTS (SELECT OBJECTS o FROM java.lang.Object o) ORDER BY @retainedHeapSize DESC",
  classLoaders: "SELECT * FROM java.lang.ClassLoader",
  hashMaps: "SELECT * FROM java.util.HashMap WHERE size > 100",
  arrayLists: "SELECT * FROM java.util.ArrayList WHERE size > 1000",
  byteArrays: "SELECT * FROM byte[] WHERE @length > 1000000",
  duplicateStrings: "SELECT * FROM java.lang.String s GROUP BY toString(s) HAVING COUNT(*) > 10",
};
