import { Component, computed, inject, signal } from '@angular/core';
import { ProjectsService, IrisProject } from '../../services/projects';
import { CompaniesService } from '../../services/companies';

@Component({
  selector: 'app-projects',
  imports: [],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class ProjectsComponent {
  projects  = inject(ProjectsService);
  companies = inject(CompaniesService);

  availablePurchasers = computed(() =>
    this.companies.all$().map(c => c.name).sort()
  );

  // ── Add modal ──────────────────────────────────────
  showAdd             = signal(false);
  addName             = signal('');
  addPurchaserMode    = signal<'select' | 'custom'>('select');
  addPurchaserSelect  = signal('');
  addPurchaserCustom  = signal('');
  addError            = signal('');

  effectivePurchaser = computed(() =>
    this.addPurchaserMode() === 'custom'
      ? this.addPurchaserCustom()
      : this.addPurchaserSelect()
  );

  openAdd(): void {
    this.addName.set('');
    this.addPurchaserMode.set('select');
    this.addPurchaserSelect.set(this.availablePurchasers()[0] ?? '');
    this.addPurchaserCustom.set('');
    this.addError.set('');
    this.showAdd.set(true);
  }

  submitAdd(): void {
    const name      = this.addName().trim();
    const purchaser = this.effectivePurchaser().trim();
    if (!name)      { this.addError.set('Project name is required.'); return; }
    if (!purchaser) { this.addError.set('Purchaser is required.'); return; }
    this.projects.add({ id: crypto.randomUUID(), name, purchaser });
    this.showAdd.set(false);
  }

  remove(p: IrisProject): void {
    this.projects.remove(p.id);
  }
}
