import { Component, computed, inject, signal } from '@angular/core';
import { AuthService, IrisUser, UserRole } from '../../services/auth';

@Component({
  selector: 'app-users',
  imports: [],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class UsersComponent {
  auth = inject(AuthService);

  roleFilter = signal('all');
  readonly roles = ['all', 'Internal', 'Legal Provider', 'Client'];
  readonly roleOptions: UserRole[] = ['Internal', 'Legal Provider', 'Client'];

  filtered = computed(() => {
    const r = this.roleFilter();
    return r === 'all' ? this.auth.allUsers : this.auth.allUsers.filter(u => u.role === r);
  });

  // ── Invite modal ──────────────────────────────────
  showInvite   = signal(false);
  inviteName   = signal('');
  inviteEmail  = signal('');
  inviteRole   = signal<UserRole>('Internal');
  invitePass   = signal('');
  inviteAdmin  = signal(false);
  inviteError  = signal('');

  openInvite(): void {
    this.inviteName.set(''); this.inviteEmail.set('');
    this.inviteRole.set('Internal'); this.invitePass.set('');
    this.inviteAdmin.set(false); this.inviteError.set('');
    this.showInvite.set(true);
  }

  submitInvite(): void {
    const name  = this.inviteName().trim();
    const email = this.inviteEmail().trim().toLowerCase();
    const pass  = this.invitePass().trim();
    if (!name || !email || !pass) { this.inviteError.set('All fields are required.'); return; }
    if (this.auth.allUsers.some(u => u.email === email)) { this.inviteError.set('An account with that email already exists.'); return; }
    this.auth.addUser({ id: crypto.randomUUID(), name, email, role: this.inviteRole(), isAdmin: this.inviteAdmin(), password: pass });
    this.showInvite.set(false);
  }

  // ── Reset password modal ──────────────────────────
  showReset   = signal(false);
  resetTarget = signal<IrisUser | null>(null);
  resetPass   = signal('');
  resetError  = signal('');

  openReset(u: IrisUser): void {
    this.resetTarget.set(u);
    this.resetPass.set('');
    this.resetError.set('');
    this.showReset.set(true);
  }

  submitReset(): void {
    const pass = this.resetPass().trim();
    if (pass.length < 4) { this.resetError.set('Password must be at least 4 characters.'); return; }
    const target = this.resetTarget();
    if (!target) return;
    this.auth.updateUser(target.id, { password: pass });
    this.showReset.set(false);
  }

  // ── Delete ────────────────────────────────────────
  removeUser(u: IrisUser): void {
    this.auth.removeUser(u.id);
  }

  isMe(u: IrisUser): boolean {
    return u.id === this.auth.currentUser()?.id;
  }

  roleColor(role: string): string {
    if (role === 'Internal')       return 'var(--text2)';
    if (role === 'Legal Provider') return '#6d28d9';
    if (role === 'Client')         return 'var(--accent)';
    return 'var(--text3)';
  }

  roleBg(role: string): string {
    if (role === 'Internal')       return 'var(--bg)';
    if (role === 'Legal Provider') return '#f3f0ff';
    if (role === 'Client')         return 'var(--accent-soft)';
    return 'var(--bg)';
  }
}
