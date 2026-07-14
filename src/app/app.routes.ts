import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './services/auth';
import { Router } from '@angular/router';

const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/login']);
};

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./views/login/login').then(m => m.LoginComponent) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'pipeline', pathMatch: 'full' },
      { path: 'client-portal',       loadComponent: () => import('./views/client-portal/client-portal').then(m => m.ClientPortalComponent) },
      { path: 'transactions-portal', loadComponent: () => import('./views/transactions-portal/transactions-portal').then(m => m.TransactionsPortalComponent) },
      { path: 'legal-portal',        loadComponent: () => import('./views/legal-portal/legal-portal').then(m => m.LegalPortalComponent) },
      { path: 'pipeline',      loadComponent: () => import('./views/pipeline/pipeline').then(m => m.PipelineComponent) },
      { path: 'map',           loadComponent: () => import('./views/map/map').then(m => m.MapComponent) },
      { path: 'lost',          loadComponent: () => import('./views/lost/lost').then(m => m.LostComponent) },
      { path: 'insights',      loadComponent: () => import('./views/insights/insights').then(m => m.InsightsComponent) },
      { path: 'social-impact', loadComponent: () => import('./views/social-impact/social-impact').then(m => m.SocialImpactComponent) },
      { path: 'agents',        loadComponent: () => import('./views/agents/agents').then(m => m.AgentsComponent) },
      { path: 'users',         loadComponent: () => import('./views/users/users').then(m => m.UsersComponent) },
      { path: 'record/:id',    loadComponent: () => import('./views/record/record').then(m => m.RecordComponent) },
    ]
  },
  { path: '**', redirectTo: 'pipeline' }
];
