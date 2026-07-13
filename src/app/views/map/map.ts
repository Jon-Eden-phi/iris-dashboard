import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MockDataService } from '../../services/mock-data';

interface PhasePin {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  cx: number;
  cy: number;
  count: number;
  properties: number;
}

@Component({
  selector: 'app-map',
  imports: [],
  templateUrl: './map.html',
  styleUrl: './map.scss',
})
export class MapComponent {
  data = inject(MockDataService);
  router = inject(Router);
  selected = signal<string | null>(null);

  pins: PhasePin[] = [
    { id: 'Bristol P3',    label: 'Bristol — Phase 3', shortLabel: 'Bristol',  color: '#2472a8', cx: 40, cy: 67, count: 18, properties: 5 },
    { id: 'Merton LAHF',   label: 'Merton LAHF 2 & 3', shortLabel: 'Merton',   color: '#0f7c6b', cx: 62, cy: 58, count: 13, properties: 3 },
    { id: 'Leeds P1',      label: 'Leeds — Phase 1',    shortLabel: 'Leeds',    color: '#7c3aed', cx: 54, cy: 37, count: 9,  properties: 2 },
    { id: 'Hastings ESPH', label: 'Hastings ESPH',      shortLabel: 'Hastings', color: '#E8601C', cx: 67, cy: 64, count: 42, properties: 2 },
  ];

  selectedPin(): PhasePin | null {
    const id = this.selected();
    return id ? (this.pins.find(p => p.id === id) ?? null) : null;
  }

  propertiesForPhase(phaseId: string) {
    return this.data.properties.filter(p => p.phase === phaseId).slice(0, 3);
  }

  select(pin: PhasePin): void {
    this.selected.update(v => v === pin.id ? null : pin.id);
  }

  goToPipeline(phaseId: string): void {
    this.router.navigate(['/pipeline'], { queryParams: { phase: phaseId } });
  }

  stageLabel(s: string): string {
    const m: Record<string, string> = { ClientApproval: 'Client Appr.', Negotiations: 'Negotiate', MemorandumOfSale: 'MoS', Refurbishment: 'Refurb' };
    return m[s] || s;
  }
}
