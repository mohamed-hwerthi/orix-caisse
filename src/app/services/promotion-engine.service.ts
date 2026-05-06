import { Injectable } from '@angular/core';
import { MenuItem, Promotion } from '../core/models';

export interface AppliedPrice {
  unitPrice: number;
  promotion: Promotion | null;
  discount: number;
}

@Injectable({ providedIn: 'root' })
export class PromotionEngineService {
  private activePromotions: Promotion[] = [];

  setActivePromotions(promos: Promotion[]): void {
    const today = new Date();
    this.activePromotions = promos.filter((p) => {
      if (!p.isActive) return false;
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      end.setHours(23, 59, 59, 999);
      return start <= today && today <= end && !p.promoCode;
    });
  }

  getApplicableForItem(item: MenuItem): Promotion | null {
    const matching = this.activePromotions.filter((p) => this.matches(p, item));
    if (matching.length === 0) return null;
    return matching.reduce((best, cur) =>
      this.discountFor(cur, item.price) > this.discountFor(best, item.price) ? cur : best,
    );
  }

  computePrice(item: MenuItem): AppliedPrice {
    const promo = this.getApplicableForItem(item);
    if (!promo) {
      return { unitPrice: item.price, promotion: null, discount: 0 };
    }
    const newPrice = this.applyTo(promo, item.price);
    return {
      unitPrice: round2(newPrice),
      promotion: promo,
      discount: round2(item.price - newPrice),
    };
  }

  computeWithCode(item: MenuItem, codePromo: Promotion | null): AppliedPrice {
    const auto = this.getApplicableForItem(item);
    const candidates: Promotion[] = [];
    if (auto) candidates.push(auto);
    if (codePromo && this.matches(codePromo, item)) candidates.push(codePromo);

    if (candidates.length === 0) {
      return { unitPrice: round2(item.price), promotion: null, discount: 0 };
    }
    const best = candidates.reduce((a, b) =>
      this.discountFor(b, item.price) > this.discountFor(a, item.price) ? b : a,
    );
    const newPrice = this.applyTo(best, item.price);
    return {
      unitPrice: round2(newPrice),
      promotion: best,
      discount: round2(item.price - newPrice),
    };
  }

  private matches(p: Promotion, item: MenuItem): boolean {
    const noTarget = p.menuItemIds.length === 0 && p.categoryIds.length === 0;
    if (noTarget) return true;
    if (p.menuItemIds.includes(item.id)) return true;
    if (p.categoryIds.length && item.categories?.some((c) => p.categoryIds.includes(c.id))) return true;
    return false;
  }

  private applyTo(p: Promotion, price: number): number {
    switch (p.type) {
      case 'PERCENT':
        return Math.max(0, price * (1 - p.value / 100));
      case 'FIXED_AMOUNT':
        return Math.max(0, price - p.value);
      case 'FIXED_PRICE':
        return Math.max(0, p.value);
    }
  }

  private discountFor(p: Promotion, price: number): number {
    return price - this.applyTo(p, price);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
