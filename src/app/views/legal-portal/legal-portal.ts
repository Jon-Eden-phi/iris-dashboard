import { Component, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { MockDataService } from '../../services/mock-data';
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
}

// Maps checklist keys to document types they relate to
// Only items where there is an actual document to review before signing off.
// Action-only confirmations (ordered, raised, sent, sign-off, exchanged etc.) have no entry.
const ITEM_DOC_TYPES: Record<string, string[]> = {
  mos_received:  ['Memorandum of Sale', 'MoS'],
  search_la_r:   ['Local Authority Search', 'Searches'],
  search_water:  ['Water & Drainage Search', 'Water Search', 'Searches'],
  search_env:    ['Environmental Search', 'Searches'],
  contract_rx:   ['Draft Contract', 'Contract Pack'],
  contract_rev:  ['Draft Contract', 'Contract Pack'],
  enquiries_in:  ['Enquiries', 'Replies to Enquiries'],
  title_report:  ['Report on Title', 'Draft Report on Title'],
};

const CHECKLIST_GROUPS = [
  {
    label: 'MoS',
    items: [
      { key: 'mos_received', label: 'MoS received' },
    ],
  },
  {
    label: 'Searches',
    items: [
      { key: 'search_la',    label: 'Local authority search ordered' },
      { key: 'search_la_r',  label: 'Local authority search received' },
      { key: 'search_water', label: 'Water & drainage search received' },
      { key: 'search_env',   label: 'Environmental search received' },
    ],
  },
  {
    label: 'Contract & Enquiries',
    items: [
      { key: 'contract_rx',   label: 'Draft contract received' },
      { key: 'contract_rev',  label: 'Contract reviewed' },
      { key: 'enquiries_out', label: 'Enquiries raised' },
      { key: 'enquiries_in',  label: 'Enquiries answered' },
    ],
  },
  {
    label: 'Title & Finance',
    items: [
      { key: 'title_report',  label: 'Report on title prepared' },
      { key: 'title_sent',    label: 'Report sent to client' },
      { key: 'funds',         label: 'Funds confirmed' },
    ],
  },
  {
    label: 'Exchange',
    items: [
      { key: 'exchange_ready', label: 'Exchange sign-off given' },
      { key: 'exchanged',      label: 'Exchanged' },
      { key: 'completed',      label: 'Completed' },
    ],
  },
];

const LEGAL_DATA_KEY = 'iris_legal_data';
const DR_KEY = 'iris_data_room';

@Component({
  selector: 'app-legal-portal',
  templateUrl: './legal-portal.html',
  styleUrls: ['./legal-portal.scss'],
  standalone: true,
})
export class LegalPortalComponent {
  auth   = inject(AuthService);
  data   = inject(MockDataService);
  router = inject(Router);
  private doc = inject(DOCUMENT);

  view       = signal<LegalView>('matters');
  selectedId = signal<string | null>(null);
  noteText   = signal('');

  // Document review modal
  reviewModal = signal<{ title: string; files: DataRoomFile[] } | null>(null);

  // Upload modal
  showUploadModal = signal(false);
  uploadDocType   = signal('');
  uploadFileName  = signal('');
  uploadNote      = signal('');
  selectedFile    = signal<File | null>(null);


  readonly checklistGroups = CHECKLIST_GROUPS;
  readonly itemDocTypes    = ITEM_DOC_TYPES;

  private legalData  = signal<Record<string, LegalMatterData>>(this._loadLegal());
  private txDataSig  = signal<Record<string, any>>(this._txRaw());

  // Shared data room with transactions portal
  private dataRoom = signal<DataRoomFile[]>(
    JSON.parse(localStorage.getItem(DR_KEY) ?? '[]')
  );

  constructor() {
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
    return this.data.properties.filter((p: Property) =>
      p.status === 'active' &&
      (p.stage === 'Legals' || tx[p.id]?.solicitorInstructed)
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

  checkProgress(propId: string): { done: number; total: number } {
    const m = this.getMatter(propId);
    const total = CHECKLIST_GROUPS.reduce((s, g) => s + g.items.length, 0);
    const done  = CHECKLIST_GROUPS.reduce((s, g) => s + g.items.filter(i => m.checklist[i.key]).length, 0);
    return { done, total };
  }

  hasAuthorityToExchange(propId: string): boolean {
    return !!this.txDataSig()[propId]?.authorityToExchange;
  }

  txCheck(propId: string, key: string): boolean {
    return !!this.txDataSig()[propId]?.checklist?.[key];
  }

  private _txRaw(): Record<string, any> {
    try { return JSON.parse(localStorage.getItem('iris_tx_data') ?? '{}'); } catch { return {}; }
  }

  isExchangeReady(propId: string): boolean {
    const m = this.getMatter(propId);
    return ['search_la_r','search_water','search_env','contract_rev','enquiries_in','title_sent','funds']
      .every(k => m.checklist[k]);
  }

  groupProgress(propId: string, group: typeof CHECKLIST_GROUPS[0]): number {
    const m = this.getMatter(propId);
    return group.items.filter(i => m.checklist[i.key]).length;
  }

  // ── Document room ──────────────────────────────────────
  docsForProperty(propId: string): DataRoomFile[] {
    return this.dataRoom().filter(f => f.propertyId === propId);
  }

  docsForItem(propId: string, itemKey: string): DataRoomFile[] {
    const types = ITEM_DOC_TYPES[itemKey] ?? [];
    if (!types.length) return [];
    return this.dataRoom().filter(
      f => f.propertyId === propId && types.some(t => f.docType.toLowerCase().includes(t.toLowerCase()))
    );
  }

  openReview(itemLabel: string, files: DataRoomFile[]): void {
    this.reviewModal.set({ title: itemLabel, files });
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
    if (!docType || !this.selectedFile()) return;
    const fileName = this.uploadFileName().trim() || this.selectedFile()!.name;
    const entry: DataRoomFile = {
      id: 'dr_' + Date.now(),
      propertyId: propId,
      stage,
      fileName,
      docType,
      uploadedBy: this.auth.currentUser()?.name ?? 'Solicitor',
      uploadedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      note: this.uploadNote().trim(),
    };
    this.dataRoom.update(list => [...list, entry]);
    this.uploadDocType.set('');
    this.uploadFileName.set('');
    this.uploadNote.set('');
    this.selectedFile.set(null);
    this.showUploadModal.set(false);
    // Reset the file input so the same file can be re-selected later
    const input = this.doc.getElementById('lg-file-input') as HTMLInputElement | null;
    if (input) input.value = '';
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

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  logout(): void {
    this.auth.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
