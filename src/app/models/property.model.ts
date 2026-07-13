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
}
