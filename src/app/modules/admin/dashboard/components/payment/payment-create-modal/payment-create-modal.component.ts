import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { MessageService } from 'primeng/api';
import { DialogService, DynamicDialogComponent, DynamicDialogRef } from 'primeng/dynamicdialog';

export interface PaymentDetails {
  orderTotal: number;
  receivedAmount: number;
  amountToChange: number;
}
@Component({
  selector: 'app-payment-create-modal',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule],
  providers: [MessageService],

  templateUrl: './payment-create-modal.component.html',
  styleUrl: './payment-create-modal.component.scss',
})
export class PaymentCreateModalComponent implements OnInit, AfterViewInit {
  [x: string]: any;
  @ViewChild('amountInput') amountInput?: ElementRef<HTMLInputElement>;
  orderTotal!: number;
  instance: DynamicDialogComponent | undefined;
  receuivedAmount!: number;
  amountToChange!: number;
  quickAmounts: number[] = [10, 20, 50, 100, 200];

  constructor(
    public ref: DynamicDialogRef,
    private readonly dialogService: DialogService,
    private readonly messageService: MessageService,
    private readonly toasterService: ToastrService,
  ) {
    this.instance = this.dialogService.getInstance(this.ref);
  }

  ngOnInit(): void {
    this.onPaymentModalOpened();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.amountInput?.nativeElement?.focus(), 50);
  }

  onPaymentModalOpened() {
    if (this.instance?.data) {
      this.orderTotal = this.instance.data.orderTotal;
    }
  }

  onSelectingReceivedAmount() {
    this.amountToChange = parseFloat((this.receuivedAmount - this.orderTotal).toFixed(2));
  }

  pickQuickAmount(amount: number): void {
    this.receuivedAmount = amount;
    this.onSelectingReceivedAmount();
    setTimeout(() => this.amountInput?.nativeElement?.focus(), 0);
  }

  get isValid(): boolean {
    return this.receuivedAmount != null && this.receuivedAmount >= this.orderTotal;
  }

  onEnter(): void {
    if (this.isValid) this.submitPaymentModal();
  }

  closeModal() {
    this.ref.close();
  }

  submitPaymentModal(): void {
    if (!this.isValid) return;
    const paymentData: PaymentDetails = {
      orderTotal: this.orderTotal,
      amountToChange: this.amountToChange,
      receivedAmount: this.receuivedAmount,
    };
    this.ref.close(paymentData);
  }

  handleSuccessToast(message: string) {
    this.toasterService.success(message);
  }
}
