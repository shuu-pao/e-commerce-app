// Records the app stores and syncs. Money is always whole centavos.

export type Id = string;
export type Cents = number;

export interface BaseRecord {
  id: Id;
  /** ISO time of the last change; the newer side wins when syncing. */
  updatedAt: string;
  deleted?: boolean;
}

export interface Category extends BaseRecord {
  name: string;
}

/** A colour of a product. A product without colours has one variant named ''. */
export interface Variant {
  id: Id;
  name: string;
  /** Square JPEG as a data URL, or null. */
  photo: string | null;
}

export interface Product extends BaseRecord {
  name: string;
  description: string;
  price: Cents;
  categoryIds: Id[];
  photo: string | null;
  variants: Variant[];
}

export interface ShopEvent extends BaseRecord {
  name: string;
  /** YYYY-MM-DD, optional. */
  startDate: string | null;
  endDate: string | null;
}

/** One change to a variant's stock. Stock left = sum of deltas - pieces sold. */
export interface StockAdjustment extends BaseRecord {
  productId: Id;
  variantId: Id;
  delta: number;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'gcash' | 'qr' | 'bpi';

export interface Payment {
  method: PaymentMethod;
  amount: Cents;
}

export type Discount =
  | { kind: 'none' }
  | { kind: 'percent'; percent: number }
  | { kind: 'amount'; amount: Cents };

/** A snapshot of what was sold, so later product edits don't change past orders. */
export interface OrderLine {
  productId: Id;
  variantId: Id;
  name: string;
  variantName: string;
  price: Cents;
  qty: number;
}

export interface Buyer {
  name: string;
  address: string;
}

export interface Order extends BaseRecord {
  number: number;
  createdAt: string;
  eventId: Id | null;
  lines: OrderLine[];
  discount: Discount;
  deliveryFee: Cents;
  payments: Payment[];
  /** Cash the buyer handed over, to work out the change. */
  cashReceived: Cents | null;
  buyer: Buyer | null;
}

export interface Collections {
  products: Product;
  categories: Category;
  events: ShopEvent;
  orders: Order;
  stock: StockAdjustment;
}

export type CollectionName = keyof Collections;

export const COLLECTIONS: CollectionName[] = ['products', 'categories', 'events', 'orders', 'stock'];

/** The permanent event that holds online (Instagram) orders. */
export const ONLINE_EVENT_ID = '00000000-0000-4000-8000-000000000001';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'gcash', label: 'GCash' },
  { id: 'qr', label: 'QR code' },
  { id: 'bpi', label: 'BPI' },
];

export function paymentLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.id === method)?.label ?? method;
}
