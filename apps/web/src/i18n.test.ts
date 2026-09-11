import { describe, expect, it } from "vitest";

import { en } from "./locales/en.js";
import { es } from "./locales/es.js";

const keys = Object.keys(en) as (keyof typeof en)[];

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe("i18n catalogs", () => {
  it("keeps English and Spanish keys aligned", () => {
    expect(Object.keys(es).sort()).toEqual(keys.slice().sort());
  });

  it("does not leave empty Spanish strings", () => {
    for (const key of keys) {
      expect(es[key].trim().length).toBeGreaterThan(0);
      expect(en[key].trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps interpolation placeholders aligned", () => {
    for (const key of keys) {
      expect(placeholders(es[key])).toEqual(placeholders(en[key]));
    }
  });
});
