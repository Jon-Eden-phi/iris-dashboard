import { Injectable, signal } from '@angular/core';

export type UserRole = 'Internal' | 'Legal Provider' | 'Client' | 'Transactions';

export interface IrisUser {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  organisation?: string;
  notificationPrefs?: 'email' | 'inapp' | 'both';
  role: UserRole;
  isAdmin: boolean;
  password: string;
}

const INITIAL_USERS: IrisUser[] = [
  { id: 'u1',  email: 'aryan@simplyphi.co.uk',     name: 'Aryan',         role: 'Internal',       isAdmin: true,  password: 'simplyphi24' },
  { id: 'u2',  email: 'athesan@simplyphi.co.uk',   name: 'Athesan Guna',  role: 'Internal',       isAdmin: false, password: 'AG@12345'    },
  { id: 'u3',  email: 'carol@simplyphi.co.uk',     name: 'Carol Quinton', role: 'Internal',       isAdmin: false, password: 'simplyphi24' },
  { id: 'u4',  email: 'demo@simplyphi.co.uk',      name: 'Demo User',     role: 'Internal',       isAdmin: false, password: 'demo1234'    },
  { id: 'u5',  email: 'hayley@winksherwood.co.uk', name: 'Hayley Briggs', role: 'Legal Provider', isAdmin: false, password: 'legal24'     },
  { id: 'u6',  email: 'holly@simplyphi.co.uk',     name: 'Holly Clarke',  role: 'Internal',       isAdmin: false, password: 'simplyphi24' },
  { id: 'u7',  email: 'priya@simplyphi.co.uk',     name: 'Priya Shah',    role: 'Internal',       isAdmin: false, password: 'simplyphi24' },
  { id: 'u8',  email: 's.jones@bristol.gov.uk',    name: 'Sarah Jones',   role: 'Client',         isAdmin: false, password: 'bristol24'   },
  { id: 'u9',  email: 'sukritibisht4@gmail.com',   name: 'Sukriti Bisht', role: 'Internal',       isAdmin: false, password: 'simplyphi24' },
  { id: 'u10', email: 'jiya@simplyphi.co.uk',      name: 'Jiya Chowdhury', role: 'Transactions',   isAdmin: false, password: 'tx24'        },
  { id: 'u11', email: 'marcus@simplyphi.co.uk',    name: 'Marcus Webb',    role: 'Transactions',   isAdmin: false, password: 'tx24'        },
];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly STORAGE_KEY = 'iris-users-v1';

  private _loadUsers(): IrisUser[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const stored: IrisUser[] = raw ? JSON.parse(raw) : [];
      // Upsert INITIAL_USERS so code-side changes (new accounts, password resets) always apply
      const merged = [...stored];
      for (const seed of INITIAL_USERS) {
        const idx = merged.findIndex(u => u.id === seed.id);
        if (idx >= 0) merged[idx] = { ...merged[idx], ...seed };
        else merged.push(seed);
      }
      this._saveUsers(merged);
      return merged;
    } catch { /* ignore */ }
    return INITIAL_USERS;
  }

  private _saveUsers(list: IrisUser[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
  }

  private _users = signal<IrisUser[]>(this._loadUsers());
  currentUser = signal<IrisUser | null>(null);

  get allUsers(): IrisUser[] { return this._users(); }

  login(email: string, password: string): boolean {
    const user = this._users().find(u => u.email === email.toLowerCase() && u.password === password);
    if (user) { this.currentUser.set(user); return true; }
    return false;
  }

  addUser(user: IrisUser): void {
    this._users.update(list => { const n = [...list, user]; this._saveUsers(n); return n; });
  }

  updateUser(id: string, changes: Partial<IrisUser>): void {
    this._users.update(list => { const n = list.map(u => u.id === id ? { ...u, ...changes } : u); this._saveUsers(n); return n; });
    if (this.currentUser()?.id === id) {
      this.currentUser.update(u => u ? { ...u, ...changes } : u);
    }
  }

  removeUser(id: string): void {
    this._users.update(list => { const n = list.filter(u => u.id !== id); this._saveUsers(n); return n; });
  }

  isLoggedIn(): boolean { return this.currentUser() !== null; }
  logout(): void { this.currentUser.set(null); }
}
