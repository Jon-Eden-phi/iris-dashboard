import { Component, computed, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, INVESTOR_DECISION_OPTIONS, InvestorDecisionKey, IrisUser } from '../../services/auth';
import { MockDataService } from '../../services/mock-data';
import { ProjectsService } from '../../services/projects';

const VIEWING_KEY   = 'iris_viewing_decisions';
const MAX_PRICE_KEY = 'iris_max_price_auth';
const ROT_KEY       = 'iris_rot_approvals';
const CONTRACT_KEY  = 'iris_contract_signs';
const COMPL_KEY     = 'iris_compl_approvals';
const FUNDS_KEY     = 'iris_funds_transfers';

@Component({
  selector: 'app-ic-portal',
  imports: [TitleCasePipe],
  templateUrl: './ic-portal.html',
  styleUrl: './ic-portal.scss',
})
export class IcPortalComponent {
  auth     = inject(AuthService);
  data     = inject(MockDataService);
  projects = inject(ProjectsService);
  router   = inject(Router);

  user         = computed(() => this.auth.currentUser()!);
  myProjectIds = computed(() => this.user().projects ?? []);
  myProjects   = computed(() => this.projects.all.filter(p => this.myProjectIds().includes(p.id)));

  investorForProject(projectId: string): IrisUser | undefined {
    return this.auth.allUsers.find(u =>
      u.role === 'Investor' && (u.projects ?? []).includes(projectId)
    );
  }

  // IC handles decisions the investor did NOT opt into
  icDecisionsForProject(projectId: string) {
    const investor = this.investorForProject(projectId);
    const investorKeys = investor?.investorDecisions ?? [];
    return INVESTOR_DECISION_OPTIONS.filter(d => !investorKeys.includes(d.key));
  }

  propertiesForProject(projectName: string) {
    return this.data.properties.filter(p => p.status === 'active' && p.phase === projectName);
  }

  // ── Decision state ─────────────────────────────
  private viewingData  = signal<Record<string, any>>(JSON.parse(localStorage.getItem(VIEWING_KEY)   ?? '{}'));
  private maxPriceData = signal<Record<string, any>>(JSON.parse(localStorage.getItem(MAX_PRICE_KEY) ?? '{}'));
  private rotData      = signal<Record<string, any>>(JSON.parse(localStorage.getItem(ROT_KEY)       ?? '{}'));
  private contractData = signal<Record<string, any>>(JSON.parse(localStorage.getItem(CONTRACT_KEY)  ?? '{}'));
  private complData    = signal<Record<string, any>>(JSON.parse(localStorage.getItem(COMPL_KEY)     ?? '{}'));
  private fundsData    = signal<Record<string, any>>(JSON.parse(localStorage.getItem(FUNDS_KEY)     ?? '{}'));

  maxPriceInputs = signal<Record<string, string>>({});

  isDecisionDone(propId: string, key: InvestorDecisionKey): boolean {
    switch (key) {
      case 'viewing_review':       return !!this.viewingData()[propId];
      case 'max_price_auth':       return !!this.maxPriceData()[propId];
      case 'rot_approval':         return this.rotData()[propId]?.status === 'approved';
      case 'contract_sign':        return !!this.contractData()[propId];
      case 'compl_statement_appr': return !!this.complData()[propId];
      case 'funds_confirmation':   return !!this.fundsData()[propId];
    }
  }

  getDecisionData(propId: string, key: InvestorDecisionKey): any {
    switch (key) {
      case 'viewing_review':       return this.viewingData()[propId];
      case 'max_price_auth':       return this.maxPriceData()[propId];
      case 'rot_approval':         return this.rotData()[propId];
      case 'contract_sign':        return this.contractData()[propId];
      case 'compl_statement_appr': return this.complData()[propId];
      case 'funds_confirmation':   return this.fundsData()[propId];
    }
  }

  pendingCount = computed(() => {
    let n = 0;
    for (const proj of this.myProjects()) {
      for (const prop of this.propertiesForProject(proj.name)) {
        for (const d of this.icDecisionsForProject(proj.id)) {
          if (!this.isDecisionDone(prop.id, d.key)) n++;
        }
      }
    }
    return n;
  });

  // ── Actions ────────────────────────────────────
  approveViewing(propId: string): void { this._saveViewing(propId, 'approved'); }
  rejectViewing(propId: string): void  { this._saveViewing(propId, 'rejected'); }
  private _saveViewing(propId: string, status: 'approved' | 'rejected'): void {
    const u = { ...this.viewingData(), [propId]: { status, at: new Date().toISOString(), by: this.user().name } };
    localStorage.setItem(VIEWING_KEY, JSON.stringify(u)); this.viewingData.set(u);
  }

  setMaxPrice(propId: string): void {
    const val = parseFloat(this.maxPriceInputs()[propId] ?? '');
    if (!val || val <= 0) return;
    const u = { ...this.maxPriceData(), [propId]: { maxPrice: val, at: new Date().toISOString(), by: this.user().name } };
    localStorage.setItem(MAX_PRICE_KEY, JSON.stringify(u)); this.maxPriceData.set(u);
  }

  approveRoT(propId: string): void {
    const u = { ...this.rotData(), [propId]: { status: 'approved', approvedBy: this.user().name } };
    localStorage.setItem(ROT_KEY, JSON.stringify(u)); this.rotData.set(u);
  }

  signContract(propId: string): void {
    const u = { ...this.contractData(), [propId]: { signedAt: new Date().toISOString(), signature: this.user().name } };
    localStorage.setItem(CONTRACT_KEY, JSON.stringify(u)); this.contractData.set(u);
  }

  approveCS(propId: string): void {
    const u = { ...this.complData(), [propId]: { approvedAt: new Date().toISOString(), approvedBy: this.user().name } };
    localStorage.setItem(COMPL_KEY, JSON.stringify(u)); this.complData.set(u);
  }

  confirmFunds(propId: string): void {
    const u = { ...this.fundsData(), [propId]: { confirmedAt: new Date().toISOString(), confirmedBy: this.user().name } };
    localStorage.setItem(FUNDS_KEY, JSON.stringify(u)); this.fundsData.set(u);
  }

  updateMaxPriceInput(propId: string, val: string): void {
    this.maxPriceInputs.update(m => ({ ...m, [propId]: val }));
  }

  fmt(n: number): string { return '£' + n.toLocaleString('en-GB'); }
  logout(): void { this.auth.logout(); this.router.navigate(['/login']); }
}
