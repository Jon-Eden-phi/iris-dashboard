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
    return [...new Set([...this.availableRoles(), 'Investor', 'Conveyancer', 'Purchaser'])].sort();
  }
  get uniqueFunctions(): string[] {
    return [...new Set(this.availableFunctions())].sort();
  }

  // ── Add modal ──────────────────────────────────────
  showAdd         = signal(false);
  addName         = signal('');
  addAddress      = signal('');
  addLogo         = signal('');
  addLogoDragging = signal(false);

  addRoleMode     = signal<'select' | 'custom'>('select');
  addRoleSelect   = signal('');
  addRoleCustom   = signal('');

  addFnMode       = signal<'select' | 'custom'>('select');
  addFnSelect     = signal('');
  addFnCustom     = signal('');

  addError        = signal('');
  editingId       = signal<string | null>(null);
  get isEditing(): boolean { return this.editingId() !== null; }

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

  onLogoDrop(event: DragEvent): void {
    event.preventDefault();
    this.addLogoDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) { this._readLogoFile(file); return; }
    const url = event.dataTransfer?.getData('text/uri-list')?.split('\n')[0]?.trim();
    if (url && url.startsWith('http')) this.addLogo.set(url);
  }

  onLogoPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { this._readLogoFile(file); break; }
      }
    }
  }

  private _readLogoFile(file: File): void {
    const reader = new FileReader();
    reader.onload = e => this.addLogo.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  openAdd(): void {
    this.editingId.set(null);
    this.addName.set(''); this.addAddress.set(''); this.addLogo.set('');
    this.addRoleMode.set('select'); this.addRoleSelect.set(''); this.addRoleCustom.set('');
    this.addFnMode.set('select'); this.addFnSelect.set(''); this.addFnCustom.set('');
    this.addError.set('');
    this.showAdd.set(true);
  }

  openEdit(c: IrisCompany): void {
    this.editingId.set(c.id);
    this.addName.set(c.name);
    this.addAddress.set(c.address || '');
    this.addLogo.set(c.logo || '');
    this.addRoleMode.set('select'); this.addRoleSelect.set(c.companyRole); this.addRoleCustom.set('');
    this.addFnMode.set('select'); this.addFnSelect.set(c.functionArea || ''); this.addFnCustom.set('');
    this.addError.set('');
    this.showAdd.set(true);
  }

  submitAdd(): void {
    const name = this.addName().trim();
    const role = this.effectiveRole().trim();
    const fn   = this.effectiveFn().trim();
    if (!name) { this.addError.set('Company name is required.'); return; }
    if (!role) { this.addError.set('Company role is required.'); return; }
    if (!fn && role !== 'Investor') { this.addError.set('Function is required.'); return; }
    const id = this.editingId();
    if (this.companies.all.some(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== id)) {
      this.addError.set('A company with that name already exists.'); return;
    }
    if (id) {
      this.companies.update(id, { name, address: this.addAddress().trim(), companyRole: role, functionArea: fn, logo: this.addLogo() || undefined });
    } else {
      this.companies.add({ id: crypto.randomUUID(), name, address: this.addAddress().trim(), companyRole: role, functionArea: fn, logo: this.addLogo() || undefined });
    }
    this.showAdd.set(false);
  }

  remove(c: IrisCompany): void {
    this.companies.remove(c.id);
  }
}
