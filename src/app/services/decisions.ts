import { Injectable, signal } from '@angular/core';
import { InvestorDecisionKey } from './auth';

const VIEWING_KEY   = 'iris_viewing_decisions';
const MAX_PRICE_KEY = 'iris_max_price_auth';
const ROT_KEY       = 'iris_rot_approvals';
const CONTRACT_KEY  = 'iris_contract_signs';
const COMPL_KEY     = 'iris_compl_approvals';
const FUNDS_KEY     = 'iris_funds_transfers';
const TX_DATA_KEY   = 'iris_tx_data';

function load(key: string): Record<string, any> {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}'); } catch { return {}; }
}

@Injectable({ providedIn: 'root' })
export class DecisionsService {
  viewing  = signal<Record<string, any>>(load(VIEWING_KEY));
  maxPrice = signal<Record<string, any>>(load(MAX_PRICE_KEY));
  rot      = signal<Record<string, any>>(load(ROT_KEY));
  contract = signal<Record<string, any>>(load(CONTRACT_KEY));
  compl    = signal<Record<string, any>>(load(COMPL_KEY));
  funds    = signal<Record<string, any>>(load(FUNDS_KEY));
  txData   = signal<Record<string, any>>(load(TX_DATA_KEY));

  isDone(propId: string, key: InvestorDecisionKey): boolean {
    switch (key) {
      case 'viewing_review':       return !!this.viewing()[propId];
      case 'max_price_auth':       return !!this.maxPrice()[propId];
      case 'rot_approval':         return this.rot()[propId]?.status === 'approved';
      case 'contract_sign':        return !!this.contract()[propId];
      case 'compl_statement_appr': return !!this.compl()[propId];
      case 'funds_confirmation':   return !!this.funds()[propId];
    }
  }

  getMaxPrice(propId: string): number | null {
    return this.maxPrice()[propId]?.maxPrice ?? null;
  }

  isViewingApproved(propId: string): boolean {
    const d = this.viewing()[propId];
    return d?.status === 'approved';
  }

  reload(): void {
    this.viewing.set(load(VIEWING_KEY));
    this.maxPrice.set(load(MAX_PRICE_KEY));
    this.rot.set(load(ROT_KEY));
    this.contract.set(load(CONTRACT_KEY));
    this.compl.set(load(COMPL_KEY));
    this.funds.set(load(FUNDS_KEY));
    this.txData.set(load(TX_DATA_KEY));
  }

  save(key: InvestorDecisionKey, propId: string, value: any): void {
    const map: Record<InvestorDecisionKey, { sig: ReturnType<typeof signal<Record<string,any>>>, storageKey: string }> = {
      viewing_review:       { sig: this.viewing,  storageKey: VIEWING_KEY },
      max_price_auth:       { sig: this.maxPrice, storageKey: MAX_PRICE_KEY },
      rot_approval:         { sig: this.rot,      storageKey: ROT_KEY },
      contract_sign:        { sig: this.contract, storageKey: CONTRACT_KEY },
      compl_statement_appr: { sig: this.compl,    storageKey: COMPL_KEY },
      funds_confirmation:   { sig: this.funds,    storageKey: FUNDS_KEY },
    };
    const { sig, storageKey } = map[key];
    const updated = { ...sig(), [propId]: value };
    localStorage.setItem(storageKey, JSON.stringify(updated));
    sig.set(updated);
  }
}
