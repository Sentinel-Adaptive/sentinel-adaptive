import {
  qvacAssessmentSchema,
  type QvacAssessment,
} from "@sentinel-adaptive/contracts";

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("QVAC output did not contain a JSON object.");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

export function parseQvacAssessment(
  text: string,
  allowedMetrics: readonly string[],
): QvacAssessment {
  const parsed = qvacAssessmentSchema.parse(extractJsonObject(text));
  const allowed = new Set(allowedMetrics);
  const usedEvidence = parsed.usedEvidence.filter((metric) =>
    allowed.has(metric),
  );
  return qvacAssessmentSchema.parse({
    ...parsed,
    usedEvidence,
  });
}
