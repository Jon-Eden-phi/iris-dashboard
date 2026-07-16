import { Component, inject, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './services/auth';
import { ToastService } from './services/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UpperCasePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  auth = inject(AuthService);
  toast = inject(ToastService);
  router = inject(Router);
  sidebarOpen  = signal(false);
  pageTitle    = signal('Pipeline');
  currentUrl   = signal('');

  private titleMap: Record<string, string> = {
    '/pipeline': 'Pipeline',
    '/map': 'Map',
    '/lost': 'Lost Properties',
    '/insights': 'Insights',
    '/social-impact': 'Social Impact',
    '/agents': 'Agents',
    '/users': 'Users',
    '/companies': 'Companies',
    '/projects': 'Projects',
    '/record': 'Property Detail',
    '/login': 'Sign In',
  };

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const url = e.urlAfterRedirects;
        this.currentUrl.set(url);
        for (const [path, title] of Object.entries(this.titleMap)) {
          if (url.startsWith(path)) { this.pageTitle.set(title); return; }
        }
      });
  }

  // ── Account modal ─────────────────────────────────
  showAccountModal = signal(false);
  acctCurrentPass  = signal('');
  acctNewPass      = signal('');
  acctConfirmPass  = signal('');
  acctPassError    = signal('');
  acctPassSuccess  = signal(false);

  openAccountModal(): void {
    this.acctCurrentPass.set(''); this.acctNewPass.set(''); this.acctConfirmPass.set('');
    this.acctPassError.set(''); this.acctPassSuccess.set(false);
    this.showAccountModal.set(true);
  }

  savePassword(): void {
    const current = this.acctCurrentPass().trim();
    const next    = this.acctNewPass().trim();
    const confirm = this.acctConfirmPass().trim();
    const user    = this.auth.currentUser();
    if (!user) return;
    if (current !== user.password) { this.acctPassError.set('Current password is incorrect.'); return; }
    if (next.length < 4) { this.acctPassError.set('New password must be at least 4 characters.'); return; }
    if (next !== confirm) { this.acctPassError.set('Passwords do not match.'); return; }
    this.auth.updateUser(user.id, { password: next });
    this.acctPassError.set('');
    this.acctCurrentPass.set(''); this.acctNewPass.set(''); this.acctConfirmPass.set('');
    this.acctPassSuccess.set(true);
  }

  saveNotifPref(pref: 'email' | 'inapp' | 'both'): void {
    const user = this.auth.currentUser();
    if (user) this.auth.updateUser(user.id, { notificationPrefs: pref });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
