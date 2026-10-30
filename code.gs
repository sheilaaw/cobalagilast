// Google Apps Script – penerima data Porsiku
// Tempel di Extensions > Apps Script pada Google Sheet (harus dibuka dari Sheet-nya, bukan script.google.com langsung).
// LANGKAH WAJIB sesudah menempel:
//  1) Pilih fungsi "izinkan" di dropdown atas > klik Run > Review permissions > Allow (untuk Sheets + Drive).
//  2) Deploy > Manage deployments > Edit (ikon pensil) > Version: New version > Deploy.
//     Execute as: Me | Who has access: Anyone
//  3) Tes: buka URL /exec di browser, harus muncul {"ok":true,...}
const TOKEN = 'PORSIKU1234'; // samakan dengan CONFIG.TOKEN di script.js
const FOLDER = 'Bukti Bayar Porsiku';

const SHEETS = {
  pengguna: {
    nama: 'Data Pengguna',
    kolom: ['nama','jk','usia','bb','tb','aktivitas','alergi','imt','kategori','bmr','tee'],
    judul: ['Nama','Jenis kelamin','Usia','BB (kg)','TB (cm)','Aktivitas','Alergi','IMT','Kategori IMT','BMR (kkal)','Total energi (kkal)']
  },
  konsultasi: {
    nama: 'Konsultasi',
    kolom: ['kode','nama','jk','usia','bb','tb','aktivitas','alergi','imt','kategori','bmr','tee','menu','keluhan','_bukti'],
    judul: ['Kode','Nama','Jenis kelamin','Usia','BB (kg)','TB (cm)','Aktivitas','Alergi','IMT','Kategori IMT','BMR (kkal)','Total energi (kkal)','Menu dipilih','Keluhan','Bukti bayar']
  }
};

function balas(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Jalankan SEKALI dari editor supaya Google meminta izin Drive & Sheets
function izinkan() {
  SpreadsheetApp.getActiveSpreadsheet().getName();
  const it = DriveApp.getFoldersByName(FOLDER);
  if (!it.hasNext()) DriveApp.createFolder(FOLDER);
}

// Untuk tes cepat lewat browser
function doGet() {
  return balas({ ok: true, pesan: 'Porsiku aktif' });
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const cfg = SHEETS[d.tipe];
    if (d.token !== TOKEN || !cfg) return balas({ ok: false, pesan: 'ditolak' });

    // 1) simpan foto bukti ke Drive. Kalau gagal, data tetap masuk ke Sheet.
    let link = '', galatDrive = '';
    if (d.tipe === 'konsultasi' && d.bukti) {
      try {
        const b64 = String(d.bukti).replace(/^data:image\/\w+;base64,/, '');
        const it = DriveApp.getFoldersByName(FOLDER);
        const folder = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER);
        const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', (d.kode || 'bukti') + ' - ' + d.nama + '.jpg');
        const file = folder.createFile(blob);
        link = file.getUrl();
        try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) {}
      } catch (err) {
        galatDrive = String(err);
      }
    }

    // 2) tulis ke Google Sheet
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sh = ss.getSheetByName(cfg.nama) || ss.insertSheet(cfg.nama);
      if (sh.getLastRow() === 0) {
        sh.appendRow(['Waktu', ...cfg.judul]);
        sh.getRange(1, 1, 1, cfg.judul.length + 1).setFontWeight('bold').setBackground('#dcebe8');
        sh.setFrozenRows(1);
      }
      // cegah baris ganda kalau browser mengirim ulang dengan kode yang sama
      if (d.tipe === 'konsultasi' && d.kode && sh.getLastRow() > 1) {
        const kodeAda = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().flat();
        if (kodeAda.indexOf(d.kode) !== -1) return balas({ ok: true, url: link, dobel: true });
      }
      const isiBukti = link || (galatDrive ? 'GAGAL SIMPAN: ' + galatDrive : '');
      sh.appendRow([new Date(), ...cfg.kolom.map(k => k === '_bukti' ? isiBukti : (d[k] === undefined ? '' : d[k]))]);
    } finally {
      lock.releaseLock();
    }
    return balas({ ok: true, url: link, drive: galatDrive });
  } catch (err) {
    return balas({ ok: false, pesan: String(err) });
  }
}