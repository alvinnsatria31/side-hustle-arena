# Ilustrasi "Cara ikut"

Tiga gambar untuk stepper di section `#cara-ikut` landing page
(`src/components/landing/CaraIkutStepper.tsx`).

| File | Langkah |
| --- | --- |
| `cara-ikut-01.png` | Pilih proyek |
| `cara-ikut-02.png` | Kerjakan dan unggah |
| `cara-ikut-03.png` | Dapat penilaian dan manfaatnya |

**Spesifikasi:** 1200 × 750 px (16:10), PNG, background putih atau `#f4f8ff`,
subjek di tengah dengan ruang kosong ±8% di tiap sisi (frame-nya `object-cover`,
jadi tepinya bisa terpotong sedikit di layar sempit).

Setelah file-nya ada, isi field `image` di `STEPS`:

```ts
image: { src: '/landing/cara-ikut-01.png', alt: 'Daftar brief minggu ini di Arena' },
```

Selama `image` masih `null`, yang tampil adalah frame putus-putus berisi nama
file yang ditunggu — bukan gambar rusak.

## Arahan gaya (dipakai di ketiga prompt)

Palet: biru `#246bfd` sebagai satu-satunya warna aksen, navy `#07152d` untuk
teks, biru muda `#ebf1ff` untuk bidang, putih untuk latar. Tanpa gradien
warna-warni, tanpa ungu, tanpa teks yang terbaca (huruf cukup jadi garis abu
samar), tanpa logo merek lain.

## Prompt

Prompt di bawah ditulis untuk model text-to-image (Midjourney, Imagen, DALL·E,
Flux). Untuk Midjourney tambahkan `--ar 16:10 --style raw --no text, words,
letters, logos, watermark`.

### 1 — Pilih proyek

> Clean flat vector illustration, 16:10, white background. Three stacked
> project brief cards floating at a slight angle, rounded corners, soft drop
> shadows; the middle card lifted forward and outlined in bright blue as if
> being picked. Each card shows abstract grey placeholder lines and one small
> blue tag chip — no readable text. A simple cursor or hand pointing at the
> lifted card. Strictly limited palette: bright blue #246bfd, pale blue #ebf1ff,
> deep navy #07152d, white. Minimal corporate illustration style, thin
> consistent strokes, generous white space, no gradients beyond one soft blue
> glow behind the lifted card, no text, no logos.

### 2 — Kerjakan dan unggah

> Clean flat vector illustration, 16:10, white background. A simplified laptop
> or browser window, rounded corners and a soft shadow, showing an abstract
> workspace: a brief panel on the left with grey placeholder lines, a file
> upload area on the right with a dashed blue border and an upward arrow. One
> file tile rising into the upload area along a small motion arc, and a thin
> blue progress bar nearing full. A small clock or deadline chip in a corner.
> Strictly limited palette: bright blue #246bfd, pale blue #ebf1ff, deep navy
> #07152d, white. Minimal corporate illustration style, thin consistent strokes,
> plenty of white space, no readable text, no logos, no photorealism.

### 3 — Dapat penilaian dan manfaatnya

> Clean flat vector illustration, 16:10, white background. A scorecard panel on
> the left listing four assessment criteria as short grey lines, each with a
> small blue filled progress bar and a blue check circle. On the right, two
> outcomes connected by thin blue lines: a points/coin badge and a portfolio
> card with a small abstract thumbnail. Balanced, calm composition, a soft blue
> glow behind the scorecard. Strictly limited palette: bright blue #246bfd,
> pale blue #ebf1ff, deep navy #07152d, white. Minimal corporate illustration
> style, thin consistent strokes, no trophies or confetti, no readable text, no
> logos.
