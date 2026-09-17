'use client';

import { participantRequest } from './participant-client';
import type { StoreListItem, StoreProductDetail } from '@/server/store/catalog-service';
import type { CheckoutResult, OrderSummary } from '@/server/store/checkout-service';
import type { OwnedProduct } from '@/server/store/entitlement-service';
import type { Delivery } from '@/server/store/delivery-service';

export type { StoreListItem, StoreProductDetail, CheckoutResult, OrderSummary, OwnedProduct, Delivery };

/**
 * The shop, from the browser.
 *
 * Rides `participantRequest` rather than growing a second fetch wrapper: the
 * shop speaks the same `{ data }` / `{ error }` contract as every other Arena
 * endpoint, and one place that knows how to unwrap it is enough.
 */

export const getStoreCatalog = () =>
  participantRequest<{ items: StoreListItem[]; owned: string[]; rupiahAvailable: boolean }>('/api/store/products');

export const getStoreProduct = (slug: string) =>
  participantRequest<{ product: StoreProductDetail; owned: boolean }>(`/api/store/products/${encodeURIComponent(slug)}`);

export const startStoreCheckout = (slug: string, paymentMethod: 'IDR' | 'POINTS') =>
  participantRequest<{ checkout: CheckoutResult }>('/api/store/checkout', {
    method: 'POST',
    body: JSON.stringify({ slug, paymentMethod }),
  });

export const getStoreLibrary = () =>
  participantRequest<{ owned: OwnedProduct[]; orders: OrderSummary[] }>('/api/store/library');

export const deliverStoreProduct = (slug: string) =>
  participantRequest<{ delivery: Delivery }>(`/api/store/library/${encodeURIComponent(slug)}/download`, { method: 'POST' });

/** Whole rupiah from minor units: 14900000 → "Rp 149.000". */
export function formatIdrMinor(amountMinor: number): string {
  return `Rp ${Math.round(amountMinor / 100).toLocaleString('id-ID')}`;
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, callbacks: {
        onSuccess?: (result: unknown) => void;
        onPending?: (result: unknown) => void;
        onError?: (result: unknown) => void;
        onClose?: () => void;
      }) => void;
    };
  }
}

const SNAP_SCRIPT_ID = 'midtrans-snap';

/**
 * Load Snap's script on demand.
 *
 * Not in the root layout: it is a third-party script on somebody else's CDN,
 * and every visitor who never buys anything would pay for it on every page.
 * Loaded once, the promise is resolved by the tag already in the document on
 * every later call.
 */
export function loadSnap(clientKey: string, environment: 'sandbox' | 'production'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Snap needs a browser.'));
    if (window.snap) return resolve();

    const existing = document.getElementById(SNAP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Snap gagal dimuat.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SNAP_SCRIPT_ID;
    script.src = environment === 'production'
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', clientKey);
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Snap gagal dimuat.')), { once: true });
    document.head.appendChild(script);
  });
}
