import { consumeDnsStream } from "./consumer.js";

const usage = `Usage: npm run agent:consume -- [options]

Options:
  --broker <host:port>  Kafka broker (default: localhost:9092)
  --from-beginning      Read the topic from the earliest offset
  --group <id>          Consumer group id (default: sentinel-agent)
  --topic <name>        Kafka topic (default: dns.telemetry)`;

function readOption(
  arguments_: readonly string[],
  name: string,
): string | undefined {
  const index = arguments_.indexOf(name);
  return index >= 0 ? arguments_[index + 1] : undefined;
}

try {
  const arguments_ = process.argv.slice(2);
  if (arguments_.includes("--help")) {
    console.log(usage);
  } else {
    await consumeDnsStream({
      broker: readOption(arguments_, "--broker"),
      topic: readOption(arguments_, "--topic"),
      groupId: readOption(arguments_, "--group"),
      fromBeginning: arguments_.includes("--from-beginning"),
      onSignals(signals) {
        for (const signal of signals) {
          console.log(JSON.stringify(signal));
        }
      },
    });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
