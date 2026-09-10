import {
  qvacResultSchema,
  type QvacResult,
  type Signal,
} from "@sentinel-adaptive/contracts";
import {
  evidenceBundle,
  isAmbiguousSignal,
} from "@sentinel-adaptive/detection";

import { parseQvacAssessment } from "./qvac-parse.js";

export interface QvacRuntime {
  load(): Promise<string>;
  complete(
    modelId: string,
    prompt: string,
    allowedMetrics: readonly string[],
  ): Promise<string>;
}

export function buildQvacPrompt(signal: Signal): string {
  const bundle = evidenceBundle(signal);
  const metrics = bundle.evidence.map((item) => item.metric);
  return [
    "You assess DNS security evidence for Sentinel Adaptive.",
    "Use only the supplied evidence. Do not invent reputation, WHOIS, ASN, malware families, customer impact, or external facts.",
    "Reply with one JSON object and no other text.",
    "rationale must be one or more complete sentences that mention only supplied evidence names and values.",
    "Never put a single severity word such as high, medium, or low in rationale.",
    "If you report confidence, put high, medium, or low in the optional confidence field, not in rationale.",
    `usedEvidence must be a non-empty subset of: ${metrics.join(", ")}`,
    "Evidence bundle:",
    JSON.stringify(bundle),
  ].join("\n");
}

export async function assessSignals(
  signals: readonly Signal[],
  runtime: QvacRuntime,
): Promise<readonly QvacResult[]> {
  const results: QvacResult[] = [];
  let modelId: string | undefined;

  for (const signal of signals) {
    if (!isAmbiguousSignal(signal)) {
      results.push(
        qvacResultSchema.parse({
          signalId: signal.signalId,
          status: "skipped",
        }),
      );
      continue;
    }

    try {
      modelId ??= await runtime.load();
    } catch {
      results.push(
        qvacResultSchema.parse({
          signalId: signal.signalId,
          status: "unavailable",
        }),
      );
      continue;
    }

    let text: string;
    try {
      text = await runtime.complete(
        modelId,
        buildQvacPrompt(signal),
        signal.evidence.map((item) => item.metric),
      );
    } catch {
      results.push(
        qvacResultSchema.parse({
          signalId: signal.signalId,
          status: "unavailable",
        }),
      );
      continue;
    }

    try {
      const allowed = signal.evidence.map((item) => item.metric);
      results.push(
        qvacResultSchema.parse({
          signalId: signal.signalId,
          status: "ok",
          assessment: parseQvacAssessment(text, allowed),
        }),
      );
    } catch {
      results.push(
        qvacResultSchema.parse({
          signalId: signal.signalId,
          status: "invalid",
        }),
      );
    }
  }

  return results;
}
