import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MockDataService } from '../../services/mock-data';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import { Property } from '../../models/property.model';

@Component({
  selector: 'app-pipeline',
  imports: [MoneyPipe],
  templateUrl: './pipeline.html',
  styleUrl: './pipeline.scss',
})
export class PipelineComponent {
  data = inject(MockDataService);
  router = inject(Router);

  readonly phases = [
    { id: 'all', label: 'All Phases', color: '#888' },
    { id: 'Bristol P3', label: 'Bristol — Phase 3', color: '#2472a8' },
    { id: 'Merton LAHF', label: 'Merton LAHF', color: '#0f7c6b' },
    { id: 'Leeds P1', label: 'Leeds — Phase 1', color: '#7c3aed' },
    { id: 'Hastings ESPH', label: 'Hastings ESPH', color: '#E8601C' },
  ];

  readonly stages = ['all', 'Draft', 'ClientApproval', 'Viewing', 'Negotiations', 'MemorandumOfSale', 'Legals', 'Refurbishment', 'Lettings'];

  selectedPhase = signal('all');
  stageFilter   = signal('all');
  searchQuery   = signal('');
  bedsFilter    = signal('all');
  epcFilter     = signal('all');
  sortOrder     = signal('newest');

  filteredProperties = computed(() => {
    const phase = this.selectedPhase();
    const stage = this.stageFilter();
    const q     = this.searchQuery().toLowerCase();
    const beds  = this.bedsFilter();
    const epc   = this.epcFilter();
    const sort  = this.sortOrder();

    let list = this.data.properties.filter(p => {
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

    if (sort === 'price-high') list = [...list].sort((a, b) => (b.financial?.ap ?? 0) - (a.financial?.ap ?? 0));
    else if (sort === 'price-low') list = [...list].sort((a, b) => (a.financial?.ap ?? 0) - (b.financial?.ap ?? 0));
    else if (sort === 'oldest') list = [...list].reverse();

    return list;
  });

  hasFilters = computed(() =>
    this.searchQuery() !== '' || this.stageFilter() !== 'all' ||
    this.bedsFilter() !== 'all' || this.epcFilter() !== 'all' || this.sortOrder() !== 'newest'
  );

  resetFilters(): void {
    this.searchQuery.set('');
    this.stageFilter.set('all');
    this.bedsFilter.set('all');
    this.epcFilter.set('all');
    this.sortOrder.set('newest');
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
    if (phaseId === 'all') return this.data.properties.length;
    return this.data.properties.filter(p => p.phase === phaseId).length;
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
