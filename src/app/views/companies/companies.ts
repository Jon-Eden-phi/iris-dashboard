import { Component, computed, inject, signal } from '@angular/core';
import { CompaniesService, IrisCompany } from '../../services/companies';

@Component({
  selector: 'app-companies',
  imports: [],
  templateUrl: './companies.html',
  styleUrl: './companies.scss',
})
export class CompaniesComponent {
  companies = inject(CompaniesService);

  // ── Derived dropdown options ───────────────────────
  availableRoles     = computed(() => this.companies.all$().map(c => c.companyRole).filter(Boolean));
  availableFunctions = computed(() => {
    const role = this.effectiveRole();
    return this.companies.all$()
      .filter(c => c.companyRole === role && c.functionArea)
      .map(c => c.functionArea!);
  });

  get uniqueRoles(): string[] {
    return [...new Set(this.availableRoles())].sort();
  }
  get uniqueFunctions(): string[] {
    return [...new Set(this.availableFunctions())].sort();
  }

  // ── Add modal ──────────────────────────────────────
  showAdd         = signal(false);
  addName         = signal('');
  addAddress      = signal('');

  addRoleMode     = signal<'select' | 'custom'>('select');
  addRoleSelect   = signal('');
  addRoleCustom   = signal('');

  addFnMode       = signal<'select' | 'custom'>('select');
  addFnSelect     = signal('');
  addFnCustom     = signal('');

  addError        = signal('');

  effectiveRole = computed(() =>
    this.addRoleMode() === 'custom' ? this.addRoleCustom() : this.addRoleSelect()
  );
  effectiveFn = computed(() =>
    this.addFnMode() === 'custom' ? this.addFnCustom() : this.addFnSelect()
  );

  onRoleSelectChange(value: string): void {
    this.addRoleSelect.set(value);
    // reset function when role changes
    this.addFnMode.set('select');
    this.addFnSelect.set('');
    this.addFnCustom.set('');
  }

  switchToCustomRole(): void {
    this.addRoleMode.set('custom');
    this.addRoleCustom.set('');
    this.addFnMode.set('select');
    this.addFnSelect.set('');
    this.addFnCustom.set('');
  }

  openAdd(): void {
    this.addName.set(''); this.addAddress.set('');
    this.addRoleMode.set('select'); this.addRoleSelect.set(''); this.addRoleCustom.set('');
    this.addFnMode.set('select'); this.addFnSelect.set(''); this.addFnCustom.set('');
    this.addError.set('');
    this.showAdd.set(true);
  }

  submitAdd(): void {
    const name = this.addName().trim();
    const role = this.effectiveRole().trim();
    const fn = this.effectiveFn().trim();
    if (!name) { this.addError.set('Company name is required.'); return; }
    if (!role) { this.addError.set('Company role is required.'); return; }
    if (!fn)   { this.addError.set('Function is required.'); return; }
    if (this.companies.all.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      this.addError.set('A company with that name already exists.'); return;
    }
    this.companies.add({
      id: crypto.randomUUID(),
      name,
      address: this.addAddress().trim(),
      companyRole: role,
      functionArea: fn,
    });
    this.showAdd.set(false);
  }

  remove(c: IrisCompany): void {
    this.companies.remove(c.id);
  }
}
