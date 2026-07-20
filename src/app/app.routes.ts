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

// Blocks Purchasing-role users from sourcing routes → sends them to Purchasing portal
const sourcingGuard = () => {
  const role = inject(AuthService).currentUser()?.role;
  if (role === 'Purchasing') return inject(Router).createUrlTree(['/transactions-portal']);
  return true;
};

// Blocks Sourcing-role users from the Purchasing portal → sends them to Pipeline
const purchasingGuard = () => {
  const role = inject(AuthService).currentUser()?.role;
  if (role === 'Sourcing') return inject(Router).createUrlTree(['/pipeline']);
  return true;
};

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./views/login/login').then(m => m.LoginComponent) },
  { path: 'setup/:token', loadComponent: () => import('./views/setup/setup').then(m => m.SetupComponent) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', canActivate: [() => {
          const role = inject(AuthService).currentUser()?.role;
          return inject(Router).createUrlTree(role === 'Purchasing' ? ['/transactions-portal'] : ['/dashboard']);
        }], children: [] },
      { path: 'client-portal',       loadComponent: () => import('./views/client-portal/client-portal').then(m => m.ClientPortalComponent) },
      { path: 'transactions-portal', canActivate: [purchasingGuard], loadComponent: () => import('./views/transactions-portal/transactions-portal').then(m => m.TransactionsPortalComponent) },
      { path: 'legal-portal',        loadComponent: () => import('./views/legal-portal/legal-portal').then(m => m.LegalPortalComponent) },
      { path: 'dashboard', canActivate: [internalGuard, sourcingGuard], loadComponent: () => import('./views/pipeline/pipeline').then(m => m.PipelineComponent), data: { mode: 'dashboard' } },
      { path: 'pipeline',  canActivate: [internalGuard, sourcingGuard], loadComponent: () => import('./views/pipeline/pipeline').then(m => m.PipelineComponent), data: { mode: 'pipeline'  } },
      { path: 'map',           canActivate: [internalGuard, sourcingGuard], loadComponent: () => import('./views/map/map').then(m => m.MapComponent) },
      { path: 'lost',          canActivate: [internalGuard, sourcingGuard], loadComponent: () => import('./views/lost/lost').then(m => m.LostComponent) },
      { path: 'insights',      canActivate: [internalGuard, sourcingGuard], loadComponent: () => import('./views/insights/insights').then(m => m.InsightsComponent) },
      { path: 'social-impact', canActivate: [internalGuard, sourcingGuard], loadComponent: () => import('./views/social-impact/social-impact').then(m => m.SocialImpactComponent) },
      { path: 'agents',        canActivate: [internalGuard], loadComponent: () => import('./views/agents/agents').then(m => m.AgentsComponent) },
      { path: 'users',         canActivate: [internalGuard], loadComponent: () => import('./views/users/users').then(m => m.UsersComponent) },
      { path: 'companies',     canActivate: [internalGuard], loadComponent: () => import('./views/companies/companies').then(m => m.CompaniesComponent) },
      { path: 'projects',      canActivate: [internalGuard], loadComponent: () => import('./views/projects/projects').then(m => m.ProjectsComponent) },
      { path: 'record/:id',    canActivate: [internalGuard], loadComponent: () => import('./views/record/record').then(m => m.RecordComponent) },
    ]
  },
  { path: '**', redirectTo: 'pipeline' }
];
