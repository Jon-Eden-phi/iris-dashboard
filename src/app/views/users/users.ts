import { Component, computed, inject, signal } from '@angular/core';
import { AuthService, IrisUser, UserRole } from '../../services/auth';
import { CompaniesService } from '../../services/companies';

@Component({
  selector: 'app-users',
  imports: [],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class UsersComponent {
  auth      = inject(AuthService);
  companies = inject(CompaniesService);

  roleFilter = signal('all');
  readonly roles = ['all', 'Internal', 'Transactions', 'Legal Provider', 'Client'];
  readonly roleOptions: UserRole[] = ['Internal', 'Transactions', 'Legal Provider', 'Client'];

  filtered = computed(() => {
    const r = this.roleFilter();
    return r === 'all' ? this.auth.allUsers : this.auth.allUsers.filter(u => u.role === r);
  });

  readonly companyRoleOptions = ['Project Manager', 'Conveyancer', 'Purchaser', 'Recipient', 'Surveyor'];
  readonly functionOptions    = ['Sourcing', 'Buying', 'Refurb', 'Admin', 'Finance'];

  // ── Invite modal ──────────────────────────────────
  showInvite          = signal(false);
  inviteFirstName     = signal('');
  inviteLastName      = signal('');
  inviteEmail         = signal('');
  inviteMobile        = signal('');
  inviteOrg           = signal('SimplyPhi');
  inviteCompanyRole   = signal('Project Manager');
  inviteFunctionArea  = signal('Sourcing');
  inviteRole          = signal<UserRole>('Internal');
  invitePass          = signal('');
  inviteAdmin         = signal(false);
  inviteError         = signal('');

  get inviteIsSimplyPhi(): boolean { return this.inviteOrg() === 'SimplyPhi'; }

  onCompanyChange(name: string): void {
    this.inviteOrg.set(name);
    const company = this.companies.getByName(name);
    if (company) {
      this.inviteCompanyRole.set(company.companyRole);
      if (company.functionArea) this.inviteFunctionArea.set(company.functionArea);
    }
  }

  openInvite(): void {
    this.inviteFirstName.set(''); this.inviteLastName.set('');
    this.inviteEmail.set(''); this.inviteMobile.set('');
    const firstCompany = this.companies.all[0];
    this.inviteOrg.set(firstCompany?.name ?? '');
    this.inviteCompanyRole.set(firstCompany?.companyRole ?? 'Project Manager');
    this.inviteFunctionArea.set(firstCompany?.functionArea ?? 'Sourcing');
    this.inviteRole.set('Internal');
    this.invitePass.set(''); this.inviteAdmin.set(false); this.inviteError.set('');
    this.showInvite.set(true);
  }

  submitInvite(): void {
    const firstName = this.inviteFirstName().trim();
    const lastName  = this.inviteLastName().trim();
    const email     = this.inviteEmail().trim().toLowerCase();
    const pass      = this.invitePass().trim();
    if (!firstName || !lastName || !email || !pass) { this.inviteError.set('First name, last name, email and password are required.'); return; }
    if (this.auth.allUsers.some(u => u.email === email)) { this.inviteError.set('An account with that email already exists.'); return; }
    const mobile       = this.inviteMobile().trim() || undefined;
    const organisation = this.inviteOrg();
    const companyRole  = this.inviteCompanyRole();
    const functionArea = this.inviteIsSimplyPhi ? this.inviteFunctionArea() : undefined;
    const role: UserRole = this.inviteIsSimplyPhi ? 'Internal' : this.inviteRole();
    this.auth.addUser({ id: crypto.randomUUID(), name: `${firstName} ${lastName}`, firstName, lastName, mobile, organisation, companyRole, functionArea, email, role, isAdmin: this.inviteAdmin(), password: pass });
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
