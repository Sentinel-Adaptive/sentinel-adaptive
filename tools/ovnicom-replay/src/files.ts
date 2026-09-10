import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const QUERY_FILE = /^queries\.\d+$/;

export function discoverQueryFiles(rootPath: string): string[] {
  const resolved = path.resolve(rootPath);
  const stats = statSync(resolved);

  if (stats.isFile()) {
    return [resolved];
  }
  if (!stats.isDirectory()) {
    throw new Error(`Dataset path is not a file or directory: ${resolved}`);
  }

  const files: string[] = [];
  collectQueryFiles(resolved, files);
  files.sort(compareQueryFiles);
  return files;
}

function collectQueryFiles(directory: string, files: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "__MACOSX" || entry.name === ".DS_Store") {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectQueryFiles(fullPath, files);
    } else if (entry.isFile() && QUERY_FILE.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

function compareQueryFiles(left: string, right: string): number {
  const leftName = path.basename(left);
  const rightName = path.basename(right);
  const leftMatch = /^queries\.(\d+)$/.exec(leftName);
  const rightMatch = /^queries\.(\d+)$/.exec(rightName);

  if (leftMatch && rightMatch) {
    const byNumber = Number(leftMatch[1]) - Number(rightMatch[1]);
    if (byNumber !== 0) {
      return byNumber;
    }
  }

  return left.localeCompare(right);
}
