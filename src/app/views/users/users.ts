import { Component, computed, inject, signal } from '@angular/core';
import { AuthService, IrisUser, UserRole } from '../../services/auth';
import { CompaniesService } from '../../services/companies';
import { InvitesService } from '../../services/invites';
import { ProjectsService } from '../../services/projects';

@Component({
  selector: 'app-users',
  imports: [],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class UsersComponent {
  auth      = inject(AuthService);
  companies = inject(CompaniesService);
  invites   = inject(InvitesService);
  projects  = inject(ProjectsService);

  roleFilter = signal('all');
  readonly roles = ['all', 'Internal', 'Transactions', 'Legal Provider', 'Client'];
  readonly roleOptions: UserRole[] = ['Internal', 'Transactions', 'Legal Provider', 'Client'];

  filtered = computed(() => {
    const r = this.roleFilter();
    return r === 'all' ? this.auth.allUsers : this.auth.allUsers.filter(u => u.role === r);
  });

  // ── Invite modal ──────────────────────────────────
  showInvite        = signal(false);
  inviteEmail       = signal('');
  inviteOrg         = signal('');
  inviteCompanyRole = signal('');
  inviteFnMode      = signal<'select' | 'custom'>('select');
  inviteFnSelect    = signal('');
  inviteFnCustom    = signal('');
  inviteAdmin       = signal(false);
  inviteProjects    = signal<string[]>([]);
  inviteError       = signal('');
  showInviteLink    = signal(false);
  generatedLink     = signal('');
  linkCopied        = signal(false);

  effectiveFn = computed(() =>
    this.inviteFnMode() === 'custom' ? this.inviteFnCustom() : this.inviteFnSelect()
  );

  get userFunctionsForRole(): string[] {
    const role = this.inviteCompanyRole();
    return [...new Set([
      ...this.auth.allUsers.filter(u => u.companyRole === role && u.functionArea).map(u => u.functionArea!),
      ...this.invites.all.filter(i => i.companyRole === role && i.functionArea).map(i => i.functionArea!),
    ])].sort();
  }

  onCompanyChange(name: string): void {
    this.inviteOrg.set(name);
    const company = this.companies.getByName(name);
    if (company) this.inviteCompanyRole.set(company.companyRole);
    this.inviteFnMode.set('select');
    this.inviteFnSelect.set('');
    this.inviteFnCustom.set('');
  }

  openInvite(): void {
    this.showInviteLink.set(false);
    this.generatedLink.set('');
    this.linkCopied.set(false);
    this.inviteEmail.set('');
    const first = this.companies.all[0];
    this.inviteOrg.set(first?.name ?? '');
    this.inviteCompanyRole.set(first?.companyRole ?? '');
    this.inviteFnMode.set('select');
    this.inviteFnSelect.set('');
    this.inviteFnCustom.set('');
    this.inviteAdmin.set(false);
    this.inviteProjects.set([]);
    this.inviteError.set('');
    this.showInvite.set(true);
  }

  toggleProject(id: string): void {
    this.inviteProjects.update(list =>
      list.includes(id) ? list.filter(p => p !== id) : [...list, id]
    );
  }

  submitInvite(): void {
    const email = this.inviteEmail().trim().toLowerCase();
    if (!email)            { this.inviteError.set('Email address is required.'); return; }
    if (!this.inviteOrg()) { this.inviteError.set('Please select a company.'); return; }
    if (this.auth.allUsers.some(u => u.email === email)) {
      this.inviteError.set('An account with that email already exists.'); return;
    }
    if (this.invites.all.some(i => i.email === email)) {
      this.inviteError.set('An invitation has already been sent to that email.'); return;
    }
    const token       = crypto.randomUUID();
    const companyRole = this.inviteCompanyRole();
    const role: UserRole = companyRole === 'Conveyancer' ? 'Legal Provider'
      : (companyRole === 'Purchaser' || companyRole === 'Recipient') ? 'Client'
      : 'Internal';
    this.invites.add({
      token, email,
      organisation: this.inviteOrg(),
      companyRole,
      functionArea: this.effectiveFn() || undefined,
      projects: this.inviteProjects().length ? this.inviteProjects() : undefined,
      isAdmin: this.inviteAdmin(),
      role,
      createdAt: Date.now(),
    });
    this.generatedLink.set(`${window.location.origin}/setup/${token}`);
    this.showInviteLink.set(true);
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.generatedLink()).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  revokeInvite(token: string): void {
    this.invites.remove(token);
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Reset password modal ──────────────────────────
  showReset   = signal(false);
  resetTarget = signal<IrisUser | null>(null);
  resetPass   = signal('');
  resetError  = signal('');

  openReset(u: IrisUser): void {
    this.resetTarget.set(u); this.resetPass.set(''); this.resetError.set(''); this.showReset.set(true);
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
  removeUser(u: IrisUser): void { this.auth.removeUser(u.id); }
  isMe(u: IrisUser): boolean    { return u.id === this.auth.currentUser()?.id; }

  roleColor(role: string): string {
    if (role === 'Internal')       return 'var(--text2)';
    if (role === 'Transactions')   return '#0f7c6b';
    if (role === 'Legal Provider') return '#6d28d9';
    if (role === 'Client')         return 'var(--accent)';
    return 'var(--text3)';
  }

  roleBg(role: string): string {
    if (role === 'Internal')       return 'var(--bg)';
    if (role === 'Transactions')   return 'rgba(15,124,107,0.08)';
    if (role === 'Legal Provider') return '#f3f0ff';
    if (role === 'Client')         return 'var(--accent-soft)';
    return 'var(--bg)';
  }
}
