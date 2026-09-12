# Reward content: Template Notion & Resume Starter Kit

**Date:** 2026-09-12 (revised the same day into the premium version)
**Reward:** `notion-kit` (DIGITAL, 300 points, UNLIMITED)

## Goal

Produce the actual deliverable behind the `notion-kit` reward, which until now existed only as a catalog row. A participant who claims it receives one link and can start using everything within minutes.

## Audience

Arena participants: university students, final-year students, fresh graduates, and entry-to-junior career switchers in Indonesia, across the three Arena divisions (Data, Design, Product).

## Design rules

The owner asked for a premium kit that does not read as generated. Every page follows these rules:

- Two colours only, Sekolah Karir blue and neutral grey. No multi-coloured callouts.
- Native Notion icons in one colour instead of emoji. No emoji in headings or view names.
- Short, concrete copy in the second person. No hype words and no exclamation marks.
- Example data is fictional but plausible: invented companies, realistic numbers, no "PT Contoh".
- One idea per section. Reference material (verbs, common mistakes) sits in toggles.

## Decisions

- **One delivery link.** The owner publishes the home page with "Allow duplicate as template" and pastes that link as the fulfilment note. No code change is needed for delivery.
- **Resumes are Word files, not Notion pages.** Notion's PDF export is not precise enough for a one-page resume.
- **Branding stays off the resume.** Sekolah Karir appears on the Notion pages, the banner, and the Excel title rows, never inside a resume that goes to employers.
- **No hyperlinks in the resumes.** A participant who retypes the visible text would keep a link to somebody else's profile.
- **No interview-preparation guide.** That belongs to the next reward, the E-Book (600 points).

## Notion structure

**Job Hunt Starter Kit** (home) is a dashboard:

1. One grey line naming the reward, then four navigation cards: Tracker Lamaran, Resume Kit, Template Pesan, Cara Pakai.
2. **Perlu ditindaklanjuti**: a linked list of applications whose follow-up is overdue, due today, or due within three days.
3. **Pipeline**: a linked board of active applications.

**Tracker Lamaran** holds stacked linked views, each under its own heading: Pipeline (board), Perlu ditindaklanjuti (list), Kalender follow-up (calendar), Statistik (bar chart), Semua lamaran (table). The source database sits at the bottom as a sub-page. Linked views are used because the API cannot reorder a database's own tabs, and the first tab a participant sees should be the board.

The **Lamaran Kerja** database has these properties: Posisi, Perusahaan, Status, Prioritas, Sumber, Tipe, Lokasi Kerja, Tanggal Apply, Follow-up, Deadline Lamaran, Ekspektasi Gaji (rupiah), Versi CV, Kontak, Link Lowongan, Next Step, and two formulas:

- **Tindak Lanjut** returns a styled label: "Terlambat" (red), "Follow-up hari ini" (orange), "N hari lagi" for up to three days ahead (blue), or "Waktunya follow-up" (orange) when an application is seven days past Sudah Apply with no follow-up date set. It is empty once the status is Diterima, Ditolak, or Tidak Ada Kabar.
- **Hari Sejak Apply** shows the days since the application in grey.

The status pipeline is Wishlist, Sudah Apply, Screening HR, Tes / Case Study, Interview User, Offer, Diterima, Ditolak, Tidak Ada Kabar. Seven example rows cover all three divisions and every active status. Each example row carries the same note structure: Lowongan (with a toggle for the full job description), Kenapa aku cocok, Persiapan, Catatan proses, Pertanyaan untuk mereka, Hasil & pelajaran.

**Resume Kit**:

- Tabs for Data, Design, and Product. Each tab has two columns, Bahasa Indonesia and English, and each column holds a preview image and the .docx file.
- Guidance below the tabs:
  - One-page anatomy.
  - Bullet formula with before/after examples.
  - How to list an Arena project, with one example per division.
  - Pre-send checklist.
  - Action verbs and common mistakes, in toggles.

**Template Pesan**: six situations, each with an Indonesian tab and an English tab holding copyable code blocks:

1. Application email
2. Follow-up
3. LinkedIn referral request, with a 300-character connection note and a follow-up message
4. Thank-you note after an interview
5. Asking for interview results
6. Replying to an offer: negotiate, accept, or decline

**Cara Pakai**:

- First-time setup.
- The five-step flow for one application.
- What each status and each Tindak Lanjut label means.
- The weekly routine.
- The Excel download.

## Resume format (ATS-safe)

- **Page and layout:** A4, one column, and no tables, text boxes, images, headers, or hyperlinks.
- **Font and colour:** Arial throughout, with one deep blue accent for the headline and section titles.
- **Headings:** section titles use Word's Heading 1 style so parsers and the navigation pane read the outline.
- **Language:** the document language is set per version (id-ID or en-US), so spell-check does not flag an Indonesian resume.
- **Dates:** right-aligned on a tab stop.
- **Length:** each resume must fit on one page with roughly 80 to 90 percent of the page filled. The preview step refuses anything longer.

## Excel format

- **Title rows:** navy title rows at the top.
- **Tracker table:** a filterable table with drop-downs for Status, Prioritas, Sumber, Tipe, and Lokasi Kerja, with each status coloured.
- **Formulas:** Tindak Lanjut and Hari Sejak Apply use the same rules as the Notion formulas.
- **Example rows:** the seven rows use dates relative to TODAY(), so their follow-up labels still show whenever the file is opened.
- **Other sheets:** a Ringkasan sheet (counts per status, response rate, interview rate, follow-ups due) and a Cara Pakai sheet.

## Source and files

`docs/rewards/notion-resume-kit/` holds the generator (`build_kit.py`), the banner source (`cover.html`, `render-cover.mjs`), and the brand assets. Generated files land in `dist/`, which the repository ignores. The copies participants receive are the ones attached in Notion.

To regenerate:

1. `python docs/rewards/notion-resume-kit/build_kit.py` builds the resumes and the Excel file.
2. Export every `.docx` to PDF in Word.
3. `python docs/rewards/notion-resume-kit/build_kit.py previews` renders the preview images and enforces one page.
4. `node docs/rewards/notion-resume-kit/render-cover.mjs` renders the banner.
5. Re-upload the changed files.

The home page lives in the owner's workspace as a private draft: https://app.notion.com/p/3d8e44db112d81a5a8c8fd8dcd40651a

## Manual steps left to the owner

- **Cover:** add the banner as the home page cover (Add cover → Upload → `dist/notion-cover.png`). The API only accepts external image URLs for covers.
- **Board columns:** show empty status columns on both Pipeline boards (⋯ → Group → turn off "Hide empty groups"). The API always creates boards with empty groups hidden.
- **New-application template (optional):** in the Lamaran Kerja database, add a template from one example row's structure, so new applications start with the note sections.
- **Publishing:** Share → Publish, enable "Allow duplicate as template", copy the public link, and paste it as the fulfilment note for `notion-kit` claims.

## Delivery

Automatic delivery was built the same day — see `2026-09-12-digital-reward-delivery-design.md`. Once the page is published and its link is set on the admin Reward page, claiming this reward fulfils it, shows the link on the profile, and emails the same link.

## Out of scope

- Making links in the fulfilment note clickable on the profile (a code change and deploy).
- The e-book and the remaining four rewards.
