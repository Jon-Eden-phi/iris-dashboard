import { Injectable, signal } from '@angular/core';

export interface IrisCompany {
  id: string;
  name: string;
  address: string;
  companyRole: string;
  functionArea?: string;
  logo?: string;
}

const DEFAULT_COMPANIES: IrisCompany[] = [
  { id: 'c1', name: 'SimplyPhi',            address: '', companyRole: 'Project Manager', functionArea: 'Sourcing' },
  { id: 'c2', name: 'Winkworth Sherwood',   address: '', companyRole: 'Conveyancer' },
  { id: 'c3', name: 'Bristol City Council', address: '', companyRole: 'Purchaser' },
];

@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private readonly STORAGE_KEY = 'iris-companies-v1';

  private _load(): IrisCompany[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    this._save(DEFAULT_COMPANIES);
    return DEFAULT_COMPANIES;
  }

  private _save(list: IrisCompany[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
  }

  private _companies = signal<IrisCompany[]>(this._load());

  get all(): IrisCompany[] { return this._companies(); }
  get all$() { return this._companies; }

  getByName(name: string): IrisCompany | undefined {
    return this._companies().find(c => c.name === name);
  }

  allRoles(): string[] {
    return [...new Set(this._companies().map(c => c.companyRole).filter(Boolean))].sort();
  }

  functionsForRole(role: string): string[] {
    return [...new Set(
      this._companies()
        .filter(c => c.companyRole === role && c.functionArea)
        .map(c => c.functionArea!)
    )].sort();
  }

  add(company: IrisCompany): void {
    this._companies.update(list => { const n = [...list, company]; this._save(n); return n; });
  }

  remove(id: string): void {
    this._companies.update(list => { const n = list.filter(c => c.id !== id); this._save(n); return n; });
  }

  update(id: string, changes: Partial<IrisCompany>): void {
    this._companies.update(list => { const n = list.map(c => c.id === id ? { ...c, ...changes } : c); this._save(n); return n; });
  }
}
