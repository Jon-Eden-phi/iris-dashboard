import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InvitesService, PendingInvite } from '../../services/invites';
import { AuthService } from '../../services/auth';
import { CompaniesService } from '../../services/companies';

@Component({
  selector: 'app-setup',
  imports: [],
  templateUrl: './setup.html',
  styleUrl: './setup.scss',
})
export class SetupComponent implements OnInit {
  private route    = inject(ActivatedRoute);
  private router   = inject(Router);
  invites   = inject(InvitesService);
  auth      = inject(AuthService);
  companies = inject(CompaniesService);

  invite  = signal<PendingInvite | null>(null);
  invalid = signal(false);
  done    = signal(false);

  firstName   = signal('');
  lastName    = signal('');
  phone       = signal('');
  password    = signal('');
  confirmPass = signal('');
  notifPrefs  = signal<'email' | 'inapp' | 'both'>('both');
  error       = signal('');

  get companyLogo(): string | undefined {
    const org = this.invite()?.organisation;
    return org ? this.companies.getByName(org)?.logo : undefined;
  }

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';

    // Try localStorage first (same-browser flow)
    const stored = this.invites.getByToken(token);
    if (stored) { this.invite.set(stored); return; }

    // Fall back to URL-encoded invite data (cross-browser / different device)
    const data = this.route.snapshot.queryParamMap.get('d');
    if (data) {
      try {
        const decoded: PendingInvite = JSON.parse(atob(data));
        if (this.invites.isUsed(decoded.token)) { this.invalid.set(true); return; }
        this.invite.set(decoded);
        return;
      } catch { /* malformed — fall through */ }
    }

    this.invalid.set(true);
  }

  submit(): void {
    const firstName = this.firstName().trim();
    const lastName  = this.lastName().trim();
    const pass      = this.password().trim();
    const inv       = this.invite();
    if (!inv) return;
    if (!firstName || !lastName) { this.error.set('First and last name are required.'); return; }
    if (pass.length < 4)         { this.error.set('Password must be at least 4 characters.'); return; }
    if (pass !== this.confirmPass().trim()) { this.error.set('Passwords do not match.'); return; }

    this.auth.addUser({
      id: crypto.randomUUID(),
      name: `${firstName} ${lastName}`,
      firstName, lastName,
      email: inv.email,
      mobile: this.phone().trim() || undefined,
      organisation: inv.organisation,
      companyRole: inv.companyRole,
      functionArea: inv.functionArea,
      projects: inv.projects,
      role: inv.role,
      isAdmin: inv.isAdmin,
      password: pass,
      notificationPrefs: this.notifPrefs(),
      investorDecisions: inv.investorDecisions as any,
    });
    this.invites.markUsed(inv.token);
    this.invites.remove(inv.token);
    this.done.set(true);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
