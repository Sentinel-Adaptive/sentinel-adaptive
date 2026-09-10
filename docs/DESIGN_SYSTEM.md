# Design System

## Product character

Sentinel Adaptive is a desktop-first operator interface for network and SOC workflows. It should feel calm, precise, trustworthy, technical, and information-dense without crowding.

## Color tokens

These are project design choices, not official Ovnicom brand values.

```css
--background: #f7f7f5;
--surface: #ffffff;
--surface-subtle: #f1f1ee;
--foreground: #111111;
--muted-foreground: #656565;
--border: #dfdfda;
--brand: #f15a2a;
--brand-foreground: #ffffff;
--success: #177245;
--warning: #a86500;
--danger: #b42318;
--info: #315e7d;
```

Orange represents product identity and action. Red is reserved for danger.

## Typography and layout

- Use a locally bundled open professional sans such as IBM Plex Sans (`@fontsource/ibm-plex-sans` in `apps/web`).
- Use tabular numerals for metrics.
- Design for 1440 by 900 and preserve the judged flow at 1280 by 720.
- Use a charcoal sidebar, off-white main canvas, restrained radii, subtle one-pixel borders, and little or no shadow.
- Establish hierarchy through typography, spacing, alignment, and contrast.

## Operational components

- Prefer tables and evidence rows for incidents and metrics.
- Every chart must answer an operator question.
- Use semantic status colors consistently and never rely on color alone.
- Keep keyboard focus visible and controls reachable.
- Incident Detail must expose current value, site baseline, deviation, interpretation, affected entities, QVAC assessment, uncertainty, and Wazuh status.

## Avoid

No default gradients, glassmorphism, neon glow, fake terminals, hacker motifs, robot or brain imagery, sparkles, decorative charts, giant product headings, excessive pills, excessive shadows, or fake values.
