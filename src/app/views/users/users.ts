import { Component, computed, inject, signal } from '@angular/core';
import { AuthService, InvestorDecisionKey, INVESTOR_DECISION_OPTIONS, IrisUser, UserRole } from '../../services/auth';
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

  readonly INVESTOR_DECISIONS = INVESTOR_DECISION_OPTIONS;

  roleFilter = signal('all');
  readonly roles = ['all', 'Sourcing', 'Purchasing', 'Operations', 'Finance', 'Admin Controller', 'Legal Provider', 'Client', 'Investor', 'Investment Committee'];
  readonly roleOptions: UserRole[] = ['Sourcing', 'Purchasing', 'Operations', 'Finance', 'Admin Controller', 'Legal Provider', 'Client', 'Investor', 'Investment Committee'];
  readonly simplyPhiRoles: UserRole[] = ['Sourcing', 'Purchasing', 'Operations', 'Finance', 'Admin Controller', 'Investment Committee'];

  filtered = computed(() => {
    const r = this.roleFilter();
    return r === 'all' ? this.auth.allUsers : this.auth.allUsers.filter(u => u.role === r);
  });

  // ── Invite modal ──────────────────────────────────
  showInvite          = signal(false);
  inviteEmail         = signal('');
  inviteOrg           = signal('');
  inviteCompanyRole   = signal('');
  inviteFnMode        = signal<'select' | 'custom'>('select');
  inviteFnSelect      = signal('');
  inviteFnCustom      = signal('');
  inviteProjects      = signal<string[]>([]);
  inviteError         = signal('');
  showInviteLink      = signal(false);
  generatedLink       = signal('');
  linkCopied          = signal(false);
  inviteDecisions    = signal<InvestorDecisionKey[]>([]);
  invitePortalRole   = signal<UserRole>('Sourcing');

  effectiveFn = computed(() =>
    this.inviteFnMode() === 'custom' ? this.inviteFnCustom() : this.inviteFnSelect()
  );

  effectiveRole = computed((): UserRole => {
    const cr = this.inviteCompanyRole();
    if (cr === 'Investor')    return 'Investor';
    if (cr === 'Conveyancer') return 'Legal Provider';
    if (cr === 'Purchaser' || cr === 'Recipient') return 'Client';
    return this.invitePortalRole();
  });

  toggleDecision(key: InvestorDecisionKey): void {
    this.inviteDecisions.update(list =>
      list.includes(key) ? list.filter(k => k !== key) : [...list, key]
    );
  }

  get userFunctionsForRole(): string[] {
    const role = this.inviteCompanyRole();
    return [...new Set([
      ...this.auth.allUsers.filter(u => u.companyRole === role && u.functionArea).map(u => u.functionArea!),
      ...this.invites.all.filter(i => i.companyRole === role && i.functionArea).map(i => i.functionArea!),
    ])].sort();
  }

  isSimplyPhi(name: string): boolean {
    return this.companies.getByName(name)?.companyRole === 'Project Manager';
  }

  onCompanyChange(name: string): void {
    this.inviteOrg.set(name);
    const company = this.companies.getByName(name);
    if (company) this.inviteCompanyRole.set(company.companyRole);
    this.inviteFnMode.set('select');
    this.inviteFnSelect.set('');
    this.inviteFnCustom.set('');
    this.invitePortalRole.set('Sourcing');
    this.inviteProjects.set(this.isSimplyPhi(name) ? this.projects.all.map(p => p.id) : []);
  }

  openInvite(): void {
    this.showInviteLink.set(false);
    this.generatedLink.set('');
    this.linkCopied.set(false);
    this.inviteEmail.set('');
    const first = this.companies.all[0];
    const firstName = first?.name ?? '';
    this.inviteOrg.set(firstName);
    this.inviteCompanyRole.set(first?.companyRole ?? '');
    this.inviteFnMode.set('select');
    this.inviteFnSelect.set('');
    this.inviteFnCustom.set('');
    this.inviteProjects.set(this.isSimplyPhi(firstName) ? this.projects.all.map(p => p.id) : []);
    this.inviteDecisions.set([]);
    this.invitePortalRole.set('Sourcing');
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
    const role  = this.effectiveRole();
    if (!email)                                                   { this.inviteError.set('Email address is required.'); return; }
    if (!this.inviteOrg())                                        { this.inviteError.set('Please select a company.'); return; }
    if (!this.effectiveFn() && role !== 'Investment Committee')   { this.inviteError.set('Please select or enter a function.'); return; }
    if (!this.inviteProjects().length)                            { this.inviteError.set('Please assign at least one project.'); return; }
    if (this.auth.allUsers.some(u => u.email === email)) {
      this.inviteError.set('An account with that email already exists.'); return;
    }
    if (this.invites.all.some(i => i.email === email)) {
      this.inviteError.set('An invitation has already been sent to that email.'); return;
    }
    const token = crypto.randomUUID();
    const inviteObj = {
      token, email,
      organisation: this.inviteOrg(),
      companyRole:  this.inviteCompanyRole(),
      functionArea: this.effectiveFn() || undefined,
      projects:     this.inviteProjects().length ? this.inviteProjects() : undefined,
      isAdmin: false,
      role,
      createdAt: Date.now(),
      investorDecisions: role === 'Investor' ? this.inviteDecisions() : undefined,
    };
    this.invites.add(inviteObj);
    const encoded = btoa(JSON.stringify(inviteObj));
    this.generatedLink.set(`${window.location.origin}/setup/${token}?d=${encoded}`);
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

  // ── Edit projects modal ───────────────────────────
  showProjectsModal = signal(false);
  projectsTarget    = signal<IrisUser | null>(null);
  editProjects      = signal<string[]>([]);

  openProjects(u: IrisUser): void {
    this.projectsTarget.set(u);
    this.editProjects.set([...(u.projects ?? [])]);
    this.showProjectsModal.set(true);
  }

  toggleEditProject(id: string): void {
    this.editProjects.update(list =>
      list.includes(id) ? list.filter(p => p !== id) : [...list, id]
    );
  }

  saveProjects(): void {
    const target = this.projectsTarget();
    if (!target) return;
    this.auth.updateUser(target.id, { projects: this.editProjects() });
    this.showProjectsModal.set(false);
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
    if (role === 'Sourcing')          return '#0369a1';
    if (role === 'Purchasing')        return '#0f7c6b';
    if (role === 'Operations')        return '#7c3aed';
    if (role === 'Finance')           return '#b45309';
    if (role === 'Admin Controller')  return 'var(--text2)';
    if (role === 'Legal Provider')    return '#6d28d9';
    if (role === 'Client')            return 'var(--accent)';
    if (role === 'Investor')             return '#0e7490';
    if (role === 'Investment Committee') return '#1d4ed8';
    return 'var(--text3)';
  }

  roleBg(role: string): string {
    if (role === 'Sourcing')          return 'rgba(3,105,161,0.08)';
    if (role === 'Purchasing')        return 'rgba(15,124,107,0.08)';
    if (role === 'Operations')        return 'rgba(124,58,237,0.08)';
    if (role === 'Finance')           return 'rgba(180,83,9,0.08)';
    if (role === 'Admin Controller')  return 'var(--bg)';
    if (role === 'Legal Provider')    return '#f3f0ff';
    if (role === 'Client')            return 'var(--accent-soft)';
    if (role === 'Investor')             return 'rgba(14,116,144,0.08)';
    if (role === 'Investment Committee') return 'rgba(29,78,216,0.08)';
    return 'var(--bg)';
  }
}
