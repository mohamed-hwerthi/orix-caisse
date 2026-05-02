import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
export class PaymentCreateModalComponent implements OnInit {
  [x: string]: any;
  orderTotal!: number;
  instance: DynamicDialogComponent | undefined;
  receuivedAmount!: number;
  amountToChange!: number;
  quickAmounts: number[] = [10, 20, 50, 100, 200];

  constructor(
    public ref: DynamicDialogRef,
    private readonly dialogService: DialogService,
    private readonly messageService: MessageService,
    private readonly toasterService:ToastrService
  ) {
    this.instance = this.dialogService.getInstance(this.ref);
  }
  ngOnInit(): void {
    this.onPaymentModalOpened();
  }

  onPaymentModalOpened() {
    if (this.instance?.data) {
      this.orderTotal = this.instance.data.orderTotal;
    }
  }
  onSelectingReceivedAmount() {
    this.amountToChange = parseFloat((this.receuivedAmount - this.orderTotal).toFixed(2)); // this.receuivedAmount - this.orderTotal
  }
  closeModal() {
    this.ref.close();
  }

  submitPaymentModal(): void {
    let paymentData: PaymentDetails = {
      orderTotal: this.orderTotal,
      amountToChange: this.amountToChange,
      receivedAmount: this.receuivedAmount,
    };
    this.handleSuccessToast('Les données de Payment sont bien Enregistrés  ');
    this.ref.close(paymentData);
  }

  handleSuccessToast(message: string) {
    this.toasterService.success(message)
  }
}
