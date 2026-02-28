import { existsSync, readFileSync, readdirSync } from "fs";
import { join, basename } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { REPORTS_DIR } from "../utils/paths.js";

const execAsync = promisify(exec);

export async function getReportSummary(reportPath: string): Promise<{
  success: boolean;
  summary: string;
}> {
  if (!existsSync(reportPath)) {
    return { success: false, summary: `Report not found: ${reportPath}` };
  }

  try {
    // If it's a zip file, extract it first
    let extractDir = reportPath;
    if (reportPath.endsWith(".zip")) {
      extractDir = join(REPORTS_DIR, `extracted-${Date.now()}`);
      await execAsync(`unzip -o "${reportPath}" -d "${extractDir}"`);
    }

    // Find index.html
    let indexPath = join(extractDir, "index.html");
    if (!existsSync(indexPath)) {
      // Try to find any HTML file
      const files = readdirSync(extractDir).filter(f => f.endsWith(".html"));
      if (files.length > 0) {
        indexPath = join(extractDir, files[0]);
      } else {
        return { success: false, summary: "No HTML files found in report" };
      }
    }

    // Read and parse HTML to extract key information
    const htmlContent = readFileSync(indexPath, "utf-8");

    // Extract text content using simple regex
    const summary = extractSummaryFromHTML(htmlContent, basename(reportPath));

    return { success: true, summary };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, summary: `Failed to extract summary: ${errorMessage}` };
  }
}

function extractSummaryFromHTML(html: string, reportName: string): string {
  const sections: string[] = [];
  sections.push(`Report: ${reportName}`);
  sections.push("=".repeat(50));

  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    sections.push(`\nTitle: ${titleMatch[1].trim()}`);
  }

  // Extract headings and their content
  const headingMatches = html.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi);
  for (const match of headingMatches) {
    sections.push(`\n## ${match[1].trim()}`);
  }

  // Extract table data (common in MAT reports)
  const tableMatches = html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi);
  for (const tableMatch of tableMatches) {
    const tableHtml = tableMatch[1];

    // Extract headers
    const headerMatches = tableHtml.matchAll(/<th[^>]*>([^<]*)<\/th>/gi);
    const headers: string[] = [];
    for (const hm of headerMatches) {
      headers.push(hm[1].trim());
    }

    if (headers.length > 0) {
      sections.push(`\nTable columns: ${headers.join(" | ")}`);
    }

    // Extract first few rows of data
    const rowMatches = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    let rowCount = 0;
    for (const rowMatch of rowMatches) {
      if (rowCount >= 5) {
        sections.push("  ... (more rows)");
        break;
      }

      const cellMatches = rowMatch[1].matchAll(/<td[^>]*>([^<]*)<\/td>/gi);
      const cells: string[] = [];
      for (const cm of cellMatches) {
        cells.push(cm[1].trim());
      }

      if (cells.length > 0) {
        sections.push(`  ${cells.join(" | ")}`);
        rowCount++;
      }
    }
  }

  // Look for "Problem Suspect" sections (specific to leak suspects report)
  const suspectMatches = html.matchAll(/Problem Suspect\s*(\d+)/gi);
  for (const match of suspectMatches) {
    sections.push(`\n** Problem Suspect ${match[1]} **`);
  }

  // Extract any percentage or size information
  const sizeMatches = html.matchAll(/(\d+(?:\.\d+)?)\s*(?:%|MB|GB|KB|bytes)/gi);
  const uniqueSizes = new Set<string>();
  for (const match of sizeMatches) {
    uniqueSizes.add(match[0]);
  }
  if (uniqueSizes.size > 0) {
    sections.push(`\nKey metrics found: ${Array.from(uniqueSizes).slice(0, 10).join(", ")}`);
  }

  // Add instructions for human review
  sections.push("\n" + "=".repeat(50));
  sections.push("For detailed analysis, open the HTML report in a browser.");
  sections.push(`Report location: ${reportName}`);

  return sections.join("\n");
}
