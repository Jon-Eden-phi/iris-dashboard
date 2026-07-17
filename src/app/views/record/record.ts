import { Component, computed, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MockDataService } from '../../services/mock-data';
import { AuthService } from '../../services/auth';
import { ProjectsService } from '../../services/projects';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import { ActivityNote, Offer, PropertyDocument } from '../../models/property.model';

const TX_STAGES = new Set(['MemorandumOfSale', 'Legals', 'Refurbishment', 'Lettings']);

@Component({
  selector: 'app-record',
  imports: [RouterLink, MoneyPipe, TitleCasePipe],
  templateUrl: './record.html',
  styleUrl: './record.scss',
})
export class RecordComponent {
  data     = inject(MockDataService);
  auth     = inject(AuthService);
  projects = inject(ProjectsService);
  route    = inject(ActivatedRoute);
  router   = inject(Router);

  get propId(): string | null { return this.route.snapshot.paramMap.get('id'); }

  property = computed(() => {
    const id = this.propId;
    return id ? this.data.getProperty(id) : undefined;
  });

  readonly stages = ['Draft','ClientApproval','Viewing','Negotiations','MemorandumOfSale','Legals','Refurbishment','Lettings'];

  readonly stageLabels: Record<string, string> = {
    Draft: 'Draft', ClientApproval: 'Client Appr.',
    Viewing: 'Viewing', Negotiations: 'Negotiate',
    MemorandumOfSale: 'MoS', Legals: 'Legals',
    Refurbishment: 'Refurb', Lettings: 'Lettings',
  };

  readonly stageGroups = [
    { label: 'Initiation',      color: '#7c3aed', stages: ['Draft', 'ClientApproval'] },
    { label: 'Viewing & Offer', color: '#2472a8', stages: ['Viewing', 'Negotiations'] },
    { label: 'Committed',       color: '#0f7c6b', stages: ['MemorandumOfSale'] },
    { label: 'Completion',      color: '#E8601C', stages: ['Legals', 'Refurbishment', 'Lettings'] },
  ];

  readonly advanceLabels: Record<string, string> = {
    Draft: 'Submit for Client Approval',
    ClientApproval: 'Client Approved — Book Viewing',
    Viewing: 'Viewing Done — Start Negotiations',
    Negotiations: 'Offer Accepted — Issue MoS',
    MemorandumOfSale: 'Move to Legals',
    Legals: 'Start Refurbishment',
    Refurbishment: 'Mark as Lettings',
  };

  canAdvance = computed(() => {
    const p = this.property();
    if (!p || p.status !== 'active') return false;
    const idx = this.stages.indexOf(p.stage);
    if (idx < 0 || idx >= this.stages.length - 1) return false;
    // TX stages can only be advanced from the Transactions portal
    if (TX_STAGES.has(p.stage) && this.auth.currentUser()?.role !== 'Transactions') return false;
    return true;
  });

  nextStageLabel = computed(() => {
    const p = this.property();
    if (!p) return '';
    return this.advanceLabels[p.stage] ?? 'Advance Stage';
  });

  currentOffer = computed(() => {
    const offers = this.property()?.offers ?? [];
    if (!offers.length) return null;
    return [...offers].reverse().find(o => o.status === 'pending') ?? offers[offers.length - 1];
  });

  councilName = computed(() => {
    const m: Record<string, string> = {
      'Bristol P3':    'Bristol City Council',
      'Merton LAHF':   'Merton Council',
      'Leeds P1':      'Leeds City Council',
      'Hastings ESPH': 'Hastings Borough Council',
    };
    return m[this.property()?.phase ?? ''] ?? 'the client';
  });

  // Draft stage form
  draftVacant    = signal(true);
  draftChainFree = signal(true);
  draftProbate   = signal(false);
  draftCapex     = signal('£31,500');
  draftAgent     = signal('');
  draftLink      = signal('');

  // Notes form
  showNoteForm  = signal(false);
  noteText      = signal('');
  noteAuthor    = signal('Aryan');

  // Offer form
  showOfferForm = signal(false);
  offerAmount   = signal<number | null>(null);
  offerNotes    = signal('');
  offerBy       = signal('Aryan');

  stageIndex(s: string): number { return this.stages.indexOf(s); }

  advance(): void {
    const id = this.propId;
    if (!id || !this.canAdvance()) return;
    this.data.advanceStage(id);
  }

  submitNote(): void {
    const text = this.noteText().trim();
    const id   = this.propId;
    if (!text || !id) return;
    const note: ActivityNote = {
      id: crypto.randomUUID(),
      text,
      author: this.noteAuthor().trim() || 'Aryan',
      timestamp: new Date().toISOString(),
      label: 'info',
    };
    this.data.addActivity(id, note);
    this.noteText.set('');
    this.showNoteForm.set(false);
  }

  submitOffer(): void {
    const amount = this.offerAmount();
    const id     = this.propId;
    if (!amount || !id) return;
    const offer: Offer = {
      id: crypto.randomUUID(),
      amount,
      status: 'pending',
      date: new Date().toISOString(),
      submittedBy: this.offerBy().trim() || 'Aryan',
      notes: this.offerNotes().trim() || undefined,
    };
    this.data.addOffer(id, offer);
    this.offerAmount.set(null);
    this.offerNotes.set('');
    this.showOfferForm.set(false);
  }

  readonly viewingAttendeeGroups = [
    { label: 'Operations (SimplyPhi)', options: ['Megan Doyle', 'Ryan Okonkwo', 'Hannah Briggs'] },
    { label: 'Viewber (external)',     options: ['Viewber — auto-assign agent', 'Viewber — David M.', 'Viewber — Aisha K.'] },
  ];

  setViewingAttendee(val: string): void {
    const id = this.propId; if (!id) return;
    this.data.updateViewing(id, { attendee: val });
  }
  setViewingDate(val: string): void {
    const id = this.propId; if (!id) return;
    this.data.updateViewing(id, { date: val });
  }
  setViewingTime(val: string): void {
    const id = this.propId; if (!id) return;
    this.data.updateViewing(id, { time: val });
  }
  setViewingReportNotes(val: string): void {
    const id = this.propId; if (!id) return;
    this.data.updateViewing(id, { reportNotes: val });
  }

  setViewingCondition(val: string): void {
    const id = this.propId; if (!id) return;
    this.data.updateViewing(id, { reportCondition: val as any });
  }

  submitViewingForReview(): void {
    const id = this.propId; if (!id) return;
    this.data.submitViewingForReview(id);
  }

  formatViewingDate(d: string | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  attendeeInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  resolveOffer(offerId: string, status: 'accepted' | 'rejected' | 'withdrawn'): void {
    const id = this.propId;
    if (!id) return;
    this.data.updateOffer(id, offerId, status);
    if (status === 'accepted' && this.property()?.stage === 'Negotiations') {
      this.data.advanceStage(id);
    }
  }

  pctVsAsking(offerAmount: number): string {
    const asking = this.property()?.financial?.ap ?? 0;
    if (!asking) return '';
    const pct = Math.round(Math.abs(asking - offerAmount) / asking * 100);
    return offerAmount >= asking ? `${pct}% above asking` : `${pct}% below asking`;
  }

  offerStatusColor(status: string): string {
    const m: Record<string, string> = {
      pending: '#f59e0b', accepted: '#0f7c6b', rejected: '#ef4444',
      countered: '#0891b2', withdrawn: '#9ca3af',
    };
    return m[status] ?? '#9ca3af';
  }

  fmtTimestamp(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  labelColor(label: string | undefined): string {
    const m: Record<string, string> = {
      info: '#2472a8', action: '#E8601C', warning: '#f59e0b', success: '#0f7c6b',
    };
    return m[label ?? 'info'] ?? '#2472a8';
  }

  epcColor(r: string): string {
    const m: Record<string, string> = {
      A: '#00a651', B: '#50b848', C: '#b2d235', D: '#fff200', E: '#f7941d', F: '#f15a24', G: '#ed1b24',
    };
    return m[r] || '#ccc';
  }

  epcTextColor(r: string): string { return ['C','D'].includes(r) ? '#111' : '#fff'; }

  showAicPopover = signal(false);
  recordTab = signal<'home' | 'financials' | 'contacts' | 'activity' | 'dataroom'>('home');

  // Users allocated to this property's project
  propertyContacts = computed(() => {
    const phase = this.property()?.phase;
    if (!phase) return [];
    const project = this.projects.all.find(pr => pr.name === phase);
    if (!project) return this.auth.allUsers.filter(u => u.projects?.length);
    return this.auth.allUsers.filter(u => u.projects?.includes(project.id));
  });

  // Documents stored against this property (persisted via mock-data)
  addDocument(doc: PropertyDocument): void {
    const id = this.propId;
    if (!id) return;
    const docs = [...(this.property()?.documents ?? []), doc];
    this.data.updateProperty(id, { documents: docs });
  }

  removeDocument(docId: string): void {
    const id = this.propId;
    if (!id) return;
    const docs = (this.property()?.documents ?? []).filter(d => d.id !== docId);
    this.data.updateProperty(id, { documents: docs });
  }

  docSearch = signal('');

  triggerDocUpload(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e: Event) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      files.forEach(file => {
        const doc: PropertyDocument = {
          id: crypto.randomUUID(),
          name: file.name,
          category: 'Other',
          uploadedBy: this.auth.currentUser()?.name ?? 'Unknown',
          uploadedAt: new Date().toISOString(),
          size: file.size > 1_048_576
            ? (file.size / 1_048_576).toFixed(1) + ' MB'
            : Math.round(file.size / 1024) + ' KB',
        };
        this.addDocument(doc);
      });
    };
    input.click();
  }

  totalCost = computed(() => {
    const f = this.property()?.financial;
    if (!f) return 0;
    return (f.ap ?? 0) + (f.capex ?? 0) + (f.tc ?? 0) + (f.sc ?? 0);
  });

  phaseColor(phase: string): string {
    const m: Record<string, string> = {
      'Bristol P3': '#2472a8', 'Merton LAHF': '#0f7c6b',
      'Leeds P1': '#7c3aed',   'Hastings ESPH': '#E8601C',
    };
    return m[phase] || '#888';
  }

  generateOfferLetter(): void {
    const p = this.property();
    if (!p) return;

    const latestOffer = [...(p.offers ?? [])].reverse().find(o => o.status === 'pending')
      ?? [...(p.offers ?? [])].reverse()[0];
    const offerAmount = latestOffer?.amount ?? p.financial?.ap ?? 0;

    const clientMap: Record<string, string> = {
      'Bristol P3':    'Bristol City Council',
      'Merton LAHF':   'London Borough of Merton',
      'Leeds P1':      'Leeds City Council',
      'Hastings ESPH': 'Hastings Borough Council',
    };
    const purchaser = clientMap[p.phase] ?? p.phase;

    const solicitorMap: Record<string, string> = {
      'Bristol P3':    'Emma Thornton\nAvon Legal Partnership\nBristol City Council\n1 Colston Street\nBristol\nBS1 5AR',
      'Merton LAHF':   'Simone Moore\nSouth London Legal Partnership\nMerton Civic Centre,\nLondon Road,\nMorden\nSM4 5DX',
      'Leeds P1':      'David Hargreaves\nLeeds City Council Legal\nLeeds City Hall\n1 Millennium Square\nLeeds\nLS1 1BA',
      'Hastings ESPH': 'Rachel Morris\nEast Sussex Legal Services\nHastings Town Hall\nQueens Road\nHastings\nTN34 1QR',
    };
    const solicitorRaw = solicitorMap[p.phase] ?? 'To be confirmed';
    const solicitorLines = solicitorRaw.split('\n').map(l => `${l}<br>`).join('');

    const agentName    = p.viewing?.agentName    ?? 'The Agent';
    const agentCompany = p.viewing?.agentCompany ?? '';
    const agentEmail   = p.viewing?.agentEmail   ?? '';
    const agentPhone   = p.viewing?.agentPhone   ?? '';

    const irisRef  = `IRIS ${p.id.replace(/\D/g, '').padStart(5, '0')}`;
    const dateStr  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(',', '');
    const bedWords = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
    const bedLabel = p.beds && p.beds <= 6 ? `${bedWords[p.beds]}-bedroom ` : '';
    const propDesc = bedLabel + (p.type?.toLowerCase() ?? 'residential property');
    const priceWords = this._numberToWords(offerAmount);

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Offer Letter — ${p.address}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #222; background: #fff; padding: 40px 56px; line-height: 1.5; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 12px; }
  .client-logo { font-size: 15pt; font-weight: 800; color: #222; line-height: 1.2; }
  .client-logo span { display: block; font-size: 9pt; font-weight: 400; letter-spacing: 0.08em; text-transform: uppercase; color: #555; }
  .sp-logo { font-size: 18pt; font-weight: 900; color: #E8601C; letter-spacing: -0.02em; }
  .sp-logo span { color: #222; }
  .divider { border: none; border-top: 3px solid #E8601C; margin: 10px 0 24px; }
  .address-block { font-size: 10.5pt; margin-bottom: 4px; line-height: 1.6; }
  .date-ref { text-align: right; font-size: 10.5pt; margin-bottom: 18px; }
  .subject { text-align: center; font-weight: 700; margin: 22px 0 6px; font-size: 11pt; }
  .re      { text-align: center; font-weight: 700; margin-bottom: 20px; font-size: 11pt; }
  .salutation { margin-bottom: 14px; }
  .opener { margin-bottom: 20px; }
  table.terms { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  table.terms td { padding: 7px 0; vertical-align: top; font-size: 10.5pt; border-bottom: 1px solid #eee; }
  table.terms td:first-child { font-weight: 700; width: 140px; padding-right: 20px; white-space: nowrap; }
  .conditions ol { margin-left: 0; padding-left: 0; list-style: none; }
  .conditions ol li { margin-bottom: 4px; }
  .conditions ol li::before { content: attr(data-n) '. '; }
  .contact-para { font-weight: 700; margin: 24px 0 10px; font-size: 10.5pt; }
  .sign-name { font-weight: 700; margin-top: 2px; }
  .footer { border-top: 2px solid #E8601C; margin-top: 48px; padding-top: 8px; text-align: center; font-size: 8pt; color: #555; line-height: 1.6; }
  @media print { body { padding: 20px 40px; } }
</style></head><body>

<div class="header">
  <div class="client-logo">
    <span>London Borough of</span>
    ${purchaser.split(' ').pop()!.toUpperCase()}
  </div>
  <div class="sp-logo">Simply<span>Phi</span></div>
</div>
<hr class="divider">

<div class="address-block">
  ${agentCompany}<br>
  ${agentPhone ? 'T: ' + agentPhone + '<br>' : ''}
  ${agentEmail ? 'E: ' + agentEmail : ''}
</div>

<div class="date-ref">
  ${dateStr}<br>
  <strong>Our Ref: ${irisRef}</strong>
</div>

<div class="subject">SUBJECT TO CONTRACT</div>
<div class="re">RE: ${p.id} — ${p.address}${p.postcode ? ', ' + p.postcode : ''}</div>

<p class="salutation">Dear ${agentName},</p>
<p class="opener">We are pleased to submit the below offer.</p>

<table class="terms">
  <tr><td>PROPERTY</td><td>${propDesc}</td></tr>
  <tr><td>TENURE</td><td>freehold</td></tr>
  <tr><td>PRICE</td><td><strong>£${offerAmount.toLocaleString('en-GB')} (${priceWords})</strong></td></tr>
  <tr><td>PURCHASER</td><td>${purchaser}<br>c/o SimplyPhi<br>1st Floor Chertsey House<br>61 Chertsey Road<br>Woking<br>GU21 5BN</td></tr>
  <tr><td>FUNDING</td><td>The purchase will be made fully in cash and no debt financing is required, which will be confirmed by our solicitors on receipt of a memorandum of sale. Should you require this ahead of time, please submit a separate request.</td></tr>
  <tr><td>TIMESCALE</td><td>Target exchange will be within 8–12 weeks from receipt of the full legal pack including all title numbers and Freehold management pack (where applicable), unless otherwise agreed with the vendor. Completion date to be mutually agreed.</td></tr>
  <tr><td>DEPOSIT</td><td>A 10 percent deposit will be paid on exchange if completion does not take place simultaneously.</td></tr>
  <tr><td>SOLICITORS</td><td>${solicitorLines}</td></tr>
  <tr><td>CONDITIONS</td><td>
    This proposal is subject to the following conditions, <strong>please add these conditions to the memorandum of sale</strong>:<br><br>
    1. Satisfactory confirmatory due diligence.<br>
    2. A minimum retention of £1,000 will be held until vacant possession is confirmed. This includes all occupants, furniture, possessions in the property including sheds or outbuildings, loft, garage.<br>
    3. All pre-payment utility meters need to be cleared of any debts, and all keys or cards to be left on site.<br>
    4. Satisfactory Building Regulations for extensions and alterations to the property.<br>
    5. Energy Performance Asset Rating of grade D (as advertised) or better<br>
    6. Investment committee approval; and<br>
    7. Formal contract
  </td></tr>
  <tr><td>KNOW YOUR<br>CLIENT (KYC)</td><td>Where a KYC check is required, we will first need written confirmation of your agency's compliance with General Data Protection Regulation (GDPR) from your Head of Compliance. Within 72 hours of receipt, an up-to-date KYC pack can be made available to be held strictly in accordance with GDPR guidance.</td></tr>
</table>

<p class="contact-para">Jon Eden will now be your point of contact during the conveyancing process. Should you have any questions or would like an update please contact Jon at jonathan.e@simplyphi.co.uk or the Transactions Team at phi-transactions@simplyphi.co.uk</p>
<p style="font-weight:700; margin-bottom:18px;">T: 01932 972100 option 2.</p>

<p style="margin-bottom:48px;">Yours Sincerely,</p>
<p class="sign-name">Jon Eden</p>
<p><strong>Transaction Lead</strong></p>
<p><strong>SimplyPhi</strong></p>

<div class="footer">
  Phi Property Acquisitions Limited<br>
  First Floor Chertsey House, 61 Chertsey Road, Woking, Surrey, GU21 5BN<br>
  01932 972100 — hello@simplyphi.co.uk — www.simplyphi.co.uk<br>
  Registered in England and Wales No. 16166674 &nbsp; VAT Registration Number 484486054
</div>

<script>window.onload = () => window.print();</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  private _numberToWords(n: number): string {
    if (n === 0) return 'Zero Pounds';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const toW = (x: number): string => {
      if (x === 0) return '';
      if (x < 20) return ones[x];
      if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
      if (x < 1000) return ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' and ' + toW(x % 100) : '');
      if (x < 1000000) {
        const th = Math.floor(x / 1000), rem = x % 1000;
        return toW(th) + ' Thousand' + (rem ? (rem < 100 ? ' and ' : ' ') + toW(rem) : '');
      }
      return x.toString();
    };
    return toW(n) + ' Pounds';
  }
}
