import { notFound } from 'next/navigation';
import { Lock, Sparkles } from 'lucide-react';
import { ButtonLink } from '@/components/primitives/Button';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { requireCurrentUser } from '@/server/auth';
import { isStoreEnabled } from '@/server/store/config';
import { hasEntitlement } from '@/server/store/entitlement-service';

export const metadata = { title: 'Penilaian 360' };
export const dynamic = 'force-dynamic';

/**
 * Sistem Penilaian 360 — the first ACCESS product, and a placeholder.
 *
 * The lock is real; the room behind it is empty. That order is deliberate. The
 * gate, the entitlement it reads and the product that grants it are the parts
 * that are hard to add later, so they exist now and are exercised by a page
 * that says plainly it is not finished. Building the application means filling
 * in `Workspace` below — nothing above it has to change, and nothing in the shop
 * has to know.
 *
 * The feature key is `app-360`, registered in
 * `featurePaths` (src/server/store/entitlement-service.ts).
 */
const FEATURE_KEY = 'app-360';

export default async function Assessment360Page() {
  if (!isStoreEnabled()) notFound();
  const user = await requireCurrentUser();
  const unlocked = await hasEntitlement(user.id, FEATURE_KEY);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <h1 className="text-2xl font-extrabold text-sk-navy">Sistem Penilaian 360°</h1>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-sk-muted">
        Umpan balik melingkar untuk tim: atasan, rekan setim, dan diri sendiri menilai lewat rubrik yang sama.
      </p>
      <div className="mt-6">{unlocked ? <Workspace /> : <Locked />}</div>
    </div>
  );
}

/** What a buyer sees. Replace this with the application itself. */
function Workspace() {
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-sk-xl)] bg-sk-success-tint text-sk-success">
        <Sparkles size={24} strokeWidth={1.8} aria-hidden />
      </div>
      <PanelHeading className="justify-center">Akses aktif</PanelHeading>
      <h2 className="mb-2 text-lg font-bold text-sk-navy">Aksesmu sudah aktif.</h2>
      <p className="mx-auto max-w-md text-[13.5px] leading-relaxed text-sk-muted">
        Aplikasi penilaian 360° masih dalam pembangunan. Kamu akan mendapat notifikasi begitu siklus penilaian pertama
        bisa dibuat — tidak perlu membeli ulang, akses ini sudah tercatat atas namamu.
      </p>
    </Card>
  );
}

/** What everybody else sees: why they cannot be here, and the way in. */
function Locked() {
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-sk-xl)] bg-sk-track text-sk-muted">
        <Lock size={22} strokeWidth={1.8} aria-hidden />
      </div>
      <h2 className="mb-2 text-lg font-bold text-sk-navy">Akses terkunci</h2>
      <p className="mx-auto mb-5 max-w-md text-[13.5px] leading-relaxed text-sk-muted">
        Sistem penilaian 360° adalah produk terpisah. Beli aksesnya di katalog produk digital untuk membuka halaman ini.
      </p>
      <ButtonLink href="/store/sistem-penilaian-360">Lihat produknya</ButtonLink>
    </Card>
  );
}
