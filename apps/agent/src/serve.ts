import "./load-env.js";
import { consumeDnsStream } from "./consumer.js";
import { listenOperatorApi } from "./api.js";
import { ensureTelemetrySchema } from "./clickhouse.js";
import { operatorStore } from "./store.js";

const port = Number(process.env.SENTINEL_API_PORT ?? 3001);

try {
  await ensureTelemetrySchema();
  const api = await listenOperatorApi(operatorStore, port);
  console.log(`Operator API http://127.0.0.1:${api.port}`);
  console.log("If Overview has no QoE or incidents, run: npm run demo:seed");
  await consumeDnsStream({
    fromBeginning: process.argv.includes("--from-beginning"),
    onSignals(signals) {
      for (const signal of signals) {
        console.log(JSON.stringify(signal));
      }
    },
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
