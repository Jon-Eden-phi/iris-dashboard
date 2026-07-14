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

const CHECKLIST_GROUPS = [
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

  view      = signal<LegalView>('matters');
  selectedId = signal<string | null>(null);
  noteText   = signal('');

  readonly checklistGroups = CHECKLIST_GROUPS;

  private legalData = signal<Record<string, LegalMatterData>>(this._load());

  constructor() {
    effect(() => {
      localStorage.setItem(LEGAL_DATA_KEY, JSON.stringify(this.legalData()));
    });
  }

  private _load(): Record<string, LegalMatterData> {
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

  // Properties currently in Legals stage
  activeMatters = computed(() =>
    this.data.properties.filter((p: Property) => p.stage === 'Legals' && p.status === 'active')
  );

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

  // Checklist
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

  isExchangeReady(propId: string): boolean {
    const m = this.getMatter(propId);
    const prereqs = ['search_la_r','search_water','search_env','contract_rev','enquiries_in','title_sent','funds'];
    return prereqs.every(k => m.checklist[k]);
  }

  groupProgress(propId: string, group: typeof CHECKLIST_GROUPS[0]): number {
    const m = this.getMatter(propId);
    return group.items.filter(i => m.checklist[i.key]).length;
  }

  // Notes
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

  // Key dates
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
