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
  /** Shown in the public catalog. Off unless the owner switches it on. */
  showInCatalog?: boolean;
}

/**
 * A photo after the cover, of a product or of one of its colours (src/domain/photos.ts). The
 * covers stay in Product.photo and Variant.photo, so a product record stays small and screens
 * that show one photo (Sell, cart, receipts) never need these.
 */
export interface ProductPhoto extends BaseRecord {
  productId: Id;
  /** The colour it belongs to, or null for the product's own photos. */
  variantId: Id | null;
  /** 1, 2, … after the cover. */
  position: number;
  /** Square JPEG as a data URL; '' once deleted, so a deleted photo takes no space. */
  photo: string;
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
  /** The "Make an invoice" box: the buyer gets an Invoice and a Payment receipt (src/domain/documents.ts). */
  invoice?: boolean;
  /**
   * An invoiced order waiting for payment: no payments yet, its pieces are held for the buyer,
   * and it isn't a sale (Home, Reports) until it's marked paid.
   */
  notPaid?: boolean;
  /** When it was marked paid. Orders paid at checkout leave it out: they were paid when placed. */
  paidAt?: string;
}

/** A bank or e-wallet account the invoice asks the buyer to pay into. */
export interface PayAccount {
  id: Id;
  /** GCash, BPI, … */
  bank: string;
  accountName: string;
  number: string;
}

/**
 * The shop's own details for invoices and receipts: one record (SHOP_ID), synced like the rest.
 * Kept in the data, not the code, because the repository is public.
 */
export interface ShopDetails extends BaseRecord {
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  accounts: PayAccount[];
  /** The payment QR code as a JPEG data URL, or null. */
  qrPhoto: string | null;
}

export interface Collections {
  products: Product;
  categories: Category;
  events: ShopEvent;
  orders: Order;
  stock: StockAdjustment;
  photos: ProductPhoto;
  shop: ShopDetails;
}

export type CollectionName = keyof Collections;

export const COLLECTIONS: CollectionName[] = ['products', 'categories', 'events', 'orders', 'stock', 'photos', 'shop'];

/** The one ShopDetails record. */
export const SHOP_ID = '00000000-0000-4000-8000-000000000002';

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
