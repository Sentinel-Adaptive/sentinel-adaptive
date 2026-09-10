import { describe, expect, it } from "vitest";

import { extractDomainFeatures } from "./domain-features.js";
import { shannonEntropy } from "./entropy.js";

describe("shannonEntropy", () => {
  it("returns 0 for empty and constant strings", () => {
    expect(shannonEntropy("")).toBe(0);
    expect(shannonEntropy("aaaa")).toBe(0);
  });

  it("returns 1 bit for a balanced two-character string", () => {
    expect(shannonEntropy("abab")).toBe(1);
  });

  it("returns 2 bits for four equally likely characters", () => {
    expect(shannonEntropy("abcd")).toBe(2);
  });
});

describe("extractDomainFeatures", () => {
  it("measures lexical shape of a normal domain", () => {
    const features = extractDomainFeatures("portal.secure-bank.test");

    expect(features.queryLength).toBe("portal.secure-bank.test".length);
    expect(features.labelCount).toBe(3);
    expect(features.longestLabelLength).toBe("secure-bank".length);
    expect(features.longSubdomain).toBe(false);
    expect(features.numericRatio).toBe(0);
  });

  it("flags long high-entropy tunnel labels", () => {
    const label = "a".repeat(20) + "b".repeat(20) + "cdef0123456789";
    const features = extractDomainFeatures(`${label}.telemetry-gateway.test`);

    expect(features.longestLabelLength).toBe(label.length);
    expect(features.longSubdomain).toBe(true);
    expect(features.longestLabelEntropy).toBeGreaterThan(1);
  });

  it("scores exact repeated patterns", () => {
    const features = extractDomainFeatures("abcabcabc.example.test");
    expect(features.repeatedPatternScore).toBe(1);
  });
});
