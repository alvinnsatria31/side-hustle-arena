# Dashboard Nav (A-Premium) + Leaderboard General Preview — Design Spec

Date: 2026-09-21
Status: approved by owner (A with premium design + leaderboard general on dashboard)
Scope: Arena participant chrome + Ringkasan dashboard only. No admin console changes.

## 1. Problem

Owner bingung: migrasi ke model "dashboard sidebar" penuh atau yang sekarang sudah enak.
Fakta: `AppChrome` sudah hybrid (sidebar dark 244px di `lg+` + topbar glass + bottom tab 5 item
di mobile). Pertanyaannya bukan bikin sidebar dari nol, melainkan full-dashboard vs rapikan hybrid.
Sebagai pemain: tile "Peringkat terbaik" statik tidak menjawab "di mana aku vs orang lain sekarang".

## 2. Decision

Opsi A — pertahankan hybrid, naikkan dashboard-feel-nya (recommended & approved).
Full sidebar collapsible (Opsi B) baru worth it kalau menu partisipan jadi 10+ item
(CV Scanner, Jobs, Store, Career Report, 360 semua masuk). Top-nav only (Opsi C) ditolak
karena tidak scalable.

## 3. Architecture (no new routes)

- Desktop `lg+`: `AppSidebar` = navigasi utama. `AppNavbar` = context bar
  (breadcrumb `Arena / {section}` + bell + avatar). Tidak ada link nav duplikat di desktop.
- Mobile: `MobileBottomNav` = navigasi utama (max 5 tab dari `bottomNavLinks().slice(0,5)`).
  Topbar mini (logo + bell + avatar). Sisa link di dropdown avatar (`md:hidden`).
- `/app/admin` by-pass chrome, tidak disentuh.
- Single source: `nav-links.ts` (`appNavLinks()` sidebar, `bottomNavLinks()` bottom tab).

## 4. Sidebar premium (desktop)

- Grouping: section `Arena` (Ringkasan, Jelajahi proyek, Proyekku, Peringkat) /
  `Lainnya` (Poin & hadiah, Tools). Label section mono 10px `#7d9abf`, spacing antar-section lega.
- Active: pill `#2a6bea` + glow (existing), icon stroke 2.3 saat active, hover `white/10`, transisi 200ms.
- Tools promo: satu-satunya highlight (gradient pill + badge BARU). Jangan tambah highlight lain.
- Footer: user card mini (avatar + nama + email dari `useParticipant`) + row Profil / Bantuan.
- `sticky top-0 h-screen`, scroll independen. Lebar 244px (260px xl). Non-collapsible.

## 5. Topbar slim premium

- Tinggi 64–68px, glass `white/90 + backdrop-blur`, border-b `sk-border`.
- Kiri: breadcrumb mono. Mapping section existing dipertahankan
  (Ringkasan, Proyekku, Jelajahi proyek, Peringkat, Profil, fallback Ruang kerja).
- Kanan: bell (badge unread, polling 60s, fail silent) + avatar button (ring on focus,
  nama truncate 9rem di `lg+`).
- Dropdown: rounded 16–20px, shadow-lg, header avatar+nama+email, item min-height 44px.
  Desktop: Admin (jika `isAdmin`) + Profil + Keluar. Mobile: + daftar link navigasi.
- Tidak ada search global, tidak ada link nav di topbar desktop.

## 6. Mobile bottom nav premium

- Max 5 tab, mapping `COLS` mengikuti jumlah tab (existing, dipertahankan).
- Glass white 95%, `safe-bottom`. Active: icon pill `sk-blue-tint` + label `sk-blue`.
  Inactive `sk-muted`. Target min 46px. Tidak jadi drawer.

## 7. Leaderboard General Preview (Ringkasan)

- Posisi: setelah `StatStrip`, sebelum "Jelajahi project lain".
  Loop pemain: Hero → Stat → Leaderboard (aku vs orang lain) → Explore.
- Card `LeaderboardPreview`: header (eyebrow "Papan peringkat", title weekCode,
  link "Lihat lengkap" → `/app/arena/leaderboard`) + top-3 compact rows
  (rank + `AvatarBadge` + nama + skor, poin secondary) + divider + row-ku
  (highlight `sk-blue-tint`, label "Kamu", gap skor ke #3).
- States: loading = skeleton 3 baris; error = silent + retry kecil (`ResourceState` pattern);
  unpublished (`WEEK_NOT_FOUND`/`WEEK_NOT_FINALIZED`) atau empty = status line
  "Peringkat minggu ini belum diumumkan…" + CTA ke workspace. Stale-while-refresh
  (`opacity-60`, jangan collapse).
- Data: reuse `getLeaderboard(week || undefined)` + `getParticipantOverview`. Tanpa endpoint baru.
- Mobile: list vertikal (bukan tabel scroll). Sidebar item Peringkat tetap;
  live-dot "baru final" default OFF (butuh flag sudah-dilihat, dibahas di plan).

## 8. Content & motion

- Container `max-w-6xl`, `px-4 → sm:6 → lg:8`, `pt-6/8`, `pb-28` mobile / `pb-16` desktop.
- `anim-fade-in` per pathname + `Suspense LoadingScreen` dipertahankan. Token `sk-*` tetap.

## 9. Data, edge cases

- Flow tidak berubah: `ParticipantProvider` → `useParticipant`/`useIsAdmin`,
  `getNotifications({limit:1})`. Avatar fallback inisial jika `avatarId` null.
- Flag-gated links disaring di `enabled()` (tidak ada link ke rute mati).
  Eksternal (Tools) & hash tidak pernah active.

## 10. Testing

- Breakpoint `lg` (sidebar muncul) / `md` (bottom nav & dropdown-mobile hilang).
- Keyboard: Escape tutup menu, focus-visible ring. SR: `aria-current="page"`,
  label notif dengan count, caption tabel leaderboard.
- Flag on/off: tab tidak kepotong. Week states: finalized / belum final / kosong / error.

## 11. Out of scope

Collapsible icon-only sidebar, search global, sidebar di mobile, ubah container,
ubah admin console, endpoint baru, live-dot default-on.

## 12. Trigger migrasi ke Opsi B

Jika menu partisipan jadi 10+ item dalam 2–3 bulan, revisit full dashboard sidebar.
