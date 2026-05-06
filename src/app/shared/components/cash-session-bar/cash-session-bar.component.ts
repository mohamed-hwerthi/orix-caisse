import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  CashMovementReason,
  CashMovementType,
  CashSession,
  CashSessionService,
  CashSessionSummary,
} from '../../../services/cash-session.service';
import { CustomToasterService } from '../../../services/custom-toaster.service';

@Component({
  selector: 'app-cash-session-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cash-session-bar.component.html',
})
export class CashSessionBarComponent implements OnInit, OnDestroy {
  session = signal<CashSession | null>(null);
  loaded = signal(false);

  // Open session
  showOpenSession = signal(false);
  openingAmountInput = 0;
  openingNotesInput = '';

  // Cash movement
  showMovementModal = signal(false);
  movementType: CashMovementType = 'OUT';
  movementReason: CashMovementReason = 'PURCHASE';
  movementAmount = 0;
  movementNote = '';

  // Close session
  showCloseModal = signal(false);
  closeSummary = signal<CashSessionSummary | null>(null);
  countedCashInput = 0;
  countedCardInput = 0;
  closingNotesInput = '';
  closing = signal(false);

  cashDenominations = [
    { value: 50, count: 0 },
    { value: 20, count: 0 },
    { value: 10, count: 0 },
    { value: 5, count: 0 },
    { value: 2, count: 0 },
    { value: 1, count: 0 },
    { value: 0.5, count: 0 },
    { value: 0.2, count: 0 },
    { value: 0.1, count: 0 },
    { value: 0.05, count: 0 },
  ];

  private subs = new Subscription();

  constructor(
    private cashSessionService: CashSessionService,
    private toaster: CustomToasterService,
  ) {}

  ngOnInit(): void {
    this.checkSession();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get computedCashCount(): number {
    return Math.round(
      this.cashDenominations.reduce((sum, d) => sum + d.value * (d.count || 0), 0) * 100,
    ) / 100;
  }

  get cashVarianceLive(): number {
    const sum = this.closeSummary();
    if (!sum) return 0;
    return Math.round((this.countedCashInput - sum.expectedCashInDrawer) * 100) / 100;
  }

  get cardVarianceLive(): number {
    const sum = this.closeSummary();
    if (!sum) return 0;
    return Math.round((this.countedCardInput - sum.expectedCardTotal) * 100) / 100;
  }

  checkSession(): void {
    this.subs.add(
      this.cashSessionService.current().subscribe({
        next: (s) => {
          this.session.set(s);
          this.loaded.set(true);
        },
        error: () => {
          this.session.set(null);
          this.loaded.set(true);
          this.showOpenSession.set(true);
        },
      }),
    );
  }

  openSession(): void {
    if (this.openingAmountInput < 0) return;
    this.subs.add(
      this.cashSessionService
        .open({ openingAmount: this.openingAmountInput, openingNotes: this.openingNotesInput || undefined })
        .subscribe({
          next: (s) => {
            this.session.set(s);
            this.showOpenSession.set(false);
            this.openingAmountInput = 0;
            this.openingNotesInput = '';
            this.toaster.handelSuccessToaster(`Caisse ouverte avec ${s.openingAmount} DT`);
          },
          error: () => this.toaster.handelErrorToaster('Échec ouverture caisse'),
        }),
    );
  }

  openMovementModal(): void {
    this.movementType = 'OUT';
    this.movementReason = 'PURCHASE';
    this.movementAmount = 0;
    this.movementNote = '';
    this.showMovementModal.set(true);
  }

  closeMovementModal(): void {
    this.showMovementModal.set(false);
  }

  saveMovement(): void {
    const s = this.session();
    if (!s?.id || this.movementAmount <= 0) return;
    this.subs.add(
      this.cashSessionService
        .addMovement(s.id, {
          type: this.movementType,
          reason: this.movementReason,
          amount: this.movementAmount,
          note: this.movementNote || undefined,
        })
        .subscribe({
          next: () => {
            this.toaster.handelSuccessToaster('Mouvement enregistré');
            this.closeMovementModal();
          },
          error: () => this.toaster.handelErrorToaster('Échec mouvement'),
        }),
    );
  }

  openCloseModal(): void {
    const s = this.session();
    if (!s?.id) return;
    this.subs.add(
      this.cashSessionService.summary(s.id).subscribe({
        next: (sum) => {
          this.closeSummary.set(sum);
          this.countedCashInput = sum.expectedCashInDrawer;
          this.countedCardInput = sum.expectedCardTotal;
          this.closingNotesInput = '';
          this.cashDenominations.forEach((d) => (d.count = 0));
          this.showCloseModal.set(true);
        },
      }),
    );
  }

  closeCloseModal(): void {
    this.showCloseModal.set(false);
  }

  applyDenominationCount(): void {
    this.countedCashInput = this.computedCashCount;
  }

  confirmClose(): void {
    const s = this.session();
    if (!s?.id || this.closing()) return;
    this.closing.set(true);
    this.subs.add(
      this.cashSessionService
        .close(s.id, {
          countedCash: this.countedCashInput,
          countedCard: this.countedCardInput,
          closingNotes: this.closingNotesInput || undefined,
        })
        .subscribe({
          next: (closed) => {
            this.toaster.handelSuccessToaster(`Z-report ${closed.zReportNumber} généré`);
            if (closed.id) {
              this.cashSessionService.downloadZReport(closed.id).subscribe({
                next: (blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${closed.zReportNumber || 'z-report-' + closed.id}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                },
                error: () => this.toaster.handelErrorToaster('Échec téléchargement Z-report'),
              });
            }
            this.session.set(null);
            this.showCloseModal.set(false);
            this.closing.set(false);
            this.openingAmountInput = closed.countedCash || 0;
            this.showOpenSession.set(true);
          },
          error: (err) => {
            this.closing.set(false);
            this.toaster.handelErrorToaster(err?.error?.message || 'Échec clôture');
          },
        }),
    );
  }
}
