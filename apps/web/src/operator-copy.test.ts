import { describe, expect, it } from "vitest";

import type { Translate } from "./i18n.js";
import { es } from "./locales/es.js";
import {
  translateEvidenceReason,
  translateIncidentSummary,
  translateSimulationError,
} from "./operator-copy.js";

const tEs: Translate = (key, vars) => {
  const template = es[key];
  if (!vars) {
    return template;
  }
  return template.replaceAll(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
};

describe("Spanish operator copy", () => {
  it("translates correlated beaconing summaries at the presentation layer", () => {
    expect(
      translateIncidentSummary(
        tEs,
        "3 correlated beaconing signal(s) on PTY-HEALTH-01: queries are highly periodic",
      ),
    ).toBe(
      "3 señales de Balizamiento correlacionadas en PTY-HEALTH-01: las consultas presentan una periodicidad elevada",
    );
  });

  it("translates evidence reasons without changing backend enums", () => {
    expect(translateEvidenceReason(tEs, "repeated communication")).toBe(
      "comunicación repetida",
    );
    expect(translateEvidenceReason(tEs, "recurring destination domain")).toBe(
      "dominio de destino recurrente",
    );
    expect(
      translateEvidenceReason(tEs, "many generated-looking names fail to resolve"),
    ).toBe("muchos nombres de aspecto generado no se resuelven");
    expect(
      translateEvidenceReason(
        tEs,
        "query is a near-miss of a local canonical domain",
      ),
    ).toBe("la consulta es un casi acierto de un dominio canónico local");
  });

  it("maps simulation failure codes to operator Spanish", () => {
    expect(translateSimulationError(tEs, "kafka_unavailable")).toBe(
      "No fue posible conectar con Kafka.",
    );
    expect(translateSimulationError(tEs, "queries_not_found")).toBe(
      "No se encontraron archivos queries.*.",
    );
  });
});
