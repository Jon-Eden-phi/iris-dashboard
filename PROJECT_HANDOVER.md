# Iris 2.0 — Project Handover

**Date:** July 2026  
**Client:** SimplyPhi (UK PropTech)  
**Handed over by:** Aryan  
**Deployed at:** https://iris-dashboard-eta.vercel.app  
**Repo:** https://github.com/aryansimplyphi/iris-dashboard

---

## 1. What the project does

Iris 2.0 is SimplyPhi's internal property-transaction platform. SimplyPhi sources residential properties on behalf of housing authorities (councils, housing associations) and manages the full journey from sourcing through to lettings.

The dashboard serves six distinct user types, each with their own portal:

| Role | Portal | What they do |
|------|--------|-------------|
| Sourcing (SimplyPhi) | Pipeline / Record | Find and assess properties, progress them through acquisitions stages |
| Purchasing (SimplyPhi) | Transactions Portal | Manage conveyancing, surveys, completion, lettings |
| Admin Controller (SimplyPhi) | All of the above + admin | Full access, user/company/project management |
| Investment Committee (SimplyPhi) | IC Portal | Make decisions on investor-backed deals |
| Client (council/HA) | Client Portal | Approve/reject properties at viewing stage |
| Legal Provider (solicitor) | Legal Portal | Manage conveyancing documents, RoT, exchange |
| Investor | Investor Portal | Approve decisions on deals they are funding |

### Property state machine
Properties travel through 8 stages split across two departments:

```
Acquisitions:   Draft → ClientApproval → Viewing → Negotiations → MemorandumOfSale
Transactions:   MemorandumOfSale → Legals → Refurbishment → Lettings
```

The `record` view (acquisitions) and `transactions-portal` view each own their half of the pipeline.

---

## 2. Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Angular 22, standalone components, signals |
| Styling | Custom CSS with design tokens, Tabler Icons |
| Data (current) | localStorage — all data is browser-local |
| Data (intended) | Supabase (Postgres + Auth) — partially set up, not yet wired |
| Deployment | Vercel (auto-deploy from GitHub `main`) |
| Environment | `generate-env.js` pre-build script writes `environment.ts` from Vercel env vars |

---

## 3. Architecture and key files

```
src/app/
├── services/
│   ├── auth.ts           User model, login, role types, seed accounts
│   ├── mock-data.ts      All property data (pipeline, TX, lost)
│   ├── companies.ts      Company registry
│   ├── projects.ts       Project registry (Bristol P3, Merton LAHF, etc.)
│   ├── invites.ts        Pending invite tokens for onboarding flow
│   ├── decisions.ts      Investor/IC decision state + pipeline gating logic
│   ├── data-room.ts      Document upload store
│   └── supabase.ts       Supabase client wrapper (wired up, not yet used)
├── views/
│   ├── pipeline/         Acquisitions dashboard + kanban board
│   ├── record/           Individual property record (acquisitions team)
│   ├── transactions-portal/  Full TX team portal (~1500 lines)
│   ├── legal-portal/     Conveyancer portal
│   ├── client-portal/    Housing authority portal
│   ├── investor-portal/  Investor decisions
│   ├── ic-portal/        Investment Committee decisions
│   ├── users/            User management (admin only)
│   ├── companies/        Company registry management
│   ├── projects/         Project management
│   ├── social-impact/    Social value reporting dashboard
│   ├── insights/         Analytics and charts
│   ├── map/              Property map view
│   ├── agents/           Estate agent directory
│   ├── lost/             Lost/withdrawn properties
│   ├── login/            Login screen
│   └── setup/            New user onboarding (invite token flow)
├── app.routes.ts         Route definitions + role-based guards
└── shared/pipes/         MoneyPipe and other shared pipes
```

### Key data models (`src/app/services/`)
- **`IrisUser`** — `{ id, email, name, role: UserRole, isAdmin, password, projects?, investorDecisions?, organisation? }`
- **`IrisCompany`** — `{ id, name, address, companyRole, functionArea?, isInvestor? }`
- **`IrisProject`** — `{ id, name, purchaser, isInvestorDeal?, investorCompany? }`
- **`Property`** — in `mock-data.ts` / `property.model.ts` — `{ id, address, postcode, phase, stage, beds, type, epcBefore, financial, status, ... }`
- **`InvestorDecisionKey`** — union type in `auth.ts` — the 6 decision steps an investor/IC can be assigned

---

## 4. Changes made (this engagement)

### Investor deal infrastructure
- Added `isInvestorDeal?: boolean` and `investorCompany?: string` to `IrisProject`
- Added `isInvestor?: boolean` to `IrisCompany` (replaces the old `companyRole === 'Investor'` pattern — Investor is now a flag on a Purchaser company, not a separate role)
- Investor company selector in project add/edit modal (shown when toggle is on)
- Investor badge in companies table; investor deal badge in projects table

### Investor & IC portals
- Built both portals with a 6-step decision checklist per property
- Each investor user has `investorDecisions: InvestorDecisionKey[]` — the steps they opted into when their account was set up
- IC automatically covers every decision the investor did not opt into
- Sequential gating: each decision only becomes actionable once the prior one in `DECISION_ORDER` is completed. If a later decision is done, earlier ones are implicitly treated as done
- Fixed invite modal role detection to use `company.isInvestor` instead of `companyRole === 'Investor'`

### Pipeline gating
- `DecisionsService` (`src/app/services/decisions.ts`) — shared service that owns all decision localStorage state and exposes `isDecisionRequired(projectId, key)`
- Three stage gates for investor-deal projects:
  - **Viewing → Negotiations**: client portal `approveViewing()` blocked if investor/IC hasn't approved viewing review
  - **Negotiations → MoS (offer accept)**: `resolveOffer()` in `record.ts` blocked if max price not authorised
  - **Legals → Refurbishment**: `advance()` in `record.ts` and `advanceStage()` in `transactions-portal.ts` blocked if contract not signed
- Amber blocker banner shown in the acquisitions record view when a gate is active
- Gate fires only if an investor or IC user is actually assigned to the project AND responsible for that specific decision

### Supabase setup (partial — not wired in yet)
- `@supabase/supabase-js` installed
- `SupabaseService` created
- `generate-env.js` pre-build script writes `environment.ts` from Vercel env vars (`NG_APP_SUPABASE_URL`, `NG_APP_SUPABASE_ANON_KEY`)
- `vercel.json` updated with correct output directory and SPA rewrite rule
- Supabase project created, DB tables created in SQL Editor
- All services still read/write localStorage — migration not started

### Seed data
- Added IC seed user: `ic@simplyphi.co.uk` / `ic2024` (Investment Committee, Bristol P3)
- Added two new Draft properties to Bristol P3: 19 Kingsdown Parade BS6 and 4 Birchwood Road BS4

---

## 5. Outstanding tasks

### High priority
1. **Supabase migration** — replace each localStorage service with Supabase client calls, starting with `auth.ts` (use Supabase Auth), then `companies`, `projects`, `mock-data` (properties), `invites`, `decisions`. Set up Row Level Security on each table.
2. **Investor/IC portal signals** — `investor-portal.ts` and `ic-portal.ts` each have their own inline localStorage signals duplicating `DecisionsService`. Refactor them to inject and use `DecisionsService` signals so all portals stay in sync.
3. **Real property data** — `mock-data.ts` contains placeholder properties. Replace with real SimplyPhi pipeline data once Supabase is live.

### Medium priority
4. **Decision status on pipeline cards** — show a "Pending investor decision" badge on property cards in the pipeline view when a gate is blocking
5. **Transactions portal** — surface max price authorisation and completion statement link in the TX record view
6. **Legal portal** — show RoT approval and contract sign status from `DecisionsService` so the legal team can see what's pending
7. **Invite flow UX** — the invite link currently generates a token stored in localStorage; this needs to become a real email send (Supabase transactional email or Resend)

### Lower priority
8. **Operations portal** — not yet built. Covers the post-completion phase (check-in, repairs, lettings management). The UX spec exists in the HTML template files from the design phase
9. **Role-based feature restrictions** — currently only Admin vs non-Admin is enforced at the data level. Finer-grained restrictions (e.g. Finance can only see financial data) are not yet implemented
10. **Passwordless auth** — `IrisUser.password` is plaintext in localStorage. Must be replaced with Supabase Auth before any real users are onboarded

---

## 6. Known issues

| Issue | Where | Detail |
|-------|-------|--------|
| Decision signals don't auto-sync | `investor-portal.ts`, `ic-portal.ts` | Both portals load localStorage into their own signals on mount. If decisions are made in one portal tab and you switch to another, data is stale until the page reloads. Fix: inject `DecisionsService` and use its signals |
| `isDone()` TypeScript warning | `decisions.ts:27` | Switch statement has no default branch — TypeScript may warn about implicit return in strict mode |
| `canAdvance()` Viewing stage | `record.ts` | `advanceBlocker` returns a message for Viewing stage but the advance button is already hidden for Viewing (client-controlled). The banner is still useful but `canAdvance()` returning false for Viewing is redundant |
| localStorage cleared = all data lost | All | No persistence across devices or after browser storage clear. Blocked on Supabase migration |
| No email delivery | `users.ts` | Invite links are generated but displayed on screen (copy-paste). No actual email is sent |

---

## 7. Setup

### Local development
```bash
git clone https://github.com/aryansimplyphi/iris-dashboard
cd iris-dashboard
npm install
```

Create `src/environments/environment.ts` with your Supabase credentials:
```ts
export const environment = {
  production: false,
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseKey: 'YOUR_SUPABASE_ANON_KEY',
};
```

```bash
npm start   # http://localhost:4200
```

### Build
```bash
npm run build   # output in dist/iris-dashboard/browser/
```

### Tests
```bash
ng test   # Karma — minimal test coverage currently
```

### Vercel deployment
Push to `main` → Vercel auto-deploys. The build command in `vercel.json` is:
```
node generate-env.js && npm run build
```
Required env vars in Vercel dashboard:
- `NG_APP_SUPABASE_URL`
- `NG_APP_SUPABASE_ANON_KEY`

---

## 8. Seed accounts

All accounts are seeded into localStorage on first load from `INITIAL_USERS` in `src/app/services/auth.ts`.

| Email | Password | Role | Projects |
|-------|----------|------|---------|
| aryan@simplyphi.co.uk | simplyphi24 | Admin Controller | All |
| demo@simplyphi.co.uk | demo1234 | Sourcing | — |
| jiya@simplyphi.co.uk | tx24 | Purchasing | — |
| marcus@simplyphi.co.uk | tx24 | Purchasing | — |
| carol@simplyphi.co.uk | simplyphi24 | Sourcing | — |
| hayley@winksherwood.co.uk | legal24 | Legal Provider | Bristol P3, Hastings ESPH |
| s.jones@bristol.gov.uk | bristol24 | Client | Bristol P3 |
| ic@simplyphi.co.uk | ic2024 | Investment Committee | Bristol P3 |

To add an investor user: log in as Admin, go to Users → Invite, select an Investor-flagged company, configure which of the 6 decision steps they want, assign to Bristol P3. They follow the invite link to set a password.
