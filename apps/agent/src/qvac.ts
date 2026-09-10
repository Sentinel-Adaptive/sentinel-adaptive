import type { QvacResult, Signal } from "@sentinel-adaptive/contracts";

import { assessSignals, type QvacRuntime } from "./qvac-assess.js";

const permittedModel = "LLAMA_3_2_1B_INST_Q4_0";

let loadedModelId: string | undefined;
let loadPromise: Promise<string> | undefined;

export function qvacLocalOnly(): boolean {
  return (process.env.QVAC_LOCAL_ONLY ?? "true") === "true";
}

export function permittedQvacModel(): string {
  return process.env.QVAC_MODEL ?? permittedModel;
}

export interface SdkRuntimeOptions {
  onProgress?: (percentage: number) => void;
}

export function createSdkRuntime(
  options: SdkRuntimeOptions = {},
): QvacRuntime {
  return {
    async load() {
      if (!qvacLocalOnly()) {
        throw new Error(
          "QVAC_LOCAL_ONLY must be true; cloud inference is forbidden.",
        );
      }
      if (permittedQvacModel() !== permittedModel) {
        throw new Error(`Only ${permittedModel} is permitted for judged inference.`);
      }
      if (loadedModelId) {
        return loadedModelId;
      }
      loadPromise ??= loadLocalModel(options);
      loadedModelId = await loadPromise;
      return loadedModelId;
    },
    async complete(modelId, prompt, allowedMetrics) {
      const { completion } = await import("@qvac/sdk");
      const run = completion({
        modelId,
        history: [{ role: "user", content: prompt }],
        stream: true,
        captureThinking: false,
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "sentinel_qvac_assessment",
            schema: assessmentJsonSchema(allowedMetrics),
          },
        },
      });
      const final = await run.final;
      const text = final.contentText.trim() || final.raw.fullText.trim();
      if (!text) {
        throw new Error("QVAC returned empty content.");
      }
      return text;
    },
  };
}

export async function assessAmbiguousSignals(
  signals: readonly Signal[],
  runtime: QvacRuntime = createSdkRuntime(),
): Promise<readonly QvacResult[]> {
  try {
    return await assessSignals(signals, runtime);
  } catch {
    return signals.map((signal) => ({
      signalId: signal.signalId,
      status: "unavailable" as const,
    }));
  }
}

export async function unloadQvacModel(): Promise<void> {
  const pending = loadPromise;
  loadedModelId = undefined;
  loadPromise = undefined;
  const modelId = pending ? await pending.catch(() => undefined) : undefined;
  if (!modelId) {
    return;
  }
  const { unloadModel } = await import("@qvac/sdk");
  await unloadModel({ modelId, clearStorage: false });
}

export async function closeQvacRuntime(): Promise<void> {
  await unloadQvacModel().catch(() => undefined);
  const { close } = await import("@qvac/sdk");
  await close();
}

async function loadLocalModel(options: SdkRuntimeOptions): Promise<string> {
  const { loadModel, LLAMA_3_2_1B_INST_Q4_0 } = await import("@qvac/sdk");
  let lastLogged = -10;
  const fallbackSrc = `https://huggingface.co/${LLAMA_3_2_1B_INST_Q4_0.registryPath.replace("/blob/", "/resolve/")}`;
  return loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    fallbackSrc,
    modelConfig: { ctx_size: 2048, gpu_layers: 0 },
    onProgress(progress) {
      const percentage = Math.floor(progress.percentage);
      if (percentage >= lastLogged + 10) {
        lastLogged = percentage;
        options.onProgress?.(percentage);
      }
    },
  });
}

function assessmentJsonSchema(
  allowedMetrics: readonly string[],
): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["assessment", "rationale", "usedEvidence"],
    properties: {
      assessment: {
        type: "string",
        enum: ["consistent", "uncertain", "insufficient_evidence"],
      },
      rationale: { type: "string", minLength: 1 },
      usedEvidence: {
        type: "array",
        minItems: 1,
        items: { type: "string", enum: [...allowedMetrics] },
      },
    },
  };
}
