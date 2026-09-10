import { createReadStream } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

import { discoverQueryFiles } from "./files.js";

export interface SourceLine {
  readonly originalFile: string;
  readonly originalLine: number;
  readonly text: string;
}

export async function* readQueryLines(
  rootPath: string,
): AsyncGenerator<SourceLine> {
  const files = discoverQueryFiles(rootPath);
  if (files.length === 0) {
    throw new Error(
      "No BIND query log files named queries.<n> were found under the dataset path.",
    );
  }

  for (const file of files) {
    const stream = createReadStream(file, { encoding: "utf8" });
    const reader = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });
    let originalLine = 0;

    try {
      for await (const text of reader) {
        originalLine += 1;
        yield {
          originalFile: path.basename(file),
          originalLine,
          text,
        };
      }
    } finally {
      reader.close();
      stream.destroy();
    }
  }
}
