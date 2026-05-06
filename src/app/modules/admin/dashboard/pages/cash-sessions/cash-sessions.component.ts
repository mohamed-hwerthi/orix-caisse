import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CashSession, CashSessionService, CashSessionSummary, CashMovement } from '../../../../../services/cash-session.service';
import { CustomToasterService } from '../../../../../services/custom-toaster.service';

@Component({
  selector: 'app-cash-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cash-sessions.component.html',
})
export class CashSessionsComponent implements OnInit, OnDestroy {
  loading = signal(true);
  sessions = signal<CashSession[]>([]);
  active = signal<CashSession | null>(null);
  activeSummary = signal<CashSessionSummary | null>(null);
  activeMovements = signal<CashMovement[]>([]);
  statusFilter = signal<'all' | 'OPEN' | 'CLOSED'>('all');

  filtered = computed(() => {
    const f = this.statusFilter();
    if (f === 'all') return this.sessions();
    return this.sessions().filter((s) => s.status === f);
  });

  totalRevenue = computed(() => this.sessions().reduce((sum, s) => sum + (s.expectedCash || 0) + (s.expectedCard || 0), 0));
  totalCashVariance = computed(() =>
    this.sessions()
      .filter((s) => s.status === 'CLOSED')
      .reduce((sum, s) => sum + (s.cashVariance || 0), 0),
  );
  withVariance = computed(() => this.sessions().filter((s) => Math.abs(s.cashVariance || 0) > 0.01).length);

  private subs = new Subscription();

  constructor(
    private cashSessionService: CashSessionService,
    private toaster: CustomToasterService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  load(): void {
    this.loading.set(true);
    this.subs.add(
      this.cashSessionService.all().subscribe({
        next: (data) => {
          this.sessions.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.toaster.handelErrorToaster('Erreur de chargement');
          this.loading.set(false);
        },
      }),
    );
  }

  viewSession(s: CashSession): void {
    if (!s.id) return;
    this.active.set(s);
    this.subs.add(this.cashSessionService.summary(s.id).subscribe({ next: (sum) => this.activeSummary.set(sum) }));
    this.subs.add(this.cashSessionService.listMovements(s.id).subscribe({ next: (m) => this.activeMovements.set(m) }));
  }

  close(): void {
    this.active.set(null);
    this.activeSummary.set(null);
    this.activeMovements.set([]);
  }

  downloadZReport(s: CashSession): void {
    if (!s.id) return;
    this.subs.add(
      this.cashSessionService.downloadZReport(s.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${s.zReportNumber || 'z-report-' + s.id}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.toaster.handelErrorToaster('Échec téléchargement Z-report'),
      }),
    );
  }

  badgeForStatus(status?: string): { label: string; color: string } {
    return status === 'CLOSED'
      ? { label: 'Clôturée', color: 'bg-gray-200 text-gray-700' }
      : { label: 'Ouverte', color: 'bg-blue-100 text-blue-700' };
  }

  varianceClass(v?: number): string {
    if (v == null || Math.abs(v) < 0.01) return 'text-gray-400';
    return v > 0 ? 'text-blue-600' : 'text-red-600';
  }

  reasonLabel(r: string): string {
    return (
      {
        PURCHASE: 'Achat',
        WITHDRAWAL: 'Retrait',
        DEPOSIT: 'Dépôt',
        CHANGE_GIVEN: 'Monnaie donnée',
        CHANGE_RECEIVED: 'Monnaie reçue',
        OTHER: 'Autre',
      } as Record<string, string>
    )[r] || r;
  }
}
