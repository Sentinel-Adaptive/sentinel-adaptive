const BIND_QUERY_LINE =
  /^(\d{2}-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2})\.(\d+)) queries: info: client (?:@\S+ )?(\S+)#(\d+) \(([^)]*)\): query: (\S+) (\S+) (\S+) (\S+)(?: \(([^)]+)\))?$/;

const MONTHS: Readonly<Record<string, number>> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const QTYPE_ALIASES: Readonly<Record<string, string>> = {
  TYPE64: "SVCB",
  TYPE65: "HTTPS",
};

export interface ParsedBindQuery {
  readonly timestamp: string;
  readonly clientIp: string;
  readonly clientPort: number;
  readonly qname: string;
  readonly qclass: string;
  readonly qtype: string;
  readonly flags: string;
  readonly resolverId?: string;
}

export function normalizeQtype(qtype: string): string {
  return QTYPE_ALIASES[qtype] ?? qtype;
}

export function bindTimestampToIsoUtc(raw: string): string | undefined {
  const match =
    /^(\d{2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2})\.(\d+)$/.exec(raw);
  if (!match) {
    return undefined;
  }

  const month = MONTHS[match[2] ?? ""];
  if (month === undefined) {
    return undefined;
  }

  const millisecond = Number(((match[7] ?? "0") + "000").slice(0, 3));
  const iso = new Date(
    Date.UTC(
      Number(match[3]),
      month,
      Number(match[1]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
      millisecond,
    ),
  ).toISOString();

  return iso.endsWith("Z") ? iso : undefined;
}

export function parseBindQueryLine(line: string): ParsedBindQuery | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const match = BIND_QUERY_LINE.exec(trimmed);
  if (!match) {
    return undefined;
  }

  const timestamp = bindTimestampToIsoUtc(match[1] ?? "");
  const clientIp = match[8] ?? "";
  const qname = (match[11] ?? "").replace(/\.$/, "");
  const qtype = normalizeQtype(match[13] ?? "");
  const resolver = match[15]?.trim();

  if (!timestamp || clientIp.length === 0 || qname.length === 0 || qtype.length === 0) {
    return undefined;
  }

  return {
    timestamp,
    clientIp,
    clientPort: Number(match[9]),
    qname,
    qclass: match[12] ?? "",
    qtype,
    flags: match[14] ?? "",
    ...(resolver ? { resolverId: resolver } : {}),
  };
}
