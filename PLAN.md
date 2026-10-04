# AIIA Clinical Trials Dashboard — build plan

Source brief: `prompt.txt`. Frontend-only for now; every data call goes through `src/services/*`
(async mock API) so a real backend can replace it without touching pages.

## Stack
Vite + React 19 + TypeScript, Tailwind CSS v4, React Router, Recharts, lucide-react, date-fns.

## Design tokens
| Token | Hex | Use |
|---|---|---|
| ink (navy) | `#0F2747` | sidebar, primary buttons, headings |
| ink-2 | `#1E3A64` | hover / secondary navy |
| canvas | `#F5F7FA` | app background |
| line | `#E3E8EF` | borders, table rules |
| teal | `#0E8A7E` | complete / on track / positive |
| amber | `#B7791F` | attention / warning |
| red | `#C2410C`→`#B42318` | critical / overdue |
| sky | `#2F6FB2` | info, chart series 2 |

Type: **IBM Plex Sans** for UI (technical, institutional, good tabular figures);
**IBM Plex Mono** only for genuine codes (study IDs, participant IDs, event IDs).
Radius: 6px controls, 8px panels — deliberately not pill-rounded. Shadows: none on panels,
borders do the separation; one subtle shadow for overlays only.

Signature element: the **Trial Health matrix** on the overview — one row per study, six
operational signals (recruitment, data completion, deviations, safety reporting, regulatory,
documents) as coloured cells, rolling up to an overall status. That's where the boldness goes;
everything else stays quiet.

## Architecture
```
src/
  types/        domain models (Study, Participant, Visit, AdverseEvent, Document, AuditEvent…)
  data/         deterministic fictional seed data
  services/     api.ts (latency wrapper) + per-domain services
  auth/         AuthContext, roles, permissions, session timeout
  components/   ui/ (Badge, Button, Card, Table, Tabs, Modal, Select…), layout/, charts/
  pages/        one folder per module
```

## Scope (all routed and functional)
Login · Dashboard (5 role views) · Studies + New Study wizard · Study Workspace · Participants ·
Participant Profile (8 tabs + timeline) · Sites · Visits (calendar + table) · eCRF (validation) ·
Ethics & Regulatory (per-study applicability config) · Safety & PV (+ Report AE workflow) ·
Documents (upload UI + version history) · Analytics (filters, 8 charts) · Data Standards ·
Audit Trail · Settings · Notification centre · Global search (Ctrl+K) · Permission-denied states.

## Claims guardrails (from brief)
No "HIPAA/GCP/government approved"; audit trail not described as immutable; data-standards
page labelled conceptual; regulations configurable per study, never assumed.
