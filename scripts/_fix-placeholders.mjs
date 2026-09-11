// One-off: replace the [PLACEHOLDER] briefs and rubrics on the three published
// projects with real content. All three have zero submissions, so nothing a
// participant has already worked against is being rewritten.
//
// Written in Indonesian to match the interface participants read. Title,
// mission and objective are left in English on purpose — they are not broken,
// and rewriting correct fields is not what was asked for.
import postgres from "postgres";

const PROJECTS = {
  "d660fc06-44f7-445d-9e4b-dc9a9662706c": {
    title: "Sales Insight Brief",
    caseBackground:
      "Toko Berkah Jaya menjual perlengkapan rumah tangga di satu kios pasar dan satu akun marketplace. " +
      "Pemiliknya, Bu Ratna, mencatat setiap penjualan di buku tulis selama bertahun-tahun, dan sejak awal " +
      "tahun ini mulai memakai aplikasi kasir sederhana yang bisa mengekspor data ke spreadsheet. Sekarang " +
      "ia punya enam bulan data transaksi: tanggal, nama produk, kategori, jumlah, harga satuan, dan kanal " +
      "penjualan.\n\n" +
      "Masalahnya, data itu belum pernah dibaca. Bu Ratna tetap memesan stok berdasarkan ingatan dan " +
      "kebiasaan, sehingga beberapa barang menumpuk sementara yang lain habis di akhir pekan. Ia tidak " +
      "butuh laporan tebal — ia butuh tahu barang apa yang harus lebih banyak dipesan, kapan harus " +
      "menambah stok, dan produk mana yang sebenarnya merugikan meski terlihat laris.",
    roleDescription:
      "Kamu adalah analis data lepas yang disewa Bu Ratna untuk satu pekerjaan singkat. Kamu tidak " +
      "punya akses ke sistem apa pun selain file ekspor yang ia kirim, dan kamu tidak bisa mewawancarai " +
      "pelanggan.\n\n" +
      "Pembaca hasil kerjamu adalah Bu Ratna sendiri: pengusaha yang cakap tetapi tidak terbiasa dengan " +
      "istilah statistik. Karena itu tugasmu bukan menunjukkan bahwa kamu bisa menganalisis, melainkan " +
      "membuat tiga keputusan konkret yang bisa ia jalankan minggu depan, masing-masing bersandar pada " +
      "angka yang benar-benar ada di data.",
    criteria: {
      "Problem framing": {
        description:
          "Seberapa tepat kamu mempersempit pertanyaan bisnis Bu Ratna menjadi sesuatu yang bisa dijawab " +
          "oleh data yang tersedia. Pembingkaian yang baik menyebut keputusan apa yang sedang diambil dan " +
          "mengakui apa yang tidak bisa dijawab oleh data enam bulan ini.",
        reviewInstruction:
          "Cari pernyataan eksplisit tentang keputusan yang hendak dibantu, bukan sekadar deskripsi " +
          "dataset. Beri nilai tinggi jika peserta menyebutkan batasan data (misalnya tidak ada data " +
          "pelanggan atau tidak ada musim penuh) dan menyesuaikan klaimnya. Beri nilai rendah jika " +
          "pertanyaannya terlalu umum sehingga jawaban apa pun terasa benar. Kutip kalimat pembingkaian " +
          "itu sebagai bukti.",
      },
      Evidence: {
        description:
          "Seberapa kuat setiap klaim disandarkan pada angka yang benar-benar ada di data, dan seberapa " +
          "jujur kamu membedakan pola yang meyakinkan dari kebetulan.",
        reviewInstruction:
          "Periksa apakah setiap kesimpulan bisa ditelusuri ke angka tertentu — jumlah, persentase, atau " +
          "perbandingan periode. Beri nilai tinggi jika peserta menunjukkan besaran, bukan hanya arah " +
          "(\"naik 40%\" lebih baik daripada \"naik\"). Turunkan nilai untuk klaim yang tidak punya angka " +
          "pendukung, dan untuk angka yang disajikan tanpa pembanding sehingga tidak bermakna. Kutip " +
          "angka yang dirujuk peserta.",
      },
      Recommendation: {
        description:
          "Seberapa bisa dijalankan tiga keputusan yang kamu usulkan oleh pemilik toko satu orang, dengan " +
          "modal dan waktu terbatas, mulai minggu depan.",
        reviewInstruction:
          "Nilai apakah tiap rekomendasi menyebut tindakan konkret, bukan tujuan. \"Tambah stok panci " +
          "20% menjelang akhir pekan\" bisa dijalankan; \"tingkatkan penjualan\" tidak. Beri nilai tinggi " +
          "jika peserta menyebut risiko atau biaya dari rekomendasinya. Turunkan nilai jika rekomendasi " +
          "menuntut sumber daya yang jelas di luar jangkauan usaha sekecil ini. Kutip rekomendasinya.",
      },
    },
  },

  "c53a475c-b772-484e-a269-f601573e9472": {
    title: "Onboarding Improvement Plan",
    caseBackground:
      "Catatku adalah aplikasi pencatat keuangan pribadi dengan sekitar 40.000 unduhan. Timnya kecil: dua " +
      "engineer, satu desainer, satu orang yang mengurus segalanya. Dari data mereka, 62% orang yang " +
      "memasang aplikasi menyelesaikan pendaftaran, tetapi hanya 18% yang mencatat transaksi kedua, dan " +
      "hanya 9% yang masih aktif setelah dua minggu.\n\n" +
      "Alur pertama kali membuka aplikasi terdiri dari enam layar: izin notifikasi, pilih mata uang, " +
      "hubungkan rekening bank (bisa dilewati), tentukan anggaran bulanan, tur fitur empat langkah, lalu " +
      "layar utama yang kosong. Tim menduga masalahnya ada di suatu tempat di sana, tetapi setiap orang " +
      "menunjuk layar yang berbeda, dan mereka hanya punya kapasitas untuk memperbaiki satu hal pada " +
      "sprint berikutnya.",
    roleDescription:
      "Kamu adalah product analyst yang diminta menengahi perdebatan itu dengan satu rekomendasi. Kamu " +
      "tidak bisa menambah orang, tidak bisa merombak seluruh alur, dan tidak punya wawancara pengguna " +
      "baru — hanya angka funnel di atas dan deskripsi keenam layar tersebut.\n\n" +
      "Hasil kerjamu dibaca oleh tim yang harus memutuskan pekerjaan sprint berikutnya. Yang mereka " +
      "butuhkan bukan daftar semua yang bisa diperbaiki, melainkan satu perubahan yang kamu pertahankan " +
      "alasannya, lengkap dengan cara mengukur apakah perubahan itu berhasil.",
    criteria: {
      "User understanding": {
        description:
          "Seberapa masuk akal kamu menyimpulkan apa yang dialami pengguna pada titik mereka berhenti, " +
          "dengan hanya bersandar pada angka funnel dan urutan layar.",
        reviewInstruction:
          "Cari penalaran yang menghubungkan angka tertentu dengan pengalaman tertentu di layar tertentu. " +
          "Beri nilai tinggi jika peserta membedakan antara dugaan dan kesimpulan, dan menyebut apa yang " +
          "perlu diverifikasi. Turunkan nilai untuk pernyataan tentang perasaan pengguna yang tidak " +
          "bersandar pada apa pun dalam kasus ini. Kutip penalaran yang dinilai.",
      },
      Prioritization: {
        description:
          "Seberapa kuat alasanmu memilih satu perbaikan di atas yang lain, mengingat tim hanya sanggup " +
          "mengerjakan satu hal.",
        reviewInstruction:
          "Nilai apakah peserta secara eksplisit menolak alternatif, bukan hanya memilih satu. " +
          "Perbandingan yang menyebut dampak dan biaya lebih baik daripada yang menyebut salah satunya. " +
          "Beri nilai tinggi jika pilihannya konsisten dengan titik kebocoran terbesar di funnel. Kutip " +
          "argumen pemilihannya.",
      },
      Measurement: {
        description:
          "Seberapa jelas kamu menetapkan cara mengetahui bahwa perubahan itu berhasil, sebelum perubahan " +
          "itu dikerjakan.",
        reviewInstruction:
          "Periksa adanya metrik yang disebut namanya, angka target, dan rentang waktu. Beri nilai tinggi " +
          "jika peserta menyebut apa yang akan membuat mereka menyimpulkan perubahan itu gagal. Turunkan " +
          "nilai untuk metrik yang tidak bisa dihitung dari data yang dimiliki tim, dan untuk target tanpa " +
          "dasar. Kutip metrik dan targetnya.",
      },
    },
  },

  "d7857fef-eb73-4672-b452-eb3b2d3a092c": {
    title: "Checkout Flow Improvement",
    caseBackground:
      "Rasa Nusantara menjual bumbu masak kemasan lewat situsnya sendiri. Rata-rata 1.200 orang menaruh " +
      "barang di keranjang setiap minggu, dan 71% di antaranya tidak pernah menyelesaikan pembayaran. " +
      "Angka itu paling buruk di ponsel.\n\n" +
      "Proses pembayarannya satu halaman panjang: alamat pengiriman (sebelas kolom, semuanya wajib), " +
      "pilihan kurir yang baru menampilkan ongkir setelah alamat lengkap diisi, pilihan pembayaran, lalu " +
      "tombol bayar. Ongkos kirim kerap menjadi kejutan di akhir. Tim layanan pelanggan sering menerima " +
      "pertanyaan \"kenapa ongkirnya semahal ini\" dari orang yang batal membeli, dan situsnya tidak " +
      "punya fitur simpan alamat untuk pembeli yang kembali.",
    roleDescription:
      "Kamu adalah desainer produk yang diminta memperbaiki satu titik keputusan dalam alur ini — bukan " +
      "merombak seluruh halaman pembayaran. Tim engineering menyediakan waktu untuk satu perubahan " +
      "berukuran sedang.\n\n" +
      "Yang dinilai bukan kecantikan tampilan, melainkan apakah orang lain bisa memahami alur sebelum dan " +
      "sesudah usulanmu tanpa penjelasan lisan darimu, dan apakah alasan di balik setiap keputusan " +
      "desainmu bisa dipertahankan.",
    criteria: {
      "Flow clarity": {
        description:
          "Seberapa jelas kamu menggambarkan alur sebelum dan sesudah, sehingga orang yang belum pernah " +
          "melihat situs ini bisa mengikuti perubahannya.",
        reviewInstruction:
          "Cari deskripsi berurutan atas langkah-langkah, dengan perbedaan sebelum dan sesudah yang bisa " +
          "ditunjuk. Beri nilai tinggi jika peserta menyebut apa yang dilihat pengguna di tiap langkah, " +
          "bukan hanya nama layarnya. Turunkan nilai jika perubahannya harus ditebak karena hanya " +
          "dijelaskan sebagai kesan umum. Kutip bagian yang menggambarkan alurnya.",
      },
      "Interaction rationale": {
        description:
          "Seberapa kuat alasan di balik setiap keputusan desain, dan seberapa jujur kamu menyebut apa " +
          "yang dikorbankan oleh keputusan itu.",
        reviewInstruction:
          "Nilai apakah tiap perubahan disertai alasan yang merujuk pada masalah dalam kasus — ongkir " +
          "yang mengejutkan, sebelas kolom wajib, atau tidak adanya simpan alamat. Beri nilai tinggi jika " +
          "peserta menyebut trade-off dari usulannya. Turunkan nilai untuk perubahan yang dibenarkan " +
          "hanya dengan menyebut praktik umum tanpa mengaitkannya ke kasus ini. Kutip alasannya.",
      },
      Presentation: {
        description:
          "Seberapa mudah pekerjaanmu ditinjau: susunan yang runtut, penamaan yang konsisten, dan usulan " +
          "yang bisa ditemukan tanpa membaca ulang seluruhnya.",
        reviewInstruction:
          "Nilai keterbacaan, bukan estetika. Beri nilai tinggi jika usulan utama muncul lebih awal dan " +
          "istilah dipakai secara konsisten. Turunkan nilai jika pembaca harus menyusun sendiri urutan " +
          "argumennya. Jangan menghukum keterbatasan alat gambar. Kutip bagian yang menjadi dasar " +
          "penilaian.",
      },
    },
  },
};

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const dryRun = !process.argv.includes("--apply");

try {
  for (const [id, project] of Object.entries(PROJECTS)) {
    const [row] = await sql`select title from arena.projects where id = ${id}`;
    if (!row) throw new Error(`project ${id} not found`);
    if (row.title !== project.title) throw new Error(`title mismatch for ${id}: ${row.title}`);

    const [subs] = await sql`select count(*)::int as n from arena.submissions where project_id = ${id}`;
    if (subs.n > 0) throw new Error(`${project.title} has ${subs.n} submissions — refusing to rewrite`);

    if (!dryRun) {
      await sql`update arena.projects
        set case_background = ${project.caseBackground},
            role_description = ${project.roleDescription},
            updated_at = now()
        where id = ${id}`;
    }

    const criteria = await sql`select id, name from arena.project_rubric_criteria where project_id = ${id}`;
    for (const criterion of criteria) {
      const copy = project.criteria[criterion.name];
      if (!copy) throw new Error(`no copy written for criterion "${criterion.name}" of ${project.title}`);
      if (!dryRun) {
        await sql`update arena.project_rubric_criteria
          set description = ${copy.description}, review_instruction = ${copy.reviewInstruction}
          where id = ${criterion.id}`;
      }
    }
    console.log(`${dryRun ? "would update" : "updated"}: ${project.title} (${criteria.length} kriteria)`);
  }

  const [left] = await sql`
    select
      (select count(*)::int from arena.projects
        where case_background like '%[PLACEHOLDER]%' or role_description like '%[PLACEHOLDER]%') as projects,
      (select count(*)::int from arena.project_rubric_criteria
        where description like '%[PLACEHOLDER]%' or review_instruction like '%[PLACEHOLDER]%') as criteria`;
  console.log(`\nplaceholder tersisa — projects: ${left.projects}, criteria: ${left.criteria}`);
  if (dryRun) console.log("(dry run — jalankan dengan --apply untuk menulis)");
} catch (error) {
  console.log("FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
