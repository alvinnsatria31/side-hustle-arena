import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/primitives/Button";
import { Entrance } from "@/components/motion/Reveal";
import { PARTICIPANT_COOKIE, verifyParticipantToken } from "@/server/auth/participant-token";

export const metadata = { title: "Masuk" };
export const dynamic = "force-dynamic";

/**
 * The sign-in card.
 *
 * There is no form here and there never will be: the Arena verifies the Sekolah
 * Karir participant session and issues none of its own, so the only control on
 * this page is the door to the main site's gate. See
 * docs/backend/PARTICIPANT_SESSION.md.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Already holding a valid participant cookie? Then this page has nothing to
  // offer. Checked from the token alone, with no database round trip, so the
  // sign-in page stays reachable even when the Arena's own storage is not.
  //
  // `redirect()` signals by throwing, so it must stay outside the try: catching
  // it here would swallow the redirect and render the card to a signed-in
  // participant instead.
  let signedIn = false;
  try {
    signedIn = (await verifyParticipantToken((await cookies()).get(PARTICIPANT_COOKIE)?.value)) !== null;
  } catch {
    // A missing SESSION_SECRET is a broken deployment, not a signed-out
    // visitor. Show the gate rather than a stack trace.
  }
  if (signedIn) redirect("/app");

  const failed = (await searchParams).error === "auth_failed";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sk-bg px-6 py-24">
      <div className="ambient" aria-hidden />
      <Entrance className="relative z-[1] w-full max-w-md rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-8 shadow-sk-lg sm:p-9">
        <Link
          href="/"
          className="mb-6 flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-sk-muted transition-colors hover:text-sk-blue"
        >
          <ArrowLeft size={14} aria-hidden /> Kembali ke beranda
        </Link>
        <span className="eyebrow">Masuk</span>
        <h1 className="mb-1.5 mt-2 text-[24px] font-extrabold tracking-[-0.02em] text-sk-navy">
          Lanjutkan perjalanan karirmu.
        </h1>
        <p className="mb-6 text-[13.5px] leading-relaxed text-sk-muted">
          Masuk dengan akun Sekolah Karir untuk menyimpan progress, bukti skill, dan Career Report kamu.
        </p>
        {failed ? (
          <p
            role="alert"
            className="mb-5 border-l-2 border-sk-error bg-sk-error-wash px-4 py-3 text-[12.5px] leading-relaxed text-sk-error"
          >
            Sesi kamu tidak bisa diverifikasi. Silakan masuk lagi.
          </p>
        ) : null}
        <ButtonLink href="/auth/login" size="lg" fullWidth>
          Masuk dengan akun Sekolah Karir
        </ButtonLink>
        <p className="mt-6 rounded-xl border border-dashed border-sk-blue-tint-border bg-sk-blue-wash px-4 py-3 text-[12px] leading-relaxed text-sk-body">
          Arena tidak menyimpan password. Autentikasi dilakukan aman melalui Sekolah Karir.
        </p>
      </Entrance>
    </div>
  );
}
