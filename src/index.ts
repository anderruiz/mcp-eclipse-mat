#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ensureDirectories } from "./utils/paths.js";
import { downloadHeapDump, listHeapDumps } from "./tools/download-heap-dump.js";
import { analyzeHeapDump, listReports } from "./tools/analyze-heap-dump.js";
import { executeOQLQuery, COMMON_OQL_QUERIES } from "./tools/run-oql-query.js";
import { getReportSummary } from "./tools/get-report-summary.js";

const server = new McpServer({
  name: "eclipse-mat",
  version: "1.1.0",
});

// Tool: download_heap_dump
server.registerTool(
  "download_heap_dump",
  {
    description: "Download a heap dump from a running Kubernetes pod. " +
      "Executes jmap inside the pod to generate an HPROF heap dump, " +
      "then copies it to the local machine for analysis.",
    inputSchema: {
      namespace: z.string().describe("Kubernetes namespace where the pod runs (e.g., 'appsec')"),
      podName: z.string().describe("Name of the pod to dump (e.g., 'my-service-abc123')"),
      cluster: z.string().describe("Kubernetes cluster identifier (e.g., 'gizmo.us1.staging.dog')"),
      javaPid: z.number().optional().describe("PID of Java process (default: 1)"),
    },
  },
  async ({ namespace, podName, cluster, javaPid }) => {
    const result = await downloadHeapDump({ namespace, podName, cluster, javaPid });
    return {
      content: [
        {
          type: "text",
          text: result.message,
        },
      ],
    };
  }
);

// Tool: analyze_heap_dump
server.registerTool(
  "analyze_heap_dump",
  {
    description: "Run Eclipse MAT analysis on a heap dump file. " +
      "Generates reports including leak suspects, memory overview, and top memory consumers.",
    inputSchema: {
      heapDumpPath: z.string().describe("Path to the .hprof heap dump file"),
      reportType: z.enum(["suspects", "overview", "top_components"]).describe(
        "Type of report: 'suspects' for leak analysis, 'overview' for general memory view, 'top_components' for largest memory users"
      ),
    },
  },
  async ({ heapDumpPath, reportType }) => {
    const result = await analyzeHeapDump({ heapDumpPath, reportType });
    return {
      content: [{ type: "text", text: result.message }],
    };
  }
);

// Tool: run_oql_query
server.registerTool(
  "run_oql_query",
  {
    description: `Execute an OQL (Object Query Language) query against a heap dump.
OQL is SQL-like syntax where classes are tables, objects are rows, fields are columns.

Basic syntax: SELECT * FROM <class> [WHERE <condition>]

Examples:
- SELECT * FROM java.lang.String (all strings)
- SELECT * FROM java.lang.String s WHERE s.@retainedHeapSize > 10000 (large strings)
- SELECT * FROM java.lang.Thread (all threads)
- SELECT * FROM java.util.HashMap WHERE size > 100 (large hash maps)

Special attributes:
- @retainedHeapSize: memory retained by this object
- @usedHeapSize: shallow heap size
- @length: array length

Common useful queries available as presets (use query_preset parameter).`,
    inputSchema: {
      heapDumpPath: z.string().describe("Path to the .hprof heap dump file"),
      query: z.string().optional().describe("Custom OQL query"),
      queryPreset: z.enum([
        "largeStrings",
        "allThreads",
        "topRetainedObjects",
        "classLoaders",
        "hashMaps",
        "arrayLists",
        "byteArrays",
        "duplicateStrings",
      ]).optional().describe("Use a preset query instead of custom query"),
      outputFormat: z.enum(["html", "csv", "txt"]).optional().describe("Output format (default: txt)"),
    },
  },
  async ({ heapDumpPath, query, queryPreset, outputFormat }) => {
    let actualQuery = query;
    if (queryPreset && !query) {
      actualQuery = COMMON_OQL_QUERIES[queryPreset as keyof typeof COMMON_OQL_QUERIES];
    }

    if (!actualQuery) {
      return {
        content: [{
          type: "text",
          text: "Error: Either 'query' or 'queryPreset' must be provided.",
        }],
      };
    }

    const result = await executeOQLQuery({
      heapDumpPath,
      query: actualQuery,
      outputFormat: outputFormat ?? "txt",
    });

    return {
      content: [{
        type: "text",
        text: result.success
          ? `Query: ${result.query}\nFormat: ${result.format}\n\nResults:\n${result.output}`
          : `Query failed: ${result.output}`,
      }],
    };
  }
);

// Tool: list_heap_dumps
server.registerTool(
  "list_heap_dumps",
  {
    description: "List all downloaded heap dumps available for analysis.",
    inputSchema: {},
  },
  async () => {
    const dumps = listHeapDumps();
    if (dumps.length === 0) {
      return {
        content: [{ type: "text", text: "No heap dumps found." }],
      };
    }

    const lines = dumps.map(d =>
      `- ID: ${d.id}\n  Pod: ${d.podName}\n  Namespace: ${d.namespace}\n  Cluster: ${d.cluster}\n  Time: ${d.timestamp}\n  Size: ${(d.sizeBytes / 1024 / 1024).toFixed(2)} MB\n  Path: ${d.filePath}`
    );
    return {
      content: [{ type: "text", text: "Available heap dumps:\n\n" + lines.join("\n\n") }],
    };
  }
);

// Tool: list_reports
server.registerTool(
  "list_reports",
  {
    description: "List all generated analysis reports. Reports can be opened in a browser for human review.",
    inputSchema: {
      heapDumpId: z.string().optional().describe("Filter reports by heap dump ID"),
    },
  },
  async ({ heapDumpId }) => {
    const reports = listReports(heapDumpId);
    if (reports.length === 0) {
      return {
        content: [{ type: "text", text: "No reports found." }],
      };
    }

    const lines = reports.map(r =>
      `- ID: ${r.id}\n  Type: ${r.reportType}\n  Heap Dump: ${r.heapDumpId}\n  Time: ${r.timestamp}\n  Path: ${r.reportPath}`
    );
    return {
      content: [{ type: "text", text: "Available reports:\n\n" + lines.join("\n\n") }],
    };
  }
);

// Tool: get_report_summary
server.registerTool(
  "get_report_summary",
  {
    description: "Get a text summary of an analysis report suitable for AI review. " +
      "Extracts key findings from HTML reports into a readable format.",
    inputSchema: {
      reportPath: z.string().describe("Path to the report directory or zip file"),
    },
  },
  async ({ reportPath }) => {
    const result = await getReportSummary(reportPath);
    return {
      content: [{ type: "text", text: result.summary }],
    };
  }
);

async function main() {
  ensureDirectories();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Eclipse MAT MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
