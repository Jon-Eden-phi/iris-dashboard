import { Injectable, inject, signal } from '@angular/core';
import { ActivityNote, NoteLabel, Offer, Property, Stage, Viewing } from '../models/property.model';
import { SocialProject, Supplier } from '../models/social.model';
import { Agent } from '../models/agent.model';
import { DataRoomStore, DataRoomFile } from './data-room';

@Injectable({ providedIn: 'root' })
export class MockDataService {
  private drStore = inject(DataRoomStore);

  private readonly STORAGE_KEY = 'iris-props-v12';

  private _props = signal<Property[]>([
    // ── ACQ pipeline (mock) ──────────────────────────────────────────────────
    { id: 'm001', address: '14 Granby Hill',          postcode: 'BS8 4LS',  phase: 'Bristol P3',    stage: 'Draft',          beds: 3, type: 'End-terrace',    epcBefore: { r: 'E', s: 44 }, financial: { ap: 310000, capex: 35000, tc: 4800, sp: 780, yield: 5.1 }, status: 'active' },
    { id: 'm002', address: '7 Stapleton Road',        postcode: 'BS5 0QN',  phase: 'Bristol P3',    stage: 'ClientApproval', beds: 2, type: 'Flat',           epcBefore: { r: 'F', s: 33 }, financial: { ap: 185000, capex: 52000, tc: 3200, sp: 600, yield: 5.8 }, status: 'active' },
    { id: 'm003', address: '22 Whitehouse Street',    postcode: 'BS3 4HA',  phase: 'Bristol P3',    stage: 'Negotiations',   beds: 4, type: 'Semi-detached',  epcBefore: { r: 'D', s: 56 }, financial: { ap: 420000, capex: 25000, tc: 6200, sp: 1040, yield: 4.7 }, status: 'active' },
    { id: 'm004', address: '45 High Street, Merton',  postcode: 'SW19 1DE', phase: 'Merton LAHF',   stage: 'Viewing',        beds: 2, type: 'Flat',           epcBefore: { r: 'E', s: 43 }, financial: { ap: 340000, capex: 48000, tc: 5800, sp: 780, yield: 3.9 }, status: 'active' },
    { id: 'm005', address: '12 Morden Road',          postcode: 'CR4 4DG',  phase: 'Merton LAHF',   stage: 'Negotiations',   beds: 3, type: 'End-terrace',    epcBefore: { r: 'D', s: 55 }, financial: { ap: 385000, capex: 22000, tc: 5600, sp: 900, yield: 4.2 }, status: 'active' },
    { id: 'm006', address: '8 Ambra Vale East',       postcode: 'BS8 4RE',  phase: 'Bristol P3',    stage: 'Draft',          beds: 3, type: 'Mid-terrace',    epcBefore: { r: 'E', s: 42 }, financial: { ap: 295000, capex: 38000, tc: 4400, sp: 780, yield: 5.0 }, status: 'active' },
    { id: 'm007', address: '31 Claremont Road',       postcode: 'BS7 8DE',  phase: 'Bristol P3',    stage: 'Draft',          beds: 2, type: 'Flat',           epcBefore: { r: 'F', s: 31 }, financial: { ap: 210000, capex: 55000, tc: 3400, sp: 600, yield: 5.5 }, status: 'active' },

    // ── MemorandumOfSale (real) ──────────────────────────────────────────────
    { id: 'p001', address: '15 Hallards Close',       postcode: 'BS11 0JP', phase: 'Bristol P3',    stage: 'MemorandumOfSale', beds: 3, type: 'End-Terrace',   epcBefore: { r: 'E', s: 41 }, financial: { ap: 285000, capex: 38000, tc: 5200, yield: 5.4 }, agreedPrice: 280000, status: 'active' },
    { id: 'p002', address: 'GFF 22 Rock Lane',        postcode: 'TN35 4JN', phase: 'Hastings ESPH', stage: 'MemorandumOfSale', beds: 2, type: 'Ground Flat',   epcBefore: { r: 'D', s: 60 }, financial: { ap: 170000, capex: 65000, tc: 12680, yield: 3.62 },                    status: 'active' },
    { id: 'p003', address: '32 Orchard Avenue',       postcode: 'BS13 0FH', phase: 'Bristol P3',    stage: 'MemorandumOfSale', beds: 2, type: 'End-Terrace',   epcBefore: { r: 'B', s: 85 }, financial: { ap: 300000, capex: 28000, tc: 4800, yield: 5.1 }, agreedPrice: 297500, status: 'active' },

    // ── Legals (real) ────────────────────────────────────────────────────────
    { id: 'p004', address: '94 Middleton Road',       postcode: 'SM4 6RR',  phase: 'Merton LAHF',   stage: 'Legals',           beds: 3, type: 'Terraced',      epcBefore: { r: 'D', s: 64 }, financial: { ap: 475000, capex: 11000, tc: 5865, yield: 3.65, sp: 17951 }, agreedPrice: 461500, status: 'active', tenure: 'Freehold', bathrooms: 1, size: 87, daysOnMarket: 8, lha: 17951, marketRent: undefined, floodRisk: 'None', description: 'Three bedroom terraced house with lounge, dining room, kitchen, three bedrooms, bathroom, rear garden and driveway.', exLocalAuthority: false, ageOfProperty: '1950-1966', mainHeatDescription: 'Boiler and radiators, mains gas', gasSafeRegister: '2023-08-16', wallsDescription: 'Solid brick, as built, no insulation (assumed)', localAuthority: 'Merton', brma: 'Outer South London BRMA', ward: 'Pollards Hill', ccg: 'NHS South West London CCG', ndss: false, auction: false, newHome: false, builtYear: 'N/A', estateManagementCharges: 'N/A' },
    { id: 'p005', address: '120 Rye Road',            postcode: 'TN35 5DB', phase: 'Hastings ESPH', stage: 'Legals',           beds: 2, type: 'Flat',          epcBefore: { r: 'D', s: 67 }, financial: { ap: 210000, capex: 42000, tc: 13080, yield: 6.37 }, agreedPrice: 185000, status: 'active', legalsStartedAt: '2026-06-22' },

    // ── Refurbishment (real) ─────────────────────────────────────────────────
    { id: 'p006', address: '74 Avenue Road',          postcode: 'SW16 4HL', phase: 'Merton LAHF',   stage: 'Refurbishment',    beds: 3, type: 'Terraced',      epcBefore: { r: 'D', s: 57 }, financial: { ap: 475000, capex: 11000, tc: 5865, yield: 3.65 },                    status: 'active' },
    { id: 'p007', address: '148 Malvern Way',         postcode: 'TN34 3QG', phase: 'Hastings ESPH', stage: 'Refurbishment',    beds: 3, type: 'Terraced',      epcBefore: { r: 'D', s: 65 }, financial: { ap: 225000, capex: 72000, tc: 12874, yield: 5.2 }, agreedPrice: 210000, status: 'active' },
    { id: 'p008', address: '26 Dunster Road',         postcode: 'BS4 1BU',  phase: 'Bristol P3',    stage: 'Refurbishment',    beds: 3, type: 'Semi-Detached', epcBefore: { r: 'C', s: 70 }, financial: { ap: 290000, capex: 32000, tc: 5200, yield: 5.0 }, agreedPrice: 270000, status: 'active' },

    // ── Demo: fresh MoS properties to walk through TX flow ──────────────────
    { id: 'p011', address: '41 Ferndale Road', postcode: 'LS6 1AH', phase: 'Leeds P1', stage: 'MemorandumOfSale', beds: 3, type: 'Semi-Detached', epcBefore: { r: 'D', s: 62 }, financial: { ap: 235000, capex: 45000, tc: 8500, yield: 5.8 }, agreedPrice: 225000, status: 'active', tenure: 'Freehold', floodRisk: 'Low', daysOnMarket: 38, description: 'Three-bedroom semi-detached in Hyde Park, Leeds. Solid Victorian bay-fronted terrace. EPC D — target C via insulation and boiler upgrade. Strong rental demand from professionals and post-grads.' },
    { id: 'p012', address: '9 Cotham Hill',    postcode: 'BS6 6LD',  phase: 'Bristol P3', stage: 'MemorandumOfSale', beds: 3, type: 'Mid-Terrace',    epcBefore: { r: 'E', s: 45 }, financial: { ap: 320000, capex: 34000, tc: 5100, yield: 5.2 }, agreedPrice: 315000, status: 'active', tenure: 'Freehold', floodRisk: 'Low', daysOnMarket: 22, description: 'Three-bedroom mid-terrace in Cotham, Bristol. Well-maintained Victorian terrace with original features. EPC E — clear uplift path via loft insulation and boiler replacement.' },
    { id: 'p013', address: '52 Knowle Road',   postcode: 'BS4 2DX',  phase: 'Bristol P3', stage: 'MemorandumOfSale', beds: 2, type: 'End-Terrace',    epcBefore: { r: 'F', s: 32 }, financial: { ap: 220000, capex: 52000, tc: 4200, yield: 5.6 }, agreedPrice: 215000, status: 'active', tenure: 'Freehold', floodRisk: 'Low', daysOnMarket: 41, description: 'Two-bedroom end-terrace in Knowle, Bristol. Requires full insulation and heating upgrade to reach EPC C. Good rental demand in area — strong yield potential post-refurb.' },
    { id: 'p014', address: '18 Ashley Down Road', postcode: 'BS7 9JJ', phase: 'Bristol P3', stage: 'MemorandumOfSale', beds: 3, type: 'Semi-Detached', epcBefore: { r: 'E', s: 47 }, financial: { ap: 345000, capex: 30000, tc: 5400, yield: 5.0 }, agreedPrice: 338000, status: 'active', tenure: 'Freehold', floodRisk: 'Low', daysOnMarket: 18, description: 'Three-bedroom semi-detached in Ashley Down, Bristol. Bay-fronted Edwardian property with original features. EPC E — straightforward path to C via loft and cavity wall insulation. Popular residential street close to local amenities.' },
    { id: 'p015', address: '67 Wells Road',       postcode: 'BS4 2AE', phase: 'Bristol P3', stage: 'MemorandumOfSale', beds: 2, type: 'Mid-Terrace',   epcBefore: { r: 'D', s: 58 }, financial: { ap: 265000, capex: 42000, tc: 4600, yield: 5.3 }, agreedPrice: 260000, status: 'active', tenure: 'Freehold', floodRisk: 'Low', daysOnMarket: 29, description: 'Two-bedroom mid-terrace on Wells Road, Knowle, Bristol. Solid Victorian terrace in need of modernisation. EPC D — target C achievable via insulation upgrade and heat pump installation. Strong local letting market.' },
    { id: 'p016', address: '23 Chessel Street',   postcode: 'BS3 3DN', phase: 'Bristol P3', stage: 'MemorandumOfSale', beds: 3, type: 'Terraced',      epcBefore: { r: 'E', s: 49 }, financial: { ap: 305000, capex: 36000, tc: 5000, yield: 5.4 }, agreedPrice: 298000, status: 'active', tenure: 'Freehold', floodRisk: 'Low', daysOnMarket: 25, description: 'Three-bedroom terraced house in Bedminster, Bristol. Classic bay-fronted Victorian terrace close to North Street. EPC E — clear route to C via loft and cavity wall insulation plus a new boiler. Strong tenant demand in a popular, well-connected area.' },

    // ── Lettings / Exchange & Completion (real) ──────────────────────────────
    { id: 'p009', address: '26 Norton Farm Road',     postcode: 'BS10 7ER', phase: 'Bristol P3',    stage: 'Lettings',         beds: 3, type: 'Semi-Detached', epcBefore: { r: 'C', s: 75 }, epcAfter: { r: 'B', s: 84 }, financial: { ap: 335000, capex: 18000, tc: 4800, sp: 850, yield: 5.8 }, agreedPrice: 330000, status: 'active', isInvestorDeal: true, tenure: 'Freehold', lha: 12480, marketRent: 18000, floodRisk: 'Low', leaseRemaining: 'N/A', daysOnMarket: 62, description: 'Three-bedroom semi-detached property in Brentry, Bristol. Benefits from driveway parking, south-facing rear garden and recently upgraded kitchen. EPC C — target B post-refurb.', viewing: { agentName: 'Rachel Ford', agentCompany: 'Fox & Sons', agentEmail: 'r.ford@foxandsons.co.uk', agentPhone: '0117 902 5000', date: '2026-01-12', time: '10:00', attendee: 'Hannah Briggs', reportCondition: 'good', reportNotes: 'Three-bedroom semi in good structural order. Kitchen upgraded 2022. South-facing garden and driveway. EPC C — strong insulation baseline. Minimal refurb scope.' } },
    { id: 'p010', address: '44 Brendon Rise',         postcode: 'TN34 3QD', phase: 'Hastings ESPH', stage: 'Lettings',         beds: 3, type: 'House',         epcBefore: { r: 'F', s: 36 }, epcAfter: { r: 'C', s: 76 }, financial: { ap: 150000, capex: 48000, tc: 12584, sp: 680, yield: 4.8 }, agreedPrice: 150000, status: 'active', tenure: 'Leasehold', lha: 8736, marketRent: 10800, floodRisk: 'Very Low', leaseRemaining: '85 yrs', daysOnMarket: 91, description: 'Three-bedroom terraced house in Ore, Hastings. Requires significant improvement works to bring to EPC C — scope includes full insulation, new boiler and double glazing throughout.', viewing: { agentName: 'James Harlow', agentCompany: 'Jacobs', agentEmail: 'j.harlow@jacobs-ea.co.uk', agentPhone: '01424 421 200', reportCondition: 'fair' } },
    { id: 'p017', address: '14 Cotswold Road',        postcode: 'BS3 4NX',  phase: 'Bristol P3',    stage: 'Lettings',         beds: 3, type: 'Mid-Terrace',   epcBefore: { r: 'E', s: 46 }, epcAfter: { r: 'B', s: 83 }, financial: { ap: 315000, capex: 33000, tc: 5200, sp: 820, yield: 5.5 }, agreedPrice: 308000, status: 'active', tenure: 'Freehold', lha: 13200, marketRent: 16800, floodRisk: 'Low', leaseRemaining: 'N/A', daysOnMarket: 34, description: 'Three-bedroom mid-terrace in Windmill Hill, Bristol. Fully refurbished to EPC B — new boiler, full insulation and double glazing throughout. Now proceeding through exchange and completion. Strong tenant demand in this well-connected south Bristol location.', viewing: { agentName: 'Laura Bennett', agentCompany: 'CJ Hole · Bedminster', agentEmail: 'l.bennett@cjhole.co.uk', agentPhone: '0117 966 3311', date: '2026-02-05', time: '11:30', attendee: 'Hannah Briggs', reportCondition: 'good', reportNotes: 'Three-bedroom mid-terrace in good order following full refurbishment. New boiler, insulation and glazing throughout. EPC B. Move-in ready.' } },
  ]);
  get properties(): Property[] { return this._props(); }

  constructor() {
    // Load persisted state if available; otherwise seed demo data for first run
    const saved = this._loadFromStorage();
    if (saved) {
      this._props.set(saved);
    } else {
      this._seedDemoData();
    }
    this._backfillProperties();
    this._backfillDataRoom();

    // Sync across browser tabs — when one tab mutates, all others update instantly
    window.addEventListener('storage', e => {
      if (e.key === this.STORAGE_KEY && e.newValue) {
        try { this._props.set(JSON.parse(e.newValue)); } catch { /* ignore parse errors */ }
      }
    });
  }

  private _loadFromStorage(): Property[] | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Property[]) : null;
    } catch { return null; }
  }

  private _saveToStorage(): void {
    try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._props())); } catch { /* ignore */ }
  }

  private _seedDemoData(): void {
    this._mutate('m001', p => ({ ...p,
      viewing: {
        agentName: 'Sophie Grant', agentCompany: 'Savills · Bristol',
        agentEmail: 's.grant@savills.com', agentPhone: '0117 910 2200',
        date: '2026-07-20', time: '15:15', attendee: 'Hannah Briggs',
        reportCondition: 'good',
        reportNotes: 'Well-presented end-terrace in good structural order. Kitchen and bathrooms dated but functional. EPC E — strong uplift potential with standard insulation package. South-facing rear garden. On-street parking.',
      },
    }));
    this._mutate('m002', p => ({ ...p,
      viewing: {
        agentName: 'Edward Carr', agentCompany: 'Knight Frank · Clifton',
        agentEmail: 'edward.carr@knightfrank.com', agentPhone: '0117 317 1990',
        date: '2026-07-14', time: '10:30', attendee: 'Megan Doyle',
      },
    }));
    this._mutate('m004', p => ({ ...p,
      viewing: {
        agentName: 'James Parker', agentCompany: 'Savills · Wimbledon',
        agentEmail: 'j.parker@savills.com', agentPhone: '020 8947 1200',
        date: '2026-07-15', time: '14:00', attendee: 'Ryan Okonkwo',
      },
    }));
    this._mutate('m003', p => ({ ...p,
      offers: [
        { id: 'o003a', amount: 405000, status: 'rejected', date: '2026-06-10T10:00:00Z', submittedBy: 'Aryan', notes: 'Vendor felt too low' },
        { id: 'o003b', amount: 415000, status: 'pending',  date: '2026-06-18T14:30:00Z', submittedBy: 'Aryan' },
      ],
      activityLog: [
        { id: 'n003a', text: 'Second offer submitted at £415,000. Vendor considering.', author: 'Aryan', timestamp: '2026-06-18T14:35:00Z', label: 'action' as NoteLabel },
      ],
    }));
    this._mutate('m005', p => ({ ...p,
      offers: [
        { id: 'o005a', amount: 375000, status: 'countered', date: '2026-06-20T10:00:00Z', submittedBy: 'Aryan', notes: 'Vendor countered at £385k' },
        { id: 'o005b', amount: 385000, status: 'pending',   date: '2026-06-25T15:00:00Z', submittedBy: 'Aryan' },
      ],
      activityLog: [
        { id: 'n005a', text: 'Initial offer of £375k countered. Vendor firm at £385k.', author: 'Aryan', timestamp: '2026-06-20T10:05:00Z', label: 'warning' as NoteLabel },
        { id: 'n005b', text: 'Counter-offer of £385k submitted. Awaiting response.',    author: 'Aryan', timestamp: '2026-06-25T15:10:00Z', label: 'action'  as NoteLabel },
      ],
    }));
    // ── TX properties: backfill acquisition history ─────────────────────────
    // p001 — 15 Hallards Close (MoS)
    this._mutate('p001', p => ({ ...p,
      viewing: { agentName: 'Claire Hobbs', agentCompany: 'Savills · Bristol', agentEmail: 'c.hobbs@savills.com', agentPhone: '0117 910 2200', date: '2026-04-08', time: '11:00', attendee: 'Ryan Okonkwo', reportCondition: 'good', reportNotes: 'Structurally sound. Some cosmetic work needed in kitchen and bathroom. Roof felt is aging but not urgent. Good natural light throughout.' },
      clientApprovedBy: 'David Mensah', clientMaxPrice: 285000,
      offers: [
        { id: 'op001a', amount: 270000, status: 'rejected',  date: '2026-04-15T10:00:00Z', submittedBy: 'Aryan', notes: 'Vendor holding firm at £280k' },
        { id: 'op001b', amount: 277500, status: 'countered', date: '2026-04-22T14:00:00Z', submittedBy: 'Aryan', notes: 'Vendor countered at £282k' },
        { id: 'op001c', amount: 280000, status: 'accepted',  date: '2026-04-28T09:30:00Z', submittedBy: 'Aryan' },
      ],
      activityLog: [
        { id: 'np001a', text: 'Offer of £280k accepted. MoS issued by vendor solicitor.', author: 'Aryan',         timestamp: '2026-05-14T11:00:00Z', label: 'success' as NoteLabel },
        { id: 'np001b', text: 'MoS signed and returned. Conveyancer instructed.',         author: 'Aryan',         timestamp: '2026-05-20T09:30:00Z', label: 'action'  as NoteLabel },
      ],
    }));

    // p002 — GFF 22 Rock Lane (MoS)
    this._mutate('p002', p => ({ ...p,
      viewing: { agentName: 'Tom Ashford', agentCompany: 'Jacobs · Hastings', agentEmail: 't.ashford@jacobs-ea.co.uk', agentPhone: '01424 421 200', date: '2026-04-10', time: '13:00', attendee: 'Megan Doyle', reportCondition: 'fair', reportNotes: 'Ground-floor flat in reasonable condition. Damp issue in rear bedroom to investigate. Lease is 85 years — acceptable. Parking permit available.' },
      clientApprovedBy: 'Sarah Okafor', clientMaxPrice: 170000,
      offers: [
        { id: 'op002a', amount: 155000, status: 'rejected',  date: '2026-04-18T10:00:00Z', submittedBy: 'Megan Doyle', notes: 'Vendor wants closer to asking' },
        { id: 'op002b', amount: 163000, status: 'accepted',  date: '2026-04-25T15:30:00Z', submittedBy: 'Megan Doyle' },
      ],
      activityLog: [
        { id: 'np002a', text: 'Offer of £163k accepted. Awaiting MoS from vendor.',  author: 'Megan Doyle', timestamp: '2026-05-02T09:00:00Z', label: 'success' as NoteLabel },
      ],
    }));

    // p003 — 32 Orchard Avenue (MoS)
    this._mutate('p003', p => ({ ...p,
      viewing: { agentName: 'Laura Kim', agentCompany: 'Fox & Sons · Bristol', agentEmail: 'l.kim@foxandsons.co.uk', agentPhone: '0117 902 5000', date: '2026-03-28', time: '10:00', attendee: 'Hannah Briggs', reportCondition: 'good', reportNotes: 'Well-maintained end-terrace. New boiler installed 2024. Rear extension planning permission granted but not built. EPC B already achieved.' },
      clientApprovedBy: 'David Mensah', clientMaxPrice: 305000,
      offers: [
        { id: 'op003a', amount: 290000, status: 'countered', date: '2026-04-03T11:00:00Z', submittedBy: 'Aryan', notes: 'Vendor countered at £300k' },
        { id: 'op003b', amount: 297500, status: 'accepted',  date: '2026-04-09T10:00:00Z', submittedBy: 'Aryan' },
      ],
      activityLog: [
        { id: 'np003a', text: 'Offer of £297.5k accepted. MoS in progress.',  author: 'Aryan', timestamp: '2026-04-25T09:00:00Z', label: 'success' as NoteLabel },
      ],
    }));

    // p004 — 94 Middleton Road (Legals)
    this._mutate('p004', p => ({ ...p,
      viewing: { agentName: 'James Parker', agentCompany: 'Savills · Wimbledon', agentEmail: 'j.parker@savills.com', agentPhone: '020 8947 1200', date: '2026-03-12', time: '14:00', attendee: 'Ryan Okonkwo', reportCondition: 'good', reportNotes: 'Three-bed terraced in good order. Some surface damp in utility room — likely condensation. New windows throughout in 2023. South-facing garden. Strong rental demand in the area.' },
      clientApprovedBy: 'Sarah Okafor', clientMaxPrice: 480000,
      offers: [
        { id: 'op004a', amount: 450000, status: 'rejected',  date: '2026-03-20T10:00:00Z', submittedBy: 'Ryan Okonkwo', notes: 'Vendor not accepting below £460k' },
        { id: 'op004b', amount: 458000, status: 'countered', date: '2026-03-26T14:00:00Z', submittedBy: 'Ryan Okonkwo', notes: 'Vendor countered at £463k' },
        { id: 'op004c', amount: 461500, status: 'accepted',  date: '2026-04-01T09:00:00Z', submittedBy: 'Ryan Okonkwo' },
      ],
      activityLog: [
        { id: 'np004a', text: 'Searches ordered. ETA 10 working days.',            author: 'Jiya Chowdhury', timestamp: '2026-06-01T09:00:00Z', label: 'action'  as NoteLabel },
        { id: 'np004b', text: 'Searches received. Draft RoT sent to fee earner.',  author: 'Jiya Chowdhury', timestamp: '2026-06-18T14:00:00Z', label: 'info'    as NoteLabel },
      ],
    }));

    // p005 — 120 Rye Road (Legals)
    this._mutate('p005', p => ({ ...p,
      viewing: { agentName: 'Sophie Wallis', agentCompany: 'Parsons Son & Basley', agentEmail: 's.wallis@psb.co.uk', agentPhone: '01424 430 600', date: '2026-03-18', time: '11:00', attendee: 'Megan Doyle', reportCondition: 'fair', reportNotes: 'First-floor flat. Some dated interior — kitchen and bathroom need full refurb. Structural report clear. Managing agent confirmed no service charge arrears. EPC D — significant capex required to reach C.' },
      clientApprovedBy: 'David Mensah', clientMaxPrice: 190000,
      offers: [
        { id: 'op005a', amount: 175000, status: 'rejected',  date: '2026-03-25T10:00:00Z', submittedBy: 'Megan Doyle', notes: 'Vendor set minimum at £185k' },
        { id: 'op005b', amount: 185000, status: 'accepted',  date: '2026-03-31T15:00:00Z', submittedBy: 'Megan Doyle' },
      ],
      activityLog: [
        { id: 'np005a', text: 'Offer of £185k accepted. Solicitor instructed.',  author: 'Megan Doyle', timestamp: '2026-05-05T09:00:00Z', label: 'success' as NoteLabel },
      ],
    }));

    // p006 — 74 Avenue Road (Refurbishment)
    this._mutate('p006', p => ({ ...p,
      viewing: { agentName: 'Mark Evans', agentCompany: 'Kinleigh Folkard & Hayward', agentEmail: 'm.evans@kfh.co.uk', agentPhone: '020 8677 9900', date: '2026-02-14', time: '10:30', attendee: 'Ryan Okonkwo', reportCondition: 'fair', reportNotes: 'Terraced property needing full refurb. No central heating — requires full system installation. Rear extension opportunity. Planning officer confirmed permitted development rights intact.' },
      clientApprovedBy: 'Sarah Okafor', clientMaxPrice: 480000,
      offers: [
        { id: 'op006a', amount: 455000, status: 'rejected',  date: '2026-02-20T09:00:00Z', submittedBy: 'Ryan Okonkwo', notes: 'Vendor had another offer' },
        { id: 'op006b', amount: 465000, status: 'accepted',  date: '2026-02-27T11:00:00Z', submittedBy: 'Ryan Okonkwo' },
      ],
      activityLog: [
        { id: 'np006a', text: 'Contracts exchanged. Refurb contractor mobilising.',  author: 'Aryan', timestamp: '2026-05-15T09:00:00Z', label: 'success' as NoteLabel },
      ],
      agreedPrice: 465000,
    }));

    // p007 — 148 Malvern Way (Refurbishment)
    this._mutate('p007', p => ({ ...p,
      viewing: { agentName: 'Ben Foster', agentCompany: 'Jacobs · Hastings', agentEmail: 'b.foster@jacobs-ea.co.uk', agentPhone: '01424 421 200', date: '2026-02-20', time: '14:00', attendee: 'Megan Doyle', reportCondition: 'poor', reportNotes: 'Property in poor condition — full strip-out required. Roof needs replacement within 2 years. Good bones structurally. Large garden. Permitted development for loft conversion confirmed.' },
      clientApprovedBy: 'David Mensah', clientMaxPrice: 215000,
      offers: [
        { id: 'op007a', amount: 195000, status: 'countered', date: '2026-02-28T10:00:00Z', submittedBy: 'Megan Doyle', notes: 'Vendor countered at £212k' },
        { id: 'op007b', amount: 207000, status: 'countered', date: '2026-03-06T14:00:00Z', submittedBy: 'Megan Doyle', notes: 'Vendor reduced to £210k — final offer' },
        { id: 'op007c', amount: 210000, status: 'accepted',  date: '2026-03-10T09:30:00Z', submittedBy: 'Megan Doyle' },
      ],
      activityLog: [
        { id: 'np007a', text: 'Refurb works commenced. Expected completion August 2026.',  author: 'Aryan', timestamp: '2026-06-01T09:00:00Z', label: 'action' as NoteLabel },
      ],
    }));

    // p008 — 26 Dunster Road (Refurbishment)
    this._mutate('p008', p => ({ ...p,
      viewing: { agentName: 'Rachel Ford', agentCompany: 'Fox & Sons · Bristol', agentEmail: 'r.ford@foxandsons.co.uk', agentPhone: '0117 902 5000', date: '2026-02-25', time: '11:30', attendee: 'Ryan Okonkwo', reportCondition: 'fair', reportNotes: 'Semi-detached in reasonable structural condition. Rear bathroom dated, kitchen serviceable. Side access for skip/materials. EPC C — capex scope mainly cosmetic and insulation works.' },
      clientApprovedBy: 'David Mensah', clientMaxPrice: 295000,
      offers: [
        { id: 'op008a', amount: 260000, status: 'rejected',  date: '2026-03-04T10:00:00Z', submittedBy: 'Aryan', notes: 'Vendor has set floor at £270k' },
        { id: 'op008b', amount: 270000, status: 'accepted',  date: '2026-03-10T14:00:00Z', submittedBy: 'Aryan' },
      ],
      activityLog: [
        { id: 'np008a', text: 'Refurb underway. Phase 1 (bathroom/kitchen) complete.',  author: 'Aryan', timestamp: '2026-06-20T09:00:00Z', label: 'action' as NoteLabel },
      ],
    }));

    // p009 — 26 Norton Farm Road (Lettings)
    this._mutate('p009', p => ({ ...p,
      clientApprovedBy: 'Sarah Okafor', clientMaxPrice: 340000,
      offers: [
        { id: 'op009a', amount: 320000, status: 'rejected',  date: '2026-01-15T10:00:00Z', submittedBy: 'Aryan', notes: 'Vendor wanted closer to asking' },
        { id: 'op009b', amount: 330000, status: 'accepted',  date: '2026-01-22T11:00:00Z', submittedBy: 'Aryan' },
      ],
      activityLog: [
        { id: 'np009a', text: 'Contracts exchanged. Completion set for 25 July 2026.',  author: 'Jiya Chowdhury', timestamp: '2026-07-01T10:00:00Z', label: 'success' as NoteLabel },
        { id: 'np009b', text: 'Refurb completed. Property listed with letting agent.',   author: 'Aryan',          timestamp: '2026-07-10T09:00:00Z', label: 'action'  as NoteLabel },
      ],
    }));

    // p010 — 44 Brendon Rise (Lettings)
    this._mutate('p010', p => ({ ...p,
      viewing: { agentName: 'James Harlow', agentCompany: 'Jacobs', agentEmail: 'j.harlow@jacobs-ea.co.uk', agentPhone: '01424 421 200', date: '2026-01-18', time: '10:00', attendee: 'Megan Doyle', reportCondition: 'poor', reportNotes: 'Full refurb required. EPC F — extensive insulation, glazing and heating works needed to hit EPC C target. Structural survey clear. Large garden, on-street parking.' },
      clientApprovedBy: 'David Mensah', clientMaxPrice: 155000,
      offers: [
        { id: 'op010a', amount: 140000, status: 'countered', date: '2026-01-25T14:00:00Z', submittedBy: 'Megan Doyle', notes: 'Vendor countered at £152k' },
        { id: 'op010b', amount: 150000, status: 'accepted',  date: '2026-02-01T10:00:00Z', submittedBy: 'Megan Doyle' },
      ],
      activityLog: [
        { id: 'np010a', text: 'Refurb completed. EPC C achieved. Tenant found.',  author: 'Aryan', timestamp: '2026-07-05T09:00:00Z', label: 'success' as NoteLabel },
      ],
    }));

    // ── p011 — 41 Ferndale Road (Legals) — full end-to-end demo ──────────────
    this._mutate('p011', p => ({ ...p,
      viewing: {
        agentName: 'Priya Nair', agentCompany: 'Manning Stainton · Leeds', agentEmail: 'p.nair@manningstainton.co.uk', agentPhone: '0113 239 0808',
        date: '2026-04-22', time: '11:00', attendee: 'Jiya Chowdhury',
        reportCondition: 'good',
        reportNotes: 'Well-maintained Victorian semi. Kitchen updated 2021, boiler 2020. Roof in good order — surveyor satisfied. Small rear yard, on-street parking. EPC D likely to improve easily to C with standard insulation package. Lease: Freehold.',
      },
      clientApprovedBy: 'Sarah Okafor', clientMaxPrice: 235000,
      offers: [
        { id: 'op011a', amount: 210000, status: 'rejected',  date: '2026-04-29T10:00:00Z', submittedBy: 'Jiya Chowdhury', notes: 'Vendor has set floor at £220k' },
        { id: 'op011b', amount: 220000, status: 'countered', date: '2026-05-06T14:30:00Z', submittedBy: 'Jiya Chowdhury', notes: 'Vendor countered at £228k — citing recent comparables' },
        { id: 'op011c', amount: 225000, status: 'accepted',  date: '2026-05-12T09:00:00Z', submittedBy: 'Jiya Chowdhury' },
      ],
      activityLog: [
        { id: 'np011a', text: 'Offer of £225k accepted. MoS received from vendor agent.',             author: 'Jiya Chowdhury', timestamp: '2026-05-22T14:00:00Z', label: 'success' as NoteLabel },
        { id: 'np011b', text: 'Solicitor instructed — Winkworth Sherwood (ref WS/2026/0498).',       author: 'Jiya Chowdhury', timestamp: '2026-05-28T09:30:00Z', label: 'action'  as NoteLabel },
        { id: 'np011c', text: 'Winkworth Sherwood confirmed receipt. Matter opened.',                  author: 'Hayley Briggs',  timestamp: '2026-05-29T11:00:00Z', label: 'info'    as NoteLabel },
        { id: 'np011d', text: 'Searches ordered — LA, water & drainage, environmental.',              author: 'Hayley Briggs',  timestamp: '2026-06-02T10:00:00Z', label: 'action'  as NoteLabel },
        { id: 'np011e', text: 'Draft contract pack received from vendor\'s solicitors.',              author: 'Hayley Briggs',  timestamp: '2026-06-18T15:30:00Z', label: 'info'    as NoteLabel },
      ],
    }));
  }

  private _mutate(id: string, fn: (p: Property) => Property): void {
    this._props.update(list => list.map(p => p.id === id ? fn(p) : p));
    this._saveToStorage();
  }

  readonly lostProperties: Property[] = [
    { id: 'l001', address: '6 Park Street, Bristol BS1', phase: 'Bristol P3', stage: 'Draft', beds: 2, status: 'lost', lostReason: 'Vendor withdrew', lostDate: '2025-03-12' },
    { id: 'l002', address: '19 Tooting High St, London SW17', phase: 'Merton LAHF', stage: 'Negotiations', beds: 3, status: 'lost', lostReason: 'Outbid', lostDate: '2025-04-05' },
    { id: 'l003', address: '44 Chapeltown Road, Leeds LS7', phase: 'Leeds P1', stage: 'Viewing', beds: 2, status: 'lost', lostReason: 'Failed survey', lostDate: '2025-02-20' },
    { id: 'l004', address: '11 Harold Road, Hastings TN35', phase: 'Hastings ESPH', stage: 'Legals', beds: 4, status: 'lost', lostReason: 'Legal issues', lostDate: '2025-05-01' },
  ];

  readonly socialProjects: SocialProject[] = [
    {
      id: 'bristol-p3', label: 'Bristol — Phase 3', council: 'Bristol City Council', area: 'Bristol & surrounding BS postcodes',
      totalSupplierSpend: 178000,
      stats: { homes: 18, bedrooms: 41, epcCPlusPct: 100, epcPointUplift: 130 },
      spendByRegion: [{ region: 'South West', pct: 86 }, { region: 'Greater London', pct: 9 }, { region: 'Other', pct: 5 }],
      grantFunding: [{ code: 'SAHP', homes: 12 }, { code: 'LAHF', homes: 6 }],
      bedsBreakdown: { '1': 0, '2': 14, '3': 3, '4': 1 },
      homes: [
        { acq: 'Granby House, BS5', type: 'Block of flats', frontDoors: 6, bedSize: 2, epcBefore: { r: 'E', s: 42 }, epcAfter: { r: 'C', s: 71 }, capex: 142000, completed: '11/2024' },
        { acq: 'Stapleton Court, BS5', type: 'Block of flats', frontDoors: 8, bedSize: 2, epcBefore: { r: 'E', s: 39 }, epcAfter: { r: 'C', s: 73 }, capex: 196000, completed: '09/2024' },
        { acq: '3 Brunswick Square, BS2', type: 'Maisonette', frontDoors: 2, bedSize: 3, epcBefore: { r: 'E', s: 48 }, epcAfter: { r: 'B', s: 81 }, capex: 41000, completed: '05/2025' },
        { acq: '41 Filwood Road, BS16', type: 'End-terrace house', frontDoors: 1, bedSize: 3, epcBefore: { r: 'D', s: 57 }, epcAfter: { r: 'C', s: 75 }, capex: 33000, completed: '03/2025' },
        { acq: '6 Greenway Park, BS9', type: 'Semi-detached house', frontDoors: 1, bedSize: 4, epcBefore: { r: 'D', s: 60 }, epcAfter: { r: 'C', s: 76 }, capex: 29500, completed: '04/2025' },
      ],
      localSpend: [
        { business: 'Avon Trades Ltd', category: 'Trades & contractors', town: 'Bristol BS3', amount: 64200, jobs: 14 },
        { business: 'Severnside Builders Merchants', category: 'Materials & merchants', town: 'Bristol BS2', amount: 41800, jobs: 27 },
        { business: 'Bristol Bright Cleaning Co.', category: 'Cleaning', town: 'Bristol BS5', amount: 18400, jobs: 32 },
      ],
    },
    {
      id: 'merton', label: 'Merton LAHF 2 & 3', council: 'London Borough of Merton', area: 'Mitcham & South London',
      totalSupplierSpend: 174000,
      stats: { homes: 13, bedrooms: 30, epcCPlusPct: 100, epcPointUplift: 106 },
      spendByRegion: [{ region: 'Greater London', pct: 82 }, { region: 'South East', pct: 13 }, { region: 'Other', pct: 5 }],
      grantFunding: [{ code: 'LSAHP', homes: 9 }, { code: 'LAHF', homes: 4 }],
      bedsBreakdown: { '1': 0, '2': 9, '3': 4, '4': 0 },
      homes: [
        { acq: 'Pollards Hill Court, CR4', type: 'Block of flats', frontDoors: 9, bedSize: 2, epcBefore: { r: 'E', s: 40 }, epcAfter: { r: 'C', s: 72 }, capex: 214000, completed: '08/2024' },
        { acq: '55 Chestnut Grove, CR4', type: 'Mid-terrace house', frontDoors: 1, bedSize: 3, epcBefore: { r: 'D', s: 55 }, epcAfter: { r: 'B', s: 82 }, capex: 38000, completed: '02/2025' },
        { acq: '9 St Olaves Walk, SW16', type: 'Maisonette', frontDoors: 2, bedSize: 3, epcBefore: { r: 'E', s: 46 }, epcAfter: { r: 'C', s: 74 }, capex: 44000, completed: '06/2025' },
        { acq: '13 Acacia Road, CR4', type: 'End-terrace house', frontDoors: 1, bedSize: 3, epcBefore: { r: 'D', s: 58 }, epcAfter: { r: 'C', s: 77 }, capex: 31000, completed: '03/2025' },
      ],
      localSpend: [
        { business: 'South London Build & Maintain', category: 'Trades & contractors', town: 'Croydon CR0', amount: 71800, jobs: 16 },
        { business: 'Colliers Wood Merchants', category: 'Materials & merchants', town: 'Colliers Wood SW19', amount: 39600, jobs: 28 },
      ],
    },
    {
      id: 'leeds-p1', label: 'Leeds — Phase 1', council: 'Leeds City Council', area: 'Leeds & LS postcodes',
      totalSupplierSpend: 101000,
      stats: { homes: 9, bedrooms: 21, epcCPlusPct: 89, epcPointUplift: 73 },
      spendByRegion: [{ region: 'Yorkshire & Humber', pct: 90 }, { region: 'Other', pct: 10 }],
      grantFunding: [{ code: 'SAHP', homes: 6 }, { code: 'LAHF', homes: 3 }],
      bedsBreakdown: { '1': 0, '2': 6, '3': 3, '4': 0 },
      homes: [
        { acq: 'Burley Lodge, LS6', type: 'Block of flats', frontDoors: 5, bedSize: 2, epcBefore: { r: 'F', s: 32 }, epcAfter: { r: 'C', s: 70 }, capex: 124000, completed: '10/2024' },
        { acq: 'Roundhay Mews, LS8', type: 'Converted terrace', frontDoors: 3, bedSize: 3, epcBefore: { r: 'E', s: 44 }, epcAfter: { r: 'C', s: 72 }, capex: 88000, completed: '12/2024' },
        { acq: '88 Roundhay Road, LS8', type: 'Mid-terrace house', frontDoors: 1, bedSize: 2, epcBefore: { r: 'D', s: 59 }, epcAfter: { r: 'D', s: 66 }, capex: 27000, completed: '01/2025' },
      ],
      localSpend: [
        { business: 'Aire Valley Contractors', category: 'Trades & contractors', town: 'Leeds LS6', amount: 38500, jobs: 8 },
        { business: 'Headingley Timber & Tools', category: 'Materials & merchants', town: 'Leeds LS6', amount: 22400, jobs: 31 },
      ],
    },
    {
      id: 'hastings-esph', label: 'Hastings — ESPH', council: 'Hastings Borough Council', area: 'East Sussex, Kent & Greater London',
      totalSupplierSpend: 420000,
      stats: { homes: 42, bedrooms: 107, epcCPlusPct: 100, epcPointUplift: 252 },
      spendByRegion: [{ region: 'Greater London', pct: 49 }, { region: 'East Sussex', pct: 40 }, { region: 'Kent', pct: 10 }, { region: 'Other', pct: 1 }],
      grantFunding: [{ code: 'SAHP', homes: 23 }, { code: 'LAHF', homes: 19 }],
      bedsBreakdown: { '1': 6, '2': 14, '3': 15, '4': 7 },
      contract: { name: 'Consultancy Contract for Property Acquisition and Refurbishment Services', reference: 'ESPH', value: 36240000, provider: 'Phi Property Acquisitions Ltd', period: '1 Apr 2025 – 31 May 2026' },
      narrative: 'The Hastings housing programme transformed government funding into 42 high-quality, energy-efficient affordable homes through acquisition, refurbishment and conversion of existing properties.',
      programmes: [{ name: 'SHAP', homes: 12 }, { name: 'LAHF R3', homes: 10 }, { name: 'LAHF R4', homes: 9 }, { name: 'Levelling Up', homes: 6 }, { name: 'Affordable Housing', homes: 5 }],
      homes: [
        { acq: 'The Hideaway (Flats 1–8), St Leonards', type: 'Block of flats', frontDoors: 8, bedSize: 2, epcBefore: { r: 'E', s: 43 }, epcAfter: { r: 'C', s: 72 }, capex: 240000, completed: '05/2025' },
        { acq: '8 Cherry Tree Close', type: 'End-terrace house', frontDoors: 1, bedSize: 3, epcBefore: { r: 'E', s: 45 }, epcAfter: { r: 'C', s: 74 }, capex: 52000, completed: '04/2025' },
        { acq: '2 Norfolk Drive', type: 'Mid-terrace house', frontDoors: 1, bedSize: 3, epcBefore: { r: 'D', s: 58 }, epcAfter: { r: 'C', s: 76 }, capex: 30000, completed: '03/2025' },
        { acq: '12 Bandhills Close', type: 'Semi-detached house', frontDoors: 1, bedSize: 3, epcBefore: { r: 'D', s: 55 }, epcAfter: { r: 'B', s: 81 }, capex: 38000, completed: '02/2025' },
      ],
      localSpend: [
        { business: 'Sussex Refurb Co.', category: 'Trades & contractors', town: 'Hastings TN34', amount: 210000, jobs: 24 },
        { business: 'Coastal Builders Merchants', category: 'Materials & merchants', town: 'St Leonards TN38', amount: 96000, jobs: 40 },
      ],
    },
  ];

  readonly suppliers: Supplier[] = [
    // Bristol — Phase 3 (12)
    { id:  1, projectId: 'bristol-p3',    name: 'Avon Property Law LLP',          category: 'Solicitor',                 postcode: 'BS1 4AQ',  fee:   8500, isLocal: true,  distanceMiles:   1.2, date: '2024-06-10', lat: 51.454, lng: -2.596 },
    { id:  2, projectId: 'bristol-p3',    name: 'Bristol Survey Group',           category: 'Surveyor',                  postcode: 'BS7 8AR',  fee:   3200, isLocal: true,  distanceMiles:   2.1, date: '2024-07-02', lat: 51.479, lng: -2.570 },
    { id:  3, projectId: 'bristol-p3',    name: 'Severnside Electrical Ltd',      category: 'Electrician',               postcode: 'BS3 1AD',  fee:  14200, isLocal: true,  distanceMiles:   1.5, date: '2024-08-14', lat: 51.443, lng: -2.601 },
    { id:  4, projectId: 'bristol-p3',    name: 'Avon Trades Ltd',                category: 'Builder / Main Contractor', postcode: 'BS5 6HR',  fee:  64200, isLocal: true,  distanceMiles:   2.3, date: '2024-09-01', lat: 51.459, lng: -2.558 },
    { id:  5, projectId: 'bristol-p3',    name: 'Clevedon Plumbing & Heating',    category: 'Plumber',                   postcode: 'BS21 6AB', fee:   9800, isLocal: true,  distanceMiles:  13.4, date: '2024-09-20', lat: 51.441, lng: -2.855 },
    { id:  6, projectId: 'bristol-p3',    name: 'Aztec Fire & Safety',            category: 'Fire Risk Assessor',        postcode: 'BS32 4AQ', fee:   1800, isLocal: true,  distanceMiles:   5.5, date: '2024-10-05', lat: 51.530, lng: -2.545 },
    { id:  7, projectId: 'bristol-p3',    name: 'Aziza Surveys',                  category: 'EPC Assessor',              postcode: 'BS7 0BJ',  fee:   2400, isLocal: true,  distanceMiles:   2.1, date: '2025-01-18', lat: 51.479, lng: -2.565 },
    { id:  8, projectId: 'bristol-p3',    name: 'Cotswold Roofing Co.',           category: 'Roofer',                    postcode: 'GL54 1AB', fee:  11600, isLocal: true,  distanceMiles:  42.1, date: '2025-02-11', lat: 51.883, lng: -1.775 },
    { id:  9, projectId: 'bristol-p3',    name: 'Greenleaf Grounds',              category: 'Landscaper / Gardener',     postcode: 'BS16 1AB', fee:   4200, isLocal: true,  distanceMiles:   4.9, date: '2025-03-22', lat: 51.483, lng: -2.504 },
    { id: 10, projectId: 'bristol-p3',    name: 'Bristol Bright Cleaning Co.',    category: 'Cleaner',                   postcode: 'BS5 0BJ',  fee:   6800, isLocal: true,  distanceMiles:   2.5, date: '2025-04-08', lat: 51.459, lng: -2.553 },
    { id: 11, projectId: 'bristol-p3',    name: 'Midland Damp Specialists',       category: 'Damp Specialist',           postcode: 'B1 1BB',   fee:   3600, isLocal: false, distanceMiles:  81.2, date: '2025-05-14', lat: 52.481, lng: -1.900 },
    { id: 12, projectId: 'bristol-p3',    name: 'National Structural Engineers',  category: 'Structural Engineer',       postcode: 'EC2A 1AB', fee:   5200, isLocal: false, distanceMiles: 118.4, date: '2025-06-30', lat: 51.522, lng: -0.085 },
    // Merton LAHF (11)
    { id: 13, projectId: 'merton',        name: 'Wimbledon Law Practice',         category: 'Solicitor',                 postcode: 'SW19 1QS', fee:   9200, isLocal: true,  distanceMiles:   1.4, date: '2024-05-08', lat: 51.421, lng: -0.204 },
    { id: 14, projectId: 'merton',        name: 'Wandle Surveying',               category: 'Surveyor',                  postcode: 'SW19 2AA', fee:   2800, isLocal: true,  distanceMiles:   1.8, date: '2024-06-15', lat: 51.419, lng: -0.191 },
    { id: 15, projectId: 'merton',        name: 'South London Build & Maintain',  category: 'Builder / Main Contractor', postcode: 'CR0 1AA',  fee:  71800, isLocal: true,  distanceMiles:   8.1, date: '2024-07-22', lat: 51.375, lng: -0.098 },
    { id: 16, projectId: 'merton',        name: 'Clapham Electrics',              category: 'Electrician',               postcode: 'SW4 7DH',  fee:  11400, isLocal: true,  distanceMiles:   6.9, date: '2024-08-10', lat: 51.461, lng: -0.134 },
    { id: 17, projectId: 'merton',        name: 'Kingston Plumbing Services',     category: 'Plumber',                   postcode: 'KT1 1AA',  fee:   7600, isLocal: true,  distanceMiles:   7.8, date: '2024-10-03', lat: 51.412, lng: -0.307 },
    { id: 18, projectId: 'merton',        name: 'Surrey Fire Risk Solutions',     category: 'Fire Risk Assessor',        postcode: 'GU1 1AA',  fee:   1600, isLocal: true,  distanceMiles:  22.3, date: '2024-11-19', lat: 51.236, lng: -0.570 },
    { id: 19, projectId: 'merton',        name: 'Mitcham Sparkle Cleaning',       category: 'Cleaner',                   postcode: 'CR4 1AA',  fee:   5200, isLocal: true,  distanceMiles:   4.3, date: '2025-01-07', lat: 51.399, lng: -0.163 },
    { id: 20, projectId: 'merton',        name: 'Pollards Hill Landscapes',       category: 'Landscaper / Gardener',     postcode: 'CR4 2AB',  fee:   3800, isLocal: true,  distanceMiles:   6.2, date: '2025-02-28', lat: 51.389, lng: -0.140 },
    { id: 21, projectId: 'merton',        name: 'SE Roofing Specialists',         category: 'Roofer',                    postcode: 'SE15 4AA', fee:   9400, isLocal: true,  distanceMiles:  12.1, date: '2025-04-14', lat: 51.470, lng: -0.067 },
    { id: 22, projectId: 'merton',        name: 'Redhill Damp & Timber',          category: 'Damp Specialist',           postcode: 'RH1 1AA',  fee:   4100, isLocal: true,  distanceMiles:  18.5, date: '2025-05-30', lat: 51.237, lng: -0.168 },
    { id: 23, projectId: 'merton',        name: 'Northern EPC Assessors',         category: 'EPC Assessor',              postcode: 'M1 1AA',   fee:   1800, isLocal: false, distanceMiles: 163.2, date: '2025-06-12', lat: 53.480, lng: -2.243 },
    // Leeds — Phase 1 (10)
    { id: 24, projectId: 'leeds-p1',      name: 'Aire Valley Solicitors',         category: 'Solicitor',                 postcode: 'LS1 4HH',  fee:   7800, isLocal: true,  distanceMiles:   0.5, date: '2024-08-05', lat: 53.797, lng: -1.547 },
    { id: 25, projectId: 'leeds-p1',      name: 'Pennine Survey Partners',        category: 'Surveyor',                  postcode: 'LS1 2AA',  fee:   2600, isLocal: true,  distanceMiles:   0.3, date: '2024-09-12', lat: 53.799, lng: -1.549 },
    { id: 26, projectId: 'leeds-p1',      name: 'Aire Valley Contractors',        category: 'Builder / Main Contractor', postcode: 'LS6 2AA',  fee:  38500, isLocal: true,  distanceMiles:   1.8, date: '2024-10-18', lat: 53.822, lng: -1.573 },
    { id: 27, projectId: 'leeds-p1',      name: 'Bradford Electrical Services',   category: 'Electrician',               postcode: 'BD1 1AA',  fee:  12800, isLocal: true,  distanceMiles:   9.8, date: '2024-11-24', lat: 53.796, lng: -1.758 },
    { id: 28, projectId: 'leeds-p1',      name: 'Harrogate Plumbing & Gas',       category: 'Plumber',                   postcode: 'HG1 1AA',  fee:   8400, isLocal: true,  distanceMiles:  13.2, date: '2025-01-09', lat: 53.992, lng: -1.538 },
    { id: 29, projectId: 'leeds-p1',      name: 'Yorkshire Fire Safety',          category: 'Fire Risk Assessor',        postcode: 'LS8 1AA',  fee:   1400, isLocal: true,  distanceMiles:   2.3, date: '2025-02-17', lat: 53.816, lng: -1.511 },
    { id: 30, projectId: 'leeds-p1',      name: 'Headingley Timber & Tools',      category: 'Roofer',                    postcode: 'LS6 1AA',  fee:  16200, isLocal: true,  distanceMiles:   2.1, date: '2025-03-05', lat: 53.822, lng: -1.573 },
    { id: 31, projectId: 'leeds-p1',      name: 'Leeds Spotless Ltd',             category: 'Cleaner',                   postcode: 'LS8 2AB',  fee:   4200, isLocal: true,  distanceMiles:   2.1, date: '2025-04-22', lat: 53.816, lng: -1.509 },
    { id: 32, projectId: 'leeds-p1',      name: 'Yorkshire Green Spaces',         category: 'Landscaper / Gardener',     postcode: 'LS8 3AA',  fee:   3600, isLocal: true,  distanceMiles:   2.1, date: '2025-05-08', lat: 53.816, lng: -1.509 },
    { id: 33, projectId: 'leeds-p1',      name: 'London Damp Specialists Ltd',    category: 'Damp Specialist',           postcode: 'E1 6AA',   fee:   3800, isLocal: false, distanceMiles: 190.8, date: '2025-06-01', lat: 51.515, lng: -0.060 },
    // Hastings — ESPH (12)
    { id: 34, projectId: 'hastings-esph', name: 'Hastings Law Group',             category: 'Solicitor',                 postcode: 'TN34 1HH', fee:  12400, isLocal: true,  distanceMiles:   0.4, date: '2025-04-02', lat: 50.854, lng:  0.573 },
    { id: 35, projectId: 'hastings-esph', name: 'Wealden Survey Partners',        category: 'Surveyor',                  postcode: 'BN21 1AA', fee:   4200, isLocal: true,  distanceMiles:  16.8, date: '2025-04-15', lat: 50.768, lng:  0.284 },
    { id: 36, projectId: 'hastings-esph', name: 'Sussex Refurb Co.',              category: 'Builder / Main Contractor', postcode: 'TN34 2AA', fee: 210000, isLocal: true,  distanceMiles:   0.6, date: '2025-05-01', lat: 50.854, lng:  0.565 },
    { id: 37, projectId: 'hastings-esph', name: 'Coastal Electrical Services',    category: 'Electrician',               postcode: 'TN38 0AA', fee:  22800, isLocal: true,  distanceMiles:   1.8, date: '2025-05-14', lat: 50.849, lng:  0.546 },
    { id: 38, projectId: 'hastings-esph', name: 'St Leonards Plumbing',           category: 'Plumber',                   postcode: 'TN38 1AA', fee:  14600, isLocal: true,  distanceMiles:   1.8, date: '2025-06-03', lat: 50.849, lng:  0.546 },
    { id: 39, projectId: 'hastings-esph', name: 'East Sussex Fire Risk',          category: 'Fire Risk Assessor',        postcode: 'TN1 1AA',  fee:   2200, isLocal: true,  distanceMiles:  22.1, date: '2025-06-20', lat: 51.133, lng:  0.264 },
    { id: 40, projectId: 'hastings-esph', name: 'Rother Roofing Ltd',             category: 'Roofer',                    postcode: 'TN39 3AA', fee:  31400, isLocal: true,  distanceMiles:   6.4, date: '2025-07-08', lat: 50.843, lng:  0.474 },
    { id: 41, projectId: 'hastings-esph', name: '1066 Cleaning Services',         category: 'Cleaner',                   postcode: 'TN34 3AA', fee:   9800, isLocal: true,  distanceMiles:   0.2, date: '2025-08-11', lat: 50.854, lng:  0.573 },
    { id: 42, projectId: 'hastings-esph', name: 'Rother Grounds & Gardens',       category: 'Landscaper / Gardener',     postcode: 'TN39 1AA', fee:   8200, isLocal: true,  distanceMiles:   6.1, date: '2025-09-25', lat: 50.843, lng:  0.474 },
    { id: 43, projectId: 'hastings-esph', name: 'Brighton EPC Solutions',         category: 'EPC Assessor',              postcode: 'BN1 1AA',  fee:   2800, isLocal: true,  distanceMiles:  43.2, date: '2025-10-14', lat: 50.829, lng: -0.137 },
    { id: 44, projectId: 'hastings-esph', name: 'London Structural Engineers',    category: 'Structural Engineer',       postcode: 'SE1 1AA',  fee:   8600, isLocal: false, distanceMiles:  68.4, date: '2025-11-03', lat: 51.503, lng: -0.088 },
    { id: 45, projectId: 'hastings-esph', name: 'City Damp Specialists',          category: 'Damp Specialist',           postcode: 'EC1A 1BB', fee:   4800, isLocal: false, distanceMiles:  69.1, date: '2025-12-01', lat: 51.522, lng: -0.102 },
  ];

  readonly agents: Agent[] = [
    { id: 'a1', name: 'Sarah Mitchell', role: 'Senior Agent', email: 'sarah@winkworth.co.uk', phone: '0117 946 6500', company: 'Winkworth Bristol', region: 'Bristol', properties: 3 },
    { id: 'a2', name: 'James Patel', role: 'Sales Director', email: 'james@jll.com', phone: '0208 493 3700', company: 'JLL Merton', region: 'Merton', properties: 2 },
    { id: 'a3', name: 'Anjali Sood', role: 'Agent', email: 'anjali.sood@jll.com', phone: '0113 261 6400', company: 'JLL Leeds', region: 'Leeds', properties: 2 },
    { id: 'a4', name: 'Tom Hendricks', role: 'Regional Director', email: 'tom@savills.com', phone: '01424 839280', company: 'Savills Hastings', region: 'Hastings', properties: 4 },
  ];

  private _logEntry(text: string, author: string, label: NoteLabel = 'info'): ActivityNote {
    return { id: crypto.randomUUID(), text, author, timestamp: new Date().toISOString(), label };
  }

  private readonly _stageMessages: Partial<Record<Stage, string>> = {
    Draft:               'Draft submitted for client approval.',
    ClientApproval:      'Client approved. Viewing booked.',
    Viewing:             'Viewing complete. Progressed to Negotiations.',
    Negotiations:        'Offer accepted. Memorandum of Sale issued.',
    MemorandumOfSale:    'MoS complete. Progressed to Legals.',
    Legals:              'Legal work complete. Refurbishment started.',
    Refurbishment:       'Refurbishment complete. Property progressed to Lettings.',
  };

  advanceStage(id: string, author = 'System'): void {
    const stages: Stage[] = ['Draft','ClientApproval','Viewing','Negotiations','MemorandumOfSale','Legals','Refurbishment','Lettings'];
    this._mutate(id, p => {
      const idx = stages.indexOf(p.stage as Stage);
      if (idx < 0 || idx >= stages.length - 1) return p;
      const next = stages[idx + 1];
      const msg = this._stageMessages[p.stage as Stage] ?? `Stage advanced to ${next}.`;
      return {
        ...p,
        stage: next,
        ...(next === 'Legals' && !p.legalsStartedAt ? { legalsStartedAt: new Date().toISOString().split('T')[0] } : {}),
        activityLog: [...(p.activityLog ?? []), this._logEntry(msg, author, 'action')],
      };
    });
  }

  revertStage(id: string, comment: string, author: string): void {
    const stages: Stage[] = ['Draft','ClientApproval','Viewing','Negotiations','MemorandumOfSale','Legals','Refurbishment','Lettings'];
    this._mutate(id, p => {
      const idx = stages.indexOf(p.stage as Stage);
      if (idx <= 0) return p;
      const prevStage = stages[idx - 1];
      const text = comment ? `Stage reverted to ${prevStage}. Comment: ${comment}` : `Stage reverted to ${prevStage}.`;
      return { ...p, stage: prevStage, activityLog: [...(p.activityLog ?? []), this._logEntry(text, author, 'warning')] };
    });
  }

  updateProperty(id: string, changes: Partial<Property>): void {
    this._mutate(id, p => ({ ...p, ...changes }));
  }

  addActivity(id: string, note: ActivityNote): void {
    this._mutate(id, p => ({ ...p, activityLog: [...(p.activityLog ?? []), note] }));
  }

  addOffer(id: string, offer: Offer): void {
    const text = `Offer of £${offer.amount.toLocaleString('en-GB')} submitted.${offer.notes ? ' Note: ' + offer.notes : ''}`;
    this._mutate(id, p => ({
      ...p,
      offers: [...(p.offers ?? []), offer],
      activityLog: [...(p.activityLog ?? []), this._logEntry(text, offer.submittedBy, 'action')],
    }));
  }

  updateOffer(propertyId: string, offerId: string, status: Offer['status'], author = 'System'): void {
    this._mutate(propertyId, p => {
      const updatedOffers = (p.offers ?? []).map(o => o.id === offerId ? { ...o, status } : o);
      const offer = updatedOffers.find(o => o.id === offerId);
      const amount = offer ? `£${offer.amount.toLocaleString('en-GB')}` : 'offer';
      const msgMap: Partial<Record<Offer['status'], [string, NoteLabel]>> = {
        accepted:  [`Offer of ${amount} accepted.`, 'success'],
        rejected:  [`Offer of ${amount} rejected.`, 'warning'],
        countered: [`Offer of ${amount} countered by vendor.`, 'warning'],
        withdrawn: [`Offer of ${amount} withdrawn.`, 'info'],
      };
      const [text, label] = msgMap[status] ?? [`Offer status updated to ${status}.`, 'info'];
      return {
        ...p,
        offers: updatedOffers,
        ...(status === 'accepted' && offer ? { agreedPrice: offer.amount } : {}),
        activityLog: [...(p.activityLog ?? []), this._logEntry(text, author, label as NoteLabel)],
      };
    });
  }

  approveClient(id: string, approvedBy: string, maxPrice: number): void {
    this._mutate(id, p => ({
      ...p,
      stage: 'Viewing' as Stage,
      clientApprovedBy: approvedBy,
      clientMaxPrice: maxPrice,
      activityLog: [
        ...(p.activityLog ?? []),
        this._logEntry(
          `Approved by ${approvedBy}. Max authorised price: £${maxPrice.toLocaleString('en-GB')}.`,
          approvedBy, 'success',
        ),
      ],
    }));
  }

  updateViewing(id: string, changes: Partial<Viewing>): void {
    this._mutate(id, p => ({ ...p, viewing: { ...(p.viewing ?? {}), ...changes } }));
  }

  submitViewingForReview(id: string, author = 'System'): void {
    this._mutate(id, p => ({
      ...p,
      viewing: { ...(p.viewing ?? {}), clientReview: 'pending' as const },
      activityLog: [...(p.activityLog ?? []), this._logEntry('Viewing report submitted to client for review.', author, 'action')],
    }));
  }

  approveViewing(id: string, author = 'System'): void {
    const stages: Stage[] = ['Draft','ClientApproval','Viewing','Negotiations','MemorandumOfSale','Legals','Refurbishment','Lettings'];
    this._mutate(id, p => {
      const idx = stages.indexOf(p.stage as Stage);
      const newStage = (idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : p.stage) as Stage;
      return {
        ...p,
        stage: newStage,
        viewing: { ...(p.viewing ?? {}), clientReview: 'approved' as const },
        activityLog: [...(p.activityLog ?? []), this._logEntry('Client approved viewing report. Property progressed to Negotiations.', author, 'success')],
      };
    });
  }

  markLost(id: string, reason: string, author = 'System'): void {
    this._mutate(id, p => ({
      ...p,
      status: 'lost' as const,
      lostReason: reason,
      lostDate: new Date().toISOString().split('T')[0],
      activityLog: [...(p.activityLog ?? []), this._logEntry(`Property marked as lost. Reason: ${reason}.`, author, 'warning')],
    }));
  }

  private async _backfillDataRoom(): Promise<void> {
    // Seed a Transfer Deed for each Lettings property so the client portal has a
    // contract to sign — unless that property already has a contract-type doc.
    await this.drStore.ready;
    const CONTRACT_DOC_TYPES = ['Contract', 'Signed Contract', 'Transfer Deed', 'TR1'];
    const propsWithContract = new Set(
      this.drStore.files()
        .filter(f => CONTRACT_DOC_TYPES.includes(f.docType))
        .map(f => f.propertyId)
    );
    const seeds: DataRoomFile[] = this._props()
      .filter(p => p.stage === 'Lettings' && !propsWithContract.has(p.id))
      .map(p => ({
        id: 'contract-seed-' + p.id,
        propertyId: p.id,
        docType: 'Transfer Deed',
        fileName: 'Contract_Transfer_' + p.address.replace(/\s+/g, '_') + '.pdf',
        uploadedBy: 'Solicitor',
        uploadedAt: '22/07/2026',
        url: null,
      }));
    if (seeds.length) this.drStore.files.update(list => [...list, ...seeds]);
  }

  private _backfillProperties(): void {
    const BACKFILL: Property[] = [
      { id: 'p012', address: '9 Cotham Hill',      postcode: 'BS6 6LD', phase: 'Bristol P3', stage: 'MemorandumOfSale', beds: 3, type: 'Mid-Terrace',   epcBefore: { r: 'E', s: 45 }, financial: { ap: 320000, capex: 34000, tc: 5100, yield: 5.2 }, agreedPrice: 315000, status: 'active', tenure: 'Freehold', floodRisk: 'Low', daysOnMarket: 22, description: 'Three-bedroom mid-terrace in Cotham, Bristol. Well-maintained Victorian terrace with original features. EPC E — clear uplift path via loft insulation and boiler replacement.' },
      { id: 'p013', address: '52 Knowle Road',     postcode: 'BS4 2DX', phase: 'Bristol P3', stage: 'MemorandumOfSale', beds: 2, type: 'End-Terrace',   epcBefore: { r: 'F', s: 32 }, financial: { ap: 220000, capex: 52000, tc: 4200, yield: 5.6 }, agreedPrice: 215000, status: 'active', tenure: 'Freehold', floodRisk: 'Low', daysOnMarket: 41, description: 'Two-bedroom end-terrace in Knowle, Bristol. Requires full insulation and heating upgrade to reach EPC C. Good rental demand in area — strong yield potential post-refurb.' },
      { id: 'p014', address: '18 Ashley Down Road', postcode: 'BS7 9JJ', phase: 'Bristol P3', stage: 'MemorandumOfSale', beds: 3, type: 'Semi-Detached', epcBefore: { r: 'E', s: 47 }, financial: { ap: 345000, capex: 30000, tc: 5400, yield: 5.0 }, agreedPrice: 338000, status: 'active', tenure: 'Freehold', floodRisk: 'Low', daysOnMarket: 18, description: 'Three-bedroom semi-detached in Ashley Down, Bristol. Bay-fronted Edwardian property with original features. EPC E — straightforward path to C via loft and cavity wall insulation. Popular residential street close to local amenities.' },
      { id: 'p015', address: '67 Wells Road',       postcode: 'BS4 2AE', phase: 'Bristol P3', stage: 'MemorandumOfSale', beds: 2, type: 'Mid-Terrace',   epcBefore: { r: 'D', s: 58 }, financial: { ap: 265000, capex: 42000, tc: 4600, yield: 5.3 }, agreedPrice: 260000, status: 'active', tenure: 'Freehold', floodRisk: 'Low', daysOnMarket: 29, description: 'Two-bedroom mid-terrace on Wells Road, Knowle, Bristol. Solid Victorian terrace in need of modernisation. EPC D — target C achievable via insulation upgrade and heat pump installation. Strong local letting market.' },
      { id: 'p016', address: '23 Chessel Street',   postcode: 'BS3 3DN', phase: 'Bristol P3', stage: 'MemorandumOfSale', beds: 3, type: 'Terraced',      epcBefore: { r: 'E', s: 49 }, financial: { ap: 305000, capex: 36000, tc: 5000, yield: 5.4 }, agreedPrice: 298000, status: 'active', tenure: 'Freehold', floodRisk: 'Low', daysOnMarket: 25, description: 'Three-bedroom terraced house in Bedminster, Bristol. Classic bay-fronted Victorian terrace close to North Street. EPC E — clear route to C via loft and cavity wall insulation plus a new boiler. Strong tenant demand in a popular, well-connected area.' },
      { id: 'p017', address: '14 Cotswold Road',    postcode: 'BS3 4NX', phase: 'Bristol P3', stage: 'Lettings',         beds: 3, type: 'Mid-Terrace',   epcBefore: { r: 'E', s: 46 }, epcAfter: { r: 'B', s: 83 }, financial: { ap: 315000, capex: 33000, tc: 5200, sp: 820, yield: 5.5 }, agreedPrice: 308000, status: 'active', tenure: 'Freehold', lha: 13200, marketRent: 16800, floodRisk: 'Low', leaseRemaining: 'N/A', daysOnMarket: 34, description: 'Three-bedroom mid-terrace in Windmill Hill, Bristol. Fully refurbished to EPC B — new boiler, full insulation and double glazing throughout. Now proceeding through exchange and completion. Strong tenant demand in this well-connected south Bristol location.' },
    ];
    const existing = new Set(this._props().map(p => p.id));
    const toAdd = BACKFILL.filter(p => !existing.has(p.id));
    if (toAdd.length) {
      this._props.update(list => [...list, ...toAdd]);
      this._saveToStorage();
    }
  }

  addProperty(p: Omit<Property, 'id' | 'stage' | 'status'>): void {
    const id = 'p' + Date.now();
    this._props.update(list => [...list, { ...p, id, stage: 'Draft', status: 'active' }]);
    this._saveToStorage();
  }

  getProperty(id: string): Property | undefined {
    return [...this.properties, ...this.lostProperties].find(p => p.id === id);
  }
}
