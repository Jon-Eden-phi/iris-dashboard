import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { MockDataService } from '../../services/mock-data';
import { Property } from '../../models/property.model';

type TxView = 'homes' | 'queries' | 'lost' | 'surveys' | 'teamdash' | 'suppliers' | 'record';

const TX_STAGES = new Set(['MemorandumOfSale', 'Legals', 'Refurbishment', 'Lettings']);

const TX_STAGE_LABELS: Record<string, string> = {
  MemorandumOfSale: 'MoS',
  Legals: 'Conveyancing',
  Refurbishment: 'Surveys',
  Lettings: 'Exchange / Completion',
};

interface Survey {
  property: string;
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

interface TxPropertyData {
  exchangeDate: string;
  completionDate: string;
  checklist: Record<string, boolean>;
  txLog: Array<{ text: string; ts: string; author: string }>;
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
}

@Component({
  selector: 'app-transactions-portal',
  imports: [],
  templateUrl: './transactions-portal.html',
  styleUrl: './transactions-portal.scss',
})
export class TransactionsPortalComponent {
  auth   = inject(AuthService);
  data   = inject(MockDataService);
  router = inject(Router);

  constructor() {
    effect(() => {
      localStorage.setItem(this.TX_DATA_KEY, JSON.stringify(this.txData()));
    });
    effect(() => {
      localStorage.setItem(this.DR_KEY, JSON.stringify(this.dataRoom()));
    });
  }

  filesForProperty(propId: string): DataRoomFile[] {
    const q = this.drSearch().toLowerCase();
    const sf = this.drStageFilter();
    return this.dataRoom().filter(f => {
      if (f.propertyId !== propId) return false;
      if (sf !== 'all' && f.stage !== sf) return false;
      if (q && !f.fileName.toLowerCase().includes(q) && !f.docType.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  filesByStage(propId: string): { stage: string; files: DataRoomFile[] }[] {
    const files = this.filesForProperty(propId);
    const map = new Map<string, DataRoomFile[]>();
    for (const f of files) {
      if (!map.has(f.stage)) map.set(f.stage, []);
      map.get(f.stage)!.push(f);
    }
    return Array.from(map.entries()).map(([stage, files]) => ({ stage, files }));
  }

  deleteFile(fileId: string): void {
    this.dataRoom.update(list => list.filter(f => f.id !== fileId));
    this.showToast('File removed', 'ti-trash');
  }

  drExpandedStages = signal<Set<string>>(new Set());

  toggleDrStage(stage: string): void {
    this.drExpandedStages.update(s => {
      const next = new Set(s);
      next.has(stage) ? next.delete(stage) : next.add(stage);
      return next;
    });
  }

  view          = signal<TxView>('homes');
  selectedId    = signal<string | null>(null);
  searchQuery   = signal('');
  stageFilter   = signal('all');
  sortOrder     = signal('modified');
  selectedPhase = signal('all');

  showNoteModal      = signal(false);
  showQueryModal     = signal(false);
  showAbortModal     = signal(false);
  showSurveyModal    = signal(false);
  showResponseModal  = signal(false);
  showUploadModal    = signal(false);
  showRevertModal    = signal(false);
  respondingQueryId  = signal<string | null>(null);
  responseText       = signal('');
  uploadDocType      = signal('MoS');
  uploadNote         = signal('');
  uploadFileName     = signal('');
  revertComment      = signal('');

  showSearchesModal        = signal(false);
  showFeeEarnerModal       = signal(false);
  showDraftRotModal        = signal(false);
  showContractPackModal    = signal(false);
  showInstructSurveysModal    = signal(false);
  showAdditionalWorksModal    = signal(false);
  showReviewDocModal          = signal(false);
  showRequestFundsModal           = signal(false);
  showAuthorityModal              = signal(false);
  showInvestorAuthorityModal      = signal(false);
  showExchangeDateModal           = signal(false);
  showCompletionDateModal         = signal(false);
  exchangeDateInput               = signal('');
  completionDateInput             = signal('');
  requestFundsNote                = signal('');
  legalActionsOpen            = signal(false);
  additionalWorksDescription  = signal('');
  additionalWorksCost         = signal('');
  requestChangesNote          = signal('');
  showRequestChangesInput     = signal(false);
  reviewDocContext            = signal<{ propId: string; checklistKey: string; checklistLabel: string; title: string; docTypes: string[] } | null>(null);
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
    'Condition survey',
    'Structural',
    'Roof condition',
    'Damp / EPC follow-up',
    'Fire risk assessment',
    'Asbestos',
    'Valuation',
  ];
  uploadRotNote         = signal('');
  uploadRotFileName     = signal('');
  contractPackNote      = signal('');
  contractPackFileName  = signal('');
  contractReceivedDate  = signal('');

  readonly stageDocTypes: Record<string, string[]> = {
    MemorandumOfSale: ['MoS', 'Offer Letter', 'ID Verification', 'Property Information Form', 'Other'],
    Legals:           ['Contract Pack', 'Report on Title', 'Searches', 'Transfer Deed', 'Enquiries', 'Replies to Enquiries', 'Other'],
    Refurbishment:    ['Survey Report', 'Scope of Works', 'Contractor Quote', 'EPC', 'Building Regulations', 'Other'],
    Lettings:         ['Completion Statement', 'Transfer Deed', 'Land Registry', 'Tenancy Agreement', 'Inventory', 'Other'],
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
  private readonly DR_KEY = 'iris_data_room';

  txData = signal<Record<string, TxPropertyData>>(
    JSON.parse(localStorage.getItem('iris_tx_data') ?? '{}')
  );

  dataRoom = signal<DataRoomFile[]>(
    JSON.parse(localStorage.getItem('iris_data_room') ?? '[]')
  );

  recordTab = signal<'overview' | 'dataroom'>('overview');
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

  surveys = signal<Survey[]>([
    { property: '19 Beaumont Road',   type: 'Electrical (EICR)',    provider: 'Aziza Surveys', instructed: '23/06/2026', siteVisit: '27/06/2026', returned: null,          status: 'Booked',          cost: 180 },
    { property: '19 Beaumont Road',   type: 'Gas safety',           provider: 'Aziza Surveys', instructed: '23/06/2026', siteVisit: '27/06/2026', returned: null,          status: 'Booked',          cost: 90  },
    { property: '675 Whitchurch Lane',type: 'Condition survey',     provider: 'BRE',           instructed: '14/06/2026', siteVisit: '18/06/2026', returned: '24/06/2026',  status: 'Returned',        cost: 420 },
    { property: '675 Whitchurch Lane',type: 'Roof condition',       provider: 'BRE',           instructed: '25/06/2026', siteVisit: null,          returned: null,          status: 'Instructed',      cost: 240 },
    { property: '14 Lanercost Road',  type: 'Valuation',            provider: 'Savills',       instructed: '10/06/2026', siteVisit: '13/06/2026', returned: '17/06/2026',  status: 'Returned',        cost: 350 },
    { property: '14 Lanercost Road',  type: 'Structural',           provider: 'BRE',           instructed: '18/06/2026', siteVisit: '22/06/2026', returned: null,          status: 'Awaiting report', cost: 580 },
  ]);

  queries = signal<Query[]>([
    { id: 'q1', property: '19 Beaumont Road',    doc: 'EPC certificate',           text: 'EPC shows expiry 2034 but the uploaded scan shows 2033 — please confirm which is correct.',                raisedBy: 'Jiya Chowdhury', assignedTo: 'Hayley Briggs (Winkworth Sherwood)',  status: 'Open', date: '21/06/2026', direction: 'raised' },
    { id: 'q2', property: '675 Whitchurch Lane', doc: 'Report on Title — draft',   text: 'Restrictive covenant on rear access — please clarify impact on standard residential use.',                raisedBy: 'Hayley Briggs (Winkworth Sherwood)', assignedTo: 'Jiya Chowdhury', status: 'Open', date: '20/06/2026', direction: 'owed'   },
    { id: 'q3', property: '14 Lanercost Road',   doc: 'Searches — local authority',text: 'Planning history shows an unresolved enforcement notice from 2019 — please confirm status.',              raisedBy: 'Jiya Chowdhury', assignedTo: 'Zan Williams (Winkworth Sherwood)',  status: 'Open', date: '19/06/2026', direction: 'raised' },
  ]);

  lostTx = signal<LostTx[]>([
    { address: '9 Church Road', postcode: 'BS5 9JE', reason: 'Survey — structural / environmental concern', detail: 'Japanese knotweed identified — remediation cost made deal unviable.', date: '29/03/2026', stageWhenLost: 'Refurbishment' },
  ]);

  readonly surveyorDirectory = [
    { name: 'Aziza Surveys', specialism: 'Electrical, gas, condition', contact: 'Aziza Khan',      email: 'aziza@azizasurveys.co.uk',    phone: '0117 405 2210', active: 7 },
    { name: 'BRE',           specialism: 'Structural, roof, damp',     contact: 'David Forsythe',  email: 'd.forsythe@bre.co.uk',        phone: '0190 866 0666', active: 4 },
    { name: 'Savills',       specialism: 'Valuation',                  contact: 'Imogen Pratt',    email: 'imogen.pratt@savills.com',    phone: '0117 910 2200', active: 3 },
  ];

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

  filteredProperties = computed(() => {
    const q     = this.searchQuery().toLowerCase();
    const stage = this.stageFilter();
    const phase = this.selectedPhase();
    const sort  = this.sortOrder();

    let list = this.txProperties().filter(p => {
      if (phase !== 'all' && p.phase !== phase) return false;
      if (stage !== 'all' && p.stage !== stage) return false;
      if (q && !p.address.toLowerCase().includes(q) && !(p.postcode ?? '').toLowerCase().includes(q)) return false;
      return true;
    });

    const stageOrder = ['MemorandumOfSale', 'Legals', 'Refurbishment', 'Lettings'];
    if (sort === 'stage')       list = [...list].sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage));
    if (sort === 'stage-desc')  list = [...list].sort((a, b) => stageOrder.indexOf(b.stage) - stageOrder.indexOf(a.stage));
    if (sort === 'address')     list = [...list].sort((a, b) => a.address.localeCompare(b.address));
    if (sort === 'price-high')  list = [...list].sort((a, b) => (b.financial?.ap ?? 0) - (a.financial?.ap ?? 0));
    if (sort === 'price-low')   list = [...list].sort((a, b) => (a.financial?.ap ?? 0) - (b.financial?.ap ?? 0));

    return list;
  });

  phaseCount(phaseId: string): number {
    if (phaseId === 'all') return this.txProperties().length;
    return this.txProperties().filter(p => p.phase === phaseId).length;
  }

  selectedProperty = computed(() => {
    const id = this.selectedId();
    return id ? this.data.getProperty(id) : undefined;
  });

  openRecord(p: Property): void {
    this.selectedId.set(p.id);
    this.view.set('record');
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
      { key: 'mos_received',       label: 'MoS received from vendor' },
      { key: 'mos_sent_sols',      label: 'MoS sent to solicitor' },
      { key: 'fee_earner_added',   label: 'Fee earner assigned' },
      { key: 'sols_confirmed',     label: 'Solicitor confirmed receipt' },
    ],
    Legals: [
      { key: 'red_flag_cleared',       label: 'Red flag review cleared' },
      { key: 'contract_pack_received', label: 'Contract pack received' },
      { key: 'searches_ordered',       label: 'Searches ordered' },
      { key: 'searches_received',      label: 'Searches received' },
      { key: 'draft_rot_received',     label: 'Draft RoT received' },
      { key: 'enquiries_raised',       label: 'Enquiries raised' },
      { key: 'final_rot_received',     label: 'Final RoT received' },
      { key: 'final_rot_approved',     label: 'Final RoT approved' },
    ],
    Refurbishment: [
      { key: 'surveys_ordered',         label: 'Surveys ordered' },
      { key: 'site_visits_booked',      label: 'Site visits booked' },
      { key: 'survey_reports_received', label: 'Survey reports received' },
      { key: 'scope_prepared',          label: 'Scope of works prepared' },
    ],
    Lettings: [
      { key: 'contract_pack',          label: 'Contract pack received' },
      { key: 'transfer_circulated',    label: 'Transfer circulated for signing' },
      { key: 'compl_statement_recv',   label: 'Completion statement received' },
      { key: 'compl_statement_appr',   label: 'Completion statement approved' },
      { key: 'funds_requested',        label: 'Funds requested from client' },
      { key: 'funds_received',         label: 'Funds received' },
      { key: 'authority_to_exchange',          label: 'Authority to exchange — client signed' },
      { key: 'investor_authority_to_exchange', label: 'Authority to exchange — investor approved' },
      { key: 'exchange_completed',             label: 'Contracts exchanged' },
      { key: 'completion_confirmed',           label: 'Completion confirmed' },
    ],
  };

  getTxData(id: string): TxPropertyData {
    return this.txData()[id] ?? { exchangeDate: '', completionDate: '', checklist: {}, txLog: [] };
  }

  setTxData(id: string, patch: Partial<TxPropertyData>): void {
    this.txData.update(d => ({ ...d, [id]: { ...this.getTxData(id), ...patch } }));
  }

  stageStatus(propId: string, stage: string): { label: string; done: boolean } {
    const cl = this.getTxData(propId).checklist;
    if (stage === 'MemorandumOfSale') {
      if (!cl['mos_received'])     return { label: 'MoS Pending', done: false };
      if (!cl['mos_sent_sols'])    return { label: 'Awaiting Solicitor Instruction', done: false };
      if (!cl['fee_earner_added']) return { label: 'Fee Earner Required', done: false };
      if (!cl['sols_confirmed'])   return { label: 'Solicitor Confirmation Pending', done: false };
      return { label: 'MoS Complete', done: true };
    }
    if (stage === 'Legals') {
      if (!cl['contract_pack_received']) return { label: 'Contract Pack Pending', done: false };
      if (!cl['searches_ordered'])       return { label: 'Searches to Order', done: false };
      if (!cl['searches_received'])      return { label: 'Searches in Progress', done: false };
      if (!cl['draft_rot_received'])     return { label: 'Draft RoT Pending', done: false };
      if (!cl['enquiries_raised'])       return { label: 'Enquiries Required', done: false };
      if (!cl['final_rot_received'])     return { label: 'Final RoT Pending', done: false };
      if (!cl['final_rot_approved'])     return { label: 'Final RoT – Pending Approval', done: false };
      return { label: 'Conveyancing Complete', done: true };
    }
    if (stage === 'Refurbishment') {
      if (!cl['surveys_ordered'])         return { label: 'Surveys to Order', done: false };
      if (!cl['site_visits_booked'])      return { label: 'Site Visits to Book', done: false };
      if (!cl['survey_reports_received']) return { label: 'Survey Reports Pending', done: false };
      if (!cl['scope_prepared'])          return { label: 'Scope of Works Pending', done: false };
      return { label: 'Surveys Complete', done: true };
    }
    if (stage === 'Lettings') {
      if (!cl['contract_pack'])          return { label: 'Contract Pack Pending', done: false };
      if (!cl['transfer_circulated'])    return { label: 'Transfer to Circulate', done: false };
      if (!cl['compl_statement_recv'])   return { label: 'Completion Statement Pending', done: false };
      if (!cl['compl_statement_appr'])   return { label: 'Completion Statement – Pending Approval', done: false };
      if (!cl['funds_requested'])        return { label: 'Funds to Request', done: false };
      if (!cl['funds_received'])         return { label: 'Funds Pending', done: false };
      if (!cl['authority_to_exchange'])          return { label: 'Authority to Exchange – Pending Client', done: false };
      if (!cl['investor_authority_to_exchange']) return { label: 'Authority to Exchange – Pending Investor', done: false };
      if (!cl['exchange_completed'])             return { label: 'Exchange Pending', done: false };
      if (!cl['completion_confirmed'])           return { label: 'Completion Pending', done: false };
      return { label: 'Ready for Completion', done: true };
    }
    return { label: '', done: false };
  }

  checklistProgress(propId: string, stage: string): { done: number; total: number } {
    const actions = this.stageActions[stage] ?? [];
    const cl = this.getTxData(propId).checklist;
    return { done: actions.filter(a => cl[a.key]).length, total: actions.length };
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

  navTo(v: TxView): void { this.view.set(v); }

  uploadDocument(): void {
    const p = this.selectedProperty();
    if (!p) return;
    const docType = this.uploadDocType();
    const note = this.uploadNote().trim();
    const fileName = this.uploadFileName() || docType + '_document.pdf';
    // Save to data room
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
    this.dataRoom.update(list => [...list, newFile]);
    // Expand that stage folder automatically
    this.drExpandedStages.update(s => { const n = new Set(s); n.add(p.stage); return n; });
    // Log to activity
    const logText = note ? `${docType} uploaded (${fileName}). Note: ${note}` : `${docType} uploaded (${fileName})`;
    this.data.addActivity(p.id, {
      id: 'upload_' + Date.now(),
      text: logText,
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    // Auto-tick matching checklist item
    const keyMap: Record<string, string> = {
      'MoS': 'mos_received', 'Contract Pack': 'contract_pack',
      'Report on Title': 'final_rot_received', 'Searches': 'searches_received',
      'Completion Statement': 'compl_statement_recv',
    };
    const key = keyMap[docType];
    if (key && !this.getTxData(p.id).checklist[key]) {
      this.toggleChecklist(p.id, key, docType + ' received');
    }
    this.showUploadModal.set(false);
    this.uploadNote.set('');
    this.uploadFileName.set('');
    this.showToast(docType + ' uploaded — saved to Data Room', 'ti-upload');
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
    return this.dataRoom().filter(f => f.propertyId === ctx.propId && ctx.docTypes.includes(f.docType));
  }

  openReviewModal(propId: string, checklistKey: string, checklistLabel: string, title: string, docTypes: string[]): void {
    this.reviewDocContext.set({ propId, checklistKey, checklistLabel, title, docTypes });
    this.requestChangesNote.set('');
    this.showRequestChangesInput.set(false);
    this.showReviewDocModal.set(true);
  }

  approveDocument(): void {
    const ctx = this.reviewDocContext();
    if (!ctx) return;
    this.toggleChecklist(ctx.propId, ctx.checklistKey, ctx.checklistLabel);
    this.showReviewDocModal.set(false);
    this.reviewDocContext.set(null);
    this.showToast(ctx.title + ' approved', 'ti-circle-check');
  }

  requestDocChanges(): void {
    const ctx = this.reviewDocContext();
    const note = this.requestChangesNote().trim();
    if (!ctx || !note) return;
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

  instructSurveyOrder(): void {
    const p = this.selectedProperty();
    if (!p) return;
    const surveys = Array.from(this.selectedSurveyOrders());
    if (!surveys.length) return;
    const assignee = this.surveyOrderAssignee() || 'Aziza Surveys';
    const comments = this.surveyOrderComments().trim();
    const logText = `Surveys instructed (${surveys.join(', ')}) — assigned to ${assignee}${comments ? '. ' + comments : ''}`;
    this.data.addActivity(p.id, {
      id: 'surveys_' + Date.now(),
      text: logText,
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    if (!this.getTxData(p.id).checklist['surveys_ordered']) {
      this.toggleChecklist(p.id, 'surveys_ordered', 'Surveys ordered');
    }
    this.showInstructSurveysModal.set(false);
    this.selectedSurveyOrders.set(new Set());
    this.surveyOrderAssignee.set('');
    this.surveyOrderComments.set('');
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

  uploadDraftRot(): void {
    const p = this.selectedProperty();
    if (!p) return;
    const note = this.uploadRotNote().trim();
    const fileName = this.uploadRotFileName() || 'Draft_RoT.pdf';
    this.dataRoom.update(list => [...list, {
      id: 'dr_' + Date.now(),
      propertyId: p.id,
      stage: p.stage,
      docType: 'Report on Title (Draft)',
      fileName,
      uploadedBy: this.auth.currentUser()?.name ?? 'TX Team',
      uploadedAt: new Date().toLocaleDateString('en-GB'),
      note,
    }]);
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
    const note = this.requestFundsNote().trim();
    this.data.addActivity(p.id, {
      id: 'funds_req_' + Date.now(),
      text: `Funds requested from client${note ? '. Note: ' + note : ''}`,
      author: this.auth.currentUser()?.name ?? 'TX Team',
      timestamp: new Date().toISOString(),
      label: 'action',
    });
    if (!this.getTxData(p.id).checklist['funds_requested']) {
      this.toggleChecklist(p.id, 'funds_requested', 'Funds requested from client');
    }
    this.showRequestFundsModal.set(false);
    this.requestFundsNote.set('');
    this.showToast('Funds requested — client notified', 'ti-cash');
  }

  approveAuthorityToExchange(): void {
    const p = this.selectedProperty();
    if (!p) return;
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
    this.showAuthorityModal.set(false);
    this.showToast('Client authority to exchange confirmed', 'ti-circle-check');
  }

  approveInvestorAuthority(): void {
    const p = this.selectedProperty();
    if (!p) return;
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
    this.showInvestorAuthorityModal.set(false);
    this.showToast('Investor authority to exchange confirmed', 'ti-circle-check');
  }

  completeExchange(): void {
    const p = this.selectedProperty();
    if (!p) return;
    const dateRaw = this.exchangeDateInput();
    const dateFormatted = dateRaw
      ? new Date(dateRaw).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB');
    this.setTxData(p.id, { exchangeDate: dateFormatted });
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
    this.data.advanceStage(id);
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
