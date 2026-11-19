/**
 * ============================================================================
 * MILK FRESH POS v2.0 — GOOGLE APPS SCRIPT BACKEND (9 TAB + EMAIL OTP + CLOUD)
 * ============================================================================
 */

const TAB_SCHEMAS = {
  TRANSAKSI: [
    'ID_Transaksi', 'No_Transaksi', 'Tanggal_Waktu', 'Tanggal_ISO', 'Pelanggan',
    'Kasir', 'Jumlah_Item', 'Subtotal', 'Diskon', 'Pajak', 'Total_Bayar',
    'Total_Modal', 'Laba_Kotor', 'Metode_Bayar', 'Uang_Diterima', 'Kembalian', 'Status'
  ],
  DETAIL_TRANSAKSI: [
    'Detail_ID', 'ID_Transaksi', 'No_Transaksi', 'Tanggal_Waktu', 'Nama_Produk',
    'Ukuran', 'Qty', 'Harga_Dasar', 'Biaya_Additional', 'Harga_Satuan_Final',
    'Subtotal', 'Additional_Dipilih', 'Catatan'
  ],
  PRODUK: [
    'ID_Produk', 'Nama_Produk', 'Kategori', 'Ukuran', 'Harga_Modal',
    'Harga_Jual', 'Stok_Saat_Ini', 'Status'
  ],
  ADDITIONAL: [
    'ID_Additional', 'Kelompok', 'Nama_Additional', 'Harga_Tambahan',
    'Tipe_Biaya', 'Status'
  ],
  STOK: [
    'ID_Log', 'Waktu', 'Nama_Produk', 'Jenis_Aktivitas', 'Perubahan',
    'Stok_Sebelum', 'Stok_Sesudah', 'Keterangan', 'Oleh'
  ],
  PENGELUARAN: [
    'ID_Pengeluaran', 'No_Pengeluaran', 'Tanggal', 'Kategori',
    'Deskripsi', 'Nominal', 'Dicatat_Oleh'
  ],
  LAPORAN_HARIAN: [
    'Tanggal', 'Jumlah_Transaksi', 'Produk_Terjual', 'Omzet',
    'Total_Modal', 'Laba_Kotor', 'Pengeluaran', 'Laba_Bersih'
  ],
  LAPORAN_BULANAN: [
    'Bulan', 'Jumlah_Transaksi', 'Produk_Terjual', 'Omzet',
    'Total_Modal', 'Laba_Kotor', 'Pengeluaran', 'Laba_Bersih'
  ],
  PENGGUNA: [
    'ID_Pengguna', 'Nama_Lengkap', 'Username', 'Email', 'Role', 'Status', 'Dibuat_Pada'
  ]
};

function doGet(e) {
  return jsonResponse({
    status: 'ok',
    message: 'Endpoint MILK FRESH POS v2.0 aktif.'
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const rawBody = e && e.postData ? e.postData.contents : '{}';
    const payload = JSON.parse(rawBody);

    if (payload.action === 'ping') {
      ensureAllSheetsExist();
      return jsonResponse({
        status: 'ok',
        message: 'Koneksi ke Google Spreadsheet berhasil & 9 tab telah diverifikasi!'
      });
    }

    // Kirim Kode OTP 6-Digit untuk Lupa Password via Email Gmail Pemilik Script
    if (payload.action === 'send_otp') {
      if (!payload.email || !payload.otpCode) {
        return jsonResponse({ status: 'error', message: 'Email atau kode OTP tidak lengkap.' });
      }
      const subject = '[' + (payload.storeName || 'MILK FRESH POS') + '] Kode OTP Reset Password';
      const body =
        'Halo ' + (payload.fullName || 'Pengguna') + ',\n\n' +
        'Kami menerima permintaan reset password untuk akun Anda di ' + (payload.storeName || 'MILK FRESH POS') + '.\n\n' +
        'KODE OTP ANDA: ' + payload.otpCode + '\n\n' +
        'Kode ini berlaku selama 10 menit. Jangan berikan kode ini kepada siapa pun.\n' +
        'Jika Anda tidak meminta reset password, abaikan email ini.';

      MailApp.sendEmail(payload.email, subject, body);
      return jsonResponse({
        status: 'ok',
        message: 'Kode OTP berhasil dikirim ke email.'
      });
    }

    // Tarik snapshot data cloud ke perangkat baru
    if (payload.action === 'pull_all') {
      const ss = ensureAllSheetsExist();
      const metaSheet = ss.getSheetByName('_CLOUD_STATE');
      if (!metaSheet || metaSheet.getLastRow() < 2) {
        return jsonResponse({ status: 'error', message: 'Belum ada data cloud tersimpan.' });
      }
      const snapshot = metaSheet.getRange(2, 2).getValue();
      return jsonResponse({
        status: 'ok',
        cloudSnapshot: snapshot
      });
    }

    if (payload.action === 'sync_all' && payload.tabs) {
      const ss = ensureAllSheetsExist();
      const tabs = payload.tabs;

      const insertedTrx = appendUniqueRows(
        ss.getSheetByName('TRANSAKSI'),
        TAB_SCHEMAS.TRANSAKSI,
        tabs.TRANSAKSI || [],
        'id',
        [
          'id', 'no_transaksi', 'tanggal_waktu', 'tanggal_iso', 'pelanggan',
          'kasir', 'jumlah_item', 'subtotal', 'diskon', 'pajak', 'total_bayar',
          'total_modal', 'laba_kotor', 'metode_bayar', 'uang_diterima', 'kembalian', 'status'
        ]
      );

      appendUniqueRows(
        ss.getSheetByName('DETAIL_TRANSAKSI'),
        TAB_SCHEMAS.DETAIL_TRANSAKSI,
        tabs.DETAIL_TRANSAKSI || [],
        'detail_id',
        [
          'detail_id', 'id_transaksi', 'no_transaksi', 'tanggal_waktu', 'nama_produk',
          'ukuran', 'qty', 'harga_dasar', 'biaya_additional', 'harga_satuan_final',
          'subtotal', 'additional_dipilih', 'catatan'
        ]
      );

      replaceSheetData(ss.getSheetByName('PRODUK'), TAB_SCHEMAS.PRODUK, tabs.PRODUK || [], [
        'id_produk', 'nama_produk', 'kategori', 'ukuran', 'harga_modal', 'harga_jual', 'stok_saat_ini', 'status'
      ]);

      replaceSheetData(ss.getSheetByName('ADDITIONAL'), TAB_SCHEMAS.ADDITIONAL, tabs.ADDITIONAL || [], [
        'id_additional', 'kelompok', 'nama_additional', 'harga_tambahan', 'tipe_biaya', 'status'
      ]);

      replaceSheetData(ss.getSheetByName('STOK'), TAB_SCHEMAS.STOK, tabs.STOK || [], [
        'id_log', 'waktu', 'nama_produk', 'jenis_aktivitas', 'perubahan', 'stok_sebelum', 'stok_sesudah', 'keterangan', 'oleh'
      ]);

      replaceSheetData(ss.getSheetByName('PENGELUARAN'), TAB_SCHEMAS.PENGELUARAN, tabs.PENGELUARAN || [], [
        'id_pengeluaran', 'no_pengeluaran', 'tanggal', 'kategori', 'deskripsi', 'nominal', 'dicatat_oleh'
      ]);

      replaceSheetData(ss.getSheetByName('LAPORAN_HARIAN'), TAB_SCHEMAS.LAPORAN_HARIAN, tabs.LAPORAN_HARIAN || [], [
        'tanggal', 'jumlah_transaksi', 'produk_terjual', 'omzet', 'total_modal', 'laba_kotor', 'pengeluaran', 'laba_bersih'
      ]);

      replaceSheetData(ss.getSheetByName('LAPORAN_BULANAN'), TAB_SCHEMAS.LAPORAN_BULANAN, tabs.LAPORAN_BULANAN || [], [
        'bulan', 'jumlah_transaksi', 'produk_terjual', 'omzet', 'total_modal', 'laba_kotor', 'pengeluaran', 'laba_bersih'
      ]);

      replaceSheetData(ss.getSheetByName('PENGGUNA'), TAB_SCHEMAS.PENGGUNA, tabs.PENGGUNA || [], [
        'id_pengguna', 'nama_lengkap', 'username', 'email', 'role', 'status', 'dibuat_pada'
      ]);

      // Simpan snapshot state agar sinkron lintas perangkat web
      if (payload.cloudSnapshot) {
        let metaSheet = ss.getSheetByName('_CLOUD_STATE');
        if (!metaSheet) {
          metaSheet = ss.insertSheet('_CLOUD_STATE');
          metaSheet.hideSheet();
        }
        metaSheet.clear();
        metaSheet.getRange(1, 1, 1, 2).setValues([['Updated_At', 'Snapshot_JSON']]);
        metaSheet.getRange(2, 1, 1, 2).setValues([[new Date().toISOString(), payload.cloudSnapshot]]);
      }

      return jsonResponse({
        status: 'ok',
        message: 'Sinkronisasi 9 tab & Cloud State selesai! ' + insertedTrx + ' transaksi baru ditambahkan.'
      });
    }

    return jsonResponse({ status: 'error', message: 'Action tidak dikenali.' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function ensureAllSheetsExist() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TAB_SCHEMAS).forEach(function (tabName) {
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    }
    if (sheet.getLastRow() === 0) {
      const headers = TAB_SCHEMAS[tabName];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#2F6F4E')
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  });
  return ss;
}

function appendUniqueRows(sheet, headers, records, idField, keys) {
  if (!records || records.length === 0) return 0;

  const existingIds = {};
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const idColValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    idColValues.forEach(function (row) {
      if (row[0]) existingIds[String(row[0])] = true;
    });
  }

  const newRows = [];
  records.forEach(function (rec) {
    const uid = String(rec[idField] || '');
    if (uid && !existingIds[uid]) {
      existingIds[uid] = true;
      newRows.push(keys.map(function (k) { return rec[k] !== undefined ? rec[k] : ''; }));
    }
  });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  }
  return newRows.length;
}

function replaceSheetData(sheet, headers, records, keys) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }
  if (!records || records.length === 0) return;

  const rows = records.map(function (rec) {
    return keys.map(function (k) { return rec[k] !== undefined ? rec[k] : ''; });
  });
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
