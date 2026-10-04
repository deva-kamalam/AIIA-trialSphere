# AIIA Clinical Trials Dashboard

A clinical trial management system (CTMS) frontend for Ayurveda clinical research at AIIA.
Built with React 19, TypeScript, Vite, Tailwind CSS v4 and Recharts. All data is fictional
and served by an in-browser mock API.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

Sign in with any demo account on the login screen (password `research2026`). Switch role at any
time from the user menu (top right) to see role-based dashboards and permission-denied states.
Press **Ctrl + K** (or `/`) anywhere for global search.

## Demo data and persistence

Changes made in the app (new studies, screened participants, adverse events, uploads, eCRF
entries and signatures, visit updates, IEC decisions, audit entries, notification read state)
are saved to this browser's localStorage by `services/store.ts` and restored on reload. Saved
changes are discarded at the start of a new day, because the sample data is generated relative
to today's date. **Settings > Data & integrations > Reset demo data** clears them immediately.

## Structure

```
src/
  types/        Domain models (Study, Participant, Visit, AdverseEvent, StudyDocument, AuditEvent…)
  data/seed.ts  Deterministic fictional data. Portfolio KPIs are derived from these records.
  services/     Mock API layer. api.ts is the transport; swap `request()` for fetch to go live.
                store.ts persists demo changes in the browser (remove it with a real backend).
  auth/         AuthContext (login, demo role switch, 15-min idle timeout), roles & permissions
  components/
    ui/         Buttons, badges, panels, tables, tabs, modals, drawers, form fields, toasts
    layout/     App shell, sidebar, top bar, global search, notifications, route guards
    charts/     Shared chart palette and tooltip
  pages/        One file per module (Dashboard, Studies, StudyWorkspace, Participants, …)
```

## Connecting a backend

Pages never touch `data/seed.ts` directly; they call `services/*`. To connect a real API:

1. Replace `request()` in `services/api.ts` with an authenticated `fetch` client.
2. Re-implement each service method against your endpoints, keeping the same return types.
3. Replace `auth/session.ts` with your identity provider's token handling and load roles
   from the server. Permission checks in `auth/permissions.ts` should also be enforced server-side.
4. Write audit events on the server; `recordAudit` in `services/audit.ts` is a client-side stand-in.
5. Delete `services/store.ts` and its `commit()` calls; the server becomes the source of truth.

## What this build does not claim

The audit trail is client-side in this demo and is not tamper-evident. CDISC/FHIR mappings
are a conceptual reference. Regulatory requirements are configured per study. No compliance
certification is implied.
