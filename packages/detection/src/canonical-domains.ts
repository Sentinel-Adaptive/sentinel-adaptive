export const canonicalDomains = [
  "secure-bank.test",
  "health-network.test",
  "health-portal.test",
  "citizen-services.test",
] as const;

export function levenshtein(left: string, right: string): number {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const distance: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => 0),
  );

  for (let row = 0; row < rows; row += 1) {
    distance[row]![0] = row;
  }
  for (let column = 0; column < columns; column += 1) {
    distance[0]![column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      distance[row]![column] = Math.min(
        (distance[row - 1]![column] ?? 0) + 1,
        (distance[row]![column - 1] ?? 0) + 1,
        (distance[row - 1]![column - 1] ?? 0) + cost,
      );
      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        distance[row]![column] = Math.min(
          distance[row]![column] ?? 0,
          (distance[row - 2]![column - 2] ?? 0) + 1,
        );
      }
    }
  }

  return distance[left.length]![right.length] ?? 0;
}

export function nearestCanonical(qname: string): {
  canonical: (typeof canonicalDomains)[number];
  distance: number;
} | null {
  const normalized = qname.replace(/\.$/, "").toLowerCase();
  const candidates = [normalized, registeredPart(normalized)];
  let nearest: (typeof canonicalDomains)[number] | null = null;
  let best = Number.POSITIVE_INFINITY;

  for (const canonical of canonicalDomains) {
    for (const candidate of candidates) {
      const distance = levenshtein(candidate, canonical);
      if (distance < best) {
        best = distance;
        nearest = canonical;
      }
    }
  }

  return nearest ? { canonical: nearest, distance: best } : null;
}

function registeredPart(qname: string): string {
  const labels = qname.split(".").filter(Boolean);
  if (labels.length <= 2) {
    return qname;
  }
  return labels.slice(-2).join(".");
}
