import {
  type Address,
  type Cart,
  type Drawing,
  type Order,
  type PaymentMethod,
  type Price,
  type Product,
  type Subscription,
} from '@datalking/pivot-app-shared-lib';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface ShopState {
  products?: Product[];
  loaded?: boolean;
  items: Cart[];
  orders: Order[];
  subscriptions?: Subscription[];
  selectedSubscriptionProduct?: Partial<Product & Price>;
  addresses?: Address[];
  paymentMethods?: PaymentMethod[];
  showCart?: boolean;
  showCheckout?: boolean;
  receipt?: Order;
  activeItem?: Drawing;
  shippingAddressId?: string;
  billingAddressId?: string;
  paymentMethodId?: string;
  activeStep: number;
  steps: Record<string, boolean>;
}

export const initialState: ShopState = {
  items: [],
  orders: [],
  activeStep: 0,
  steps: {},
};

export const shopSlice = createSlice({
  name: 'shop',
  initialState,
  reducers: {
    patch(state, action: PayloadAction<Partial<ShopState>>) {
      return { ...state, ...action.payload };
    },
    stepStatus(state, payload: PayloadAction<Record<string, boolean>>) {
      state.steps = { ...state.steps, ...payload.payload };
    },
  },
});

export const { patch, stepStatus } = shopSlice.actions;
export const actions = shopSlice.actions;

export const shopReducer = shopSlice.reducer;
export default shopReducer;
