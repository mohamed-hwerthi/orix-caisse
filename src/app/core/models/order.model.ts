export interface Order {
  id: string;
  userEmail: string;
  menuItemQuantities: { [menuItemId: number]: number };
  totalCost: number;
  originalAmount?: number;
  discountAmount?: number;
  appliedPromotionIds?: number[];
  createdOn: Date;
  paid: boolean;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
}

// New OrderSubmission model for API submission
export interface OrderSubmission {
  userEmail: string;
  menuItemQuantities: { [menuItemId: number]: number };
  createdOn: string;
  paid: boolean;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  promoCode?: string;
  paymentMethod?: 'CASH' | 'CARD' | 'MIXED' | 'CHECK' | 'OTHER';
}
