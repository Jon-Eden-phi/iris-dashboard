import { Component, computed, effect, inject, signal, WritableSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, TitleCasePipe, DOCUMENT } from '@angular/common';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { MockDataService } from '../../services/mock-data';
import { DataRoomStore } from '../../services/data-room';
import { DecisionsService } from '../../services/decisions';
import { ProjectsService } from '../../services/projects';
import { Property } from '../../models/property.model';

type TxView = 'homes' | 'queries' | 'lost' | 'surveys' | 'teamdash' | 'suppliers' | 'record' | 'acquisitions' | 'acq-record' | 'pipeline';

const SURVEYS_KEY = 'iris_surveys';

const TX_STAGES = new Set(['MemorandumOfSale', 'Legals', 'Refurbishment', 'Lettings']);
const ACQ_STAGES = new Set(['Draft', 'ClientApproval', 'Viewing', 'Negotiations']);

const TX_STAGE_LABELS: Record<string, string> = {
  MemorandumOfSale: 'MoS',
  Legals: 'Conveyancing',
  Refurbishment: 'Surveys',
  Lettings: 'Exchange / Completion',
};

const ALL_STAGE_LABELS: Record<string, string> = {
  Draft: 'Draft', ClientApproval: 'Client Appr.', Viewing: 'Viewing', Negotiations: 'Negotiate',
  MemorandumOfSale: 'MoS', Legals: 'Legals', Refurbishment: 'Refurb', Lettings: 'Lettings',
};

const ALL_STAGES = ['Draft','ClientApproval','Viewing','Negotiations','MemorandumOfSale','Legals','Refurbishment','Lettings'];

interface Survey {
  property: string;
  propertyId: string;
  type: string;
  provider: string;
  instructed: string;
  siteVisit: string | null;
  returned: string | null;
  status: 'Instructed' | 'Booked' | 'Awaiting report' | 'Returned';
  cost: number;
}

interface Query {
  id: string;
  property: string;
  doc: string;
  text: string;
  raisedBy: string;
  assignedTo: string;
  status: 'Open' | 'Resolved';
  date: string;
  direction: 'raised' | 'owed';
  response?: string;
  resolvedDate?: string;
}

interface LostTx {
  address: string;
  postcode: string;
  reason: string;
  detail: string;
  date: string;
  stageWhenLost: string;
}

interface TxNote {
  id: string;
  text: string;
  category: 'general' | 'action' | 'warning';
  author: string;
  ts: string;
}

interface TxFee {
  id: string;
  type: string;
  amount: number;
  billingPoint: string;
}

interface TxPropertyData {
  exchangeDate: string;
  completionDate: string;
  checklist: Record<string, boolean>;
  txLog: Array<{ text: string; ts: string; author: string }>;
  notes?: TxNote[];
  fees?: TxFee[];
  solicitorInstructed?: boolean;
  solicitorName?: string;
  authorityToExchange?: boolean;
  rotQuery?: string;
  rotQueryResponse?: string;
  complStatementQuery?: string;
  complStatementSentToClient?: boolean;
  fundsRequest?: { amount: number; requestedAt: string; note?: string };
}

interface DataRoomFile {
  id: string;
  propertyId: string;
  stage: string;
  docType: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  note: string;
  url?: string;
}

@Component({
  selector: 'app-transactions-portal',
  imports: [DatePipe, TitleCasePipe, RouterLink, MoneyPipe],
  templateUrl: './transactions-portal.html',
  styleUrl: './transactions-portal.scss',
})
export class TransactionsPortalComponent {
  auth      = inject(AuthService);
  data      = inject(MockDataService);
  router    = inject(Router);
  decisions = inject(DecisionsService);
  projects  = inject(ProjectsService);
  private doc = inject(DOCUMENT);
  private drStore = inject(DataRoomStore);

  constructor() {
    effect(() => {
      localStorage.setItem(this.TX_DATA_KEY, JSON.stringify(this.txData()));
    });
    effect(() => {
      localStorage.setItem(SURVEYS_KEY, JSON.stringify(this.surveys()));
    });
    const win = this.doc.defaultView;
    if (win) {
      win.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === this.ROT_APPROVALS_KEY) {
          try { this.rotApprovalsSig.set(JSON.parse(e.newValue ?? '{}')); } catch { /* ignore */ }
        }
        if (e.key === this.CONTRACT_SIGNS_KEY) {
          try { this.contractSignsSig.set(JSON.parse(e.newValue ?? '{}')); } catch { /* ignore */ }
        }
        if (e.key === this.LEGAL_DATA_KEY) {
          try { this.legalDataSig.set(JSON.parse(e.newValue ?? '{}')); } catch { /* ignore */ }
        }
        if (e.key === this.COMPL_APPROVALS_KEY) {
          try { this.complApprovalsSig.set(JSON.parse(e.newValue ?? '{}')); } catch { /* ignore */ }
        }
        if (e.key === this.FUNDS_TRANSFERS_KEY) {
          try { this.fundTransfersSig.set(JSON.parse(e.newValue ?? '{}')); } catch { /* ignore */ }
        }
      });
    }

    // Auto-advance stage when all checklist items are complete
    const TX_STAGES = new Set(['MemorandumOfSale', 'Legals', 'Refurbishment', 'Lettings']);
    effect(() => {
      for (const p of this.data.properties) {
        if (p.status !== 'active' || !TX_STAGES.has(p.stage)) continue;
        if (this.stageStatus(p.id, p.stage).done) {
          this.data.advanceStage(p.id);
        }
      }
    });
  }

  filesForProperty(propId: string): DataRoomFile[] {
    const q = this.drSearch().toLowerCase();
    return this.dataRoom().filter(f => {
      if (f.propertyId !== propId) return false;
      if (q && !f.fileName.toLowerCase().includes(q) && !f.docType.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  filesForStageSection(propId: string, stage: string): DataRoomFile[] {
    const q = this.drSearch().toLowerCase();
    return this.dataRoom().filter(f => {
      if (f.propertyId !== propId || f.stage !== stage) return false;
      if (q && !f.fileName.toLowerCase().includes(q) && !f.docType.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  readonly dataRoomSections = [
    { stage: 'Draft',              label: 'Draft',               icon: 'ti-pencil'       },
    { stage: 'ClientApproval',     label: 'Client Approval',     icon: 'ti-user-check'   },
    { stage: 'Viewing',            label: 'Viewing',             icon: 'ti-eye'          },
    { stage: 'Negotiations',       label: 'Negotiations',        icon: 'ti-messages'     },
    { stage: 'MemorandumOfSale',   label: 'MoS',                 icon: 'ti-file-text'    },
    { stage: 'Legals',             label: 'Conveyancing',        icon: 'ti-scale'        },
    { stage: 'Refurbishment',      label: 'Surveys & Refurb',    icon: 'ti-clipboard'    },
    { stage: 'Lettings',           label: 'Exchange / Lettings', icon: 'ti-home-check'   },
  ];

  deleteFile(fileId: string): void {
    this.dataRoom.update(list => list.filter(f => f.id !== fileId));
    this.showToast('File removed', 'ti-trash');
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

  drExpandedStages = signal<Set<string>>(new Set());

  toggleDrStage(stage: string): void {
    this.drExpandedStages.update(s => {
      const next = new Set(s);
      next.has(stage) ? next.delete(stage) : next.add(stage);
      return next;
    });
  }

  view              = signal<TxView>('homes');
  selectedId        = signal<string | null>(null);
  acqSelectedId     = signal<string | null>(null);
  selectedStageView = signal<string | null>(null);
  searchQuery   = signal('');
  stageFilter   = signal('all');
  selectedPhase = signal('all');

  // Dashboard table sort
  homeSortCol = signal('');
  homeSortDir = signal<'asc' | 'desc'>('asc');

  homeSortBy(col: string): void {
    if (this.homeSortCol() === col) {
      this.homeSortDir.set(this.homeSortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.homeSortCol.set(col);
      this.homeSortDir.set('asc');
    }
  }

  // Pipeline table sort
  pipeSortCol = signal('');
  pipeSortDir = signal<'asc' | 'desc'>('asc');

  pipeSortBy(col: string): void {
    if (this.pipeSortCol() === col) {
      this.pipeSortDir.set(this.pipeSortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.pipeSortCol.set(col);
      this.pipeSortDir.set('asc');
    }
  }

  private readonly EPC_RANK: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 };
  private readonly TX_STAGE_ORDER = ['MemorandumOfSale', 'Legals', 'Refurbishment', 'Lettings'];
  private readonly ALL_STAGE_ORDER = ['Draft','ClientApproval','Viewing','Negotiations','MemorandumOfSale','Legals','Refurbishment','Lettings'];

  private propVal(p: Property, col: string): string | number {
    switch (col) {
      case 'address':   return p.address;
      case 'phase':     return p.phase ?? '';
      case 'stage':     return this.ALL_STAGE_ORDER.indexOf(p.stage);
      case 'beds':      return p.beds ?? 0;
      case 'epcBefore': return this.EPC_RANK[p.epcBefore?.r ?? ''] ?? 99;
      case 'epcAfter':  return this.EPC_RANK[p.epcAfter?.r ?? ''] ?? 99;
      case 'ap':        return p.financial?.ap ?? 0;
      case 'purchasePrice': return p.agreedPrice ?? p.financial?.ap ?? 0;
      case 'valuation': return p.valuation ?? 0;
      case 'yield':     return p.financial?.yield ?? 0;
      case 'dept':      return this.txSourceStages.has(p.stage) ? 'Sourcing' : 'Purchasing';
      case 'type':      return p.type ?? '';
      case 'tc':        return p.financial?.tc ?? 0;
      default:          return '';
    }
  }

  private applySort(list: Property[], col: string, dir: 'asc' | 'desc'): Property[] {
    if (!col) return list;
    return [...list].sort((a, b) => {
      const va = this.propVal(a, col);
      const vb = this.propVal(b, col);
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb));
      return dir === 'asc' ? cmp : -cmp;
    });
  }

  showNoteModal      = signal(false);
  showQueryModal     = signal(false);
  showAbortModal     = signal(false);
  showSurveyModal    = signal(false);
  showResponseModal  = signal(false);
  showUploadModal      = signal(false);
  showRevertModal      = signal(false);
  respondingQueryId    = signal<string | null>(null);
  responseText         = signal('');
  uploadDocType        = signal('MoS');
  uploadDocTypeFilter  = signal<string[] | null>(null);
  uploadNote           = signal('');
  uploadFileName       = signal('');
  selectedFile         = signal<File | null>(null);

  triggerTxFileInput(): void {
    this.doc.getElementById('tx-file-input')?.click();
  }

  onTxFileSelected(event: Event): void {
    const f = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.selectedFile.set(f);
    if (f && !this.uploadFileName()) this.uploadFileName.set(f.name);
  }
  revertComment      = signal('');

  showSearchesModal        = signal(false);
  showFeeEarnerModal       = signal(false);
  showDraftRotModal        = signal(false);
  showContractPackModal    = signal(false);
  showInstructSurveysModal    = signal(false);
  showAdditionalWorksModal    = signal(false);
  showInstructSolicitorModal  = signal(false);
  instructSolicitorName       = signal('');
  showReviewDocModal          = signal(false);
  showRequestFundsModal           = signal(false);
  showAuthorityModal              = signal(false);
  showInvestorAuthorityModal      = signal(false);
  showExchangeDateModal           = signal(false);
  showCompletionDateModal         = signal(false);
  exchangeDateInput               = signal('');
  completionDateInput             = signal('');
  requestFundsNote                = signal('');
  requestFundsAmount              = signal('');
  legalActionsOpen            = signal(false);
  additionalWorksDescription  = signal('');
  additionalWorksCost         = signal('');
  requestChangesNote          = signal('');
  showRequestChangesInput     = signal(false);
  reviewDocContext            = signal<{ propId: string; checklistKey: string; checklistLabel: string; title: string; docTypes: string[]; surveyType?: string } | null>(null);
  searchAssignee        = signal('');
  searchComments        = signal('');
  selectedSearches      = signal<Set<string>>(new Set());
  feeEarnerName         = signal('');
  surveyOrderAssignee   = signal('');
  surveyOrderComments   = signal('');
  selectedSurveyOrders  = signal<Set<string>>(new Set());

  readonly availableSurveyTypes = [
    'Electrical (EICR)',
    'Gas safety',
    'Home Buyers and Valuation',
    'Structural',
    'Roof condition',
    'Damp / EPC follow-up',
    'Fire risk assessment',
    'Asbestos',
  ];
  uploadRotNote         = signal('');
  uploadRotFileName     = signal('');
  uploadRotFile         = signal<File | null>(null);
  contractPackNote      = signal('');
  contractPackFileName  = signal('');
  contractReceivedDate  = signal('');

  readonly stageDocTypes: Record<string, string[]> = {
    MemorandumOfSale: ['MoS', 'Offer Letter', 'ID Verification', 'Property Information Form', 'Other'],
    Legals:           ['Contract Pack', 'Draft Report on Title', 'Report on Title', 'Annexure', 'Searches', 'Transfer Deed', 'Enquiries', 'Replies to Enquiries', 'Other'],
    Refurbishment:    ['Survey Report', 'Asbestos Survey', 'Scope of Works', 'Contractor Quote', 'EPC', 'Building Regulations', 'Searches', 'Other'],
    Lettings:         ['Signed Contract', 'Transfer Deed', 'TR1', 'Completion Statement', 'Land Registry', 'Tenancy Agreement', 'Inventory', 'Other'],
  };

  docTypesForStage(stage: string): string[] {
    return this.stageDocTypes[stage] ?? ['Other'];
  }

  readonly availableSearches = [
    'Local authority search',
    'Water and drainage search',
    'Environmental search',
    'Chancel repair liability',
    'Land registry search',
    'Planning search',
  ];

  noteInput        = signal('');
  noteText         = signal('');
  noteCat          = signal<'general' | 'action' | 'warning'>('general');
  queryDoc         = signal('');
  queryAssignee    = signal('');
  queryText        = signal('');
  abortReason      = signal('');
  surveyType       = signal('');
  surveyProvider   = signal('');
  surveyCost       = signal('');
  surveySiteVisit  = signal('');

  toast            = signal('');
  toastVisible     = signal(false);

  private readonly TX_DATA_KEY = 'iris_tx_data';
  private readonly ROT_APPROVALS_KEY = 'iris_rot_approvals';
  private readonly CONTRACT_SIGNS_KEY = 'iris_contract_signs';
  private readonly LEGAL_DATA_KEY = 'iris_legal_data';
  private readonly COMPL_APPROVALS_KEY = 'iris_compl_approvals';
  private readonly FUNDS_TRANSFERS_KEY = 'iris_funds_transfers';

  txData = signal<Record<string, TxPropertyData>>(
    JSON.parse(localStorage.getItem('iris_tx_data') ?? '{}')
  );

  // Shared across all portals via IndexedDB + BroadcastChannel (see DataRoomStore).
  get dataRoom(): WritableSignal<DataRoomFile[]> {
    return this.drStore.files as unknown as WritableSignal<DataRoomFile[]>;
  }

  private rotApprovalsSig = signal<Record<string, { status: string }>>(
    JSON.parse(localStorage.getItem('iris_rot_approvals') ?? '{}')
  );

  private contractSignsSig = signal<Record<string, { signedAt: string }>>(
    JSON.parse(localStorage.getItem('iris_contract_signs') ?? '{}')
  );

  private legalDataSig = signal<Record<string, any>>(
    JSON.parse(localStorage.getItem('iris_legal_data') ?? '{}')
  );

  complApprovalsSig = signal<Record<string, any>>(
    JSON.parse(localStorage.getItem('iris_compl_approvals') ?? '{}')
  );

  fundTransfersSig = signal<Record<string, any>>(
    JSON.parse(localStorage.getItem('iris_funds_transfers') ?? '{}')
  );

  isRotApproved(propId: string): boolean {
    return this.rotApprovalsSig()[propId]?.status === 'approved';
  }

  isContractSigned(propId: string): boolean {
    return !!this.contractSignsSig()[propId];
  }

  pipelineSearch = signal('');

  readonly txSourceStages = new Set(['Draft', 'ClientApproval', 'Viewing', 'Negotiations']);

  pipelineAllProperties = computed(() => {
    const q   = this.pipelineSearch().toLowerCase();
    const col = this.pipeSortCol();
    const dir = this.pipeSortDir();
    let list = this.data.properties.filter(p => {
      if (p.status !== 'active') return false;
      if (!q) return true;
      return p.address.toLowerCase().includes(q) || (p.postcode ?? '').toLowerCase().includes(q);
    });
    return this.applySort(list, col, dir);
  });

  txDeptLabel(stage: string): string {
    return this.txSourceStages.has(stage) ? 'Sourcing' : 'Purchasing';
  }

  navigateToRecord(p: Property): void {
    this.router.navigate(['/record', p.id]);
  }

  recordTab  = signal<'flow' | 'dataroom' | 'property' | 'media' | 'fees' | 'milestones' | 'parties' | 'notes'>('flow');
  mediaSubTab = signal<'inspection' | 'agent' | 'floorplan' | 'matterport'>('inspection');
  drSearch   = signal('');
  drStageFilter = signal('all');

  readonly TX_STAGE_LABELS = TX_STAGE_LABELS;

  readonly phases = [
    { id: 'all',           label: 'All Phases',         color: '#888'    },
    { id: 'Bristol P3',    label: 'Bristol — Phase 3',  color: '#2472a8' },
    { id: 'Merton LAHF',   label: 'Merton LAHF',        color: '#0f7c6b' },
    { id: 'Leeds P1',      label: 'Leeds — Phase 1',    color: '#7c3aed' },
    { id: 'Hastings ESPH', label: 'Hastings ESPH',      color: '#E8601C' },
  ];

  private readonly _surveySeed: Survey[] = [
    { property: '19 Beaumont Road',   propertyId: '', type: 'Electrical (EICR)',    provider: 'Aziza Surveys', instructed: '23/06/2026', siteVisit: '27/06/2026', returned: null,          status: 'Booked',          cost: 180 },
    { property: '19 Beaumont Road',   propertyId: '', type: 'Gas safety',           provider: 'Aziza Surveys', instructed: '23/06/2026', siteVisit: '27/06/2026', returned: null,          status: 'Booked',          cost: 90  },
    { property: '675 Whitchurch Lane',propertyId: '', type: 'Home Buyers and Valuation', provider: 'BRE',      instructed: '14/06/2026', siteVisit: '18/06/2026', returned: '24/06/2026',  status: 'Returned',        cost: 420 },
    { property: '675 Whitchurch Lane',propertyId: '', type: 'Roof condition',       provider: 'BRE',           instructed: '25/06/2026', siteVisit: null,          returned: null,          status: 'Instructed',      cost: 240 },
    { property: '14 Lanercost Road',  propertyId: '', type: 'Home Buyers and Valuation', provider: 'Savills',  instructed: '10/06/2026', siteVisit: '13/06/2026', returned: '17/06/2026',  status: 'Returned',        cost: 350 },
    { property: '14 Lanercost Road',  propertyId: '', type: 'Structural',           provider: 'BRE',           instructed: '18/06/2026', siteVisit: '22/06/2026', returned: null,          status: 'Awaiting report', cost: 580 },
  ];
  surveys = signal<Survey[]>(
    JSON.parse(localStorage.getItem(SURVEYS_KEY) ?? 'null') ?? this._surveySeed
  );

  queries = signal<Query[]>([
    { id: 'q1', property: '19 Beaumont Road',    doc: 'EPC certificate',           text: 'EPC shows expiry 2034 but the uploaded scan shows 2033 — please confirm which is correct.',                raisedBy: 'Jiya Chowdhury', assignedTo: 'Hayley Briggs (Winkworth Sherwood)',  status: 'Open', date: '21/06/2026', direction: 'raised' },
    { id: 'q2', property: '675 Whitchurch Lane', doc: 'Report on Title — draft',   text: 'Restrictive covenant on rear access — please clarify impact on standard residential use.',                raisedBy: 'Hayley Briggs (Winkworth Sherwood)', assignedTo: 'Jiya Chowdhury', status: 'Open', date: '20/06/2026', direction: 'owed'   },
    { id: 'q3', property: '14 Lanercost Road',   doc: 'Searches — local authority',text: 'Planning history shows an unresolved enforcement notice from 2019 — please confirm status.',              raisedBy: 'Jiya Chowdhury', assignedTo: 'Zan Williams (Winkworth Sherwood)',  status: 'Open', date: '19/06/2026', direction: 'raised' },
  ]);

  lostTx = signal<LostTx[]>([
    { address: '9 Church Road', postcode: 'BS5 9JE', reason: 'Survey — structural / environmental concern', detail: 'Japanese knotweed identified — remediation cost made deal unviable.', date: '29/03/2026', stageWhenLost: 'Refurbishment' },
  ]);

  surveyorDirectory = signal([
    { name: 'Aziza Surveys', specialism: 'Electrical, gas, condition', contact: 'Aziza Khan',      email: 'aziza@azizasurveys.co.uk',    phone: '0117 405 2210', active: 7 },
    { name: 'BRE',           specialism: 'Structural, roof, damp',     contact: 'David Forsythe',  email: 'd.forsythe@bre.co.uk',        phone: '0190 866 0666', active: 4 },
    { name: 'Savills',       specialism: 'Valuation',                  contact: 'Imogen Pratt',    email: 'imogen.pratt@savills.com',    phone: '0117 910 2200', active: 3 },
  ]);

  showAddSupplierModal  = signal(false);
  supplierName          = signal('');
  supplierSpecialism    = signal('');
  supplierContact       = signal('');
  supplierEmail         = signal('');
  supplierPhone         = signal('');

  openAddSupplierModal(): void {
    this.supplierName.set('');
    this.supplierSpecialism.set('');
    this.supplierContact.set('');
    this.supplierEmail.set('');
    this.supplierPhone.set('');
    this.showAddSupplierModal.set(true);
  }

  addSupplier(): void {
    const name = this.supplierName().trim();
    if (!name) return;
    this.surveyorDirectory.update(list => [...list, {
      name,
      specialism: this.supplierSpecialism().trim() || 'General',
      contact: this.supplierContact().trim() || '—',
      email: this.supplierEmail().trim(),
      phone: this.supplierPhone().trim(),
      active: 0,
    }]);
    this.showAddSupplierModal.set(false);
    this.showToast(name + ' added to the surveyor directory', 'ti-address-book');
  }

  readonly teamWorkload = [
    { name: 'Jiya Chowdhury', count: 6 },
    { name: 'Tom Resnick',    count: 4 },
    { name: 'Aisha Patel',    count: 5 },
    { name: 'Oliver Wren',    count: 3 },
  ];

  readonly txStages = ['MemorandumOfSale', 'Legals', 'Refurbishment', 'Lettings'];

  txProperties = computed(() =>
    this.data.properties.filter(p => p.status === 'active' && TX_STAGES.has(p.stage))
  );

  txBedsFilter = signal('all');
  txEpcFilter  = signal('all');

  filteredProperties = computed(() => {
    const q     = this.searchQuery().toLowerCase();
    const stage = this.stageFilter();
    const phase = this.selectedPhase();
    const beds  = this.txBedsFilter();
    const epc   = this.txEpcFilter();
    const col   = this.homeSortCol();
    const dir   = this.homeSortDir();

    let list = this.txProperties().filter(p => {
      if (phase !== 'all' && p.phase !== phase) return false;
      if (stage !== 'all' && p.stage !== stage) return false;
      if (q && !p.address.toLowerCase().includes(q) && !(p.postcode ?? '').toLowerCase().includes(q)) return false;
      if (beds !== 'all') {
        if (beds === '5+') { if ((p.beds ?? 0) < 5) return false; }
        else               { if (p.beds !== +beds) return false; }
      }
      if (epc !== 'all' && p.epcBefore?.r !== epc) return false;
      return true;
    });

    return this.applySort(list, col, dir);
  });

  txTotalBudget = computed(() =>
    this.filteredProperties().reduce((a, p) => a + (p.financial?.ap ?? 0), 0)
  );

  txAvgYield = computed(() => {
    const ps = this.filteredProperties().filter(p => p.financial?.yield);
    return ps.length ? ps.reduce((a, p) => a + p.financial!.yield!, 0) / ps.length : 0;
  });

  txEpcCPlus = computed(() =>
    this.filteredProperties().filter(p => p.epcAfter && ['A','B','C'].includes(p.epcAfter.r)).length
  );

  txHasFilters = computed(() =>
    this.searchQuery() !== '' || this.stageFilter() !== 'all' ||
    this.txBedsFilter() !== 'all' || this.txEpcFilter() !== 'all'
  );

  txResetFilters(): void {
    this.searchQuery.set('');
    this.stageFilter.set('all');
    this.txBedsFilter.set('all');
    this.txEpcFilter.set('all');
  }

  phaseCount(phaseId: string): number {
    if (phaseId === 'all') return this.txProperties().length;
    return this.txProperties().filter(p => p.phase === phaseId).length;
  }

  selectedProperty = computed(() => {
    const id = this.selectedId();
    return id ? this.data.getProperty(id) : undefined;
  });

  acqProperties = computed(() =>
    this.data.properties.filter((p: Property) => p.status === 'active' && ACQ_STAGES.has(p.stage))
  );

  acqProperty = computed(() => {
    const id = this.acqSelectedId();
    return id ? this.data.getProperty(id) : undefined;
  });

  // Active property regardless of which record view is open
  currentProperty = computed(() => {
    const v = this.view();
    return v === 'acq-record' ? this.acqProperty() : this.selectedProperty();
  });

  readonly allStages = ALL_STAGES;
  readonly allStageLabels = ALL_STAGE_LABELS;

  openRecord(p: Property): void {
    this.selectedId.set(p.id);
    this.selectedStageView.set(null);
    this.view.set('record');
    this.doc.querySelector('.tx-content')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  openAcqRecord(p: Property): void {
    this.acqSelectedId.set(p.id);
    this.view.set('acq-record');
    this.doc.querySelector('.tx-content')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  stageColor(stage: string): string {
    const map: Record<string, string> = {
      MemorandumOfSale: 'red',
      Legals:           'blue',
      Refurbishment:    'amber',
      Lettings:         'teal',
    };
    return map[stage] ?? 'gray';
  }

  stageLabel(stage: string): string {
    return TX_STAGE_LABELS[stage] ?? stage;
  }

  stageProgress(stage: string): number {
    const map: Record<string, number> = {
      MemorandumOfSale: 12,
      Legals: 38,
      Refurbishment: 65,
      Lettings: 90,
    };
    return map[stage] ?? 0;
  }

  surveyStatusColor(status: string): string {
    if (status === 'Returned') return 'green';
    if (status === 'Awaiting report') return 'amber';
    return 'blue';
  }

  get queriesOwed(): Query[]   { return this.queries().filter(q => q.direction === 'owed');   }
  get queriesRaised(): Query[] { return this.queries().filter(q => q.direction === 'raised'); }
  get openQueryCount(): number { return this.queries().filter(q => q.status === 'Open').length; }

  get surveyAwaitingCount(): number { return this.surveys().filter(s => s.status === 'Awaiting report').length; }
  get surveyReturnedCount(): number { return this.surveys().filter(s => s.status === 'Returned').length; }
  get surveyTotalCost(): number     { return this.surveys().reduce((a, s) => a + s.cost, 0); }

  readonly stageActions: Record<string, { key: string; label: string }[]> = {
    MemorandumOfSale: [
      { key: 'mos_received',          label: 'MoS received' },
      { key: 'sols_confirmed',        label: 'Solicitor confirmed receipt' },
      { key: 'contract_pack_received', label: 'Contract pack received' },
    ],
    Legals: [
      { key: 'contract_pack_received', label: 'Contract pack received' },
      { key: 'red_flag_cleared',       label: 'Red flag review cleared' },
      { key: 'searches_ordered',       label: 'Searches & survey instructed' },
      { key: 'surveys_ordered',        label: 'Survey instructed' },
      { key: 'survey_report_received', label: 'Survey report received' },
      { key: 'searches_received',      label: 'Search results received' },
      { key: 'draft_rot_received',     label: 'Draft RoT received from lawyers' },
      { key: 'final_rot_received',     label: 'Final RoT received from lawyers' },
      { key: 'final_rot_approved',     label: 'Final RoT approved' },
    ],
    Refurbishment: [
      { key: 'site_visits_booked', label: 'Site visits booked' },
      { key: 'scope_prepared',     label: 'Scope of works prepared' },
      { key: 'scope_approved',     label: 'Scope of works approved' },
    ],
    Lettings: [
      { key: 'contract_pack',                  label: 'Contract & Transfer prepared' },
      { key: 'authority_to_exchange',          label: 'Authority to exchange — client signed' },
      { key: 'investor_authority_to_exchange', label: 'Authority to exchange — investor approved' },
      { key: 'compl_statement_recv',           label: 'Completion statement received' },
      { key: 'compl_statement_appr',           label: 'Completion statement approved' },
      { key: 'funds_requested',                label: 'Funds requested from client' },
      { key: 'funds_received',                 label: 'Funds received' },
      { key: 'exchange_completed',             label: 'Contracts exchanged' },
      { key: 'completion_confirmed',           label: 'Completion confirmed' },
    ],
  };

  getTxData(id: string): TxPropertyData {
    return this.txData()[id] ?? { exchangeDate: '', completionDate: '', checklist: {}, txLog: [], notes: [] };
  }

  getPropertyNotes(propId: string): TxNote[] {
    return this.getTxData(propId).notes ?? [];
  }

  addPropertyNote(propId: string): void {
    const text = this.noteText().trim();
    if (!text) return;
    const note: TxNote = {
      id: 'n_' + Date.now(),
      text,
      category: this.noteCat(),
      author: this.auth.currentUser()?.name ?? 'TX Team',
      ts: new Date().toLocaleDateString('en-GB'),
    };
    const existing = this.getTxData(propId);
    this.setTxData(propId, { notes: [...(existing.notes ?? []), note] });
    this.noteText.set('');
  }

  usersByRole(role: string) {
    return this.auth.allUsers.filter(u => u.role === role);
  }

  initials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  }

  // ── Fees ────────────────────────────────────────────────────
  showAddFeeModal  = signal(false);
  feeType          = signal('Acquisition Fee');
  feeAmount        = signal('');
  feeBillingPoint  = signal('Exchange');

  readonly feeTypes = [
    'Acquisition Fee', 'Acquisition fee %', 'Associated surveys',
    'Conveyancing Costs', 'Disbursement Fees', 'Due Diligence Fees',
    'Floorplan Fee', 'HBC Spend', 'Iris Data Room Setup',
    'Land Registry Fee', 'Leasehold surplus fee', 'Legal Lease Advice',
    'Negotiation Fee', 'Other',
  ];

  readonly billingPoints = ['Acquisition', 'On instruction', 'Exchange', 'Completion'];

  getPropertyFees(propId: string): TxFee[] {
    return this.getTxData(propId).fees ?? [];
  }

  addFee(propId: string): void {
    const amount = parseFloat(this.feeAmount());
    if (!amount) return;
    const fee: TxFee = { id: 'f_' + Date.now(), type: this.feeType(), amount, billingPoint: this.feeBillingPoint() };
    const existing = this.getTxData(propId);
    this.setTxData(propId, { fees: [...(existing.fees ?? []), fee] });
    this.feeAmount.set('');
    this.showAddFeeModal.set(false);
  }

  removeFee(propId: string, feeId: string): void {
    const existing = this.getTxData(propId);
    this.setTxData(propId, { fees: (existing.fees ?? []).filter(f => f.id !== feeId) });
  }

  feesTotal(propId: string): number {
    return this.getPropertyFees(propId).reduce((a, f) => a + f.amount, 0);
  }

  // ── Property display helpers ─────────────────────────────────
  fmt(n: number | undefined): string {
    if (!n) return '—';
    return '£' + n.toLocaleString('en-GB');
  }

  epcColor(r: string): string {
    const m: Record<string, string> = {
      A: '#00a651', B: '#50b848', C: '#b2d235',
      D: '#fff200', E: '#f7941d', F: '#f15a24', G: '#ed1b24',
    };
    return m[r] ?? '#ccc';
  }

  setTxData(id: string, patch: Partial<TxPropertyData>): void {
    this.txData.update(d => ({ ...d, [id]: { ...this.getTxData(id), ...patch } }));
  }

  _itemDone(propId: string, key: string): boolean {
    if (this.getTxData(propId).checklist[key]) return true;
    if (key === 'mos_received' || key === 'sols_confirmed')
      return this.txHasDocs(propId, ['Memorandum of Sale', 'MoS']);
    if (key === 'contract_pack_received')
      return this.txHasDocs(propId, ['Contract Pack', 'Draft Contract']);
    if (key === 'contract_pack')
      return this.txHasDocs(propId, ['Contract', 'Signed Contract', 'Transfer Deed', 'TR1']) || this.legalCheck(propId, 'contract_transfer');
    if (key === 'red_flag_cleared')
      return this.legalCheck(propId, 'contract_rev');
    if (key === 'survey_report_received') {
      const ordered = this.surveysForProp(propId);
      if (ordered.length) return ordered.every(s => this.txHasDocs(propId, [this.surveyReportDocType(s.type)]));
      return this.txHasDocs(propId, ['Survey Report', 'HomeBuyer Report', 'Structural Survey', 'Asbestos Survey']);
    }
    if (key === 'draft_rot_received')
      return this.txHasDocs(propId, ['Draft Report on Title', 'Report on Title']) || this.legalCheck(propId, 'title_report');
    if (key === 'final_rot_received')
      return this.txHasDocs(propId, ['Final Report on Title', 'Report on Title']);
    if (key === 'final_rot_approved')
      return this.rotApprovalsSig()[propId]?.status === 'approved';
    if (key === 'searches_received')
      return this.txHasAllSearches(propId);
    if (key === 'compl_statement_recv')
      return this.txHasDocs(propId, ['Completion Statement']) || this.legalCheck(propId, 'compl_statement');
    if (key === 'compl_statement_appr')
      return !!this.complApprovalsSig()[propId];
    if (key === 'funds_requested') return !!this.getTxData(propId).fundsRequest || !!this.complApprovalsSig()[propId];
    if (key === 'funds_received')  return !!this.fundTransfersSig()[propId];
    if (key === 'exchange_completed')
      return this.legalCheck(propId, 'exchanged');
    if (key === 'survey_reports_received') {
      const ordered = this.surveysForProp(propId);
      if (ordered.length) return ordered.every(s => this.txHasDocs(propId, [this.surveyReportDocType(s.type)]));
      return this.txHasDocs(propId, ['Survey Report', 'HomeBuyer Report', 'Structural Survey', 'Asbestos Survey']);
    }
    return false;
  }

  stageStatus(propId: string, stage: string): { label: string; done: boolean } {
    const cl   = this.getTxData(propId).checklist;
    const done = (key: string) => this._itemDone(propId, key);
    if (stage === 'MemorandumOfSale') {
      if (!done('mos_received'))           return { label: 'MoS Pending', done: false };
      if (!done('fee_earner_added'))        return { label: 'Fee Earner Required', done: false };
      if (!done('sols_confirmed'))          return { label: 'Solicitor Confirmation Pending', done: false };
      if (!done('contract_pack_received'))  return { label: 'Contract Pack Pending', done: false };
      return { label: 'MoS Complete', done: true };
    }
    if (stage === 'Legals') {
      if (!done('contract_pack_received'))  return { label: 'Contract Pack Pending', done: false };
      if (!done('red_flag_cleared'))         return { label: 'Red Flag Review Pending', done: false };
      if (!cl['searches_ordered'])          return { label: 'Searches & Survey to Instruct', done: false };
      if (!cl['surveys_ordered'])           return { label: 'Survey to Instruct', done: false };
      if (!done('survey_report_received'))  return { label: 'Survey Report Pending', done: false };
      if (!done('searches_received'))        return { label: 'Searches in Progress', done: false };
      if (!done('draft_rot_received'))       return { label: 'Draft RoT Awaited from Lawyers', done: false };
      if (!done('final_rot_received'))       return { label: 'Final RoT Awaited from Lawyers', done: false };
      if (!done('final_rot_approved'))      return { label: 'Final RoT – Pending Approval', done: false };
      return { label: 'Conveyancing Complete', done: true };
    }
    if (stage === 'Refurbishment') {
      if (!cl['site_visits_booked'])      return { label: 'Site Visits to Book', done: false };
      if (!done('survey_reports_received')) return { label: 'Survey Reports Pending', done: false };
      if (!cl['scope_prepared'])          return { label: 'Scope of Works Pending', done: false };
      if (!cl['scope_approved'])          return { label: 'Scope of Works – Pending Approval', done: false };
      return { label: 'Surveys Complete', done: true };
    }
    if (stage === 'Lettings') {
      if (!cl['contract_pack'])                return { label: 'Contract & Transfer Pending', done: false };
      if (!cl['authority_to_exchange'])        return { label: 'Authority to Exchange – Pending Client', done: false };
      if (this.data.getProperty(propId)?.isInvestorDeal && !cl['investor_authority_to_exchange']) return { label: 'Authority to Exchange – Pending Investor', done: false };
      if (!done('compl_statement_recv'))        return { label: 'Completion Statement Pending', done: false };
      if (!done('compl_statement_appr'))       return { label: 'Completion Statement – Pending Client Approval', done: false };
      if (!done('funds_requested'))  return { label: 'Funds to Request', done: false };
      if (!done('funds_received'))   return { label: 'Funds Pending – Awaiting Client Transfer', done: false };
      if (!done('exchange_completed'))          return { label: 'Exchange Pending', done: false };
      if (!cl['completion_confirmed'])         return { label: 'Completion Pending', done: false };
      return { label: 'Ready for Completion', done: true };
    }
    return { label: '', done: false };
  }

  checklistProgress(propId: string, stage: string): { done: number; total: number } {
    const actions = this.stageActions[stage] ?? [];
    return { done: actions.filter(a => this._itemDone(propId, a.key)).length, total: actions.length };
  }

  /**
   * Scope-of-works status for the Scoping dashboard column — one of the refurbishment workflow steps.
   * "Site visits booked" (site_visits_booked) means all necessary surveys have been instructed
   * with our suppliers — until then, properties sit in "Surveys Required" (nothing instructed yet)
   * or "Surveys Instructed" (at least one survey ordered via the Survey Tracker, not yet all booked).
   */
  scopingStatus(propId: string): 'Surveys Required' | 'Surveys Instructed' | 'Scope Required' | 'Issued for Approval' | 'Approved' {
    if (!this._itemDone(propId, 'site_visits_booked')) {
      return this.surveysForProp(propId).length === 0 ? 'Surveys Required' : 'Surveys Instructed';
    }
    if (!this._itemDone(propId, 'scope_prepared'))     return 'Scope Required';
    if (!this._itemDone(propId, 'scope_approved'))     return 'Issued for Approval';
    return 'Approved';
  }

  /** Whether the vendor's solicitor contract pack has been received for this property. */
  contractPackStatus(propId: string): 'Not Received' | 'Received' {
    return this._itemDone(propId, 'contract_pack_received') ? 'Received' : 'Not Received';
  }

  updateValuation(propId: string, raw: string): void {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    this.data.updateProperty(propId, { valuation: cleaned ? parseFloat(cleaned) : undefined });
  }

  toggleChecklist(propId: string, key: string, label: string): void {
    const current = this.getTxData(propId).checklist[key] ?? false;
    const newVal = !current;
    const existing = this.getTxData(propId);
    const newLog = newVal
      ? [{ text: label, ts: new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' }), author: this.auth.currentUser()?.name ?? 'TX Team' }, ...existing.txLog]
      : existing.txLog;
    const updatedChecklist = { ...existing.checklist, [key]: newVal };
    this.setTxData(propId, { checklist: updatedChecklist, txLog: newLog });
    if (newVal) this.showToast(label, 'ti-circle-check');

    if (newVal) {
      const prop = this.data.getProperty(propId);
      if (prop) {
        const actions = this.stageActions[prop.stage] ?? [];
        const allDone = actions.length > 0 && actions.every(a => updatedChecklist[a.key]);
        if (allDone) {
          const nextIdx = this.txStages.indexOf(prop.stage) + 1;
          if (nextIdx < this.txStages.length) {
            setTimeout(() => {
              this.data.advanceStage(propId);
              this.showToast('All tasks complete — moved to ' + TX_STAGE_LABELS[this.txStages[nextIdx]], 'ti-trophy');
            }, 700);
          }
        }
      }
    }
  }

  priceReduction(p: { financial?: { ap?: number }; agreedPrice?: number }): number | null {
    if (p.agreedPrice && p.financial?.ap && p.agreedPrice < p.financial.ap) {
      return p.financial.ap - p.agreedPrice;
    }
    return null;
  }

  navTo(v: TxView): void {
    this.view.set(v);
    this.doc.querySelector('.tx-content')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  uploadDocument(): void {
    const p = this.currentProperty();
    const file = this.selectedFile();
    if (!p || !file) return;
    const docType = this.uploadDocType();
    const note = this.uploadNote().trim();
    const fileName = this.uploadFileName().trim() || file.name;
    const newFile: DataRoomFile = {
      id: 'dr_' + Date.now(),
      propertyId: p.id,
      stage: p.stage,
      docType,
      fileName,
      uploadedBy: this.auth.currentUser()?.name ?? 'TX Team',
      uploadedAt: new Date().toLocaleDateString('en-GB'),
      note,
    };
    this.showUploadModal.set(false);
    this.uploadDocTypeFilter.set(null);
    this.uploadNote.set('');
    this.uploadFileName.set('');
    this.selectedFile.set(null);
    const txInput = this.doc.getElementById('tx-file-input') as HTMLInputElement | null;
    if (txInput) txInput.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      const entry = { ...newFile, url: reader.result as string };
      this.dataRoom.set([...this.dataRoom(), entry]);
      this.drExpandedStages.update(s => { const n = new Set(s); n.add(p.stage); return n; });
      const logText = note ? `${docType} uploaded (${fileName}). Note: ${note}` : `${docType} uploaded (${fileName})`;
      this.data.addActivity(p.id, { id: 'upload_' + Date.now(), text: logText, author: this.auth.currentUser()?.name ?? 'TX Team', timestamp: new Date().toISOString(), label: 'action' });
      const keyMap: Record<string, string> = {
        'MoS': 'mos_received', 'Contract Pack': 'contract_pack',
        'Report on Title': 'final_rot_received', 'Searches': 'searches_received',
        'Survey Report': 'survey_report_received', 'Asbestos Survey': 'survey_report_received',
        'Completion Statement': 'compl_statement_recv',
      };
      const key = keyMap[docType];
      if (key && !this.getTxData(p.id).checklist[key]) this.toggleChecklist(p.id, key, docType + ' received');
      this.showToast(docType + ' uploaded — saved to Data Room', 'ti-upload');
    };
    reader.readAsDataURL(file);
  }

  toggleSearch(s: string): void {
    this.selectedSearches.update(set => {
      const next = new Set(set);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  orderSearches(): void {
    const p = this.selectedProperty();
    if (!p) return;
    const searches = Array.from(this.selectedSearches());
    if (!searches.length) return;
    const assignee = this.searchAssignee() || 'Winkworth Sherwood';
    const comments = this.searchComments().trim();
    const logText = `Searches ordered (${searches.join(', ')}) — assigned to ${assignee}${comments ? '. ' + comments : ''}`;
    this.data.addActivity(p.id, {
      id: 'searches_' + Date.now(),
      text: logText,
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    if (!this.getTxData(p.id).checklist['searches_ordered']) {
      this.toggleChecklist(p.id, 'searches_ordered', 'Searches ordered');
    }
    this.showSearchesModal.set(false);
    this.selectedSearches.set(new Set());
    this.searchAssignee.set('');
    this.searchComments.set('');
    this.showToast('Searches ordered — solicitor notified', 'ti-search');
  }

  reviewFiles(): DataRoomFile[] {
    const ctx = this.reviewDocContext();
    if (!ctx) return [];
    if (ctx.surveyType) {
      const exactType = this.surveyReportDocType(ctx.surveyType);
      return this.dataRoom().filter(f => f.propertyId === ctx.propId && f.docType === exactType);
    }
    return this.dataRoom().filter(f => f.propertyId === ctx.propId && ctx.docTypes.includes(f.docType));
  }

  openReviewModal(propId: string, checklistKey: string, checklistLabel: string, title: string, docTypes: string[]): void {
    this.reviewDocContext.set({ propId, checklistKey, checklistLabel, title, docTypes });
    this.requestChangesNote.set('');
    this.showRequestChangesInput.set(false);
    this.showReviewDocModal.set(true);
  }

  openSurveyReviewModal(propId: string, checklistKey: string, surveyType: string): void {
    this.reviewDocContext.set({
      propId, checklistKey,
      checklistLabel: surveyType + ' report',
      title: surveyType + ' report',
      docTypes: [this.surveyReportDocType(surveyType)],
      surveyType,
    });
    this.requestChangesNote.set('');
    this.showRequestChangesInput.set(false);
    this.showReviewDocModal.set(true);
  }

  approveDocument(): void {
    const ctx = this.reviewDocContext();
    if (!ctx) return;
    if (ctx.checklistKey === 'compl_statement_appr') {
      this.setTxData(ctx.propId, { complStatementSentToClient: true, complStatementQuery: undefined });
    } else {
      this.toggleChecklist(ctx.propId, ctx.checklistKey, ctx.checklistLabel);
    }
    this.showReviewDocModal.set(false);
    this.reviewDocContext.set(null);
    this.showToast(ctx.title + ' approved', 'ti-circle-check');
  }

  requestDocChanges(): void {
    const ctx = this.reviewDocContext();
    const note = this.requestChangesNote().trim();
    if (!ctx || !note) return;
    if (ctx.checklistKey === 'draft_rot_received') {
      this.setTxData(ctx.propId, { rotQuery: note });
      const existing = this.getTxData(ctx.propId);
      const newLog = [{ text: 'Draft RoT received from lawyers', ts: new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' }), author: this.auth.currentUser()?.name ?? 'TX Team' }, ...existing.txLog];
      this.setTxData(ctx.propId, { checklist: { ...existing.checklist, draft_rot_received: true }, txLog: newLog });
    }
    if (ctx.checklistKey === 'compl_statement_appr') {
      this.setTxData(ctx.propId, { complStatementQuery: note });
    }
    this.data.addActivity(ctx.propId, {
      id: 'changes_' + Date.now(),
      text: `Changes requested on ${ctx.title}: ${note}`,
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'warning',
    });
    this.showReviewDocModal.set(false);
    this.reviewDocContext.set(null);
    this.requestChangesNote.set('');
    this.showRequestChangesInput.set(false);
    this.showToast('Changes requested — solicitor notified', 'ti-alert-triangle');
  }

  requestAdditionalWorks(): void {
    const p = this.selectedProperty();
    if (!p) return;
    const desc = this.additionalWorksDescription().trim();
    const cost = this.additionalWorksCost().trim();
    if (!desc) return;
    this.data.addActivity(p.id, {
      id: 'addworks_' + Date.now(),
      text: `Additional works requested: ${desc}${cost ? ' — estimated cost £' + cost : ''}`,
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    this.showAdditionalWorksModal.set(false);
    this.additionalWorksDescription.set('');
    this.additionalWorksCost.set('');
    this.showToast('Additional works request logged', 'ti-tools');
  }

  toggleSurveyOrder(s: string): void {
    this.selectedSurveyOrders.update(set => {
      const next = new Set(set);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  surveyTypeAssignees = signal<Record<string, string>>({});

  setSurveyTypeAssignee(type: string, assignee: string): void {
    this.surveyTypeAssignees.update(m => ({ ...m, [type]: assignee }));
  }

  allSelectedSurveysHaveAssignee(): boolean {
    const assignees = this.surveyTypeAssignees();
    return Array.from(this.selectedSurveyOrders()).every(t => !!assignees[t]);
  }

  surveyOrderPropertyId = signal<string | null>(null);

  /** Active TX properties the solicitor has cleared red flag review on — only these can have surveys instructed. */
  eligibleSurveyProperties = computed(() =>
    this.data.properties.filter(p =>
      p.status === 'active' &&
      this.txStages.includes(p.stage) &&
      this._itemDone(p.id, 'red_flag_cleared')
    )
  );

  openInstructSurveysModal(propId?: string): void {
    const eligible = this.eligibleSurveyProperties();
    const preferred = propId && eligible.some(p => p.id === propId) ? propId : (eligible[0]?.id ?? null);
    this.surveyOrderPropertyId.set(preferred);
    this.selectedSurveyOrders.set(new Set());
    this.surveyTypeAssignees.set({});
    this.surveyOrderComments.set('');
    this.showInstructSurveysModal.set(true);
  }

  onSurveyOrderPropertyChange(propId: string): void {
    this.surveyOrderPropertyId.set(propId);
  }

  instructSurveyOrder(): void {
    const propId = this.surveyOrderPropertyId();
    const p = propId ? this.data.getProperty(propId) : undefined;
    if (!p) return;
    const surveyTypes = Array.from(this.selectedSurveyOrders());
    if (!surveyTypes.length) return;
    const typeAssignees = this.surveyTypeAssignees();
    const assigneeFor = (type: string) => typeAssignees[type] || 'Unassigned';
    const comments = this.surveyOrderComments().trim();
    const today = new Date().toLocaleDateString('en-GB');
    const logText = `Surveys instructed (${surveyTypes.map(t => `${t} → ${assigneeFor(t)}`).join(', ')})${comments ? '. ' + comments : ''}`;
    this.data.addActivity(p.id, {
      id: 'surveys_' + Date.now(),
      text: logText,
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    // Add each survey to the tracker
    this.surveys.update(list => [
      ...list,
      ...surveyTypes.map(type => ({
        property: p.address,
        propertyId: p.id,
        type,
        provider: assigneeFor(type),
        instructed: today,
        siteVisit: null,
        returned: null,
        status: 'Instructed' as const,
        cost: 0,
      })),
    ]);
    if (!this.getTxData(p.id).checklist['surveys_ordered']) {
      this.toggleChecklist(p.id, 'surveys_ordered', 'Surveys ordered');
    }
    this.showInstructSurveysModal.set(false);
    this.selectedSurveyOrders.set(new Set());
    this.surveyTypeAssignees.set({});
    this.surveyOrderComments.set('');
    this.surveyOrderPropertyId.set(null);
    this.showToast('Surveys instructed — order created', 'ti-clipboard-check');
  }

  addFeeEarner(): void {
    const p = this.selectedProperty();
    if (!p || !this.feeEarnerName()) return;
    this.data.addActivity(p.id, {
      id: 'fee_' + Date.now(),
      text: `Fee earner assigned: ${this.feeEarnerName()}`,
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    if (!this.getTxData(p.id).checklist['fee_earner_added']) {
      this.toggleChecklist(p.id, 'fee_earner_added', 'Fee earner assigned');
    }
    this.showFeeEarnerModal.set(false);
    this.feeEarnerName.set('');
    this.showToast('Fee earner added', 'ti-user-check');
  }

  legalCheck(propId: string, key: string): boolean {
    return !!this.legalDataSig()[propId]?.checklist?.[key];
  }

  legalExchangedDate(propId: string): string | undefined {
    return this.legalDataSig()[propId]?.exchangedDate;
  }

  legalAllSearchesDone(propId: string): boolean {
    const cl = this.legalDataSig()[propId]?.checklist ?? {};
    return !!(cl['search_la_r'] && cl['search_water'] && cl['search_env']);
  }

  solicitorSignedOffExchange(propId: string): boolean {
    return this.legalCheck(propId, 'exchange_ready');
  }

  txHasDocs(propId: string, docTypes: string[]): boolean {
    return this.dataRoom().some(f => f.propertyId === propId && docTypes.includes(f.docType));
  }

  surveysForProp(propId: string): Survey[] {
    return this.surveys().filter(s => s.propertyId === propId);
  }

  surveyReportDocType(surveyType: string): string {
    return 'Survey Report - ' + surveyType;
  }

  surveyReportDocTypes(surveyType: string): string[] {
    return ['Survey Report - ' + surveyType];
  }

  txItemDocTypes(key: string): string[] {
    switch (key) {
      case 'mos_received':
      case 'sols_confirmed':     return ['Memorandum of Sale', 'MoS'];
      case 'contract_pack_received':
      case 'contract_pack':      return ['Contract', 'Signed Contract', 'Transfer Deed', 'TR1'];
      case 'draft_rot_received': return ['Draft Report on Title', 'Report on Title'];
      case 'final_rot_received': return ['Final Report on Title', 'Report on Title'];
      case 'searches_received':  return ['Local Authority Search', 'Water & Drainage Search', 'Water Search', 'Environmental Search', 'Searches'];
      case 'survey_report_received':
      case 'survey_reports_received': return ['Survey Report', 'HomeBuyer Report', 'Structural Survey', 'Asbestos Survey'];
      case 'compl_statement_recv': return ['Completion Statement'];
      default:                   return [];
    }
  }

  txHasAllSearches(propId: string): boolean {
    return this.txHasDocs(propId, ['Local Authority Search']) &&
           this.txHasDocs(propId, ['Water & Drainage Search']) &&
           this.txHasDocs(propId, ['Environmental Search']);
  }

  remainingSearchTypes(propId: string): string[] {
    return ['Local Authority Search', 'Water & Drainage Search', 'Environmental Search']
      .filter(t => !this.txHasDocs(propId, [t]));
  }

  mosDocs(propId: string): DataRoomFile[] {
    return this.dataRoom().filter(f => f.propertyId === propId && f.docType === 'MoS');
  }

  instructSolicitor(p: Property): void {
    this.setTxData(p.id, { solicitorInstructed: true, solicitorName: this.instructSolicitorName().trim() || undefined });
    this.showInstructSolicitorModal.set(false);
    this.instructSolicitorName.set('');
    this.showToast('Solicitor instructed — matter opened in legal portal', 'ti-scale');
  }

  solicitorNameFor(propId: string): string {
    return this.getTxData(propId)?.solicitorName ?? '';
  }

  openSearchesModal(propId: string): void {
    this.searchAssignee.set(this.solicitorNameFor(propId));
    this.showSearchesModal.set(true);
  }

  openSurveyModal(propId: string): void {
    this.surveyOrderAssignee.set(this.solicitorNameFor(propId));
    this.showSurveyModal.set(true);
  }

  onRotFileSelected(event: Event): void {
    const f = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.uploadRotFile.set(f);
    if (f && !this.uploadRotFileName()) this.uploadRotFileName.set(f.name);
  }

  triggerRotFileInput(): void {
    this.doc.getElementById('rot-file-input')?.click();
  }

  uploadDraftRot(): void {
    const p = this.selectedProperty();
    if (!p) return;
    const note = this.uploadRotNote().trim();
    const file = this.uploadRotFile();
    const fileName = this.uploadRotFileName().trim() || file?.name || 'Draft_RoT.pdf';
    const entryId = 'dr_' + Date.now();
    this.dataRoom.update(list => [...list, {
      id: entryId,
      propertyId: p.id,
      stage: p.stage,
      docType: 'Draft Report on Title',
      fileName,
      uploadedBy: this.auth.currentUser()?.name ?? 'TX Team',
      uploadedAt: new Date().toLocaleDateString('en-GB'),
      note,
    }]);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.dataRoom.set(this.dataRoom().map(f => f.id === entryId ? { ...f, url: reader.result as string } : f));
      };
      reader.readAsDataURL(file);
    }
    this.drExpandedStages.update(s => { const n = new Set(s); n.add(p.stage); return n; });
    this.data.addActivity(p.id, {
      id: 'rot_draft_' + Date.now(),
      text: `Draft RoT uploaded (${fileName})${note ? '. Note: ' + note : ''}`,
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    if (!this.getTxData(p.id).checklist['draft_rot_received']) {
      this.toggleChecklist(p.id, 'draft_rot_received', 'Draft RoT received');
    }
    this.showDraftRotModal.set(false);
    this.uploadRotNote.set('');
    this.uploadRotFileName.set('');
    this.uploadRotFile.set(null);
    const input = this.doc.getElementById('rot-file-input') as HTMLInputElement | null;
    if (input) input.value = '';
    this.showToast('Draft RoT uploaded — saved to Data Room', 'ti-upload');
  }

  contractPackReceived(): void {
    const p = this.selectedProperty();
    if (!p) return;
    const note = this.contractPackNote().trim();
    const fileName = this.contractPackFileName() || 'Contract_Pack.pdf';
    const receivedDate = this.contractReceivedDate()
      ? new Date(this.contractReceivedDate()).toLocaleDateString('en-GB')
      : new Date().toLocaleDateString('en-GB');
    this.dataRoom.update(list => [...list, {
      id: 'dr_' + Date.now(),
      propertyId: p.id,
      stage: p.stage,
      docType: 'Contract Pack',
      fileName,
      uploadedBy: this.auth.currentUser()?.name ?? 'TX Team',
      uploadedAt: new Date().toLocaleDateString('en-GB'),
      note: note || ('Received ' + receivedDate),
    }]);
    this.drExpandedStages.update(s => { const n = new Set(s); n.add(p.stage); return n; });
    this.data.addActivity(p.id, {
      id: 'cp_' + Date.now(),
      text: `Contract pack received on ${receivedDate}${note ? '. Note: ' + note : ''}`,
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    if (!this.getTxData(p.id).checklist['contract_pack_received']) {
      this.toggleChecklist(p.id, 'contract_pack_received', 'Contract pack received');
    }
    this.showContractPackModal.set(false);
    this.contractPackNote.set('');
    this.contractPackFileName.set('');
    this.contractReceivedDate.set('');
    this.showToast('Contract pack received — logged to Data Room', 'ti-file-check');
  }

  requestFunds(): void {
    const p = this.selectedProperty();
    if (!p) return;
    const amount = this.requestFundsAmount().trim();
    if (!amount) return;
    const note = this.requestFundsNote().trim();
    const today = new Date().toLocaleDateString('en-GB');
    this.setTxData(p.id, { fundsRequest: { amount: parseFloat(amount), requestedAt: today, note: note || undefined } });
    this.data.addActivity(p.id, {
      id: 'funds_req_' + Date.now(),
      text: `Funds requested from client — £${parseFloat(amount).toLocaleString('en-GB')}${note ? '. Note: ' + note : ''}`,
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    this.showRequestFundsModal.set(false);
    this.requestFundsAmount.set('');
    this.requestFundsNote.set('');
    this.showToast('Funds requested — client notified', 'ti-cash');
  }

  private addToDataRoom(p: { id: string; stage: string }, docType: string, fileName: string, note: string): void {
    this.dataRoom.update(list => [...list, {
      id: 'dr_' + Date.now(),
      propertyId: p.id,
      stage: p.stage,
      docType,
      fileName,
      uploadedBy: this.auth.currentUser()?.name ?? 'TX Team',
      uploadedAt: new Date().toLocaleDateString('en-GB'),
      note,
    }]);
    this.drExpandedStages.update(s => { const n = new Set(s); n.add(p.stage); return n; });
  }

  approveAuthorityToExchange(): void {
    const p = this.selectedProperty();
    if (!p) return;
    const today = new Date().toLocaleDateString('en-GB');
    this.addToDataRoom(p, 'Authority to Exchange (Client)', 'Authority_to_Exchange_Client.pdf', `Client authority received on ${today}`);
    this.data.addActivity(p.id, {
      id: 'auth_exc_' + Date.now(),
      text: 'Authority to exchange and complete — client signed',
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    if (!this.getTxData(p.id).checklist['authority_to_exchange']) {
      this.toggleChecklist(p.id, 'authority_to_exchange', 'Authority to exchange — client signed');
    }
    this.setTxData(p.id, { authorityToExchange: true });
    this.showAuthorityModal.set(false);
    this.showToast('Client authority to exchange confirmed — solicitor notified', 'ti-circle-check');
  }

  approveInvestorAuthority(): void {
    const p = this.selectedProperty();
    if (!p) return;
    const today = new Date().toLocaleDateString('en-GB');
    this.addToDataRoom(p, 'Authority to Exchange (Investor)', 'Authority_to_Exchange_Investor.pdf', `Investor authority received on ${today}`);
    this.data.addActivity(p.id, {
      id: 'inv_auth_' + Date.now(),
      text: 'Authority to exchange and complete — investor approved',
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    if (!this.getTxData(p.id).checklist['investor_authority_to_exchange']) {
      this.toggleChecklist(p.id, 'investor_authority_to_exchange', 'Authority to exchange — investor approved');
    }
    this.setTxData(p.id, { authorityToExchange: true });
    this.showInvestorAuthorityModal.set(false);
    this.showToast('Investor authority to exchange confirmed — solicitor notified', 'ti-circle-check');
  }

  completeExchange(): void {
    const p = this.selectedProperty();
    if (!p) return;
    const dateRaw = this.exchangeDateInput();
    const dateFormatted = dateRaw
      ? new Date(dateRaw).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB');
    this.setTxData(p.id, { exchangeDate: dateFormatted });
    this.addToDataRoom(p, 'Exchange Confirmation', 'Exchange_Confirmation.pdf', `Contracts exchanged on ${dateFormatted}`);
    this.data.addActivity(p.id, {
      id: 'exchange_' + Date.now(),
      text: `Contracts exchanged on ${dateFormatted}`,
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    if (!this.getTxData(p.id).checklist['exchange_completed']) {
      this.toggleChecklist(p.id, 'exchange_completed', 'Contracts exchanged');
    }
    this.showExchangeDateModal.set(false);
    this.exchangeDateInput.set('');
    this.showToast('Exchange completed — date saved', 'ti-trophy');
  }

  confirmCompletion(): void {
    const p = this.selectedProperty();
    if (!p) return;
    const dateRaw = this.completionDateInput();
    const dateFormatted = dateRaw
      ? new Date(dateRaw).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB');
    this.setTxData(p.id, { completionDate: dateFormatted });
    this.addToDataRoom(p, 'Completion Confirmation', 'Completion_Confirmation.pdf', `Completion confirmed on ${dateFormatted}`);
    this.data.addActivity(p.id, {
      id: 'completion_' + Date.now(),
      text: `Completion confirmed on ${dateFormatted}`,
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    if (!this.getTxData(p.id).checklist['completion_confirmed']) {
      this.toggleChecklist(p.id, 'completion_confirmed', 'Completion confirmed');
    }
    this.showCompletionDateModal.set(false);
    this.completionDateInput.set('');
    this.showToast('Completion confirmed — property completed', 'ti-trophy');
  }

  revertStageAction(): void {
    const p = this.selectedProperty();
    if (!p) return;
    this.data.revertStage(p.id, this.revertComment().trim(), this.auth.currentUser()?.name ?? 'TX Team');
    this.showRevertModal.set(false);
    this.revertComment.set('');
    this.showToast('Stage reverted', 'ti-arrow-back-up');
  }

  openResponseModal(queryId: string): void {
    this.respondingQueryId.set(queryId);
    this.responseText.set('');
    this.showResponseModal.set(true);
  }

  submitResponse(): void {
    const id = this.respondingQueryId();
    const text = this.responseText().trim();
    if (!id || !text) return;
    this.queries.update(list => list.map(q => q.id === id
      ? { ...q, status: 'Resolved', response: text, resolvedDate: new Date().toLocaleDateString('en-GB') }
      : q
    ));
    this.showResponseModal.set(false);
    this.respondingQueryId.set(null);
    this.responseText.set('');
    this.showToast('Response sent — query marked resolved', 'ti-circle-check');
  }

  raiseQuery(): void {
    const text = this.queryText().trim();
    if (!text) return;
    this.queries.update(list => [{
      id: 'q' + Date.now(),
      property: this.selectedProperty()?.address ?? 'General',
      doc: this.queryDoc() || 'General',
      text,
      raisedBy: this.auth.currentUser()?.name ?? 'Me',
      assignedTo: this.queryAssignee() || 'Winkworth Sherwood',
      status: 'Open',
      date: new Date().toLocaleDateString('en-GB'),
      direction: 'raised',
    }, ...list]);
    this.queryText.set('');
    this.showQueryModal.set(false);
    this.showToast('Query raised — solicitor notified', 'ti-bell');
    this.view.set('queries');
  }

  addSurvey(): void {
    const type     = this.surveyType() || 'Electrical (EICR)';
    const provider = this.surveyProvider() || 'Aziza Surveys';
    const costRaw  = this.surveyCost().replace(/[^0-9.]/g, '');
    const cost     = costRaw ? parseFloat(costRaw) : 0;
    const siteVisitRaw = this.surveySiteVisit().trim();
    const siteVisit = siteVisitRaw
      ? new Date(siteVisitRaw).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : null;
    const status: Survey['status'] = siteVisit ? 'Booked' : 'Instructed';

    this.surveys.update(list => [...list, {
      property: this.selectedProperty()?.address ?? 'Unknown',
      propertyId: this.selectedProperty()?.id ?? '',
      type, provider,
      instructed: new Date().toLocaleDateString('en-GB'),
      siteVisit, returned: null, status, cost,
    }]);
    this.surveyType.set('');
    this.surveyProvider.set('');
    this.surveyCost.set('');
    this.surveySiteVisit.set('');
    this.showSurveyModal.set(false);
    this.showToast(type + ' instructed with ' + provider, 'ti-clipboard-check');
  }

  abortTransaction(): void {
    const p = this.selectedProperty();
    if (!p) return;
    this.lostTx.update(list => [{
      address: p.address,
      postcode: p.postcode ?? '',
      reason: this.abortReason() || 'Red flag — unresolvable issue',
      detail: 'Aborted from ' + this.stageLabel(p.stage) + ' stage.',
      date: new Date().toLocaleDateString('en-GB'),
      stageWhenLost: p.stage,
    }, ...list]);
    this.showAbortModal.set(false);
    this.showToast('Transaction aborted — ACQ, client, and solicitors notified', 'ti-archive');
    this.view.set('lost');
  }

  advanceStage(id: string): void {
    const prop = this.data.properties.find(p => p.id === id);
    if (prop?.stage === 'Legals') {
      const project = this.projects.all.find(p => p.name === prop.phase && p.isInvestorDeal);
      if (project
          && this.decisions.isDecisionRequired(project.id, 'contract_sign')
          && !this.decisions.isDone(id, 'contract_sign')) {
        this.showToast('Contract must be signed by the investor or IC before advancing to Refurbishment', 'ti-lock');
        return;
      }
    }
    this.data.advanceStage(id, this.auth.currentUser()?.name ?? 'TX Team');
    this.showToast('Stage advanced', 'ti-arrow-right');
  }

  revertLost(idx: number): void {
    this.lostTx.update(list => list.filter((_, i) => i !== idx));
    this.showToast('Transaction reverted to pipeline', 'ti-arrow-back-up');
  }

  showToast(msg: string, _icon?: string): void {
    this.toast.set(msg);
    this.toastVisible.set(true);
    setTimeout(() => this.toastVisible.set(false), 2800);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
