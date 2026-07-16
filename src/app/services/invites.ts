import { Injectable, signal } from '@angular/core';
import { UserRole } from './auth';

export interface PendingInvite {
  token: string;
  email: string;
  organisation: string;
  companyRole: string;
  functionArea?: string;
  isAdmin: boolean;
  role: UserRole;
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class InvitesService {
  private readonly STORAGE_KEY = 'iris-invites-v1';

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
}
