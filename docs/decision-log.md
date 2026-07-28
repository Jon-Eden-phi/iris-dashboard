# Decision Log

Decisions made during development that affect how the system behaves and why. Read this before changing anything in the investor/IC flow, pipeline gating, or user/company model.

---

## DEC-001 — Investor as a flag on Purchaser companies, not a separate role

**Date:** July 2026  
**Status:** Implemented

**Decision:** `isInvestor?: boolean` is a flag on `IrisCompany` (shown only when `companyRole === 'Purchaser'`). "Investor" is not a company role in its own right.

**Why:** An investor is always a type of purchaser — they are funding the acquisition on behalf of the council. Making it a separate company role meant duplication in the role list and broke downstream logic that assumed every deal has exactly one Purchaser-type company. The flag keeps the data model clean.

**Impact:**
- `IrisCompany.companyRole` never equals `'Investor'`
- To check if a company is an investor, use `company.isInvestor === true`
- The invite modal derives the `Investor` user role from `company.isInvestor`, not from `companyRole`
- The pipeline's investor-deal selector filters companies by `isInvestor === true`

---

## DEC-002 — Investor deal is a project-level flag, not property-level

**Date:** July 2026  
**Status:** Implemented

**Decision:** `IrisProject.isInvestorDeal?: boolean` flags the whole project. Individual properties inherit investor-deal status from their project (`property.phase` → project name lookup).

**Why:** In practice, if a project is investor-backed all properties in it are subject to investor oversight. Property-level flags would require per-property configuration with no real use case for mixed projects.

**Impact:**
- All pipeline gate checks look up the project via `property.phase` before checking `isInvestorDeal`
- `investorCompany?: string` (company name) is also stored on the project

---

## DEC-003 — Six decision steps; IC covers what the investor doesn't

**Date:** July 2026  
**Status:** Implemented

**The six steps (in order):**
1. `viewing_review` — Approve or reject at viewing stage
2. `max_price_auth` — Set the maximum bid price before making an offer
3. `rot_approval` — Approve the solicitor's final Report on Title
4. `contract_sign` — Sign electronically to authorise exchange
5. `compl_statement_appr` — Review and approve the completion statement
6. `funds_confirmation` — Confirm funds have been sent to the solicitor

**Decision:** When creating an investor account, an admin selects which of these 6 steps the investor personally handles. The Investment Committee (IC) automatically handles everything the investor did not opt into. This means every decision is always covered by exactly one party.

**Why:** Some investors want to be hands-off (delegate everything to IC) and some want full visibility. The opt-in model gives each investor control without requiring the IC to duplicate work.

**Implementation:** `IrisUser.investorDecisions?: InvestorDecisionKey[]` stores the investor's opted-in steps. `DecisionsService.isDecisionRequired(projectId, key)` resolves which party is responsible.

---

## DEC-004 — Pipeline gating: three hard gates for investor deals

**Date:** July 2026  
**Status:** Implemented

**Decision:** Three stage transitions are hard-blocked for investor-deal projects until the relevant decision is recorded:

| Transition | Blocking decision | Enforced in |
|-----------|------------------|-------------|
| Viewing → Negotiations | `viewing_review` approved | `client-portal.ts: approveViewing()` |
| Negotiations → MoS (offer accepted) | `max_price_auth` set | `record.ts: resolveOffer()` |
| Legals → Refurbishment | `contract_sign` recorded | `record.ts: advance()` and `transactions-portal.ts: advanceStage()` |

**Why:** These three are the points in the process where an investor materially affects the deal outcome — approving a property to proceed, capping what can be paid, and authorising legal completion. Other decisions (RoT approval, completion statement, funds confirmation) are informational gates within a stage, not stage-advance gates.

**Important:** A gate only fires if `DecisionsService.isDecisionRequired(projectId, key)` returns true. That method checks whether an investor or IC user is actually assigned to the project and responsible for that key. If no investor or IC user is linked, the gate is skipped entirely — even if the project is flagged `isInvestorDeal`.

---

## DEC-005 — Sequential decision ordering with implicit completion

**Date:** July 2026  
**Status:** Implemented

**Decision:** Decisions unlock sequentially within a portal. A decision is only "live" (actionable) once all prior steps are done. Additionally, if a *later* decision is recorded, all earlier ones are treated as implicitly done — they appear as completed even if never explicitly actioned.

**DECISION_ORDER:**
```
viewing_review → max_price_auth → rot_approval → contract_sign → compl_statement_appr → funds_confirmation
```

**Why:** The sequential unlock prevents the UI from overwhelming the user with all 6 decisions at once when a property first appears. The implicit completion rule handles real-world cases where early steps were skipped or verbally agreed — if funds have been transferred, it makes no sense to show max_price_auth as still pending.

**Implementation:** `_isDirectlyDone()` checks only the explicit record. `isDecisionDone()` returns true if `_isDirectlyDone` OR if any later step in `DECISION_ORDER` is directly done. `isDecisionLive()` gates visibility and requires the prior step to be `_isDirectlyDone` (not just implicitly done).

---

## DEC-006 — localStorage as current data layer; backend TBD

**Date:** July 2026  
**Status:** Active — no backend chosen

**Decision:** All data persists to localStorage for now. The app was built to validate product design quickly without backend overhead. Backend selection is deferred until the product is further along.

**What this means for the next developer:**
- All data is browser-local and clears with browser storage
- No data is shared between users or devices
- Passwords are plaintext in localStorage — not suitable for real users
- The data model is clean and relational; it will map well to any Postgres-compatible backend when the time comes

**Recommended migration order when ready:** Auth → Companies → Projects → Properties → Invites → Decisions

---

## DEC-007 — Naming convention: match Angular app, not generic DB conventions

**Date:** July 2026  
**Status:** Standing rule

**Decision:** All Supabase table and column names must match the field names in the Angular services exactly. Do not rename fields to snake_case or pluralise differently when creating DB tables.

**Why:** The original instruction was "keep that in mind for everything to come, want nothing to change" — the Angular app should not need to be rewritten to accommodate a DB naming convention change.

---

## DEC-008 — Purchasing-role users go directly to Transactions Portal

**Date:** Earlier in project  
**Status:** Implemented

**Decision:** Users with role `Purchasing` are routed directly to `/transactions-portal` on login and cannot access the sourcing pipeline. Sourcing-role users are blocked from `/transactions-portal`.

**Why:** The two internal teams (Sourcing and Purchasing/Transactions) have completely different workflows with no overlap in their day-to-day use. Keeping them in separate portals reduces UI noise.

**Implementation:** `sourcingGuard` and `purchasingGuard` in `app.routes.ts`.
