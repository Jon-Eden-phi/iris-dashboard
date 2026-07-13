import { Component, computed, inject, signal } from '@angular/core';
import { MockDataService } from '../../services/mock-data';

@Component({
  selector: 'app-lost',
  imports: [],
  templateUrl: './lost.html',
  styleUrl: './lost.scss',
})
export class LostComponent {
  data = inject(MockDataService);
  phaseFilter = signal('all');

  phases = ['all', 'Bristol P3', 'Merton LAHF', 'Leeds P1', 'Hastings ESPH'];

  filtered = computed(() => {
    const ph = this.phaseFilter();
    return ph === 'all'
      ? this.data.lostProperties
      : this.data.lostProperties.filter(p => p.phase === ph);
  });

  formatDate(d: string | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  stageLabel(s: string): string {
    const m: Record<string, string> = { ClientApproval: 'Client Appr.', Negotiations: 'Negotiate', MemorandumOfSale: 'MoS', Refurbishment: 'Refurb' };
    return m[s] || s;
  }
}
