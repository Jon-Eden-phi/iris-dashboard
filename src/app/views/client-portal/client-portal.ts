import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MockDataService } from '../../services/mock-data';
import { AuthService } from '../../services/auth';
import { ProjectsService } from '../../services/projects';
import { Property } from '../../models/property.model';

const DR_KEY = 'iris_data_room';
const ROT_APPROVALS_KEY = 'iris_rot_approvals';
const CONTRACT_SIGNS_KEY = 'iris_contract_signs';

interface DataRoomFile {
  id: string;
  propertyId: string;
  docType: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  url?: string;
}

type PortalView = 'dashboard' | 'properties' | 'detail';

@Component({
  selector: 'app-client-portal',
  imports: [DatePipe, TitleCasePipe, UpperCasePipe],
  templateUrl: './client-portal.html',
  styleUrl: './client-portal.scss',
})
export class ClientPortalComponent {
  data     = inject(MockDataService);
  auth     = inject(AuthService);
  router   = inject(Router);
  projects = inject(ProjectsService);
  private get _userName(): string { return this.auth.currentUser()?.name ?? 'Client'; }

  view         = signal<PortalView>('dashboard');
  selectedId   = signal<string | null>(null);

  filterSearch = signal('');
  filterBeds   = signal('all');
  filterEpc    = signal('all');
  filterStage  = signal('all');
  filterSort   = signal('newest');

  private dataRoom = signal<DataRoomFile[]>(
    JSON.parse(localStorage.getItem(DR_KEY) ?? '[]')
  );

  private rotApprovals = signal<Record<string, { status: string; approvedBy?: string }>>(
    JSON.parse(localStorage.getItem(ROT_APPROVALS_KEY) ?? '{}')
  );

  private contractSigns = signal<Record<string, { signedAt: string; signature?: string }>>(
    JSON.parse(localStorage.getItem(CONTRACT_SIGNS_KEY) ?? '{}')
  );

  sigHasContent = signal(false);
  private _sigDrawing = false;

  showApproveModal = signal(false);
  showRejectModal  = signal(false);
  showRotApproveModal = signal(false);

  showViewingApproveModal = signal(false);
  showViewingRejectModal  = signal(false);

  showAccountModal = signal(false);
  acctCurrentPass  = signal('');
  acctNewPass      = signal('');
  acctConfirmPass  = signal('');
  acctPassError    = signal('');
  acctPassSuccess  = signal(false);

  approverName = signal('');
  maxPrice     = signal('');

  rejectReasons = signal<string[]>([]);
  rejectNotes   = signal('');

  viewingRejectReasons = signal<string[]>([]);
  viewingRejectNotes   = signal('');

  readonly rejectOptions = [
    'Price too high',
    'Wrong area',
    'Wrong property type',
    'Poor condition / survey concerns',
    'Budget constraints',
    'Other',
  ];

  readonly viewingRejectOptions = [
    'Location doesn\'t meet requirements',
    'Property condition was poor',
    'Size / layout not suitable',
    'Price too high given condition',
    'Structural concerns',
    'Other',
  ];

  constructor() {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === DR_KEY) {
        try { this.dataRoom.set(JSON.parse(e.newValue ?? '[]')); } catch { /* ignore */ }
      }
      if (e.key === ROT_APPROVALS_KEY) {
        try { this.rotApprovals.set(JSON.parse(e.newValue ?? '{}')); } catch { /* ignore */ }
      }
      if (e.key === CONTRACT_SIGNS_KEY) {
        try { this.contractSigns.set(JSON.parse(e.newValue ?? '{}')); } catch { /* ignore */ }
      }
    });
  }

  activeProperty = computed(() => {
    const id = this.selectedId();
    return id ? this.data.getProperty(id) : undefined;
  });

  activeProperties = computed(() => {
    const userProjectIds = this.auth.currentUser()?.projects ?? [];
    if (!userProjectIds.length) return [];
    const assignedPhases = new Set(
      this.projects.all
        .filter(proj => userProjectIds.includes(proj.id))
        .map(proj => proj.name)
    );
    return this.data.properties.filter(p =>
      p.status === 'active' && assignedPhases.has(p.phase)
    );
  });

  filteredProperties = computed(() => {
    const q     = this.filterSearch().toLowerCase();
    const beds  = this.filterBeds();
    const epc   = this.filterEpc();
    const stage = this.filterStage();
    const sort  = this.filterSort();

    let list = this.activeProperties().filter(p => {
      if (q && !p.address.toLowerCase().includes(q) && !(p.postcode ?? '').toLowerCase().includes(q)) return false;
      if (beds !== 'all') {
        if (beds === '5+') { if ((p.beds ?? 0) < 5) return false; }
        else               { if (p.beds !== +beds) return false; }
      }
      if (epc !== 'all' && p.epcBefore?.r !== epc) return false;
      if (stage !== 'all' && p.stage !== stage) return false;
      return true;
    });

    if (sort === 'price-high') list = [...list].sort((a, b) => (b.financial?.ap ?? 0) - (a.financial?.ap ?? 0));
    else if (sort === 'price-low') list = [...list].sort((a, b) => (a.financial?.ap ?? 0) - (b.financial?.ap ?? 0));
    else if (sort === 'oldest') list = [...list].reverse();

    return list;
  });

  hasFilters = computed(() =>
    this.filterSearch() !== '' || this.filterBeds() !== 'all' ||
    this.filterEpc() !== 'all' || this.filterStage() !== 'all' || this.filterSort() !== 'newest'
  );

  resetFilters(): void {
    this.filterSearch.set('');
    this.filterBeds.set('all');
    this.filterEpc.set('all');
    this.filterStage.set('all');
    this.filterSort.set('newest');
  }

  actionRequired = computed(() =>
    this.activeProperties().filter(p =>
      p.stage === 'ClientApproval' ||
      (p.stage === 'Viewing' && p.viewing?.clientReview === 'pending') ||
      this.rotApprovals()[p.id]?.status === 'pending' ||
      (p.stage === 'Lettings' && this.contractDocForProp(p.id) !== undefined && !this.contractSigns()[p.id])
    )
  );

  atMoS = computed(() =>
    this.activeProperties().filter(p => p.stage === 'MemorandumOfSale').length
  );

  totalValue = computed(() =>
    this.activeProperties().reduce((a, p) => a + (p.financial?.ap ?? 0), 0)
  );

  stageCounts = computed(() => {
    const order = ['Draft','ClientApproval','Viewing','Negotiations','MemorandumOfSale','Legals','Refurbishment','Lettings'];
    const props = this.activeProperties();
    return order
      .map(s => ({ stage: s, label: this.stageLabel(s), count: props.filter(p => p.stage === s).length }))
      .filter(s => s.count > 0);
  });

  bedBreakdown = computed(() => {
    const counts: Record<string, number> = {};
    for (const p of this.activeProperties()) {
      const key = !p.beds ? '?' : p.beds >= 5 ? '5+' : String(p.beds);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return ['1','2','3','4','5+'].map(b => ({ beds: b, count: counts[b] ?? 0 })).filter(b => b.count > 0);
  });

  private readonly committedStages = new Set(['MemorandumOfSale','Legals','Refurbishment','Lettings']);

  committedSpend = computed(() =>
    this.activeProperties()
      .filter(p => this.committedStages.has(p.stage))
      .reduce((sum, p) => sum + (p.agreedPrice ?? p.financial?.ap ?? 0), 0)
  );

  committedCount = computed(() =>
    this.activeProperties().filter(p => this.committedStages.has(p.stage)).length
  );

  lettingsCount = computed(() =>
    this.activeProperties().filter(p => p.stage === 'Lettings').length
  );

  epcTargetMet = computed(() =>
    this.activeProperties().filter(p => p.epcAfter && ['A','B','C'].includes(p.epcAfter.r)).length
  );

  epcRatingCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const p of this.activeProperties()) {
      const r = p.epcBefore?.r;
      if (r) counts[r] = (counts[r] ?? 0) + 1;
    }
    return ['A','B','C','D','E','F','G']
      .map(r => ({ r, count: counts[r] ?? 0 }))
      .filter(x => x.count > 0);
  });

  openDetail(p: Property): void {
    this.selectedId.set(p.id);
    this.view.set('detail');
  }

  approve(): void {
    const p = this.activeProperty();
    if (!p) return;
    const name  = this.approverName().trim() || 'Council Representative';
    const price = parseFloat(this.maxPrice()) || (p.financial?.ap ?? 0);
    this.data.approveClient(p.id, name, price);
    this.showApproveModal.set(false);
    this.approverName.set('');
    this.maxPrice.set('');
    this.view.set('dashboard');
    this.selectedId.set(null);
  }

  reject(): void {
    const p = this.activeProperty();
    if (!p) return;
    const reasons = this.rejectReasons();
    const reason  = reasons.length ? reasons.join(', ') : 'Rejected by council';
    this.data.markLost(p.id, reason, this._userName);
    this.showRejectModal.set(false);
    this.rejectReasons.set([]);
    this.rejectNotes.set('');
    this.view.set('dashboard');
    this.selectedId.set(null);
  }

  toggleReason(r: string): void {
    this.rejectReasons.update(list =>
      list.includes(r) ? list.filter(x => x !== r) : [...list, r]
    );
  }

  approveViewing(): void {
    const p = this.activeProperty();
    if (!p) return;
    this.data.approveViewing(p.id, this._userName);
    this.showViewingApproveModal.set(false);
    this.view.set('dashboard');
    this.selectedId.set(null);
  }

  rejectAtViewing(): void {
    const p = this.activeProperty();
    if (!p) return;
    const reasons = this.viewingRejectReasons();
    const reason  = reasons.length ? reasons.join(', ') : 'Rejected at viewing by council';
    this.data.markLost(p.id, reason, this._userName);
    this.showViewingRejectModal.set(false);
    this.viewingRejectReasons.set([]);
    this.viewingRejectNotes.set('');
    this.view.set('dashboard');
    this.selectedId.set(null);
  }

  toggleViewingReason(r: string): void {
    this.viewingRejectReasons.update(list =>
      list.includes(r) ? list.filter(x => x !== r) : [...list, r]
    );
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  openAccountModal(): void {
    this.acctCurrentPass.set(''); this.acctNewPass.set(''); this.acctConfirmPass.set('');
    this.acctPassError.set(''); this.acctPassSuccess.set(false);
    this.showAccountModal.set(true);
  }

  savePassword(): void {
    const current = this.acctCurrentPass().trim();
    const next    = this.acctNewPass().trim();
    const confirm = this.acctConfirmPass().trim();
    const user    = this.auth.currentUser();
    if (!user) return;
    if (current !== user.password) { this.acctPassError.set('Current password is incorrect.'); return; }
    if (next.length < 4) { this.acctPassError.set('New password must be at least 4 characters.'); return; }
    if (next !== confirm) { this.acctPassError.set('Passwords do not match.'); return; }
    this.auth.updateUser(user.id, { password: next });
    this.acctPassError.set('');
    this.acctCurrentPass.set(''); this.acctNewPass.set(''); this.acctConfirmPass.set('');
    this.acctPassSuccess.set(true);
  }

  saveNotifPref(pref: 'email' | 'inapp' | 'both'): void {
    const user = this.auth.currentUser();
    if (user) this.auth.updateUser(user.id, { notificationPrefs: pref });
  }

  userInitials(): string {
    const name = this.auth.currentUser()?.name ?? '';
    return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  }

  actionType(p: Property): 'property-approval' | 'viewing-review' | 'rot-approval' | 'contract-sign' | null {
    if (p.stage === 'ClientApproval') return 'property-approval';
    if (p.stage === 'Viewing' && p.viewing?.clientReview === 'pending') return 'viewing-review';
    if (this.rotApprovals()[p.id]?.status === 'pending') return 'rot-approval';
    if (p.stage === 'Lettings' && this.contractDocForProp(p.id) !== undefined && !this.contractSigns()[p.id]) return 'contract-sign';
    return null;
  }

  rotDocForProp(propId: string): DataRoomFile | undefined {
    return this.dataRoom().find(f => f.propertyId === propId && f.docType === 'Final Report on Title');
  }

  contractDocForProp(propId: string): DataRoomFile | undefined {
    return this.dataRoom().find(f =>
      f.propertyId === propId &&
      ['Signed Contract', 'Transfer Deed', 'TR1'].includes(f.docType)
    );
  }

  isContractSigned(propId: string): boolean {
    return !!this.contractSigns()[propId];
  }

  contractSignedAt(propId: string): string | undefined {
    return this.contractSigns()[propId]?.signedAt;
  }

  contractSignature(propId: string): string | undefined {
    return this.contractSigns()[propId]?.signature;
  }

  private _sigPoint(event: MouseEvent | TouchEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = 'touches' in event ? event.touches[0] : event as MouseEvent;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  }

  startSig(event: MouseEvent | TouchEvent, propId: string): void {
    const canvas = document.getElementById('sig-' + propId) as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pt = this._sigPoint(event, canvas);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    this._sigDrawing = true;
  }

  drawSig(event: MouseEvent | TouchEvent, propId: string): void {
    if (!this._sigDrawing) return;
    event.preventDefault();
    const canvas = document.getElementById('sig-' + propId) as HTMLCanvasElement;
    if (!canvas) return;
    const pt = this._sigPoint(event, canvas);
    const ctx = canvas.getContext('2d')!;
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    this.sigHasContent.set(true);
  }

  endSig(): void {
    this._sigDrawing = false;
  }

  clearSig(propId: string): void {
    const canvas = document.getElementById('sig-' + propId) as HTMLCanvasElement;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    this.sigHasContent.set(false);
  }

  signContract(propId: string): void {
    const canvas = document.getElementById('sig-' + propId) as HTMLCanvasElement;
    const signature = canvas?.toDataURL('image/png');
    const signs = { ...this.contractSigns(), [propId]: { signedAt: new Date().toLocaleDateString('en-GB'), signature } };
    localStorage.setItem(CONTRACT_SIGNS_KEY, JSON.stringify(signs));
    this.contractSigns.set(signs);
  }

  rotApprovalStatus(propId: string): string | undefined {
    return this.rotApprovals()[propId]?.status;
  }

  previewRotFile(propId: string): void {
    const file = this.rotDocForProp(propId);
    if (!file?.url) return;
    fetch(file.url)
      .then(r => r.blob())
      .then(blob => { window.open(URL.createObjectURL(blob), '_blank'); });
  }

  approveRot(propId: string): void {
    const approvals = { ...this.rotApprovals() };
    approvals[propId] = { status: 'approved', approvedBy: this._userName };
    localStorage.setItem(ROT_APPROVALS_KEY, JSON.stringify(approvals));
    this.rotApprovals.set(approvals);
    this.showRotApproveModal.set(false);
    this.view.set('dashboard');
    this.selectedId.set(null);
  }

  stagePct(stage: string): number {
    const stages = ['Draft','ClientApproval','Viewing','Negotiations','MemorandumOfSale','Legals','Refurbishment','Lettings'];
    const idx = stages.indexOf(stage);
    return idx < 0 ? 0 : Math.round(idx / (stages.length - 1) * 100);
  }

  stageLabel(s: string): string {
    const m: Record<string, string> = {
      Draft: 'Draft', ClientApproval: 'Client Approval', Viewing: 'Viewing',
      Negotiations: 'Negotiations', MemorandumOfSale: 'Memorandum of Sale',
      Legals: 'Legals', Refurbishment: 'Refurbishment', Lettings: 'Lettings',
    };
    return m[s] ?? s;
  }

  statusMsg(p: Property): string {
    switch (p.stage) {
      case 'Draft':             return 'Under assessment by SimplyPhi';
      case 'Viewing':           return p.viewing?.clientReview === 'pending' ? 'Viewing report sent — awaiting your decision' : 'Viewing being arranged';
      case 'Negotiations':      return 'Offer negotiations in progress';
      case 'MemorandumOfSale':  return 'Memorandum of Sale agreed';
      case 'Legals':            return 'Legal conveyancing in progress';
      case 'Refurbishment':     return 'Refurbishment underway';
      case 'Lettings':          return 'Property in lettings';
      default: return p.stage;
    }
  }

  fmt(n: number | undefined): string {
    if (!n) return '—';
    if (n >= 1_000_000) return '£' + (n / 1_000_000).toFixed(1) + 'm';
    return '£' + n.toLocaleString('en-GB');
  }

  fmtFull(n: number | undefined): string {
    return n ? '£' + n.toLocaleString('en-GB') : '—';
  }

  epcColor(r: string): string {
    const m: Record<string, string> = {
      A: '#00a651', B: '#50b848', C: '#b2d235',
      D: '#fff200', E: '#f7941d', F: '#f15a24', G: '#ed1b24',
    };
    return m[r] ?? '#ccc';
  }
}
