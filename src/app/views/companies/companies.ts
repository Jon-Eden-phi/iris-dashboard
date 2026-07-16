import { Component, inject, signal } from '@angular/core';
import { CompaniesService, IrisCompany } from '../../services/companies';

@Component({
  selector: 'app-companies',
  imports: [],
  templateUrl: './companies.html',
  styleUrl: './companies.scss',
})
export class CompaniesComponent {
  companies = inject(CompaniesService);

  readonly companyRoleOptions = ['Project Manager', 'Conveyancer', 'Purchaser', 'Recipient', 'Surveyor'];
  readonly functionOptions    = ['Sourcing', 'Buying', 'Refurb', 'Admin', 'Finance'];

  // ── Add modal ──────────────────────────────────────
  showAdd       = signal(false);
  addName        = signal('');
  addAddress     = signal('');
  addCompanyRole = signal('Project Manager');
  addFunction    = signal('');
  addError       = signal('');

  openAdd(): void {
    this.addName.set(''); this.addAddress.set('');
    this.addCompanyRole.set('Project Manager'); this.addFunction.set('');
    this.addError.set('');
    this.showAdd.set(true);
  }

  submitAdd(): void {
    const name = this.addName().trim();
    const address = this.addAddress().trim();
    if (!name) { this.addError.set('Company name is required.'); return; }
    if (this.companies.all.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      this.addError.set('A company with that name already exists.'); return;
    }
    this.companies.add({
      id: crypto.randomUUID(),
      name,
      address,
      companyRole: this.addCompanyRole(),
      functionArea: this.addFunction() || undefined,
    });
    this.showAdd.set(false);
  }

  remove(c: IrisCompany): void {
    this.companies.remove(c.id);
  }
}
