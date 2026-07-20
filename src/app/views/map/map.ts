import { Component, inject, signal, computed, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MockDataService } from '../../services/mock-data';
import * as L from 'leaflet';

interface PhasePin {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  lat: number;
  lng: number;
}

const PHASES: PhasePin[] = [
  { id: 'Bristol P3',    label: 'Bristol — Phase 3',  shortLabel: 'Bristol',  color: '#2472a8', lat: 51.4545, lng: -2.5879 },
  { id: 'Merton LAHF',   label: 'Merton LAHF 2 & 3',  shortLabel: 'Merton',   color: '#0f7c6b', lat: 51.4014, lng: -0.1958 },
  { id: 'Leeds P1',      label: 'Leeds — Phase 1',     shortLabel: 'Leeds',    color: '#7c3aed', lat: 53.8008, lng: -1.5491 },
  { id: 'Hastings ESPH', label: 'Hastings ESPH',        shortLabel: 'Hastings', color: '#E8601C', lat: 50.8543, lng:  0.5730 },
];

@Component({
  selector: 'app-map',
  imports: [],
  templateUrl: './map.html',
  styleUrl: './map.scss',
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  data   = inject(MockDataService);
  router = inject(Router);

  selected = signal<string | null>(null);
  phases   = PHASES;

  private map!: L.Map;
  private markers: L.Marker[] = [];

  selectedPin = computed(() => {
    const id = this.selected();
    return id ? (PHASES.find(p => p.id === id) ?? null) : null;
  });

  propCount(phaseId: string): number {
    return this.data.properties.filter(p => p.phase === phaseId).length;
  }

  propertiesForPhase(phaseId: string) {
    return this.data.properties.filter(p => p.phase === phaseId).slice(0, 3);
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      center: [52.8, -1.5],
      zoom: 6,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(this.map);

    for (const phase of PHASES) {
      const count = this.propCount(phase.id);
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            width:42px; height:42px; border-radius:50%;
            background:${phase.color}; color:#fff;
            font-weight:800; font-size:13px;
            display:flex; align-items:center; justify-content:center;
            border:3px solid #fff;
            box-shadow:0 2px 10px rgba(0,0,0,0.28);
            cursor:pointer;
          ">${count}</div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });

      const marker = L.marker([phase.lat, phase.lng], { icon })
        .addTo(this.map)
        .on('click', () => this.selected.update(v => v === phase.id ? null : phase.id));

      this.markers.push(marker);
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  select(phase: PhasePin): void {
    this.selected.update(v => v === phase.id ? null : phase.id);
    this.map.flyTo([phase.lat, phase.lng], 11, { duration: 0.8 });
  }

  goToPipeline(phaseId: string): void {
    this.router.navigate(['/pipeline'], { queryParams: { phase: phaseId } });
  }

  stageLabel(s: string): string {
    const m: Record<string, string> = { ClientApproval: 'Client Appr.', Negotiations: 'Negotiate', MemorandumOfSale: 'MoS', Refurbishment: 'Refurb' };
    return m[s] || s;
  }
}
