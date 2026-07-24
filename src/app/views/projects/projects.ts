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
    this.companies.all$()
      .filter(c => c.companyRole === 'Purchaser')
      .map(c => c.name)
      .sort()
  );

  investorCompanies = computed(() =>
    this.companies.all$()
      .filter(c => c.companyRole === 'Investor')
      .map(c => c.name)
      .sort()
  );

  // ── Add modal ──────────────────────────────────────
  showAdd             = signal(false);
  addName             = signal('');
  addPurchaserMode    = signal<'select' | 'custom'>('select');
  addPurchaserSelect  = signal('');
  addPurchaserCustom  = signal('');
  addError            = signal('');
  addIsInvestorDeal   = signal(false);
  addInvestorCompany  = signal('');
  editingId           = signal<string | null>(null);
  get isEditing(): boolean { return this.editingId() !== null; }

  effectivePurchaser = computed(() =>
    this.addPurchaserMode() === 'custom'
      ? this.addPurchaserCustom()
      : this.addPurchaserSelect()
  );

  openAdd(): void {
    this.editingId.set(null);
    this.addName.set('');
    this.addPurchaserMode.set('select');
    this.addPurchaserSelect.set(this.availablePurchasers()[0] ?? '');
    this.addPurchaserCustom.set('');
    this.addIsInvestorDeal.set(false);
    this.addInvestorCompany.set(this.investorCompanies()[0] ?? '');
    this.addError.set('');
    this.showAdd.set(true);
  }

  openEdit(p: IrisProject): void {
    this.editingId.set(p.id);
    this.addName.set(p.name);
    this.addPurchaserMode.set('select');
    this.addPurchaserSelect.set(p.purchaser);
    this.addPurchaserCustom.set('');
    this.addIsInvestorDeal.set(p.isInvestorDeal ?? false);
    this.addInvestorCompany.set(p.investorCompany ?? this.investorCompanies()[0] ?? '');
    this.addError.set('');
    this.showAdd.set(true);
  }

  submitAdd(): void {
    const name      = this.addName().trim();
    const purchaser = this.effectivePurchaser().trim();
    if (!name)      { this.addError.set('Project name is required.'); return; }
    if (!purchaser) { this.addError.set('Purchaser is required.'); return; }
    const id = this.editingId();
    const isInvestorDeal = this.addIsInvestorDeal();
    const investorCompany = isInvestorDeal ? this.addInvestorCompany() : undefined;
    if (id) {
      this.projects.update(id, { name, purchaser, isInvestorDeal, investorCompany });
    } else {
      this.projects.add({ id: crypto.randomUUID(), name, purchaser, isInvestorDeal, investorCompany });
    }
    this.showAdd.set(false);
  }

  remove(p: IrisProject): void {
    this.projects.remove(p.id);
  }
}
