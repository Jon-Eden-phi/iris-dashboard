export interface PropertyDocument {
  id: string;
  name: string;
  category: 'Legal' | 'Financial' | 'Survey' | 'Other';
  uploadedBy: string;
  uploadedAt: string;
  size?: string;
}

export type Stage =
  | 'Draft' | 'ClientApproval' | 'Viewing' | 'Negotiations'
  | 'MemorandumOfSale' | 'Legals' | 'Refurbishment' | 'Lettings';

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'withdrawn';
export type NoteLabel   = 'info' | 'action' | 'warning' | 'success';

export interface EpcRating { r: string; s: number; }

export interface Viewing {
  date?: string; time?: string; attendee?: string;
  notes?: string; outcome?: string;
  agentName?: string; agentCompany?: string;
  agentEmail?: string; agentPhone?: string;
  clientReview?: 'pending' | 'approved' | 'rejected';
  reportNotes?: string;
  reportCondition?: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface Offer {
  id: string;
  amount: number;
  status: OfferStatus;
  date: string;
  submittedBy: string;
  notes?: string;
}

export interface ActivityNote {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  label?: NoteLabel;
}

export interface Financial {
  ap?: number;
  sp?: number;
  capex?: number;
  tc?: number;
  sc?: number;
  ltsc?: number;
  stampDuty?: number;
  yield?: number;
  epcRating?: string;
}

export interface Property {
  id: string;
  address: string;
  phase: string;
  stage: Stage;
  status: 'active' | 'lost';
  beds?: number;
  type?: string;
  postcode?: string;
  epcBefore?: EpcRating;
  epcAfter?: EpcRating;
  isMock?: boolean;
  viewing?: Viewing;
  financial?: Financial;
  notes?: string;
  offers?: Offer[];
  activityLog?: ActivityNote[];
  agreedPrice?: number;
  clientApprovedBy?: string;
  clientMaxPrice?: number;
  lostReason?: string;
  lostDate?: string;
  completedDate?: string;
  isInvestorDeal?: boolean;
  tenure?: string;
  lha?: number;
  marketRent?: number;
  floodRisk?: string;
  leaseRemaining?: string;
  description?: string;
  daysOnMarket?: number;
  exCouncil?: boolean;
  exCare?: string;
  bathrooms?: number;
  size?: number;
  exLocalAuthority?: boolean;
  ageOfProperty?: string;
  mainHeatDescription?: string;
  gasSafeRegister?: string;
  wallsDescription?: string;
  localAuthority?: string;
  brma?: string;
  ward?: string;
  ccg?: string;
  ndss?: boolean;
  auction?: boolean;
  newHome?: boolean;
  builtYear?: string;
  estateManagementCharges?: number | string;
  documents?: PropertyDocument[];
}
