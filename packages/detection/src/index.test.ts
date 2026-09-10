import { describe, expect, it } from "vitest";

import { extractDomainFeatures, shannonEntropy } from "./index.js";

describe("detection public exports", () => {
  it("exposes entropy and domain-feature helpers", () => {
    expect(shannonEntropy("abab")).toBe(1);
    expect(extractDomainFeatures("a.example.test").labelCount).toBe(3);
  });
});
