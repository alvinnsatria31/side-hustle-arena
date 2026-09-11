"""Generate the downloadable files for the `notion-kit` reward.

The reward is "Template Notion & Resume Starter Kit". Its Notion page carries the
tracker itself; this script builds the files attached to that page.

  python docs/rewards/notion-resume-kit/build_kit.py            resumes + Excel tracker
  python docs/rewards/notion-resume-kit/build_kit.py previews   PNG previews from the PDFs

Between the two steps, export every .docx to PDF in Word (see the spec). The
preview step also refuses a resume that runs past one page.

Resume rules — they decide whether an ATS can read the file at all: A4, one
column, no tables, text boxes, images, or page headers; contact details in the
body; a font every copy of Word and Google Docs has; section titles as real Word
headings; dates on a right tab stop. No hyperlinks either: a participant who
retypes "linkedin.com/in/namakamu" would keep a link to somebody else's profile.
Sekolah Karir branding never goes inside a resume — it is sent to other companies.
"""

from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.enum.text import WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.table import Table, TableStyleInfo

HERE = Path(__file__).resolve().parent
DIST = HERE / "dist"

# Brand colours for the Excel file. The resumes use a print palette below.
NAVY = "07152D"
BLUE = "246BFD"
INK = "1A2540"

# ---------------------------------------------------------------------------
# Resume content
# ---------------------------------------------------------------------------

# Item kinds: ("para", text) · ("role", title, organisation, dates) ·
# ("bullet", text) · ("line", text) · ("kv", label, text)
RESUMES = {
    "CV-Data-Analyst-Indonesia.docx": {
        "lang": "id-ID",
        "title": "CV - Nama Lengkap",
        "name": "NAMA LENGKAP",
        "headline": "Data Analyst  ·  Fresh Graduate S1 Statistika",
        "contact": ["Jakarta Selatan", "0812-3456-7890", "namakamu@email.com", "linkedin.com/in/namakamu", "github.com/namakamu"],
        "sections": [
            ("RINGKASAN PROFIL", [
                ("para", "Lulusan S1 Statistika yang mengolah data dengan SQL, Python, dan Excel, lalu menyajikannya menjadi "
                         "dashboard dan rekomendasi yang dipakai tim bisnis. Berpengalaman magang 6 bulan sebagai Data Analyst "
                         "dan menyelesaikan proyek analisis nyata di Side Hustle Arena. Mencari posisi Data Analyst entry level "
                         "di perusahaan teknologi atau ritel."),
            ]),
            ("PENGALAMAN", [
                ("role", "Data Analyst Intern", "Sagara Retail, Jakarta", "Feb 2026 – Jul 2026"),
                ("bullet", "Membangun dashboard penjualan mingguan di Looker Studio untuk 40 cabang, memangkas waktu pembuatan "
                           "laporan dari 6 jam menjadi 30 menit per minggu."),
                ("bullet", "Menganalisis 1,2 juta baris data transaksi dengan SQL dan menemukan 5 produk bermargin terendah; "
                           "rekomendasi penyesuaian harganya dipakai tim kategori."),
                ("bullet", "Membuat skrip pembersihan data dengan Python (pandas) yang menurunkan kesalahan input dari 8% "
                           "menjadi di bawah 1%."),
                ("role", "Asisten Praktikum Statistika", "Universitas Arunika, Bandung", "Agu 2024 – Jan 2025"),
                ("bullet", "Membimbing 60 mahasiswa per semester dalam praktikum R dan SPSS; 92% lulus ujian praktikum."),
            ]),
            ("PROYEK & BUKTI SKILL", [
                ("role", "Analisis Churn Pelanggan Aplikasi Langganan", "Side Hustle Arena, Sekolah Karir", "Sep 2026"),
                ("bullet", "Mengolah data 20.000 pelanggan untuk menemukan 3 faktor utama penyebab churn, lalu menyusun "
                           "rekomendasi retensi dalam laporan 5 halaman."),
                ("bullet", "Mendapat skor review 88/100 dan peringkat 2 dari 45 peserta divisi Data. Bukti: portfoliokamu.com/churn"),
                ("role", "Dashboard Tren Harga Bahan Pokok", "Proyek Pribadi", "Mar 2025"),
                ("bullet", "Mengumpulkan data harga 10 komoditas dari sumber publik dan memvisualisasikan tren 12 bulan di "
                           "Tableau Public; dilihat lebih dari 1.500 kali."),
            ]),
            ("PENDIDIKAN", [
                ("role", "S1 Statistika", "Universitas Arunika, Bandung", "2021 – 2025"),
                ("line", "IPK 3,62/4,00  ·  Skripsi: Prediksi Permintaan Produk Ritel dengan Model ARIMA"),
            ]),
            ("ORGANISASI", [
                ("role", "Kepala Divisi Riset", "Himpunan Mahasiswa Statistika", "2023 – 2024"),
                ("bullet", "Memimpin 8 anggota menjalankan 4 survei kampus dengan total 1.200 responden."),
            ]),
            ("SKILL & SERTIFIKASI", [
                ("kv", "Hard skill", "SQL, Python (pandas, matplotlib), Excel (Pivot Table, XLOOKUP), Looker Studio, Tableau"),
                ("kv", "Soft skill", "Komunikasi data, presentasi ke stakeholder, kerja tim lintas fungsi"),
                ("kv", "Sertifikasi", "Google Data Analytics Professional Certificate (2025)"),
                ("kv", "Bahasa", "Indonesia (penutur asli), Inggris (profesional, TOEFL ITP 550)"),
            ]),
        ],
    },
    "CV-Data-Analyst-English.docx": {
        "lang": "en-US",
        "title": "CV - Full Name",
        "name": "FULL NAME",
        "headline": "Data Analyst  ·  Statistics Graduate",
        "contact": ["South Jakarta", "+62 812-3456-7890", "yourname@email.com", "linkedin.com/in/yourname", "github.com/yourname"],
        "sections": [
            ("SUMMARY", [
                ("para", "Statistics graduate who turns raw data into dashboards and recommendations that business teams act on, "
                         "using SQL, Python, and Excel. Completed a 6-month Data Analyst internship and real-world analysis "
                         "projects on Side Hustle Arena. Seeking an entry-level Data Analyst role in technology or retail."),
            ]),
            ("EXPERIENCE", [
                ("role", "Data Analyst Intern", "Sagara Retail, Jakarta", "Feb 2026 – Jul 2026"),
                ("bullet", "Built a weekly sales dashboard in Looker Studio covering 40 branches, cutting reporting time from "
                           "6 hours to 30 minutes per week."),
                ("bullet", "Analyzed 1.2 million transaction rows in SQL to identify the 5 lowest-margin products; the pricing "
                           "recommendations were adopted by the category team."),
                ("bullet", "Wrote a Python (pandas) data-cleaning script that cut input errors from 8% to under 1%."),
                ("role", "Statistics Lab Assistant", "Universitas Arunika, Bandung", "Aug 2024 – Jan 2025"),
                ("bullet", "Coached 60 students per semester in R and SPSS lab sessions; 92% passed the practical exam."),
            ]),
            ("PROJECTS & SKILL EVIDENCE", [
                ("role", "Customer Churn Analysis for a Subscription App", "Side Hustle Arena, Sekolah Karir", "Sep 2026"),
                ("bullet", "Analyzed data on 20,000 customers to identify the 3 main drivers of churn and wrote a 5-page "
                           "retention recommendation report."),
                ("bullet", "Scored 88/100 in project review and ranked 2nd of 45 participants in the Data division. "
                           "Evidence: yourportfolio.com/churn"),
                ("role", "Staple Food Price Trend Dashboard", "Personal Project", "Mar 2025"),
                ("bullet", "Collected prices for 10 commodities from public sources and visualized 12-month trends in Tableau "
                           "Public; viewed more than 1,500 times."),
            ]),
            ("EDUCATION", [
                ("role", "Bachelor of Statistics", "Universitas Arunika, Bandung", "2021 – 2025"),
                ("line", "GPA 3.62/4.00  ·  Thesis: Retail Demand Forecasting with ARIMA Models"),
            ]),
            ("LEADERSHIP & ACTIVITIES", [
                ("role", "Head of Research Division", "Statistics Student Association", "2023 – 2024"),
                ("bullet", "Led 8 members in running 4 campus surveys with 1,200 respondents in total."),
            ]),
            ("SKILLS & CERTIFICATIONS", [
                ("kv", "Technical", "SQL, Python (pandas, matplotlib), Excel (Pivot Tables, XLOOKUP), Looker Studio, Tableau"),
                ("kv", "Soft skills", "Data storytelling, stakeholder presentations, cross-functional teamwork"),
                ("kv", "Certifications", "Google Data Analytics Professional Certificate (2025)"),
                ("kv", "Languages", "Indonesian (native), English (professional working proficiency, TOEFL ITP 550)"),
            ]),
        ],
    },
    "CV-UI-UX-Designer-Indonesia.docx": {
        "lang": "id-ID",
        "title": "CV - Nama Lengkap",
        "name": "NAMA LENGKAP",
        "headline": "UI/UX Designer  ·  Fresh Graduate Desain Komunikasi Visual",
        "contact": ["Bandung", "0812-3456-7890", "namakamu@email.com", "linkedin.com/in/namakamu", "behance.net/namakamu"],
        "sections": [
            ("RINGKASAN PROFIL", [
                ("para", "Lulusan Desain Komunikasi Visual yang merancang tampilan aplikasi berdasarkan riset dan uji pengguna. "
                         "Terbiasa bekerja di Figma dengan design system dan prototipe interaktif. Berpengalaman magang 5 bulan "
                         "sebagai UI/UX Designer di startup edukasi dan menyelesaikan proyek redesign di Side Hustle Arena. "
                         "Mencari posisi UI/UX Designer entry level."),
            ]),
            ("PENGALAMAN", [
                ("role", "UI/UX Designer Intern", "Bentang Edu, Jakarta", "Mar 2026 – Jul 2026"),
                ("bullet", "Merancang ulang alur pendaftaran kelas di aplikasi mobile; tingkat penyelesaian pendaftaran naik "
                           "dari 41% menjadi 63% setelah rilis."),
                ("bullet", "Menjalankan 12 sesi usability testing dan merangkum temuannya menjadi 18 perbaikan yang "
                           "diprioritaskan bersama tim produk."),
                ("bullet", "Menyusun 60+ komponen design system di Figma, mempercepat pembuatan halaman baru oleh 4 desainer."),
                ("role", "Desainer Grafis Freelance", "Klien UMKM", "2023 – 2025"),
                ("bullet", "Membuat identitas visual dan materi promosi untuk 15 UMKM kuliner dan fashion."),
            ]),
            ("PROYEK & BUKTI SKILL", [
                ("role", "Redesign Aplikasi Antrean Puskesmas", "Side Hustle Arena, Sekolah Karir", "Sep 2026"),
                ("bullet", "Mewawancarai 8 pengguna, memetakan 5 titik frustrasi, lalu merancang prototipe high-fidelity di Figma."),
                ("bullet", "Mendapat skor review 91/100 dan peringkat 1 di divisi Design. Portfolio: behance.net/namakamu/antrean"),
                ("role", "Studi Kasus Aplikasi Bank Sampah", "Proyek Pribadi", "Feb 2025"),
                ("bullet", "Merancang aplikasi dari riset sampai prototipe; studi kasusnya dilihat lebih dari 2.000 kali di Behance."),
            ]),
            ("PENDIDIKAN", [
                ("role", "S1 Desain Komunikasi Visual", "Universitas Arunika, Bandung", "2021 – 2025"),
                ("line", "IPK 3,58/4,00  ·  Tugas akhir: Perancangan Aplikasi Pengingat Minum Obat untuk Lansia"),
            ]),
            ("ORGANISASI", [
                ("role", "Koordinator Divisi Desain", "BEM Fakultas Seni Rupa dan Desain", "2023 – 2024"),
                ("bullet", "Memimpin 6 desainer memproduksi 120+ materi publikasi untuk 14 acara kampus."),
            ]),
            ("SKILL & SERTIFIKASI", [
                ("kv", "Desain", "Figma, Adobe Illustrator, Adobe Photoshop, ProtoPie"),
                ("kv", "Riset", "Wawancara pengguna, usability testing, user flow, wireframe"),
                ("kv", "Lainnya", "Design system, dasar HTML/CSS"),
                ("kv", "Sertifikasi", "Google UX Design Professional Certificate (2025)"),
                ("kv", "Bahasa", "Indonesia (penutur asli), Inggris (profesional, IELTS 6.5)"),
            ]),
        ],
    },
    "CV-UI-UX-Designer-English.docx": {
        "lang": "en-US",
        "title": "CV - Full Name",
        "name": "FULL NAME",
        "headline": "UI/UX Designer  ·  Visual Communication Design Graduate",
        "contact": ["Bandung", "+62 812-3456-7890", "yourname@email.com", "linkedin.com/in/yourname", "behance.net/yourname"],
        "sections": [
            ("SUMMARY", [
                ("para", "Visual Communication Design graduate who designs app interfaces from user research and usability "
                         "testing. Works in Figma with design systems and interactive prototypes. Completed a 5-month UI/UX "
                         "internship at an education startup and a redesign project on Side Hustle Arena. Seeking an "
                         "entry-level UI/UX Designer role."),
            ]),
            ("EXPERIENCE", [
                ("role", "UI/UX Designer Intern", "Bentang Edu, Jakarta", "Mar 2026 – Jul 2026"),
                ("bullet", "Redesigned the mobile app's class sign-up flow; completion rose from 41% to 63% after release."),
                ("bullet", "Ran 12 usability testing sessions and turned the findings into 18 fixes prioritized with the "
                           "product team."),
                ("bullet", "Built 60+ Figma design system components, speeding up new page design for a team of 4 designers."),
                ("role", "Freelance Graphic Designer", "Small Business Clients", "2023 – 2025"),
                ("bullet", "Created visual identities and promotional materials for 15 food and fashion small businesses."),
            ]),
            ("PROJECTS & SKILL EVIDENCE", [
                ("role", "Queue App Redesign for a Community Health Center", "Side Hustle Arena, Sekolah Karir", "Sep 2026"),
                ("bullet", "Interviewed 8 users, mapped 5 pain points, and designed a high-fidelity prototype in Figma."),
                ("bullet", "Scored 91/100 in project review and ranked 1st in the Design division. Portfolio: behance.net/yourname/queue"),
                ("role", "Waste Bank App Case Study", "Personal Project", "Feb 2025"),
                ("bullet", "Designed an app from research to prototype; the case study has more than 2,000 views on Behance."),
            ]),
            ("EDUCATION", [
                ("role", "Bachelor of Visual Communication Design", "Universitas Arunika, Bandung", "2021 – 2025"),
                ("line", "GPA 3.58/4.00  ·  Final project: Medication Reminder App for Older Adults"),
            ]),
            ("LEADERSHIP & ACTIVITIES", [
                ("role", "Design Coordinator", "Faculty of Art and Design Student Executive Board", "2023 – 2024"),
                ("bullet", "Led 6 designers producing 120+ publication materials for 14 campus events."),
            ]),
            ("SKILLS & CERTIFICATIONS", [
                ("kv", "Design", "Figma, Adobe Illustrator, Adobe Photoshop, ProtoPie"),
                ("kv", "Research", "User interviews, usability testing, user flows, wireframing"),
                ("kv", "Other", "Design systems, basic HTML/CSS"),
                ("kv", "Certifications", "Google UX Design Professional Certificate (2025)"),
                ("kv", "Languages", "Indonesian (native), English (professional working proficiency, IELTS 6.5)"),
            ]),
        ],
    },
    "CV-Product-Manager-Indonesia.docx": {
        "lang": "id-ID",
        "title": "CV - Nama Lengkap",
        "name": "NAMA LENGKAP",
        "headline": "Associate Product Manager  ·  Fresh Graduate S1 Sistem Informasi",
        "contact": ["Jakarta Barat", "0812-3456-7890", "namakamu@email.com", "linkedin.com/in/namakamu", "namakamu.notion.site"],
        "sections": [
            ("RINGKASAN PROFIL", [
                ("para", "Lulusan Sistem Informasi yang menerjemahkan masalah pengguna menjadi kebutuhan produk yang jelas bagi "
                         "tim engineering dan desain. Berpengalaman magang 6 bulan sebagai Product Management Intern di "
                         "perusahaan fintech dan menyelesaikan proyek product discovery di Side Hustle Arena. Mencari posisi "
                         "Associate Product Manager."),
            ]),
            ("PENGALAMAN", [
                ("role", "Product Management Intern", "Lumina Pay, Jakarta", "Jan 2026 – Jun 2026"),
                ("bullet", "Menyusun PRD fitur pengingat tagihan bersama 4 engineer dan 1 desainer; fitur dirilis sesuai jadwal "
                           "dan dipakai 38.000 pengguna di bulan pertama."),
                ("bullet", "Menganalisis funnel aktivasi di Mixpanel dan menemukan drop-off terbesar di verifikasi KTP; "
                           "penyederhanaan langkah yang diusulkan menaikkan aktivasi dari 52% menjadi 61%."),
                ("bullet", "Merangkum 150 ulasan aplikasi setiap bulan menjadi daftar masalah prioritas untuk sprint planning."),
                ("role", "Asisten Peneliti", "Laboratorium Sistem Informasi, Universitas Arunika", "2024 – 2025"),
                ("bullet", "Mengolah data survei 400 responden tentang adopsi dompet digital di kalangan UMKM."),
            ]),
            ("PROYEK & BUKTI SKILL", [
                ("role", "Product Discovery Aplikasi Titip Belanja", "Side Hustle Arena, Sekolah Karir", "Sep 2026"),
                ("bullet", "Mewawancarai 10 calon pengguna, merumuskan 3 problem statement, dan memprioritaskan fitur MVP "
                           "dengan kerangka RICE."),
                ("bullet", "Mendapat skor review 86/100 di divisi Product. Bukti: namakamu.notion.site/titip"),
                ("role", "Analisis Alur Pemesanan Aplikasi Transportasi Online", "Proyek Pribadi", "Apr 2025"),
                ("bullet", "Membandingkan alur pemesanan 3 aplikasi dan menulis rekomendasi perbaikan dalam artikel yang dibaca "
                           "lebih dari 3.000 kali."),
            ]),
            ("PENDIDIKAN", [
                ("role", "S1 Sistem Informasi", "Universitas Arunika, Bandung", "2021 – 2025"),
                ("line", "IPK 3,55/4,00  ·  Skripsi: Analisis Faktor Kepuasan Pengguna Aplikasi Dompet Digital"),
            ]),
            ("ORGANISASI", [
                ("role", "Ketua Pelaksana Tech Talk", "Himpunan Mahasiswa Sistem Informasi", "2024"),
                ("bullet", "Memimpin 20 panitia menyelenggarakan seminar dengan 350 peserta dan 4 pembicara industri."),
            ]),
            ("SKILL & SERTIFIKASI", [
                ("kv", "Produk", "PRD, user story, prioritisasi (RICE, MoSCoW), product discovery"),
                ("kv", "Tools", "Jira, Figma, Mixpanel, SQL dasar, Google Sheets"),
                ("kv", "Sertifikasi", "Scrum Fundamentals Certified (2025)"),
                ("kv", "Bahasa", "Indonesia (penutur asli), Inggris (profesional, TOEFL ITP 560)"),
            ]),
        ],
    },
    "CV-Product-Manager-English.docx": {
        "lang": "en-US",
        "title": "CV - Full Name",
        "name": "FULL NAME",
        "headline": "Associate Product Manager  ·  Information Systems Graduate",
        "contact": ["West Jakarta", "+62 812-3456-7890", "yourname@email.com", "linkedin.com/in/yourname", "yourname.notion.site"],
        "sections": [
            ("SUMMARY", [
                ("para", "Information Systems graduate who turns user problems into clear product requirements for engineering "
                         "and design teams. Completed a 6-month Product Management internship at a fintech company and a "
                         "product discovery project on Side Hustle Arena. Seeking an Associate Product Manager role."),
            ]),
            ("EXPERIENCE", [
                ("role", "Product Management Intern", "Lumina Pay, Jakarta", "Jan 2026 – Jun 2026"),
                ("bullet", "Wrote the PRD for a bill reminder feature with 4 engineers and 1 designer; it shipped on schedule "
                           "and reached 38,000 users in its first month."),
                ("bullet", "Analyzed the activation funnel in Mixpanel and found the largest drop-off at ID verification; the "
                           "simplified flow I proposed lifted activation from 52% to 61%."),
                ("bullet", "Summarized 150 app reviews each month into a prioritized problem list for sprint planning."),
                ("role", "Research Assistant", "Information Systems Lab, Universitas Arunika", "2024 – 2025"),
                ("bullet", "Processed survey data from 400 respondents on digital wallet adoption among small businesses."),
            ]),
            ("PROJECTS & SKILL EVIDENCE", [
                ("role", "Product Discovery for a Grocery Errand App", "Side Hustle Arena, Sekolah Karir", "Sep 2026"),
                ("bullet", "Interviewed 10 prospective users, defined 3 problem statements, and prioritized MVP features "
                           "with the RICE framework."),
                ("bullet", "Scored 86/100 in project review in the Product division. Evidence: yourname.notion.site/errand"),
                ("role", "Ride-Hailing Booking Flow Analysis", "Personal Project", "Apr 2025"),
                ("bullet", "Compared the booking flows of 3 apps and published improvement recommendations in an article read "
                           "more than 3,000 times."),
            ]),
            ("EDUCATION", [
                ("role", "Bachelor of Information Systems", "Universitas Arunika, Bandung", "2021 – 2025"),
                ("line", "GPA 3.55/4.00  ·  Thesis: User Satisfaction Factors in Digital Wallet Apps"),
            ]),
            ("LEADERSHIP & ACTIVITIES", [
                ("role", "Project Lead, Tech Talk", "Information Systems Student Association", "2024"),
                ("bullet", "Led a 20-person committee to run a seminar with 350 attendees and 4 industry speakers."),
            ]),
            ("SKILLS & CERTIFICATIONS", [
                ("kv", "Product", "PRDs, user stories, prioritization (RICE, MoSCoW), product discovery"),
                ("kv", "Tools", "Jira, Figma, Mixpanel, basic SQL, Google Sheets"),
                ("kv", "Certifications", "Scrum Fundamentals Certified (2025)"),
                ("kv", "Languages", "Indonesian (native), English (professional working proficiency, TOEFL ITP 560)"),
            ]),
        ],
    },
}

# ---------------------------------------------------------------------------
# Resume layout
# ---------------------------------------------------------------------------

FONT = "Arial"
PAGE_W, MARGIN_X = 21.0, 1.8
TEXT_WIDTH_CM = PAGE_W - 2 * MARGIN_X

# Print palette: near-black text, one deep blue accent, one hairline grey.
C_NAME = "0F172A"
C_TEXT = "1F2937"
C_SOFT = "374151"
C_MUTED = "5B6472"
C_ACCENT = "1F4FBF"
C_RULE = "CBD2DC"

RPR_ORDER_AFTER_SPACING = ("w:w", "w:kern", "w:position", "w:sz", "w:szCs", "w:highlight", "w:u", "w:effect",
                           "w:bdr", "w:shd", "w:fitText", "w:vertAlign", "w:rtl", "w:cs", "w:em", "w:lang",
                           "w:eastAsianLayout", "w:specVanish", "w:oMath")
PPR_ORDER_AFTER_BORDER = ("w:shd", "w:tabs", "w:suppressAutoHyphens", "w:kinsoku", "w:wordWrap", "w:overflowPunct",
                          "w:topLinePunct", "w:autoSpaceDE", "w:autoSpaceDN", "w:bidi", "w:adjustRightInd",
                          "w:snapToGrid", "w:spacing", "w:ind", "w:contextualSpacing", "w:mirrorIndents",
                          "w:suppressOverlap", "w:jc", "w:textDirection", "w:textAlignment", "w:textboxTightWrap",
                          "w:outlineLvl", "w:divId", "w:cnfStyle", "w:rPr", "w:sectPr", "w:pPrChange")


def _fonts(r_pr) -> None:
    """Pin every script slot to FONT and drop theme fonts, which would win otherwise."""
    fonts = r_pr.get_or_add_rFonts()
    for attr in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
        fonts.attrib.pop(qn(attr), None)
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        fonts.set(qn(attr), FONT)


def _tracking(r_pr, twentieths: int) -> None:
    spacing = r_pr.find(qn("w:spacing"))
    if spacing is None:
        spacing = OxmlElement("w:spacing")
        r_pr.insert_element_before(spacing, *RPR_ORDER_AFTER_SPACING)
    spacing.set(qn("w:val"), str(twentieths))


def _language(r_pr, lang: str) -> None:
    element = r_pr.find(qn("w:lang"))
    if element is None:
        element = OxmlElement("w:lang")
        r_pr.insert_element_before(element, "w:eastAsianLayout", "w:specVanish", "w:oMath")
    element.set(qn("w:val"), lang)


def _run(paragraph, text: str, size: float, color: str = C_TEXT, bold: bool = False, tracking: int = 0):
    run = paragraph.add_run(text)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)
    r_pr = run._element.get_or_add_rPr()
    _fonts(r_pr)
    if tracking:
        _tracking(r_pr, tracking)
    return run


def _paragraph(doc, style: str | None = None, before: float = 0, after: float = 0, line: float = 1.1):
    paragraph = doc.add_paragraph(style=style)
    fmt = paragraph.paragraph_format
    fmt.space_before, fmt.space_after, fmt.line_spacing = Pt(before), Pt(after), line
    return paragraph


def _rule_below(paragraph, color: str = C_RULE) -> None:
    border = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    for key, value in (("w:val", "single"), ("w:sz", "4"), ("w:space", "3"), ("w:color", color)):
        bottom.set(qn(key), value)
    border.append(bottom)
    # Word rejects a pPr whose children are out of schema order.
    paragraph._p.get_or_add_pPr().insert_element_before(border, *PPR_ORDER_AFTER_BORDER)


def _prepare_styles(doc, lang: str) -> None:
    normal = doc.styles["Normal"]
    normal.font.size = Pt(10)
    normal_rpr = normal.element.get_or_add_rPr()
    _fonts(normal_rpr)
    _language(normal_rpr, lang)

    # Section titles are real headings: ATS parsers and Word's navigation pane
    # both read the outline, and a plain bold line gives them nothing to hold.
    heading = doc.styles["Heading 1"]
    heading.font.size = Pt(9.5)
    heading.font.bold = True
    heading.font.italic = False
    heading.font.color.rgb = RGBColor.from_string(C_ACCENT)
    heading_rpr = heading.element.get_or_add_rPr()
    _fonts(heading_rpr)
    _tracking(heading_rpr, 24)
    _language(heading_rpr, lang)
    fmt = heading.paragraph_format
    fmt.space_before, fmt.space_after, fmt.line_spacing = Pt(12), Pt(4), 1.0
    fmt.keep_with_next = True


def build_resume(filename: str, spec: dict) -> Path:
    doc = Document()
    section = doc.sections[0]
    section.page_width, section.page_height = Cm(PAGE_W), Cm(29.7)
    section.top_margin, section.bottom_margin = Cm(1.5), Cm(1.4)
    section.left_margin = section.right_margin = Cm(MARGIN_X)
    _prepare_styles(doc, spec["lang"])

    props = doc.core_properties
    props.title, props.author, props.last_modified_by, props.comments, props.keywords = spec["title"], "", "", "", ""
    props.language = spec["lang"]

    # Sizes are tuned so a fresh graduate's content fills about 90% of the page:
    # less reads unfinished, more leaves no room for their own additions.
    _run(_paragraph(doc, line=1.0), spec["name"], 24, C_NAME, bold=True, tracking=-6)
    _run(_paragraph(doc, before=4, line=1.0), spec["headline"], 11, C_ACCENT, bold=True)
    contact = _paragraph(doc, before=6, line=1.0)
    for index, item in enumerate(spec["contact"]):
        if index:
            _run(contact, "  ·  ", 9.5, C_RULE, bold=True)
        _run(contact, item, 9.5, C_MUTED)

    for heading, items in spec["sections"]:
        head = doc.add_paragraph(style="Heading 1")
        _rule_below(head)
        _run(head, heading, 9.5, C_ACCENT, bold=True, tracking=24)
        first_role = True
        for kind, *parts in items:
            if kind == "para":
                _run(_paragraph(doc, after=1, line=1.18), parts[0], 10.5, C_TEXT)
            elif kind == "role":
                title, organisation, dates = parts
                p = _paragraph(doc, before=0 if first_role else 7, after=2, line=1.0)
                p.paragraph_format.keep_with_next = True
                p.paragraph_format.tab_stops.add_tab_stop(Cm(TEXT_WIDTH_CM), WD_TAB_ALIGNMENT.RIGHT)
                _run(p, title, 10.5, C_NAME, bold=True)
                _run(p, f"  —  {organisation}", 10.5, C_SOFT)
                _run(p, f"\t{dates}", 9.5, C_MUTED)
                first_role = False
            elif kind == "bullet":
                p = _paragraph(doc, style="List Bullet", after=2, line=1.15)
                p.paragraph_format.left_indent = Cm(0.5)
                p.paragraph_format.first_line_indent = Cm(-0.32)
                _run(p, parts[0], 10.5, C_TEXT)
            elif kind == "line":
                _run(_paragraph(doc, before=1, after=1, line=1.1), parts[0], 10, C_MUTED)
            elif kind == "kv":
                label, text = parts
                p = _paragraph(doc, after=2.5, line=1.12)
                _run(p, f"{label}: ", 10.5, C_NAME, bold=True)
                _run(p, text, 10.5, C_TEXT)
            else:
                raise ValueError(f"Unknown resume item kind: {kind}")

    path = DIST / filename
    doc.save(path)
    return path


# ---------------------------------------------------------------------------
# Previews (run after exporting the resumes to PDF in Word)
# ---------------------------------------------------------------------------

def build_previews() -> None:
    import fitz  # PyMuPDF
    from PIL import Image, ImageFilter

    for docx_name in RESUMES:
        pdf_path = DIST / docx_name.replace(".docx", ".pdf")
        if not pdf_path.exists():
            raise SystemExit(f"Missing {pdf_path.name}: export the .docx files to PDF in Word first.")
        with fitz.open(pdf_path) as pdf:
            if pdf.page_count != 1:
                raise SystemExit(f"{pdf_path.name} has {pdf.page_count} pages; a resume template must fit on one.")
            page = pdf[0]
            text_bottom = max(block[3] for block in page.get_text("blocks"))
            fill = text_bottom / page.rect.height
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        sheet = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)

        # A sheet of paper on a quiet grey ground, with a soft shadow: it reads as a
        # document at a glance instead of a white box lost on a white Notion page.
        pad = 90
        canvas = Image.new("RGB", (sheet.width + 2 * pad, sheet.height + 2 * pad), (241, 244, 248))
        shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        shade = Image.new("RGBA", sheet.size, (15, 23, 42, 46))
        shadow.paste(shade, (pad, pad + 14))
        shadow = shadow.filter(ImageFilter.GaussianBlur(26))
        canvas.paste(shadow, (0, 0), shadow)
        border = Image.new("RGB", (sheet.width + 2, sheet.height + 2), (214, 220, 229))
        canvas.paste(border, (pad - 1, pad - 1))
        canvas.paste(sheet, (pad, pad))
        preview = DIST / f"preview-{docx_name.replace('.docx', '.png')}"
        canvas.save(preview, optimize=True)
        print(f"wrote {preview.name}  (text fills {fill:.0%} of the page)")


# ---------------------------------------------------------------------------
# Excel tracker
# ---------------------------------------------------------------------------

STATUSES = [
    # (name, fill, font colour, meaning). Colours follow the Notion select options.
    ("Wishlist", "F1F5F9", "475569", "Lowongan menarik yang belum kamu lamar."),
    ("Sudah Apply", "EBF1FF", "1A56D6", "Lamaran sudah terkirim, belum ada balasan."),
    ("Screening HR", "F3E8FF", "7E22CE", "HR menghubungi atau mengajak screening call."),
    ("Tes / Case Study", "FCE7F3", "BE185D", "Diminta mengerjakan tes, psikotes, atau studi kasus."),
    ("Interview User", "FFEDD5", "C2410C", "Interview dengan calon atasan atau tim."),
    ("Offer", "FEF9C3", "A16207", "Menerima tawaran kerja, sedang dipertimbangkan."),
    ("Diterima", "16A34A", "FFFFFF", "Tawaran diterima."),
    ("Ditolak", "FEE2E2", "B91C1C", "Perusahaan menolak. Catat pelajarannya."),
    ("Tidak Ada Kabar", "EDE7E3", "78716C", "Tiga minggu tanpa balasan setelah follow-up."),
]
PRIORITIES = ["Tinggi", "Sedang", "Rendah"]
SOURCES = ["LinkedIn", "JobStreet", "Glints", "Kalibrr", "Dealls", "Website Perusahaan", "Referral", "Lainnya"]
JOB_TYPES = ["Full-time", "Magang", "Kontrak", "Part-time", "Freelance"]
LOCATIONS = ["Remote", "Hybrid", "On-site"]

# (header, width). Letters: A..Q, in this order.
COLUMNS = [
    ("Posisi", 30), ("Perusahaan", 22), ("Status", 17), ("Prioritas", 11), ("Sumber", 18), ("Tipe", 11),
    ("Lokasi Kerja", 13), ("Tanggal Apply", 14), ("Follow-up", 14), ("Deadline Lamaran", 16),
    ("Tindak Lanjut", 20), ("Hari Sejak Apply", 15), ("Ekspektasi Gaji", 16), ("Versi CV", 20),
    ("Kontak", 26), ("Link Lowongan", 28), ("Next Step", 40),
]

# Example dates are formulas relative to today, so the examples still show a
# follow-up that is due whenever the file is opened. Same companies as Notion.
EXAMPLES = [
    ["Data Analyst Intern", "Sagara Retail", "Interview User", "Tinggi", "LinkedIn", "Magang", "Hybrid",
     "=TODAY()-11", "=TODAY()+3", None, 4_500_000, "CV-Data-ID-v2", "Rani, Talent Acquisition",
     "https://www.linkedin.com/jobs/", "Latihan studi kasus SQL untuk interview user"],
    ["Junior UI/UX Designer", "Bentang Edu", "Tes / Case Study", "Tinggi", "Glints", "Full-time", "On-site",
     "=TODAY()-9", "=TODAY()+2", None, 6_500_000, "CV-Design-ID-v1", "", "https://glints.com/id",
     "Kirim design challenge sebelum tenggat"],
    ["Associate Product Manager", "Lumina Pay", "Screening HR", "Tinggi", "Referral", "Full-time", "Hybrid",
     "=TODAY()-6", "=TODAY()", None, 8_000_000, "CV-Product-EN-v1", "Dimas, alumni di tim Payments", "",
     "Siapkan cerita produk favorit untuk screening"],
    ["Business Intelligence Trainee", "Rantai Logistik", "Sudah Apply", "Sedang", "JobStreet", "Kontrak", "On-site",
     "=TODAY()-8", "=TODAY()-1", None, 5_500_000, "CV-Data-ID-v2", "", "https://id.jobstreet.com",
     "Kirim email follow-up"],
    ["Product Designer Intern", "Sagara Health", "Wishlist", "Sedang", "LinkedIn", "Magang", "Remote",
     None, None, "=TODAY()+8", 4_000_000, "", "", "https://www.linkedin.com/jobs/",
     "Sesuaikan portfolio dengan produk kesehatan"],
    ["Product Analyst", "Kilau Commerce", "Offer", "Tinggi", "Kalibrr", "Full-time", "Hybrid",
     "=TODAY()-25", "=TODAY()+4", None, 7_500_000, "CV-Product-ID-v2", "Sinta, HR Business Partner", "",
     "Balas offer sebelum tenggat"],
    ["Data Scientist Intern", "Nadi Analytics", "Ditolak", "Rendah", "Dealls", "Magang", "Remote",
     "=TODAY()-31", None, None, 5_000_000, "CV-Data-EN-v1", "", "", "Minta feedback hasil tes coding"],
]

FIRST_ROW, LAST_ROW = 5, 204


def _banner(ws, last_col: str, title: str, subtitle: str) -> None:
    ws.merge_cells(f"A1:{last_col}1")
    ws.merge_cells(f"A2:{last_col}2")
    ws["A1"] = title
    ws["A1"].font = Font(name="Arial", size=16, bold=True, color="FFFFFF")
    ws["A1"].fill = PatternFill("solid", start_color=NAVY, end_color=NAVY)
    ws["A1"].alignment = Alignment(vertical="center", indent=1)
    ws["A2"] = subtitle
    ws["A2"].font = Font(name="Arial", size=10, color="C9D7F2")
    ws["A2"].fill = PatternFill("solid", start_color=NAVY, end_color=NAVY)
    ws["A2"].alignment = Alignment(vertical="top", indent=1)
    ws.row_dimensions[1].height = 32
    ws.row_dimensions[2].height = 22


def build_tracker() -> Path:
    wb = Workbook()
    wb.properties.creator = "Sekolah Karir"
    wb.properties.title = "Tracker Lamaran Kerja"

    ws = wb.active
    ws.title = "Tracker"
    last_col = "Q"
    _banner(ws, last_col, "Tracker Lamaran Kerja",
            "Job Hunt Starter Kit · Sekolah Karir. Tujuh baris pertama adalah contoh fiktif; hapus setelah kamu paham alurnya.")

    for index, (header, width) in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=4, column=index, value=header)
        cell.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
        ws.column_dimensions[cell.column_letter].width = width
    ws.row_dimensions[4].height = 22

    # Example values map onto every column except the two formula columns (K, L).
    value_columns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17]
    for offset, example in enumerate(EXAMPLES):
        for column, value in zip(value_columns, example):
            ws.cell(row=FIRST_ROW + offset, column=column, value=value)

    body_font = Font(name="Arial", size=10, color=INK)
    for row in range(FIRST_ROW, LAST_ROW + 1):
        ws.cell(row=row, column=11, value=(
            f'=IF(OR(C{row}="Diterima",C{row}="Ditolak",C{row}="Tidak Ada Kabar"),"",'
            f'IF(I{row}<>"",IF(I{row}<TODAY(),"Terlambat",IF(I{row}=TODAY(),"Follow-up hari ini",'
            f'IF(I{row}-TODAY()<=3,I{row}-TODAY()&" hari lagi",""))),'
            f'IF(AND(C{row}="Sudah Apply",H{row}<>"",TODAY()-H{row}>=7),"Waktunya follow-up","")))'))
        ws.cell(row=row, column=12, value=f'=IF(H{row}="","",TODAY()-H{row})')
        for column in range(1, 18):
            cell = ws.cell(row=row, column=column)
            cell.font = body_font
            cell.alignment = Alignment(vertical="top", wrap_text=column in (1, 2, 15, 17))
        for column in (8, 9, 10):
            ws.cell(row=row, column=column).number_format = "dd mmm yyyy"
        ws.cell(row=row, column=12).number_format = '0" hari"'
        ws.cell(row=row, column=13).number_format = '"Rp"#,##0'

    table = Table(displayName="TrackerLamaran", ref=f"A4:{last_col}{LAST_ROW}")
    table.tableStyleInfo = TableStyleInfo(name="TableStyleLight9", showRowStripes=True)
    ws.add_table(table)

    for values, column in (([s[0] for s in STATUSES], "C"), (PRIORITIES, "D"), (SOURCES, "E"),
                           (JOB_TYPES, "F"), (LOCATIONS, "G")):
        validation = DataValidation(type="list", formula1='"' + ",".join(values) + '"', allow_blank=True)
        validation.error = "Pilih salah satu dari daftar."
        validation.errorTitle = "Pilihan tidak tersedia"
        ws.add_data_validation(validation)
        validation.add(f"{column}{FIRST_ROW}:{column}{LAST_ROW}")

    status_range = f"C{FIRST_ROW}:C{LAST_ROW}"
    for name, fill, font_color, _ in STATUSES:
        ws.conditional_formatting.add(status_range, CellIsRule(
            operator="equal", formula=[f'"{name}"'],
            fill=PatternFill("solid", start_color=fill, end_color=fill), font=Font(color=font_color, bold=True)))
    action_range = f"K{FIRST_ROW}:K{LAST_ROW}"
    for text, fill, font_color in (("Terlambat", "FEE2E2", "B91C1C"), ("Follow-up hari ini", "FFEDD5", "C2410C"),
                                   ("Waktunya follow-up", "FFEDD5", "C2410C")):
        ws.conditional_formatting.add(action_range, CellIsRule(
            operator="equal", formula=[f'"{text}"'],
            fill=PatternFill("solid", start_color=fill, end_color=fill), font=Font(color=font_color, bold=True)))
    ws.conditional_formatting.add(action_range, FormulaRule(
        formula=[f'ISNUMBER(SEARCH("hari lagi",K{FIRST_ROW}))'],
        fill=PatternFill("solid", start_color="EBF1FF", end_color="EBF1FF"), font=Font(color="1A56D6")))

    ws.freeze_panes = "B5"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True

    # Summary ----------------------------------------------------------------
    summary = wb.create_sheet("Ringkasan")
    _banner(summary, "H", "Ringkasan Lamaran", "Dihitung otomatis dari sheet Tracker.")
    summary.column_dimensions["A"].width = 34
    summary.column_dimensions["B"].width = 12
    tracker_status = f"Tracker!$C${FIRST_ROW}:$C${LAST_ROW}"

    summary["A4"] = "Total lamaran di tracker"
    summary["B4"] = f"=COUNTA(Tracker!$A${FIRST_ROW}:$A${LAST_ROW})"
    summary["A6"], summary["B6"] = "Status", "Jumlah"
    for cell in (summary["A6"], summary["B6"]):
        cell.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", start_color=NAVY, end_color=NAVY)
    for offset, (name, fill, font_color, _) in enumerate(STATUSES):
        row = 7 + offset
        summary.cell(row=row, column=1, value=name).font = Font(name="Arial", size=10, bold=True, color=font_color)
        summary.cell(row=row, column=1).fill = PatternFill("solid", start_color=fill, end_color=fill)
        summary.cell(row=row, column=2, value=f"=COUNTIF({tracker_status},A{row})")
    # Rows: 7 Wishlist, 8 Sudah Apply, 9 Screening HR, 10 Tes, 11 Interview User, 12 Offer, 13 Diterima, 14 Ditolak, 15 Tidak Ada Kabar
    summary["A17"], summary["B17"] = "Lamaran terkirim (tanpa Wishlist)", "=B4-B7"
    summary["A18"], summary["B18"] = "Tingkat respons perusahaan", "=IFERROR((B17-B8-B15)/B17,0)"
    summary["A19"], summary["B19"] = "Tingkat lolos sampai interview", "=IFERROR((B11+B12+B13)/B17,0)"
    summary["A20"], summary["B20"] = "Perlu ditindaklanjuti sekarang", f'=COUNTIF(Tracker!$K${FIRST_ROW}:$K${LAST_ROW},"Terlambat")+COUNTIF(Tracker!$K${FIRST_ROW}:$K${LAST_ROW},"*hari ini")+COUNTIF(Tracker!$K${FIRST_ROW}:$K${LAST_ROW},"Waktunya*")'
    summary["B18"].number_format = summary["B19"].number_format = "0%"
    for row in (4, 17, 18, 19, 20):
        summary[f"A{row}"].font = Font(name="Arial", size=10, bold=True, color=INK)
        summary[f"B{row}"].font = Font(name="Arial", size=11, bold=True, color=BLUE)

    chart = BarChart()
    chart.type = "bar"
    chart.title = "Lamaran per status"
    chart.legend = None
    chart.height, chart.width = 9, 16
    chart.add_data(Reference(summary, min_col=2, min_row=6, max_row=15), titles_from_data=True)
    chart.set_categories(Reference(summary, min_col=1, min_row=7, max_row=15))
    chart.y_axis.majorGridlines = None
    chart.x_axis.scaling.orientation = "maxMin"
    chart.series[0].graphicalProperties.solidFill = BLUE
    chart.series[0].graphicalProperties.line.solidFill = BLUE
    summary.add_chart(chart, "D4")

    # How-to -------------------------------------------------------------------
    guide = wb.create_sheet("Cara Pakai")
    _banner(guide, "C", "Cara Pakai", "Versi Excel dari tracker Notion. Bisa dibuka di Google Sheets.")
    guide.column_dimensions["A"].width = 22
    guide.column_dimensions["B"].width = 78
    steps = [
        ("1  Kosongkan", "Hapus 7 baris contoh di sheet Tracker. Rumus di kolom Tindak Lanjut dan Hari Sejak Apply sudah terpasang sampai baris 204."),
        ("2  Catat", "Setiap menemukan lowongan menarik, tambah satu baris berstatus Wishlist dan isi Deadline Lamaran."),
        ("3  Kirim", "Setelah melamar, ganti status ke Sudah Apply, isi Tanggal Apply, dan pasang Follow-up 7 hari setelahnya."),
        ("4  Tindak lanjuti", "Kolom Tindak Lanjut memberi tanda saat follow-up jatuh tempo atau terlambat. Kirim pesannya, lalu geser tanggalnya."),
        ("5  Evaluasi", "Seminggu sekali buka sheet Ringkasan. Tingkat respons rendah biasanya berarti CV perlu disesuaikan per lowongan."),
    ]
    row = 4
    for label, text in steps:
        guide.cell(row=row, column=1, value=label).font = Font(name="Arial", size=10, bold=True, color=BLUE)
        cell = guide.cell(row=row, column=2, value=text)
        cell.alignment = Alignment(wrap_text=True, vertical="top")
        cell.font = Font(name="Arial", size=10, color=INK)
        guide.row_dimensions[row].height = 30
        row += 1
    row += 1
    guide.cell(row=row, column=1, value="Arti setiap status").font = Font(name="Arial", size=11, bold=True, color=INK)
    row += 1
    for name, fill, font_color, meaning in STATUSES:
        label = guide.cell(row=row, column=1, value=name)
        label.font = Font(name="Arial", size=10, bold=True, color=font_color)
        label.fill = PatternFill("solid", start_color=fill, end_color=fill)
        guide.cell(row=row, column=2, value=meaning).font = Font(name="Arial", size=10, color=INK)
        row += 1

    wb.calculation.fullCalcOnLoad = True
    path = DIST / "Tracker-Lamaran-Kerja.xlsx"
    wb.save(path)
    return path


def main() -> None:
    DIST.mkdir(parents=True, exist_ok=True)
    if sys.argv[1:] == ["previews"]:
        build_previews()
        return
    for filename, spec in RESUMES.items():
        print("wrote", build_resume(filename, spec).relative_to(HERE))
    print("wrote", build_tracker().relative_to(HERE))


if __name__ == "__main__":
    main()
