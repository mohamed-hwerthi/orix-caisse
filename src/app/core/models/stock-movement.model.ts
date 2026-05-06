export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'LOSS' | 'SALE';

export interface StockMovement {
  id?: number;
  menuItemId: number;
  menuItemTitle?: string;
  type: StockMovementType;
  quantity: number;
  stockBefore?: number;
  stockAfter?: number;
  reason?: string;
  referenceDoc?: string;
  userEmail?: string;
  createdAt?: string;
}
