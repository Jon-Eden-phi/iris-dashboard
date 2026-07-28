# Iris Dashboard — Claude Code Instructions

## Project overview
Angular 22 SPA for SimplyPhi's internal property-transaction platform (Iris 2.0). Multi-role dashboard covering Acquisitions, Transactions, Legal, Client, Investor, and Investment Committee workflows.

Deployed at: https://iris-dashboard-eta.vercel.app  
GitHub: https://github.com/aryansimplyphi/iris-dashboard

## Run & build
```bash
npm install
npm start          # dev server on http://localhost:4200
npm run build      # production build → dist/iris-dashboard/browser/
ng test            # Karma unit tests (minimal coverage currently)
```

## Key conventions

### Angular style
- **Standalone components only** — no NgModules
- **Signals everywhere** — `signal()`, `computed()`, `effect()`. No RxJS Observables in components
- All services are `@Injectable({ providedIn: 'root' })`
- Template files use the new `@if` / `@for` control flow (not `*ngIf` / `*ngFor`)
- No comments unless the WHY is non-obvious

### Data layer (current state)
Everything persists to **localStorage**. Supabase is wired up (`src/app/services/supabase.ts`, `src/environments/environment.ts`) but no service has been migrated yet — all reads/writes still go through the localStorage services listed below.

### Services
| File | Responsibility | Storage key prefix |
|------|---------------|--------------------|
| `auth.ts` | Users, login, seed accounts | `iris-users-v1` |
| `companies.ts` | Company registry | `iris-companies-v1` |
| `projects.ts` | Project registry | `iris-projects-v1` |
| `invites.ts` | Pending invite tokens | `iris-invites-v1` |
| `mock-data.ts` | All property/pipeline data | multiple |
| `decisions.ts` | Investor/IC decision state | `iris_viewing_decisions` etc. |
| `data-room.ts` | Document upload store | `iris-data-room-v1` |
| `supabase.ts` | Supabase client wrapper (unused) | — |

### Investor/IC decision gating
`DecisionsService.isDecisionRequired(projectId, key)` is the single source of truth for whether a decision gate is active. Call this before blocking any stage transition. See `docs/decision-log.md` for the full business rules.

### Routing / role guards
- `authGuard` — must be logged in
- `internalGuard` — redirects external roles (Investor, IC, Client, Legal) to their own portal
- `sourcingGuard` / `purchasingGuard` — separates Sourcing and Purchasing internal teams

### Vercel deployment
`generate-env.js` runs before `ng build` and writes `src/environments/environment.ts` from `NG_APP_SUPABASE_URL` and `NG_APP_SUPABASE_ANON_KEY` env vars. These are set in Vercel dashboard. The file is gitignored locally — set real values there manually.

## Seed accounts (localStorage — reset by clearing browser storage)
| Email | Password | Role |
|-------|----------|------|
| aryan@simplyphi.co.uk | simplyphi24 | Admin Controller |
| demo@simplyphi.co.uk | demo1234 | Sourcing |
| jiya@simplyphi.co.uk | tx24 | Purchasing |
| marcus@simplyphi.co.uk | tx24 | Purchasing |
| s.jones@bristol.gov.uk | bristol24 | Client (Bristol P3) |
| hayley@winksherwood.co.uk | legal24 | Legal Provider |
| ic@simplyphi.co.uk | ic2024 | Investment Committee (Bristol P3) |

## Things to watch out for
- `investor-portal.ts` and `ic-portal.ts` each have their own copy of localStorage signal state. They do **not** use `DecisionsService` signals — they have inline signals. This is a known duplication to fix when migrating to Supabase.
- `mock-data.ts` is large (~1500 lines). Property data is in the top section; detailed per-property objects (viewing, financial, activity) are in a separate `propertyDetails` map further down.
- The `IrisUser.password` field is plaintext in localStorage — acceptable for the current mock-data phase, must be removed when Supabase auth is wired.
- Adding a new property type or stage requires updating both `mock-data.ts` (the raw property list) and `record.ts` / `transactions-portal.ts` (stage arrays and guards).
