import { db } from './db.js';
import { generateId } from './utils.js';

export async function syncSingleTransactionToSheets(trx) {
  const settings = db.getSettings();
  const url = (settings.googleAppsScriptUrl || '').trim();
  if (!url) throw new Error('URL Google Apps Script belum diisi di Pengaturan.');

  if (db.data.syncedTransactionIds.includes(trx.id)) {
    return { status: 'already_synced' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'sync_transactions',
      storeName: settings.storeName,
      transactions: [trx],
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  db.data.syncedTransactionIds.push(trx.id);
  db.data.syncLogs.unshift({
    id: generateId('SYNC'),
    timestamp: new Date().toISOString(),
    count: 1,
    status: 'BERHASIL',
    note: `Auto-sync ${trx.transactionNumber}`,
  });
  db.save();
  return { status: 'synced' };
}

export async function syncAllPendingToSheets() {
  const settings = db.getSettings();
  const url = (settings.googleAppsScriptUrl || '').trim();
  if (!url) throw new Error('URL Google Apps Script belum diisi.');

  const syncedSet = new Set(db.data.syncedTransactionIds);
  const pending = db.data.transactions.filter((t) => !syncedSet.has(t.id));

  if (pending.length === 0) {
    return { syncedCount: 0 };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'sync_transactions',
      storeName: settings.storeName,
      transactions: pending,
    }),
  });

  if (!res.ok) throw new Error(`Gagal menghubungi Google Sheets (HTTP ${res.status})`);

  for (const t of pending) {
    db.data.syncedTransactionIds.push(t.id);
  }
  db.data.syncLogs.unshift({
    id: generateId('SYNC'),
    timestamp: new Date().toISOString(),
    count: pending.length,
    status: 'BERHASIL',
    note: `Sinkronisasi massal ${pending.length} transaksi`,
  });
  db.save();
  return { syncedCount: pending.length };
}
