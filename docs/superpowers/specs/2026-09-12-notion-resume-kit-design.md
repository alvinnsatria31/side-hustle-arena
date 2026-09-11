# Reward content: Template Notion & Resume Starter Kit

**Date:** 2026-09-12
**Reward:** `notion-kit` (DIGITAL, 300 points, UNLIMITED)

## Goal

Produce the actual deliverable behind the `notion-kit` reward, which until now existed only as a catalog row. A participant who claims it receives one link and can start using everything within minutes.

## Audience

Arena participants: university students, final-year students, fresh graduates, and entry-to-junior career switchers in Indonesia.

## Decisions

- **One delivery link.** A single Notion page, published with "Allow duplicate as template". The admin pastes this link as the fulfilment note when marking the claim FULFILLED. No code change is needed for delivery.
- **Tracker lives in Notion** (board by status, full table, follow-up calendar, status chart). An `.xlsx` copy is attached for participants who do not use Notion; it also opens in Google Sheets.
- **Resumes are Word files, not Notion pages.** Notion's PDF export is not precise enough for a one-page resume. Two `.docx` templates, Bahasa Indonesia and English, each with a PDF preview.
- **Branding stays off the resume.** Sekolah Karir branding appears on the Notion page (banner, icon, callouts) and the Excel title rows, never inside the resume body that goes to employers.
- **Arena tie-in.** Both resumes have a "Projects & skill evidence" section with an example entry for a Side Hustle Arena project.

## Notion page structure

1. Branded banner (brand blue `#246bfd`, navy `#07152d`, Manrope), Sekolah Karir logo as the icon.
2. Welcome callout: this is a Side Hustle Arena reward, and how to duplicate the page.
3. "Mulai dari sini": three first steps as to-dos.
4. Inline database **Lamaran Kerja** with example rows marked as examples.
   - Properties: Posisi (title), Perusahaan, Status, Prioritas, Sumber, Tipe, Tanggal Apply, Follow-up, Link Lowongan, Versi CV, Kontak, Ekspektasi Gaji (rupiah), Next Step, Hari Sejak Apply (formula).
   - Status pipeline: Wishlist, Sudah Apply, Screening HR, Tes / Case Study, Interview User, Offer, Diterima, Ditolak, Tidak Ada Kabar.
   - Views: Board (by Status), Semua Lamaran (table), Jadwal Follow-up (calendar), Statistik (chart).
   - Each example row carries a per-application note structure: about the role, why I fit, interview notes, questions for HR, outcome.
5. Excel download.
6. Sub-page **Resume Starter Kit**: resume files and previews, one-page structure, bullet formula with before/after examples, how to list an Arena project, pre-send ATS checklist, action verbs (ID/EN), common mistakes, file naming.
7. Toggle **Cara pakai tracker**: what each status means, a weekly 15-minute routine.

## Resume format (ATS-safe)

A4, single column, no tables, text boxes, or images; contact details in the body, not the page header; standard fonts; section headings as plain text with a rule; dates right-aligned by tab stop; must fit on one page (verified by converting to PDF).

## Excel format

Title rows in brand colours; a filterable table with drop-down validation for Status/Prioritas/Sumber/Tipe; colour by status; "Hari Sejak Apply" and "Perlu Follow-up" formulas; a summary sheet (counts per status, response rate); a how-to sheet.

## Source and files

`docs/rewards/notion-resume-kit/` holds the generator (`build_kit.py`), the banner source (`cover.html`, `render-cover.mjs`), and the brand assets. Generated files land in `dist/`, which the repository ignores; the copies participants receive are the ones attached in Notion.

To regenerate: `python docs/rewards/notion-resume-kit/build_kit.py` and `node docs/rewards/notion-resume-kit/render-cover.mjs`, then export each `.docx` to PDF in Word and confirm it is still one page before re-uploading.

The Notion page lives in the owner's workspace as a private draft: https://app.notion.com/p/3d8e44db112d81a5a8c8fd8dcd40651a

## Manual steps left to the owner

- In Notion: Share → Publish → enable "Allow duplicate as template", then copy the public link. The API cannot toggle this.
- Optional: make the banner a real page cover (Add cover → Upload → `dist/notion-cover.png`). The API only accepts external image URLs for covers, so the banner is placed as the first image block instead.
- When fulfilling a `notion-kit` claim, paste that link as the fulfilment note.

## Out of scope

- Making links in the fulfilment note clickable on the profile (a separate code change and deploy).
- The e-book and the remaining four rewards.
