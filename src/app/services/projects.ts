import { Injectable, signal } from '@angular/core';

export interface IrisProject {
  id: string;
  name: string;
  purchaser: string;
  isInvestorDeal?: boolean;
  investorCompany?: string;
}

const SEED_PROJECTS: IrisProject[] = [
  { id: 'proj-bristol-p3',    name: 'Bristol P3',    purchaser: 'Bristol City Council' },
  { id: 'proj-merton-lahf',   name: 'Merton LAHF',   purchaser: 'London Borough of Merton' },
  { id: 'proj-hastings-esph', name: 'Hastings ESPH', purchaser: 'East Sussex Pathfinder Housing' },
  { id: 'proj-leeds-p1',      name: 'Leeds P1',      purchaser: 'Leeds City Council' },
];

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly STORAGE_KEY = 'iris-projects-v1';

  private _load(): IrisProject[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const stored: IrisProject[] = raw ? JSON.parse(raw) : [];
      const merged = [...stored];
      for (const seed of SEED_PROJECTS) {
        if (!merged.find(p => p.id === seed.id)) merged.unshift(seed);
      }
      this._save(merged);
      return merged;
    } catch { /* ignore */ }
    return SEED_PROJECTS;
  }

  private _save(list: IrisProject[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
  }

  private _projects = signal<IrisProject[]>(this._load());

  get all(): IrisProject[] { return this._projects(); }
  get all$() { return this._projects; }

  add(project: IrisProject): void {
    this._projects.update(list => { const n = [...list, project]; this._save(n); return n; });
  }

  remove(id: string): void {
    this._projects.update(list => { const n = list.filter(p => p.id !== id); this._save(n); return n; });
  }

  update(id: string, changes: Partial<IrisProject>): void {
    this._projects.update(list => { const n = list.map(p => p.id === id ? { ...p, ...changes } : p); this._save(n); return n; });
  }
}
