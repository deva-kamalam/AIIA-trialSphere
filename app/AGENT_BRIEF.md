# Brief for page-building agents

Project: AIIA Clinical Trials Dashboard, a CTMS for Ayurveda clinical research.
Full product spec: `D:\Office\ClaudeZone\lohita\prompt.txt` (read the sections for your pages).
Plan + design tokens: `D:\Office\ClaudeZone\lohita\PLAN.md`.

## Hard rules
- Only create or edit the files you were assigned (your page files under `src/pages/`, plus
  an optional folder `src/pages/<yourarea>/` for page-local components). **Do not edit** anything
  in `src/components`, `src/services`, `src/data`, `src/types`, `src/auth`, `src/lib`, `App.tsx`,
  or another agent's pages. If you need something that doesn't exist, build it locally in your folder.
- Each page file must `export default` its page component (already stubbed; replace the stub).
- Fetch data only via services in `src/services` (`useAsync` from `@/lib/hooks`). Mutations go
  through the service functions (they also write the audit log). Don't import `@/data/seed` in pages
  except for `TODAY` and static lists like `USERS`/`SITES` names if truly needed for dropdowns.
- TypeScript strict, `verbatimModuleSyntax` (use `import type` for types), no enums,
  `noUnusedLocals`. Path alias `@/` = `src/`.
- When done run `npx tsc -b` from `D:\Office\ClaudeZone\lohita\app` and fix every error in **your**
  files. If errors are in other agents' files, ignore them. Don't run `npm run dev`/build.

## Toolkit (read these files before writing)
- `src/components/ui/primitives.tsx`: Button, Badge, StatusBadge/toneFor, Panel, PageHeader, Kpi,
  Progress, MeterCell, Field, Input, Select, Textarea, RadioGroup, Skeleton, EmptyState, HealthDot, Mono
- `src/components/ui/overlays.tsx`: Modal, Drawer, Popover, useToast
- `src/components/ui/data.tsx`: Table/THead/Th/SortTh/Td/Tr, Pager, Tabs, Segmented, FilterBar,
  SearchInput, FilterSelect, ClearFilters
- `src/components/charts/theme.tsx`: colours `C`, `SERIES`, `axisProps`, `gridProps`, `ChartTooltip`,
  `Legend`. Use Recharts (`recharts` v3) with these. Wrap charts in `ResponsiveContainer` with a fixed height.
- `src/lib/hooks.ts`: useAsync, useSort, usePaged. `src/lib/format.ts`: fmtDate, fmtShort, fmtNum,
  pct, relDue, daysFromToday, ago, cx.
- `src/auth/AuthContext.tsx`: `useAuth()` → `{ user, can(perm) }`. Permissions in `src/auth/permissions.ts`.
  Hide/disable edit actions when the role lacks the permission (e.g. `can('studies:create')`).
- Types: `src/types/index.ts`. Services: `src/services/*.ts`.
- `lucide-react` for icons. `date-fns` for dates. `react-router-dom` v7 (`Link`, `useNavigate`,
  `useParams`, `useSearchParams`). Read query params the global search links use (e.g. `/safety?event=AE-00121`,
  `/visits?q=…&status=Overdue`, `/documents?q=…`, `/studies?pi=…`, `/sites?site=S01`).

## Visual language (follow exactly)
- Light UI. Navy `ink` for primary; `ok` (teal) = complete/on track; `warn` (amber) = attention;
  `crit` (red) = overdue/critical; `info` (blue) = informational. Use the Tailwind tokens
  (`text-ink`, `bg-ok-soft`, `border-line`, `text-muted`, `text-faint`, `bg-canvas`…), never raw hex in JSX
  except via `C` in charts.
- Panels are bordered (`border-line`), no drop shadows, radius 8px. Tables are dense (13.5px).
- Sentence case everywhere. **No ALL-CAPS labels, no eyebrow labels above headings, no "→" appended to
  buttons/links, no "A · B · C" middle-dot meta strings** (use commas or separate elements).
  Numbered markers only for real sequences (lifecycles, workflows).
- Monospace (`<Mono>`) only for real codes: study IDs, participant IDs, event IDs, document IDs.
- Interactions must work: filtering, sorting, tabs, modals, expandable rows, validation, toasts after mutations
  (toast wording matches the button: "Save draft" → "Draft saved").
- Copy claims guardrails: never say HIPAA/GCP certified/government approved; never call the audit trail
  "immutable" or "tamper-proof"; mark CDISC/FHIR mappings as conceptual; regulatory requirements are
  configured per study, never assumed.
- Responsive: desktop first, tables scroll horizontally on tablet (Table component already does), grids
  collapse (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4` etc.).
- Pages start with `<PageHeader title subtitle actions />`. Loading states use `Skeleton`.
