"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/primitives/Button";

export default function LoginPage() {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sk-bg px-6 py-24">
      <div className="ambient" aria-hidden />
      <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="relative z-[1] w-full max-w-md rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-8 shadow-sk-lg sm:p-9">
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-sk-muted transition-colors hover:text-sk-blue">
          <ArrowLeft size={14} aria-hidden /> Kembali ke beranda
        </Link>
        <span className="eyebrow">Masuk</span>
        <h1 className="mb-1.5 mt-2 text-[24px] font-extrabold tracking-[-0.02em] text-sk-navy">Lanjutkan perjalanan karirmu.</h1>
        <p className="mb-6 text-[13.5px] leading-relaxed text-sk-muted">
          Masuk dengan akun Sekolah Karir untuk menyimpan progress, bukti skill, dan Career Report kamu.
        </p>
        <ButtonLink href="/auth/login?returnTo=/app" size="lg" fullWidth>Masuk dengan akun Sekolah Karir</ButtonLink>
        <p className="mt-6 rounded-xl border border-dashed border-sk-blue-tint-border bg-sk-blue-wash px-4 py-3 text-[12px] leading-relaxed text-sk-body">
          Arena tidak menyimpan password. Autentikasi dilakukan aman melalui Sekolah Karir.
        </p>
      </motion.div>
    </div>
  );
}
