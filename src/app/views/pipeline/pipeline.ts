import { Component, computed, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MockDataService } from '../../services/mock-data';
import { AuthService } from '../../services/auth';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import { Property } from '../../models/property.model';

const EPC_RANK: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 };

@Component({
  selector: 'app-pipeline',
  imports: [MoneyPipe],
  templateUrl: './pipeline.html',
  styleUrl: './pipeline.scss',
})
export class PipelineComponent {
  data   = inject(MockDataService);
  auth   = inject(AuthService);
  router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly isDashboard = this.route.snapshot.data['mode'] === 'dashboard';

  readonly phases = [
    { id: 'all', label: 'All Phases', color: '#888' },
    { id: 'Bristol P3', label: 'Bristol — Phase 3', color: '#2472a8' },
    { id: 'Merton LAHF', label: 'Merton LAHF', color: '#0f7c6b' },
    { id: 'Leeds P1', label: 'Leeds — Phase 1', color: '#7c3aed' },
    { id: 'Hastings ESPH', label: 'Hastings ESPH', color: '#E8601C' },
  ];

  readonly stages = ['all', 'Draft', 'ClientApproval', 'Viewing', 'Negotiations', 'MemorandumOfSale', 'Legals', 'Refurbishment', 'Lettings'];
  readonly sourcingStageSet = new Set(['Draft', 'ClientApproval', 'Viewing', 'Negotiations']);
  readonly displayStages = this.isDashboard
    ? ['all', 'Draft', 'ClientApproval', 'Viewing', 'Negotiations']
    : this.stages;

  selectedPhase = signal('all');
  stageFilter   = signal('all');
  searchQuery   = signal('');
  bedsFilter    = signal('all');
  epcFilter     = signal('all');

  // Dashboard table sort
  sortCol = signal('');
  sortDir = signal<'asc' | 'desc'>('asc');

  sortBy(col: string): void {
    if (this.sortCol() === col) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortCol.set(col);
      this.sortDir.set('asc');
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

  private propVal(p: Property, col: string): string | number {
    switch (col) {
      case 'address':   return p.address;
      case 'phase':     return p.phase ?? '';
      case 'stage':     return this.stages.indexOf(p.stage);
      case 'beds':      return p.beds ?? 0;
      case 'epcBefore': return EPC_RANK[p.epcBefore?.r ?? ''] ?? 99;
      case 'epcAfter':  return EPC_RANK[p.epcAfter?.r ?? ''] ?? 99;
      case 'ap':        return p.financial?.ap ?? 0;
      case 'yield':     return p.financial?.yield ?? 0;
      case 'dept':      return this.sourcingStageSet.has(p.stage) ? 'Sourcing' : 'Purchasing';
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

  private readonly sourcingRoleStages = new Set(['Draft','ClientApproval','Viewing','Negotiations']);
  private readonly purchasingRoleStages = new Set(['MemorandumOfSale','Legals','Refurbishment','Lettings']);

  private roleStageFilter = computed((): Set<string> | null => {
    const role = this.auth.currentUser()?.role;
    if (role === 'Sourcing')   return this.sourcingRoleStages;
    if (role === 'Purchasing') return this.purchasingRoleStages;
    return null;
  });

  filteredProperties = computed(() => {
    const phase = this.selectedPhase();
    const stage = this.stageFilter();
    const q     = this.searchQuery().toLowerCase();
    const beds  = this.bedsFilter();
    const epc   = this.epcFilter();
    const col   = this.sortCol();
    const dir   = this.sortDir();

    const roleStages = this.roleStageFilter();

    let list = this.data.properties.filter(p => {
      if (roleStages && !roleStages.has(p.stage)) return false;
      if (this.isDashboard && !this.sourcingStageSet.has(p.stage)) return false;
      if (phase !== 'all' && p.phase !== phase) return false;
      if (stage !== 'all' && p.stage !== stage) return false;
      if (q && !p.address.toLowerCase().includes(q) && !(p.postcode || '').toLowerCase().includes(q)) return false;
      if (beds !== 'all') {
        if (beds === '5+') { if ((p.beds ?? 0) < 5) return false; }
        else               { if (p.beds !== +beds) return false; }
      }
      if (epc !== 'all' && p.epcBefore?.r !== epc) return false;
      return true;
    });

    return this.applySort(list, col, dir);
  });

  hasFilters = computed(() =>
    this.searchQuery() !== '' || this.stageFilter() !== 'all' ||
    this.bedsFilter() !== 'all' || this.epcFilter() !== 'all'
  );

  resetFilters(): void {
    this.searchQuery.set('');
    this.stageFilter.set('all');
    this.bedsFilter.set('all');
    this.epcFilter.set('all');
  }

  totalBudget = computed(() =>
    this.filteredProperties().reduce((a, p) => a + (p.financial?.ap ?? 0), 0)
  );

  avgYield = computed(() => {
    const ps = this.filteredProperties().filter(p => p.financial?.yield);
    return ps.length ? (ps.reduce((a, p) => a + (p.financial!.yield!), 0) / ps.length) : 0;
  });

  epcCPlus = computed(() =>
    this.filteredProperties().filter(p => p.epcAfter && ['A', 'B', 'C'].includes(p.epcAfter.r)).length
  );

  phaseCount(phaseId: string): number {
    const roleStages = this.roleStageFilter();
    const base = this.data.properties.filter(p => {
      if (roleStages && !roleStages.has(p.stage)) return false;
      if (this.isDashboard && !this.sourcingStageSet.has(p.stage)) return false;
      return true;
    });
    if (phaseId === 'all') return base.length;
    return base.filter(p => p.phase === phaseId).length;
  }

  stageLabel(s: string): string {
    const map: Record<string, string> = {
      ClientApproval: 'Client Appr.', Negotiations: 'Negotiate',
      MemorandumOfSale: 'MoS', Refurbishment: 'Refurb',
    };
    return map[s] || s;
  }

  navigate(p: Property): void {
    this.router.navigate(['/record', p.id]);
  }

  // Pipeline view (all active properties)
  pipelineSearch = signal('');

  pipelineProperties = computed(() => {
    const q   = this.pipelineSearch().toLowerCase();
    const col = this.pipeSortCol();
    const dir = this.pipeSortDir();
    let list = this.data.properties.filter(p => {
      if (!q) return true;
      return p.address.toLowerCase().includes(q) || (p.postcode ?? '').toLowerCase().includes(q);
    });
    return this.applySort(list, col, dir);
  });

  deptLabel(stage: string): string {
    return this.sourcingStageSet.has(stage) ? 'Sourcing' : 'Purchasing';
  }

  showCreateModal = signal(false);
  draftAddress  = signal('');
  draftPostcode = signal('');
  draftPhase    = signal('Bristol P3');
  draftBeds     = signal('');
  draftType     = signal('');
  draftPrice    = signal('');

  createDraft(): void {
    const address = this.draftAddress().trim();
    if (!address) return;
    this.data.addProperty({
      address,
      postcode: this.draftPostcode().trim() || undefined,
      phase:    this.draftPhase(),
      beds:     this.draftBeds()  ? +this.draftBeds()  : undefined,
      type:     this.draftType().trim() || undefined,
      financial: this.draftPrice() ? { ap: +this.draftPrice().replace(/[^0-9]/g, '') } : undefined,
    });
    this.draftAddress.set('');
    this.draftPostcode.set('');
    this.draftBeds.set('');
    this.draftType.set('');
    this.draftPrice.set('');
    this.showCreateModal.set(false);
  }
}
