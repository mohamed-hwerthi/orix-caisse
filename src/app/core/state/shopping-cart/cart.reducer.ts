// cart.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { addItem, clearCart, decrementItem, incrementItem, removeItem, setItemQuantity } from './cart.actions';
import { MenuItem } from '../../models';

export interface CartItem extends MenuItem {
  quantityToSale: number;
}

export interface CartState {
  items: CartItem[];
}

const rawInitial: any[] = JSON.parse(localStorage.getItem('cart') || '[]');
const initialCartItems: CartItem[] = rawInitial.map((it) => ({
  ...it,
  quantityToSale: it.quantityToSale && it.quantityToSale > 0 ? it.quantityToSale : 1,
}));

export const initialCartState: CartState = {
  items: initialCartItems,
};

export const cartReducer = createReducer(
  initialCartState,
  // Add → if item already in cart, increment its quantity instead of duplicating.
  on(addItem, (state, { item }) => {
    const existing = state.items.find((i) => i.id === item.id);
    if (existing) {
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === item.id ? { ...i, quantityToSale: (i.quantityToSale || 1) + 1 } : i,
        ),
      };
    }
    return { ...state, items: [...state.items, { ...(item as CartItem), quantityToSale: 1 }] };
  }),
  on(incrementItem, (state, { itemId }) => ({
    ...state,
    items: state.items.map((i) =>
      i.id === itemId ? { ...i, quantityToSale: (i.quantityToSale || 1) + 1 } : i,
    ),
  })),
  on(decrementItem, (state, { itemId }) => ({
    ...state,
    items: state.items
      .map((i) =>
        i.id === itemId ? { ...i, quantityToSale: Math.max(1, (i.quantityToSale || 1) - 1) } : i,
      ),
  })),
  on(setItemQuantity, (state, { itemId, quantity }) => ({
    ...state,
    items: state.items.map((i) =>
      i.id === itemId ? { ...i, quantityToSale: quantity > 0 ? quantity : 1 } : i,
    ),
  })),
  on(removeItem, (state, { itemId }) => ({ ...state, items: state.items.filter((item) => item.id !== itemId) })),
  on(clearCart, (state) => ({ ...state, items: [] })),
);
