import { createAction, props } from '@ngrx/store';
import { MenuItem } from '../../models';

export const addItem = createAction('[Cart] Add Item', props<{ item: MenuItem }>());
export const incrementItem = createAction('[Cart] Increment Item', props<{ itemId: number }>());
export const decrementItem = createAction('[Cart] Decrement Item', props<{ itemId: number }>());
export const setItemQuantity = createAction(
  '[Cart] Set Item Quantity',
  props<{ itemId: number; quantity: number }>(),
);
export const removeItem = createAction('[Cart] Remove Item', props<{ itemId: number }>());
export const clearCart = createAction('[Cart] Clear Cart');
export const loadCartFromStorage = createAction('[Cart] Load Cart From Storage', props<{ items: MenuItem[] }>());
