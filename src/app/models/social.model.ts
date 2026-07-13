export interface EpcRating { r: string; s: number; }

export interface Home {
  acq: string; type: string; frontDoors: number; bedSize: number;
  epcBefore: EpcRating; epcAfter: EpcRating;
  capex: number; completed: string;
}

export interface LocalSpend {
  business: string; category: string; town: string; amount: number; jobs: number;
}

export interface GrantFunding { code: string; homes: number; }

export interface SocialProject {
  id: string; label: string; council: string; area: string;
  totalSupplierSpend: number;
  homes: Home[];
  localSpend: LocalSpend[];
  stats?: { homes: number; bedrooms: number; epcCPlusPct: number; epcPointUplift: number; };
  spendByRegion?: { region: string; pct: number; }[];
  grantFunding?: GrantFunding[];
  bedsBreakdown?: { [key: string]: number };
  contract?: { name: string; reference: string; value: number; provider: string; period: string; };
  narrative?: string;
  programmes?: { name: string; homes: number; }[];
}

export interface Supplier {
  id?: number; projectId: string; name: string; category: string;
  postcode: string; town?: string; fee: number; lat?: number; lng?: number;
  isLocal: boolean; distanceMiles?: number; date: string;
}
