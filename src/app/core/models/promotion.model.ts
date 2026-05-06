export type PromotionType = 'PERCENT' | 'FIXED_AMOUNT' | 'FIXED_PRICE';

export interface Promotion {
  id?: number;
  name: string;
  description?: string;
  type: PromotionType;
  value: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  promoCode?: string;
  maxUses?: number;
  usesCount?: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  firstOrderOnly?: boolean;
  oncePerUser?: boolean;
  menuItemIds: number[];
  categoryIds: number[];
}
