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

// Redirects external-role users back to their own portal if they try to access internal routes
const internalGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.currentUser()?.role;
  if (role === 'Legal Provider') return router.createUrlTree(['/legal-portal']);
  if (role === 'Client')         return router.createUrlTree(['/client-portal']);
  return true;
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
      { path: 'pipeline',      canActivate: [internalGuard], loadComponent: () => import('./views/pipeline/pipeline').then(m => m.PipelineComponent) },
      { path: 'map',           canActivate: [internalGuard], loadComponent: () => import('./views/map/map').then(m => m.MapComponent) },
      { path: 'lost',          canActivate: [internalGuard], loadComponent: () => import('./views/lost/lost').then(m => m.LostComponent) },
      { path: 'insights',      canActivate: [internalGuard], loadComponent: () => import('./views/insights/insights').then(m => m.InsightsComponent) },
      { path: 'social-impact', canActivate: [internalGuard], loadComponent: () => import('./views/social-impact/social-impact').then(m => m.SocialImpactComponent) },
      { path: 'agents',        canActivate: [internalGuard], loadComponent: () => import('./views/agents/agents').then(m => m.AgentsComponent) },
      { path: 'users',         canActivate: [internalGuard], loadComponent: () => import('./views/users/users').then(m => m.UsersComponent) },
      { path: 'companies',     canActivate: [internalGuard], loadComponent: () => import('./views/companies/companies').then(m => m.CompaniesComponent) },
      { path: 'projects',      canActivate: [internalGuard], loadComponent: () => import('./views/projects/projects').then(m => m.ProjectsComponent) },
      { path: 'record/:id',    canActivate: [internalGuard], loadComponent: () => import('./views/record/record').then(m => m.RecordComponent) },
    ]
  },
  { path: '**', redirectTo: 'pipeline' }
];
