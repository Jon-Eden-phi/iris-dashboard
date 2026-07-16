import { Injectable, signal } from '@angular/core';

export interface IrisProject {
  id: string;
  name: string;
  purchaser: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly STORAGE_KEY = 'iris-projects-v1';

  private _load(): IrisProject[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
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
