/**
 * Meta Pixel: tells Meta Ads which visitors arrived, and which pages they saw.
 *
 * Loaded from our own code rather than pasted in as Meta's snippet, for four
 * reasons the snippet cannot offer:
 *
 *   • It can be switched off, or pointed at another pixel, from the admin
 *     panel on the main site (Pengaturan → Meta Pixel) - no deploy here. The
 *     answer is fetched from CONFIG_URL.
 *   • It stays off the pages listed in PRIVATE_PREFIXES. The pixel reports the
 *     full address of the page it runs on, and what an admin opens in the
 *     console is not Meta's to know.
 *   • It only runs on the real domain, so local development and preview builds
 *     do not show up in the ad account as visitors.
 *   • Automatic event detection is off. Left on, the pixel scrapes button text
 *     and page metadata on its own initiative; here it sends only what this
 *     file is asked to send.
 */

/** Served by the main site, which owns the setting. Open to any origin. */
const CONFIG_URL = 'https://www.sekolahkarir.id/api/meta-pixel';

const PRODUCTION_DOMAIN = 'sekolahkarir.id';

/** The admin console, under both of its addresses. */
const PRIVATE_PREFIXES = ['/app/admin', '/admin'];

type MetaEvent = 'PageView';

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState: boolean;
  allowDuplicatePageViews: boolean;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

function isValidMetaPixelId(value: string): boolean {
  return /^\d{10,20}$/.test(value);
}

export function isProductionHost(hostname: string): boolean {
  return hostname === PRODUCTION_DOMAIN || hostname.endsWith(`.${PRODUCTION_DOMAIN}`);
}

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * The pixel to report to, or null when the admin switch is off.
 *
 * `undefined` means not asked yet. Anything short of a clean answer - a failed
 * request, an error status, a malformed body - settles as null: when in doubt
 * this does not track.
 */
let pixelId: string | null | undefined;
let asking: Promise<void> | null = null;

async function askForPixelId(): Promise<void> {
  try {
    const res = await fetch(CONFIG_URL);
    const data = res.ok ? ((await res.json()) as { enabled?: unknown; pixelId?: unknown }) : null;
    pixelId =
      data?.enabled === true && typeof data.pixelId === 'string' && isValidMetaPixelId(data.pixelId)
        ? data.pixelId
        : null;
  } catch {
    pixelId = null;
  }
}

/**
 * Meta's loader, restated. Calls made before fbevents.js arrives are queued and
 * replayed by it, so nothing here has to wait for the network.
 */
function loadPixel(id: string): Fbq {
  if (window.fbq) return window.fbq;

  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  // Page views are sent by MetaPixel on each route change instead, so that the
  // private pages can be skipped. Must be set before fbevents.js loads.
  fbq.disablePushState = true;
  // Without this Meta keeps the first PageView of a tab and silently drops every
  // later one, so a visitor who clicks through five pages would count as one.
  fbq.allowDuplicatePageViews = true;
  window.fbq = fbq;
  window._fbq ??= fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  fbq('set', 'autoConfig', false, id);
  fbq('init', id);
  return fbq;
}

function send(name: MetaEvent): void {
  // Checked here, at the moment of sending, and not only when the event was
  // asked for: the pixel reports whatever address the tab is on right now, and
  // an event that waited on the settings request may be sent a page later.
  if (!pixelId || isPrivatePath(window.location.pathname)) return;

  try {
    loadPixel(pixelId)('track', name);
  } catch {
    // Blocked or broken tracker. The visitor's page carries on.
  }
}

/**
 * Send one event to Meta. A no-op off the production domain, on private pages
 * and while the admin switch is off, and never throws: an ad tracker must not
 * break the page it measures.
 */
export function trackMetaEvent(name: MetaEvent): void {
  if (typeof window === 'undefined') return;
  if (!isProductionHost(window.location.hostname)) return;
  if (isPrivatePath(window.location.pathname)) return;

  // Settings already known: send now, while the tab is still on the page the
  // event belongs to.
  if (pixelId !== undefined) return send(name);

  asking ??= askForPixelId();
  void asking.then(() => send(name));
}
