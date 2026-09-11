# Sentinel Adaptive — Project Rules

Hackathon entry for **Track 04 — Ovnicom "Sentinel-DNS"** and **Track 03 — Sovereign Intelligence at the Edge**. Full briefs: `.devin/rules/track-04.md`, `.devin/rules/track-03.md`, and the distilled competition T&Cs in `.devin/rules/hackathon-terms.md`.

## Submission (hard rules)

- **Deadline Sep 11 08:00 Panama (UTC-5). No extension; the platform auto-closes.**
- Deliverables: jury-accessible repo + **demo video ≤ 5 min, in Spanish**, link accessible without credentials. The video is reviewed first.
- All preexisting code must be declared in the README (see `docs/PREEXISTING.md`) — omission disqualifies.
- The substantial product must be built inside the 48h window (Sep 9 08:00 → Sep 11 08:00).
- Prizes are accumulable: one submission competes for the general podium AND corporate challenges.

## Track 03 constraints (sovereign edge)

- **Built on the QVAC SDK** (qvac.tether.io), preferably with QVAC-provided models.
- **Cloud inference = instant disqualification.** Routing inference to a cloud API disqualifies outright. Cloud use for non-inference functions (e.g. hosting a UI) is allowed.
- **Pears is bonus, not required.** Peer-to-peer communication/inference delegation via Pears scores extra; fully on-device competes equally.
- **Declare all preexisting work in the README** — omitting it disqualifies. See `docs/PREEXISTING.md`.
- **Deliverables:** jury-accessible repo (through the whole evaluation period) + demo video ≤ 5 min with a credential-free link — the video is the first thing judges review. Due Sep 11 08:00 Panama time.
- **Evaluation:** Technical 35%, Innovation 25%, Impact 20%, Design 10%, Completion 10%. Single ranking; ties break on Technical, then Impact, then jury-president vote.

## Track 04 constraints (Ovnicom Sentinel-DNS)

- **Local inference only.** All inference runs on-device / on the local server via QVAC. No DNS query or derived data may go to a cloud inference endpoint — no exceptions.
- **Read-only consumer.** The agent reads from the DNS telemetry event bus without modifying the production pipeline.
- **Wazuh output.** Threat alerts (DGA, typosquatting, DNS tunneling, C2 beaconing) must reach Wazuh in a SIEM-processable format via webhook or local API.
- **Operator-readable QoE.** Experience score per zone/PoP — from resolution latency, NXDOMAIN rate, and saturation signals — written to ClickHouse, visualized in Grafana per site/zone. Must be interpretable by a network operator.
- **Synthetic data only.** Inputs are generated datasets (public DGA lists, simulated normal traffic, fictional zones). No real client data. Lightweight model + rules is fine; training from scratch is not required.
- **Deliverables:** jury-accessible repo + demo video ≤ 5 min, due Sep 11 08:00.

## What judges verify

- Threat classification runs on the live stream, not a static file.
- Alerts arrive at Wazuh in a processable format.
- The QoE score is interpretable by a network operator.
- It is verifiable that no data leaves the infrastructure.

## Simulation tooling

The `/simulation` page in the operator UI can replay the Ovnicom challenge logs, inject labeled synthetic attack scenarios, or mix both into the live Kafka stream. Use it to demonstrate classification on realistic background traffic plus controlled attack bursts. The CLI equivalents remain: `npm run ovnicom:replay` and `npm run demo:*`.
