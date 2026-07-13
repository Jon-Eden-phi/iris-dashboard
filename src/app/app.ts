import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './services/auth';
import { ToastService } from './services/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  auth = inject(AuthService);
  toast = inject(ToastService);
  router = inject(Router);
  sidebarOpen = signal(false);
  pageTitle = signal('Pipeline');

  private titleMap: Record<string, string> = {
    '/pipeline': 'Pipeline',
    '/map': 'Map',
    '/lost': 'Lost Properties',
    '/insights': 'Insights',
    '/social-impact': 'Social Impact',
    '/agents': 'Agents',
    '/users': 'Users',
    '/record': 'Property Detail',
    '/login': 'Sign In',
  };

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const url = e.urlAfterRedirects;
        for (const [path, title] of Object.entries(this.titleMap)) {
          if (url.startsWith(path)) { this.pageTitle.set(title); return; }
        }
      });
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
