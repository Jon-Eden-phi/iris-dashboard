import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MockDataService } from '../../services/mock-data';
import { AuthService } from '../../services/auth';
import { ProjectsService } from '../../services/projects';
import { Property } from '../../models/property.model';

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

  showApproveModal = signal(false);
  showRejectModal  = signal(false);

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
      (p.stage === 'Viewing' && p.viewing?.clientReview === 'pending')
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

  actionType(p: Property): 'property-approval' | 'viewing-review' | null {
    if (p.stage === 'ClientApproval') return 'property-approval';
    if (p.stage === 'Viewing' && p.viewing?.clientReview === 'pending') return 'viewing-review';
    return null;
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
