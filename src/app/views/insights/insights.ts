import { Component, AfterViewInit, ElementRef, ViewChild, inject, computed, effect } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { MockDataService } from '../../services/mock-data';

Chart.register(...registerables);

interface NegRow {
  id: string; label: string; color: string;
  properties: number; asking: number; agreed: number; series: number[];
}

// Historical completions per phase (before this Iris instance was set up)
const HISTORICAL: Record<string, NegRow> = {
  'Bristol P3':    { id: 'bristol-p3',    label: 'Bristol — Phase 3', color: '#E8601C', properties: 4,  asking: 1051950, agreed: 987750,  series: [0, 8200,  19400,  33100,  48900,  64200] },
  'Merton LAHF':   { id: 'merton',        label: 'Merton LAHF',       color: '#7c3aed', properties: 8,  asking: 2640000, agreed: 2512000, series: [0, 18000, 42000,  72000,  104000, 128000] },
  'Leeds P1':      { id: 'leeds-p1',      label: 'Leeds — Phase 1',   color: '#2472a8', properties: 5,  asking: 890000,  agreed: 844000,  series: [0, 7000,  16000,  27000,  37000,  46000] },
  'Hastings ESPH': { id: 'hastings-esph', label: 'Hastings ESPH',     color: '#0f7c6b', properties: 12, asking: 3150000, agreed: 2988000, series: [0, 24000, 56000,  95000,  133000, 162000] },
};

const POST_NEG_STAGES = new Set(['MemorandumOfSale', 'Legals', 'Refurbishment', 'Lettings']);

@Component({
  selector: 'app-insights',
  imports: [],
  templateUrl: './insights.html',
  styleUrl: './insights.scss',
})
export class InsightsComponent implements AfterViewInit {
  @ViewChild('insightsChart') insightsChart!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  data = inject(MockDataService);

  negotiationRows = computed<NegRow[]>(() => {
    // Properties that have completed negotiations (accepted offer or post-neg stage)
    const liveProps = this.data.properties.filter(p =>
      p.status === 'active' && (
        POST_NEG_STAGES.has(p.stage) || (p.offers ?? []).some(o => o.status === 'accepted')
      )
    );

    return Object.entries(HISTORICAL).map(([phase, hist]) => {
      const phaseProps = liveProps.filter(p => p.phase === phase);
      const liveAsking  = phaseProps.reduce((a, p) => a + (p.financial?.ap ?? 0), 0);
      const liveAgreed  = phaseProps.reduce((a, p) => {
        const accepted = [...(p.offers ?? [])].reverse().find(o => o.status === 'accepted');
        return a + (p.agreedPrice ?? accepted?.amount ?? p.financial?.ap ?? 0);
      }, 0);
      const liveSaving  = liveAsking - liveAgreed;

      return {
        id:         hist.id,
        label:      hist.label,
        color:      hist.color,
        properties: hist.properties + phaseProps.length,
        asking:     hist.asking + liveAsking,
        agreed:     hist.agreed + liveAgreed,
        // Bump the last series point by any live savings
        series: hist.series.map((v, i) =>
          i === hist.series.length - 1 ? v + liveSaving : v
        ),
      };
    });
  });

  get totalOff():    number   { return this.negotiationRows().reduce((a, r) => a + (r.asking - r.agreed), 0); }
  get totalAsking(): number   { return this.negotiationRows().reduce((a, r) => a + r.asking, 0); }
  get totalAgreed(): number   { return this.negotiationRows().reduce((a, r) => a + r.agreed, 0); }
  get totalProps():  number   { return this.negotiationRows().reduce((a, r) => a + r.properties, 0); }
  get avgPct():      number   { return this.totalAsking ? this.totalOff / this.totalAsking * 100 : 0; }
  get topProject():  NegRow   { return [...this.negotiationRows()].sort((a, b) => (b.asking - b.agreed) - (a.asking - a.agreed))[0]; }

  rowOff(r: NegRow): number { return r.asking - r.agreed; }
  rowPct(r: NegRow): number { return r.asking ? this.rowOff(r) / r.asking * 100 : 0; }

  fmt(n: number): string {
    if (n >= 1_000_000) return '£' + (n / 1_000_000).toFixed(2) + 'm';
    if (n >= 1_000)     return '£' + (n / 1_000).toFixed(0) + 'k';
    return '£' + n.toLocaleString('en-GB');
  }

  constructor() {
    // Re-render chart whenever pipeline data changes
    effect(() => {
      const rows = this.negotiationRows();
      if (this.chart) this.updateChart(rows);
    });
  }

  ngAfterViewInit(): void {
    this.buildChart();
  }

  private buildChart(): void {
    const rows = this.negotiationRows();
    this.chart = new Chart(this.insightsChart.nativeElement, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: rows.map(r => ({
          label: r.label, data: r.series,
          borderColor: r.color, backgroundColor: r.color + '20',
          fill: true, tension: 0.35, pointRadius: 3,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v: any) => '£' + (v / 1000) + 'k', font: { size: 11 } },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          x: { ticks: { font: { size: 11 } }, grid: { display: false } },
        },
      },
    });
  }

  private updateChart(rows: NegRow[]): void {
    if (!this.chart) return;
    rows.forEach((r, i) => {
      if (this.chart!.data.datasets[i]) {
        this.chart!.data.datasets[i].data = r.series;
      }
    });
    this.chart.update();
  }
}
