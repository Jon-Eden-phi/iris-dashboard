import { Injectable, signal } from '@angular/core';
import { UserRole } from './auth';

export interface PendingInvite {
  token: string;
  email: string;
  organisation: string;
  companyRole: string;
  functionArea?: string;
  projects?: string[];
  isAdmin: boolean;
  role: UserRole;
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class InvitesService {
  private readonly STORAGE_KEY      = 'iris-invites-v1';
  private readonly USED_STORAGE_KEY = 'iris-used-tokens-v1';

  private _load(): PendingInvite[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  }

  private _save(list: PendingInvite[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
  }

  private _invites = signal<PendingInvite[]>(this._load());

  get all(): PendingInvite[] { return this._invites(); }
  get all$() { return this._invites; }

  getByToken(token: string): PendingInvite | undefined {
    return this._invites().find(i => i.token === token);
  }

  add(invite: PendingInvite): void {
    this._invites.update(list => { const n = [...list, invite]; this._save(n); return n; });
  }

  remove(token: string): void {
    this._invites.update(list => { const n = list.filter(i => i.token !== token); this._save(n); return n; });
  }

  isUsed(token: string): boolean {
    try {
      const raw = localStorage.getItem(this.USED_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]).includes(token) : false;
    } catch { return false; }
  }

  markUsed(token: string): void {
    try {
      const raw  = localStorage.getItem(this.USED_STORAGE_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!list.includes(token)) {
        list.push(token);
        localStorage.setItem(this.USED_STORAGE_KEY, JSON.stringify(list));
      }
    } catch { /* ignore */ }
  }
}
