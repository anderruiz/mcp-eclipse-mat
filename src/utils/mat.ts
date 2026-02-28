import { exec } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { join, basename, dirname } from "path";
import { PARSE_HEAP_DUMP_SCRIPT, REPORTS_DIR, generateReportId, MAT_PATH } from "./paths.js";

const execAsync = promisify(exec);
const MAT_TIMEOUT = 1800000; // 30 minutes for large heap dumps

export type ReportType = "suspects" | "overview" | "top_components";

const REPORT_TYPE_MAP: Record<ReportType, string> = {
  suspects: "org.eclipse.mat.api:suspects",
  overview: "org.eclipse.mat.api:overview",
  top_components: "org.eclipse.mat.api:top_components",
};

const REPORT_ZIP_SUFFIX: Record<ReportType, string> = {
  suspects: "_Leak_Suspects.zip",
  overview: "_System_Overview.zip",
  top_components: "_Top_Components.zip",
};

export interface MATAnalysisResult {
  success: boolean;
  reportId: string;
  reportPath: string;
  zipPath: string;
  message: string;
}

export async function runMATAnalysis(
  heapDumpPath: string,
  reportType: ReportType
): Promise<MATAnalysisResult> {
  const reportId = generateReportId();

  // Verify heap dump exists
  if (!existsSync(heapDumpPath)) {
    return {
      success: false,
      reportId,
      reportPath: "",
      zipPath: "",
      message: `Heap dump not found: ${heapDumpPath}`,
    };
  }

  // Verify MAT is installed
  if (!existsSync(PARSE_HEAP_DUMP_SCRIPT)) {
    return {
      success: false,
      reportId,
      reportPath: "",
      zipPath: "",
      message: `Eclipse MAT not found. Install with: brew install --cask mat\nExpected at: ${PARSE_HEAP_DUMP_SCRIPT}`,
    };
  }

  const matCommand = REPORT_TYPE_MAP[reportType];
  const dumpDir = dirname(heapDumpPath);
  const dumpName = basename(heapDumpPath, ".hprof");

  try {
    // Run MAT analysis
    const command = `"${PARSE_HEAP_DUMP_SCRIPT}" "${heapDumpPath}" ${matCommand}`;

    console.error(`\n🔬 Starting Eclipse MAT analysis...`);
    console.error(`📊 Report type: ${reportType}`);
    console.error(`📁 Heap dump: ${basename(heapDumpPath)}`);
    console.error(`⏳ This may take 5-15 minutes for large heap dumps. Please wait...\n`);
    console.error(`Command: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      timeout: MAT_TIMEOUT,
      cwd: MAT_PATH,
      env: {
        ...process.env,
        _JAVA_OPTIONS: "-Xmx32g",
      },
    });

    console.error(`✓ MAT analysis completed`);

    // Find the generated zip file
    const expectedZipName = `${dumpName}${REPORT_ZIP_SUFFIX[reportType]}`;
    const zipPath = join(dumpDir, expectedZipName);

    console.error(`Looking for report: ${expectedZipName}`);

    if (!existsSync(zipPath)) {
      console.error(`❌ Report not found at: ${zipPath}`);
      return {
        success: false,
        reportId,
        reportPath: "",
        zipPath: "",
        message: `Analysis completed but report not found at expected location: ${zipPath}\nstdout: ${stdout}\nstderr: ${stderr}`,
      };
    }

    console.error(`✓ Report found, copying to reports directory...`);

    // Copy zip to reports directory with our naming
    const destZipPath = join(REPORTS_DIR, `${reportId}-${reportType}.zip`);
    await execAsync(`cp "${zipPath}" "${destZipPath}"`);

    console.error(`✅ Report saved to: ${destZipPath}\n`);

    return {
      success: true,
      reportId,
      reportPath: destZipPath,
      zipPath: destZipPath,
      message: `✅ Analysis complete.\n📊 Report type: ${reportType}\n📋 Report ID: ${reportId}\n📁 Report saved to: ${destZipPath}\n\n💡 To view: unzip the file and open index.html in a browser.`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      reportId,
      reportPath: "",
      zipPath: "",
      message: `MAT analysis failed: ${errorMessage}`,
    };
  }
}

export async function runOQLQuery(
  heapDumpPath: string,
  query: string,
  outputFormat: "html" | "csv" | "txt" = "txt"
): Promise<{ success: boolean; output: string }> {
  if (!existsSync(heapDumpPath)) {
    return { success: false, output: `Heap dump not found: ${heapDumpPath}` };
  }

  if (!existsSync(PARSE_HEAP_DUMP_SCRIPT)) {
    return {
      success: false,
      output: `Eclipse MAT not found. Install with: brew install --cask mat`,
    };
  }

  try {
    // Escape the OQL query for shell
    const escapedQuery = query.replace(/"/g, '\\"');
    const command = `"${PARSE_HEAP_DUMP_SCRIPT}" "${heapDumpPath}" -format=${outputFormat} "-command=oql \\"${escapedQuery}\\"" org.eclipse.mat.api:query`;

    console.error(`\n🔍 Running OQL query...`);
    console.error(`Query: ${query}`);
    console.error(`Format: ${outputFormat}`);
    console.error(`⏳ Processing... This may take a few minutes.\n`);

    const { stdout, stderr } = await execAsync(command, {
      timeout: MAT_TIMEOUT,
      cwd: MAT_PATH,
      env: {
        ...process.env,
        _JAVA_OPTIONS: "-Xmx32g",
      },
    });

    // The output is typically in a generated file
    const dumpDir = dirname(heapDumpPath);
    const dumpName = basename(heapDumpPath, ".hprof");
    const queryReportZip = join(dumpDir, `${dumpName}_Query.zip`);

    if (existsSync(queryReportZip)) {
      console.error(`✓ Query report generated, extracting results...`);
      // Unzip and read the content
      const unzipDir = join(REPORTS_DIR, `oql-${Date.now()}`);
      await execAsync(`unzip -o "${queryReportZip}" -d "${unzipDir}"`);

      // Read the main output file
      const { stdout: catOut } = await execAsync(`cat "${unzipDir}"/*.${outputFormat} 2>/dev/null || cat "${unzipDir}"/index.html 2>/dev/null || echo "Could not read output"`);

      console.error(`✅ OQL query completed successfully\n`);
      return { success: true, output: catOut };
    }

    console.error(`✅ OQL query completed\n`);
    return {
      success: true,
      output: stdout || stderr || "Query completed but no output generated",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, output: `OQL query failed: ${errorMessage}` };
  }
}
