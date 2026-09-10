import { shannonEntropy } from "./entropy.js";

export interface DomainFeatures {
  queryLength: number;
  longestLabelLength: number;
  labelCount: number;
  shannonEntropy: number;
  longestLabelEntropy: number;
  numericRatio: number;
  uniqueCharRatio: number;
  repeatedPatternScore: number;
  longSubdomain: boolean;
}

export function splitLabels(qname: string): string[] {
  return qname
    .replace(/\.$/, "")
    .toLowerCase()
    .split(".")
    .filter((label) => label.length > 0);
}

export function extractDomainFeatures(qname: string): DomainFeatures {
  const normalized = qname.replace(/\.$/, "").toLowerCase();
  const labels = splitLabels(normalized);
  const longest = labels.reduce(
    (current, label) => (label.length > current.length ? label : current),
    "",
  );
  const numericCount = [...normalized].filter(
    (character) => character >= "0" && character <= "9",
  ).length;

  return {
    queryLength: normalized.length,
    longestLabelLength: longest.length,
    labelCount: labels.length,
    shannonEntropy: shannonEntropy(normalized),
    longestLabelEntropy: shannonEntropy(longest),
    numericRatio: normalized.length === 0 ? 0 : numericCount / normalized.length,
    uniqueCharRatio:
      normalized.length === 0 ? 0 : new Set(normalized).size / normalized.length,
    repeatedPatternScore: repeatedPatternScore(longest),
    longSubdomain: longest.length >= 24,
  };
}

export function repeatedPatternScore(label: string): number {
  if (label.length < 4) {
    return 0;
  }

  for (let size = 1; size <= Math.floor(label.length / 2); size += 1) {
    if (label.length % size !== 0) {
      continue;
    }
    const unit = label.slice(0, size);
    if (unit.repeat(label.length / size) === label) {
      return 1;
    }
  }

  let repeats = 0;
  for (let index = 1; index < label.length; index += 1) {
    if (label[index] === label[index - 1]) {
      repeats += 1;
    }
  }

  return repeats / (label.length - 1);
}
