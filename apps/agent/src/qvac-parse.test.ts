import { describe, expect, it } from "vitest";

import { parseQvacAssessment } from "./qvac-parse.js";

describe("parseQvacAssessment", () => {
  it("extracts the first JSON object and keeps supplied metrics", () => {
    const parsed = parseQvacAssessment(
      'prefix {"assessment":"uncertain","rationale":"NXDOMAIN is elevated in this window.","usedEvidence":["nxdomainRatio","whois"]}\nsuffix',
      ["nxdomainRatio"],
    );
    expect(parsed.assessment).toBe("uncertain");
    expect(parsed.usedEvidence).toEqual(["nxdomainRatio"]);
  });

  it("rejects output that is not schema-valid after filtering", () => {
    expect(() => parseQvacAssessment("no json here", ["nxdomainRatio"])).toThrow();
    expect(() =>
      parseQvacAssessment(
        '{"assessment":"uncertain","rationale":"invented reputation","usedEvidence":["whois"]}',
        ["nxdomainRatio"],
      ),
    ).toThrow();
  });
});
