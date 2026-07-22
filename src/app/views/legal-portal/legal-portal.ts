import { Component, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { MockDataService } from '../../services/mock-data';
import { ProjectsService } from '../../services/projects';
import { Property } from '../../models/property.model';

type LegalView = 'matters' | 'record';

interface LegalNote {
  id: string;
  text: string;
  author: string;
  ts: string;
}

interface LegalMatterData {
  solicitorRef: string;
  checklist: Record<string, boolean>;
  notes: LegalNote[];
  targetExchange: string;
  targetCompletion: string;
  rotQueryResponse?: string;
  exchangedDate?: string;
}

interface DataRoomFile {
  id: string;
  propertyId: string;
  stage: string;
  fileName: string;
  docType: string;
  uploadedBy: string;
  uploadedAt: string;
  note: string;
  url?: string;
}

// Maps checklist keys to document types they relate to
// Only items where there is an actual document to review before signing off.
// Action-only confirmations (ordered, raised, sent, sign-off, exchanged etc.) have no entry.
const ITEM_DOC_TYPES: Record<string, string[]> = {
  mos_received:    ['Memorandum of Sale', 'MoS'],
  search_la_r:     ['Local Authority Search', 'Searches'],
  search_water:    ['Water & Drainage Search', 'Water Search', 'Searches'],
  search_env:      ['Environmental Search', 'Searches'],
  survey_report:   ['Survey Report', 'HomeBuyer Report', 'Structural Survey'],
  contract_rx:     ['Draft Contract', 'Contract Pack'],
  contract_rev:    ['Draft Contract', 'Contract Pack'],
  title_report:         ['Draft Report on Title', 'Report on Title'],
  rot_query_addressed:  ['Final Report on Title'],
  contract_transfer:    ['Signed Contract', 'Transfer Deed', 'TR1'],
  compl_statement:         ['Completion Statement'],
  compl_statement_revised: ['Revised Completion Statement'],
};

const CHECKLIST_GROUPS = [
  {
    label: 'MoS',
    icon: 'ti-file-text',
    items: [
      { key: 'mos_received', label: 'MoS received' },
    ],
  },
  {
    label: 'Contract Pack',
    icon: 'ti-files',
    items: [
      { key: 'contract_rx',  label: 'Contract pack received' },
      { key: 'contract_rev', label: 'Red flag review completed' },
    ],
  },
  {
    label: 'Searches & Survey',
    icon: 'ti-search',
    items: [
      { key: 'search_la',        label: 'Searches ordered' },
      { key: 'survey_instructed', label: 'Survey instructed' },
      { key: 'search_la_r',      label: 'Local authority search received' },
      { key: 'search_water',     label: 'Water & drainage search received' },
      { key: 'search_env',       label: 'Environmental search received' },
      { key: 'survey_report',    label: 'Survey report received' },
    ],
  },
  {
    label: 'Report on Title',
    icon: 'ti-certificate',
    items: [
      { key: 'title_report',        label: 'Report on title prepared' },
      { key: 'rot_query_addressed', label: 'Upload final RoT' },
    ],
  },
  {
    label: 'Finance',
    icon: 'ti-coin',
    items: [
      { key: 'contract_transfer', label: 'Contract & Transfer prepared' },
    ],
  },
  {
    label: 'Exchange',
    icon: 'ti-exchange',
    items: [
      { key: 'exchange_ready', label: 'Exchange sign-off given' },
      { key: 'exchanged',      label: 'Exchanged' },
    ],
  },
  {
    label: 'Completion',
    icon: 'ti-home-check',
    items: [
      { key: 'compl_statement',         label: 'Completion statement prepared' },
      { key: 'compl_statement_revised', label: 'Revised completion statement uploaded' },
      { key: 'client_compl_appr',       label: 'Completion statement approved by client' },
      { key: 'client_funds_transferred', label: 'Funds transferred by client' },
      { key: 'funds',                   label: 'Funds confirmed' },
      { key: 'completed',               label: 'Completed' },
    ],
  },
];

// Items that TX uploads — legal portal should only view these, not upload them
const TX_UPLOADED_ITEMS: ReadonlySet<string> = new Set(['search_la_r', 'search_water', 'search_env', 'survey_report']);

const LEGAL_DATA_KEY = 'iris_legal_data';
const DR_KEY = 'iris_data_room';
const ROT_APPROVALS_KEY = 'iris_rot_approvals';
const SURVEYS_KEY = 'iris_surveys';
const COMPL_APPROVALS_KEY = 'iris_compl_approvals';
const FUNDS_TRANSFERS_KEY = 'iris_funds_transfers';

@Component({
  selector: 'app-legal-portal',
  templateUrl: './legal-portal.html',
  styleUrls: ['./legal-portal.scss'],
  standalone: true,
})
export class LegalPortalComponent {
  auth     = inject(AuthService);
  data     = inject(MockDataService);
  router   = inject(Router);
  projects = inject(ProjectsService);
  private doc = inject(DOCUMENT);

  view       = signal<LegalView>('matters');
  selectedId = signal<string | null>(null);
  noteText   = signal('');

  // Document review modal
  reviewModal = signal<{ title: string; files: DataRoomFile[]; propId: string; itemKey: string } | null>(null);

  // Upload modal
  showUploadModal = signal(false);
  uploadDocType   = signal('');
  uploadFileName  = signal('');
  uploadNote      = signal('');
  selectedFile    = signal<File | null>(null);

  // Exchange date modal
  showExchangeModal = signal<string | null>(null);
  exchangeDateDraft = signal('');


  readonly checklistGroups  = CHECKLIST_GROUPS;
  readonly itemDocTypes     = ITEM_DOC_TYPES;
  readonly txUploadedItems  = TX_UPLOADED_ITEMS;

  private legalData  = signal<Record<string, LegalMatterData>>(this._loadLegal());
  private txDataSig  = signal<Record<string, any>>(this._txRaw());
  complApprovalsSig  = signal<Record<string, any>>(
    JSON.parse(localStorage.getItem(COMPL_APPROVALS_KEY) ?? '{}')
  );

  fundTransfersSig = signal<Record<string, any>>(
    JSON.parse(localStorage.getItem(FUNDS_TRANSFERS_KEY) ?? '{}')
  );

  // Shared data room with transactions portal
  private dataRoom = signal<DataRoomFile[]>(
    (JSON.parse(localStorage.getItem(DR_KEY) ?? '[]') as DataRoomFile[])
      .map(f => ({ ...f, docType: f.docType.replace('Survey Report — ', 'Survey Report - ') }))
  );

  // Ordered surveys from TX portal
  private surveysData = signal<{ propertyId: string; type: string }[]>(
    JSON.parse(localStorage.getItem(SURVEYS_KEY) ?? '[]')
  );

  private rotApprovalsSig = signal<Record<string, { status: string; approvedBy?: string }>>(
    this._loadRotApprovals()
  );

  constructor() {
    effect(() => {
      const matters = this.activeMatters();
      const all = { ...this.legalData() };
      let updated = false;
      for (const p of matters) {
        if (!all[p.id]?.targetExchange) {
          const start = p.legalsStartedAt ? new Date(p.legalsStartedAt) : new Date();
          const exchange = new Date(start); exchange.setDate(exchange.getDate() + 56);
          const completion = new Date(exchange); completion.setDate(completion.getDate() + 14);
          all[p.id] = {
            ...(all[p.id] ?? this._defaultMatter()),
            targetExchange:   exchange.toISOString().split('T')[0],
            targetCompletion: completion.toISOString().split('T')[0],
          };
          updated = true;
        }
      }
      if (updated) this.legalData.set(all);
    });
    effect(() => {
      localStorage.setItem(LEGAL_DATA_KEY, JSON.stringify(this.legalData()));
    });
    effect(() => {
      localStorage.setItem(DR_KEY, JSON.stringify(this.dataRoom()));
    });
    const win = this.doc.defaultView;
    if (win) {
      win.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === 'iris_tx_data') this.txDataSig.set(this._txRaw());
        if (e.key === DR_KEY) {
          try { this.dataRoom.set(JSON.parse(e.newValue ?? '[]')); } catch { /* ignore */ }
        }
        if (e.key === ROT_APPROVALS_KEY) {
          try { this.rotApprovalsSig.set(JSON.parse(e.newValue ?? '{}')); } catch { /* ignore */ }
        }
        if (e.key === SURVEYS_KEY) {
          try { this.surveysData.set(JSON.parse(e.newValue ?? '[]')); } catch { /* ignore */ }
        }
        if (e.key === COMPL_APPROVALS_KEY) {
          try { this.complApprovalsSig.set(JSON.parse(e.newValue ?? '{}')); } catch { /* ignore */ }
        }
        if (e.key === FUNDS_TRANSFERS_KEY) {
          try { this.fundTransfersSig.set(JSON.parse(e.newValue ?? '{}')); } catch { /* ignore */ }
        }
      });
    }
  }

  private _loadLegal(): Record<string, LegalMatterData> {
    try {
      const raw = localStorage.getItem(LEGAL_DATA_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  }

  private _defaultMatter(): LegalMatterData {
    return { solicitorRef: '', checklist: {}, notes: [], targetExchange: '', targetCompletion: '' };
  }

  getMatter(id: string): LegalMatterData {
    return this.legalData()[id] ?? this._defaultMatter();
  }

  activeMatters = computed(() => {
    const tx = this.txDataSig();
    const userProjectIds = this.auth.currentUser()?.projects ?? [];
    const assignedPhases = new Set(
      this.projects.all
        .filter(proj => userProjectIds.includes(proj.id))
        .map(proj => proj.name)
    );
    if (!userProjectIds.length) return [];
    return this.data.properties.filter((p: Property) =>
      p.status === 'active' &&
      (p.stage === 'Legals' || p.stage === 'Lettings' || tx[p.id]?.solicitorInstructed) &&
      assignedPhases.has(p.phase)
    );
  });

  selectedProperty = computed(() => {
    const id = this.selectedId();
    return id ? this.data.getProperty(id) : undefined;
  });

  openRecord(p: Property): void {
    this.selectedId.set(p.id);
    this.view.set('record');
    this.doc.querySelector('.lg-content')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  navTo(v: LegalView): void {
    this.view.set(v);
    this.doc.querySelector('.lg-content')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ── Checklist ─────────────────────────────────────────
  toggleCheck(propId: string, key: string): void {
    this.legalData.update(all => {
      const m = { ...(all[propId] ?? this._defaultMatter()) };
      m.checklist = { ...m.checklist, [key]: !m.checklist[key] };
      return { ...all, [propId]: m };
    });
  }

  recordExchange(propId: string, date: string): void {
    this.legalData.update(all => {
      const m = { ...(all[propId] ?? this._defaultMatter()) };
      m.checklist = { ...m.checklist, exchanged: true };
      m.exchangedDate = date;
      return { ...all, [propId]: m };
    });
    this.showExchangeModal.set(null);
    this.exchangeDateDraft.set('');
  }

  exchangedDateFor(propId: string): string | undefined {
    return this.legalData()[propId]?.exchangedDate;
  }

  isItemDone(propId: string, itemKey: string): boolean {
    if (this.getMatter(propId).checklist[itemKey]) return true;
    // Auto-check from data room docs
    const types = ITEM_DOC_TYPES[itemKey] ?? [];
    if (types.length && (itemKey === 'mos_received' || itemKey === 'contract_rx' || itemKey === 'rot_query_addressed' || itemKey === 'contract_transfer' || itemKey === 'compl_statement' || TX_UPLOADED_ITEMS.has(itemKey))) {
      if (this.dataRoom().some(f => f.propertyId === propId && types.some(t => f.docType.toLowerCase().includes(t.toLowerCase())))) return true;
    }
    // Auto-check from TX portal actions
    if (itemKey === 'search_la' || itemKey === 'survey_instructed') {
      return !!this.txDataSig()[propId]?.checklist?.['searches_ordered'];
    }
    if (itemKey === 'client_compl_appr') {
      return !!this.complApprovalsSig()[propId];
    }
    if (itemKey === 'client_funds_transferred') {
      return !!this.fundTransfersSig()[propId];
    }
    return false;
  }

  private _isItemVisible(propId: string, key: string): boolean {
    if (key === 'compl_statement_revised') return !!this.txComplStatementQuery(propId);
    if (key === 'client_compl_appr') return !!this.legalData()[propId]?.checklist?.['compl_statement'] || this.dataRoom().some(f => f.propertyId === propId && f.docType === 'Completion Statement');
    if (key === 'client_funds_transferred') return !!this.legalData()[propId]?.checklist?.['compl_statement'] || this.dataRoom().some(f => f.propertyId === propId && f.docType === 'Completion Statement');
    return true;
  }

  checkProgress(propId: string): { done: number; total: number } {
    const total = CHECKLIST_GROUPS.reduce((s, g) => s + g.items.filter(i => this._isItemVisible(propId, i.key)).length, 0);
    const done  = CHECKLIST_GROUPS.reduce((s, g) => s + g.items.filter(i => this._isItemVisible(propId, i.key) && this.isItemDone(propId, i.key)).length, 0);
    return { done, total };
  }

  hasAuthorityToExchange(propId: string): boolean {
    return !!this.txDataSig()[propId]?.authorityToExchange;
  }

  txCheck(propId: string, key: string): boolean {
    return !!this.txDataSig()[propId]?.checklist?.[key];
  }

  txRotQuery(propId: string): string {
    return this.txDataSig()[propId]?.rotQuery ?? '';
  }

  txComplStatementQuery(propId: string): string {
    return this.txDataSig()[propId]?.complStatementQuery ?? this._txRaw()[propId]?.complStatementQuery ?? '';
  }

  private _txRaw(): Record<string, any> {
    try { return JSON.parse(localStorage.getItem('iris_tx_data') ?? '{}'); } catch { return {}; }
  }

  private _loadRotApprovals(): Record<string, { status: string; approvedBy?: string }> {
    try { return JSON.parse(localStorage.getItem(ROT_APPROVALS_KEY) ?? '{}'); } catch { return {}; }
  }

  rotClientApproved(propId: string): boolean {
    return this.rotApprovalsSig()[propId]?.status === 'approved';
  }

  rotClientPending(propId: string): boolean {
    return this.rotApprovalsSig()[propId]?.status === 'pending';
  }

  isExchangeReady(propId: string): boolean {
    const m = this.getMatter(propId);
    return ['search_la_r','search_water','search_env','survey_report','contract_rev','rot_query_addressed','contract_transfer','funds']
      .every(k => m.checklist[k]);
  }

  groupProgress(propId: string, group: typeof CHECKLIST_GROUPS[0]): number {
    return group.items.filter(i => this._isItemVisible(propId, i.key) && this.isItemDone(propId, i.key)).length;
  }

  groupTotal(propId: string, group: typeof CHECKLIST_GROUPS[0]): number {
    return group.items.filter(i => this._isItemVisible(propId, i.key)).length;
  }

  // ── Document room ──────────────────────────────────────
  docsForProperty(propId: string): DataRoomFile[] {
    return this.dataRoom().filter(f => f.propertyId === propId);
  }

  surveysForProp(propId: string): { propertyId: string; type: string }[] {
    return this.surveysData().filter(s => s.propertyId === propId);
  }

  docsForSurveyType(propId: string, surveyType: string): DataRoomFile[] {
    const docType = 'Survey Report - ' + surveyType;
    return this.dataRoom().filter(f => f.propertyId === propId && f.docType === docType);
  }

  docsForItem(propId: string, itemKey: string): DataRoomFile[] {
    const types = ITEM_DOC_TYPES[itemKey] ?? [];
    if (!types.length) return [];
    return this.dataRoom().filter(
      f => f.propertyId === propId && types.some(t => f.docType.toLowerCase().includes(t.toLowerCase()))
    );
  }

  openReview(propId: string, itemKey: string, itemLabel: string, files: DataRoomFile[]): void {
    this.reviewModal.set({ title: itemLabel, files, propId, itemKey });
  }

  doneReviewing(): void {
    const modal = this.reviewModal();
    if (!modal) return;
    if (!this.getMatter(modal.propId).checklist[modal.itemKey]) {
      this.toggleCheck(modal.propId, modal.itemKey);
    }
    this.reviewModal.set(null);
  }

  triggerFileInput(): void {
    this.doc.getElementById('lg-file-input')?.click();
  }

  onFileSelected(event: Event): void {
    const f = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.selectedFile.set(f);
    if (f && !this.uploadFileName()) this.uploadFileName.set(f.name);
  }

  uploadDoc(propId: string, stage: string = 'Legals'): void {
    const docType = this.uploadDocType().trim();
    const file = this.selectedFile();
    if (!docType || !file) return;
    const entryId = 'dr_' + Date.now();
    const entry: DataRoomFile = {
      id: entryId,
      propertyId: propId,
      stage,
      fileName: this.uploadFileName().trim() || file.name,
      docType,
      uploadedBy: this.auth.currentUser()?.name ?? 'Solicitor',
      uploadedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      note: this.uploadNote().trim(),
    };
    this.uploadDocType.set('');
    this.uploadFileName.set('');
    this.uploadNote.set('');
    this.selectedFile.set(null);
    this.showUploadModal.set(false);
    const input = this.doc.getElementById('lg-file-input') as HTMLInputElement | null;
    if (input) input.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      this.dataRoom.update(list => [...list, { ...entry, url: reader.result as string }]);
      if (docType === 'Final Report on Title') {
        const current = { ...this.rotApprovalsSig() };
        if (current[propId]?.status !== 'approved') {
          current[propId] = { status: 'pending' };
          localStorage.setItem(ROT_APPROVALS_KEY, JSON.stringify(current));
          this.rotApprovalsSig.set(current);
        }
      }
    };
    reader.readAsDataURL(file);
  }

  previewFile(file: DataRoomFile): void {
    if (!file.url) return;
    const [header, b64] = file.url.split(',');
    const mime = (header.match(/:(.*?);/) ?? [])[1] ?? 'application/octet-stream';
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    window.open(URL.createObjectURL(new Blob([arr], { type: mime })), '_blank');
  }

  deleteDoc(fileId: string): void {
    this.dataRoom.update(list => list.filter(f => f.id !== fileId));
  }

  // ── Notes ──────────────────────────────────────────────
  addNote(propId: string): void {
    const text = this.noteText().trim();
    if (!text) return;
    const note: LegalNote = {
      id: Date.now().toString(),
      text,
      author: this.auth.currentUser()?.name ?? 'Solicitor',
      ts: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
    this.legalData.update(all => {
      const m = { ...(all[propId] ?? this._defaultMatter()) };
      m.notes = [note, ...(m.notes ?? [])];
      return { ...all, [propId]: m };
    });
    this.noteText.set('');
  }

  // ── Dates / ref ────────────────────────────────────────
  setDate(propId: string, field: 'targetExchange' | 'targetCompletion', val: string): void {
    this.legalData.update(all => {
      const m = { ...(all[propId] ?? this._defaultMatter()) };
      m[field] = val;
      return { ...all, [propId]: m };
    });
  }

  setSolicitorRef(propId: string, val: string): void {
    this.legalData.update(all => {
      const m = { ...(all[propId] ?? this._defaultMatter()) };
      m.solicitorRef = val;
      return { ...all, [propId]: m };
    });
  }

  queryResponseDraft = signal('');

  submitQueryResponse(propId: string): void {
    const text = this.queryResponseDraft().trim();
    if (!text) return;
    this.legalData.update(all => {
      const m = { ...(all[propId] ?? this._defaultMatter()) };
      m.rotQueryResponse = text;
      return { ...all, [propId]: m };
    });
    // Write response back to txData so TX portal can see it
    try {
      const tx = this._txRaw();
      tx[propId] = { ...(tx[propId] ?? {}), rotQueryResponse: text };
      localStorage.setItem('iris_tx_data', JSON.stringify(tx));
      this.txDataSig.set(tx);
    } catch { /* ignore */ }
    this.queryResponseDraft.set('');
  }

  isOverdue(dateStr: string): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date(new Date().toDateString());
  }

  fmtDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  logout(): void {
    this.auth.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
