import {
  Component, computed, inject, signal,
  ViewChild, ElementRef, AfterViewInit, OnDestroy
} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, skip, Subscription } from 'rxjs';
import { MockDataService } from '../../services/mock-data';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import { Home } from '../../models/social.model';

Chart.register(...registerables);

@Component({
  selector: 'app-social-impact',
  imports: [MoneyPipe],
  templateUrl: './social-impact.html',
  styleUrl: './social-impact.scss',
})
export class SocialImpactComponent implements AfterViewInit, OnDestroy {
  @ViewChild('epcChartCanvas') epcChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('regionChartCanvas') regionChartCanvas?: ElementRef<HTMLCanvasElement>;

  data = inject(MockDataService);

  socialProject = signal('all');
  dateFrom = signal('');
  dateTo = signal('');
  avoidedRates = signal<Record<string, number>>({ '1': 22800, '2': 26500, '3': 31900, '4': 39200 });
  activePreset = signal('All time');

  readonly datePresets = [
    { label: 'All time', from: '', to: '' },
    { label: '2024',     from: '2024-01-01', to: '2024-12-31' },
    { label: '2025',     from: '2025-01-01', to: '2025-12-31' },
    { label: '2026',     from: '2026-01-01', to: '2026-12-31' },
    { label: 'FY 24/25', from: '2024-04-01', to: '2025-03-31' },
    { label: 'FY 25/26', from: '2025-04-01', to: '2026-03-31' },
  ];

  private epcChart: Chart | null = null;
  private regionChart: Chart | null = null;
  private sub!: Subscription;
  private chartTrigger$;

  constructor() {
    this.chartTrigger$ = combineLatest([
      toObservable(this.socialProject),
      toObservable(this.dateFrom),
      toObservable(this.dateTo),
    ]).pipe(skip(1));
  }

  // ── Derived state ─────────────────────────────────────────────

  selectedProjects = computed(() => {
    const sp = this.socialProject();
    if (sp === 'all') return this.data.socialProjects;
    return this.data.socialProjects.filter(p => p.id === sp);
  });

  activeProject = computed(() =>
    this.data.socialProjects.find(p => p.id === this.socialProject()) ?? null
  );

  filteredHomes = computed<Home[] | null>(() => {
    const from = this.dateFrom(), to = this.dateTo();
    if (!from && !to) return null;
    return this.selectedProjects().flatMap(p => p.homes).filter(h => {
      if (!h.completed) return false;
      const [mm, yyyy] = h.completed.split('/');
      const d = `${yyyy}-${mm.padStart(2, '0')}`;
      if (from && d < from.substring(0, 7)) return false;
      if (to   && d > to.substring(0, 7))   return false;
      return true;
    });
  });

  displayedHomes = computed(() =>
    this.filteredHomes() ?? this.selectedProjects().flatMap(p => p.homes)
  );

  periodLabel = computed(() => {
    const ap = this.activePreset();
    if (ap === 'All time') return 'all time';
    if (ap !== 'Custom') return ap;
    return `${this.dateFrom()} – ${this.dateTo()}`;
  });

  statHomes = computed(() => {
    const fh = this.filteredHomes();
    if (fh) return fh.reduce((a, h) => a + h.frontDoors, 0);
    return this.selectedProjects().reduce((a, p) => a + (p.stats?.homes ?? 0), 0);
  });

  statBeds = computed(() => {
    const fh = this.filteredHomes();
    if (fh) return fh.reduce((a, h) => a + h.frontDoors * h.bedSize, 0);
    return this.selectedProjects().reduce((a, p) => a + (p.stats?.bedrooms ?? 0), 0);
  });

  statCPlusPct = computed(() => {
    const ps = this.selectedProjects();
    return ps.length ? Math.round(ps.reduce((a, p) => a + (p.stats?.epcCPlusPct ?? 0), 0) / ps.length) : 0;
  });

  statUplift = computed(() => {
    const fh = this.filteredHomes();
    if (fh) return fh.reduce((a, h) => a + (h.epcAfter.s - h.epcBefore.s), 0);
    return this.selectedProjects().reduce((a, p) => a + (p.stats?.epcPointUplift ?? 0), 0);
  });

  totalDoors      = computed(() => this.displayedHomes().reduce((a, h) => a + h.frontDoors, 0));
  totalCapex      = computed(() => this.displayedHomes().reduce((a, h) => a + h.capex, 0));
  totalUpliftPts  = computed(() =>
    this.displayedHomes().reduce((a, h) => a + (h.epcAfter.s - h.epcBefore.s), 0)
  );
  avgEpcUplift    = computed(() => {
    const hs = this.displayedHomes();
    return hs.length ? Math.round(this.totalUpliftPts() / hs.length) : 0;
  });
  epcCPlusCount   = computed(() =>
    this.displayedHomes().filter(h => ['A','B','C'].includes(h.epcAfter.r)).length
  );
  epcCPlusPct     = computed(() => {
    const total = this.displayedHomes().length;
    return total ? Math.round(this.epcCPlusCount() / total * 100) : 0;
  });

  bedBreakdown = computed<Record<string, number>>(() => {
    const bd: Record<string, number> = { '1':0, '2':0, '3':0, '4':0 };
    const fh = this.filteredHomes();
    if (fh) {
      fh.forEach(h => { const k = String(Math.min(4, Math.max(1, h.bedSize))); bd[k] += h.frontDoors; });
    } else {
      this.selectedProjects().forEach(p =>
        ['1','2','3','4'].forEach(k => { bd[k] += p.bedsBreakdown?.[k] ?? 0; })
      );
    }
    return bd;
  });

  totalBedHomes  = computed(() => Object.values(this.bedBreakdown()).reduce((a, b) => a + b, 0));
  annualAvoided  = computed(() =>
    ['1','2','3','4'].reduce((a, k) =>
      a + (this.bedBreakdown()[k] ?? 0) * (this.avoidedRates()[k] ?? 0), 0)
  );

  filteredSuppliers = computed(() => {
    const sp = this.socialProject(), from = this.dateFrom(), to = this.dateTo();
    return this.data.suppliers.filter(s => {
      if (sp !== 'all' && s.projectId !== sp) return false;
      if (from && s.date < from) return false;
      if (to   && s.date > to)   return false;
      return true;
    });
  });

  totalFees      = computed(() => this.filteredSuppliers().reduce((a, s) => a + s.fee, 0));
  localFees      = computed(() => this.filteredSuppliers().filter(s => s.isLocal).reduce((a, s) => a + s.fee, 0));
  localCount     = computed(() => this.filteredSuppliers().filter(s => s.isLocal).length);
  nonLocalCount  = computed(() => this.filteredSuppliers().filter(s => !s.isLocal).length);
  localSpendPct  = computed(() => this.totalFees() ? Math.round(this.localFees() / this.totalFees() * 100) : 0);

  headerTitle = computed(() => {
    const sp = this.socialProject();
    if (sp === 'all') return 'All projects (portfolio)';
    return this.activeProject()?.label ?? sp;
  });

  headerSubtitle = computed(() => {
    const sp = this.socialProject();
    if (sp === 'all') return this.data.socialProjects.map(p => p.label.split(' — ')[0]).join(' · ');
    const proj = this.activeProject();
    return proj ? `${proj.council} · ${proj.area}` : '';
  });

  // ── Lifecycle ─────────────────────────────────────────────────

  ngAfterViewInit(): void {
    setTimeout(() => this.buildCharts(), 60);
    this.sub = this.chartTrigger$.subscribe(() => setTimeout(() => this.buildCharts(), 60));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.epcChart?.destroy();
    this.regionChart?.destroy();
  }

  // ── Charts ────────────────────────────────────────────────────

  buildCharts(): void { this.buildEpcChart(); this.buildRegionChart(); }

  buildEpcChart(): void {
    this.epcChart?.destroy(); this.epcChart = null;
    const canvas = this.epcChartCanvas?.nativeElement;
    if (!canvas) return;

    const sp = this.socialProject();
    let labels: string[], data: number[], colors: string[];

    if (sp === 'all') {
      labels = this.data.socialProjects.map(p => p.label.split(' — ')[0]);
      data   = this.data.socialProjects.map(p => p.stats?.epcPointUplift ?? 0);
      colors = ['#2472a8', '#0f7c6b', '#7c3aed', '#E8601C'];
    } else {
      const homes = this.filteredHomes() ?? (this.activeProject()?.homes ?? []);
      labels = homes.map(h => h.acq.split(',')[0].substring(0, 22));
      data   = homes.map(h => h.epcAfter.s - h.epcBefore.s);
      colors = homes.map(h => ['A','B','C'].includes(h.epcAfter.r) ? '#0f7c6b' : '#E8601C');
    }

    this.epcChart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 5 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `+${ctx.parsed.y} EPC points` } }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 11 }, callback: (val) => `+${val}` }
          },
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 35 } }
        }
      }
    });
  }

  buildRegionChart(): void {
    this.regionChart?.destroy(); this.regionChart = null;
    const canvas = this.regionChartCanvas?.nativeElement;
    if (!canvas) return;

    const regions: Record<string, number> = {};
    this.selectedProjects().forEach(p =>
      p.spendByRegion?.forEach(r => {
        regions[r.region] = (regions[r.region] || 0) + Math.round(p.totalSupplierSpend * r.pct / 100);
      })
    );
    const labels = Object.keys(regions), vals = Object.values(regions);
    if (!labels.length) return;

    const palette = ['#2472a8','#0f7c6b','#7c3aed','#E8601C','#f59e0b','#10b981','#ef4444','#6366f1'];
    const colours = labels.map((_, i) => palette[i % palette.length]);
    this.regionChart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ data: vals, backgroundColor: colours, borderRadius: 4 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  // ── Actions ───────────────────────────────────────────────────

  setPreset(p: { label: string; from: string; to: string }): void {
    this.dateFrom.set(p.from); this.dateTo.set(p.to); this.activePreset.set(p.label);
  }
  clearDates(): void { this.dateFrom.set(''); this.dateTo.set(''); this.activePreset.set('All time'); }
  updateRate(k: string, val: string): void { this.avoidedRates.update(r => ({ ...r, [k]: parseInt(val) || 0 })); }

  readonly projectCentres: Record<string, { lat: number; lng: number; label: string }> = {
    'bristol-p3':    { lat: 51.454, lng: -2.596, label: 'Bristol city centre' },
    'merton':        { lat: 51.411, lng: -0.188, label: 'Wimbledon / Mitcham' },
    'leeds-p1':      { lat: 53.800, lng: -1.549, label: 'Leeds city centre' },
    'hastings-esph': { lat: 50.855, lng:  0.573, label: 'Hastings' },
  };

  projectCentre = computed(() => {
    const id = this.socialProject();
    return id !== 'all' ? (this.projectCentres[id] ?? null) : null;
  });

  supplierPins = computed(() => {
    const centre = this.projectCentre();
    if (!centre) return [];
    // SVG 500×500, centre at 250,250 — show 130mi radius; 1mi = 1.923px
    const scale = 500 / (130 * 2);
    const latPerMi = 1 / 69.2;
    const lngPerMi = 1 / (69.2 * Math.cos(centre.lat * Math.PI / 180));
    return this.filteredSuppliers()
      .filter(s => s.lat != null && s.lng != null)
      .map(s => ({
        x: 250 + (s.lng! - centre.lng) / lngPerMi * scale,
        y: 250 - (s.lat! - centre.lat) / latPerMi * scale,
        name: s.name,
        category: s.category,
        isLocal: s.isLocal,
        distance: s.distanceMiles ?? 0,
      }));
  });

  hoveredPin = signal<string | null>(null);

  getProjectLabel(projectId: string): string {
    return this.data.socialProjects.find(p => p.id === projectId)?.label.split(' — ')[0] ?? projectId;
  }

  epcColor(r: string): string {
    const m: Record<string,string> = { A:'#00a651',B:'#50b848',C:'#b2d235',D:'#fff200',E:'#f7941d',F:'#f15a24',G:'#ed1b24' };
    return m[r] || '#ccc';
  }
  epcTextColor(r: string): string { return ['C','D'].includes(r) ? '#111' : '#fff'; }
  fmtDate(d: string): string { const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; }
}
