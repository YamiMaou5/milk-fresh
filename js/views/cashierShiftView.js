import { auth } from '../auth.js';
import { db } from '../db.js';
import {
  escapeHTML,
  formatDateTime,
  formatRupiah,
  refreshIcons,
} from '../utils.js';

export function renderCashierShiftView() {
  const content = document.getElementById('app-content');
  const currentUser = auth.getUser();
  const settings = db.getSettings();
  let scopeMode = 'mine'; // 'mine' | 'all_today'

  function render() {
    const todayStr = new Date().toDateString();
    const todayTrx = db.data.transactions.filter((t) => {
      if (t.status === 'Dibatalkan') return false;
      const isToday = new Date(t.createdAt).toDateString() === todayStr;
      if (!isToday) return false;
      return scopeMode === 'mine' ? t.cashierId === currentUser.id : true;
    });

    const totalCash = todayTrx
      .filter((t) => t.paymentMethod === 'Tunai')
      .reduce((s, t) => s + (Number(t.grandTotal) || 0), 0);

    const totalNonCash = todayTrx
      .filter((t) => t.paymentMethod !== 'Tunai')
      .reduce((s, t) => s + (Number(t.grandTotal) || 0), 0);

    const totalSales = totalCash + totalNonCash;
    const totalCupSold = todayTrx.reduce((s, t) => s + (Number(t.totalItemsCount) || 0), 0);

    content.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header" style="margin-bottom:10px;">
          <div>
            <h3 class="card-title">Rekap Setoran &amp; Tutup Shift Kasir</h3>
            <p style="font-size:12px;color:var(--text-secondary);margin-top:2px;">
              Petugas Kasir: <strong>${escapeHTML(currentUser.fullName)}</strong> (@${escapeHTML(currentUser.username)})
            </p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="cat-pill ${scopeMode === 'mine' ? 'active' : ''}" id="shift-scope-mine">
              Shift Saya Hari Ini
            </button>
            <button type="button" class="cat-pill ${scopeMode === 'all_today' ? 'active' : ''}" id="shift-scope-all">
              Semua Shift Hari Ini
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="btn-print-shift-report">
              <i data-lucide="printer"></i>
              <span>Cetak Slip Setoran</span>
            </button>
          </div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-top">
            <span>Uang Tunai Laci (Wajib Setor)</span>
            <div class="kpi-icon"><i data-lucide="banknote" style="width:16px;height:16px;"></i></div>
          </div>
          <div class="kpi-value" style="color:var(--primary-green);">${formatRupiah(totalCash)}</div>
          <div class="kpi-foot">Total pembayaran tunai hari ini</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span>Pembayaran Non-Tunai</span>
            <div class="kpi-icon" style="background:var(--info-bg);color:var(--info);"><i data-lucide="qr-code" style="width:16px;height:16px;"></i></div>
          </div>
          <div class="kpi-value">${formatRupiah(totalNonCash)}</div>
          <div class="kpi-foot">QRIS, Transfer &amp; E-Wallet</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span>Total Penjualan Shift</span>
            <div class="kpi-icon" style="background:var(--accent-cocoa-soft);color:var(--accent-cocoa);"><i data-lucide="wallet" style="width:16px;height:16px;"></i></div>
          </div>
          <div class="kpi-value">${formatRupiah(totalSales)}</div>
          <div class="kpi-foot">${todayTrx.length} transaksi sukses</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span>Produk Terjual</span>
            <div class="kpi-icon"><i data-lucide="milk" style="width:16px;height:16px;"></i></div>
          </div>
          <div class="kpi-value">${totalCupSold} item</div>
          <div class="kpi-foot">Total gelas &amp; botol keluar</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Rincian Transaksi Shift (${todayTrx.length})</h3>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>No. Transaksi</th>
                <th>Waktu</th>
                <th>Pelanggan</th>
                <th>Item Pesanan</th>
                <th>Metode</th>
                <th>Status</th>
                <th>Total Bayar</th>
              </tr>
            </thead>
            <tbody>
              ${
                todayTrx.length === 0
                  ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada transaksi tercatat pada shift ini.</td></tr>`
                  : todayTrx
                      .map((t) => {
                        const itemSummary = t.items.map((i) => `${i.productName} (${i.qty}x)`).join(', ');
                        return `
                          <tr>
                            <td class="selectable-text" style="font-family:var(--font-mono);font-weight:700;">${escapeHTML(t.transactionNumber)}</td>
                            <td>${formatDateTime(t.createdAt)}</td>
                            <td>${escapeHTML(t.customerName || '-')}</td>
                            <td>${escapeHTML(itemSummary)}</td>
                            <td><span class="badge badge-neutral">${escapeHTML(t.paymentMethod)}</span></td>
                            <td><span class="badge badge-success">${escapeHTML(t.status)}</span></td>
                            <td style="font-weight:800;color:var(--primary-green);">${formatRupiah(t.grandTotal)}</td>
                          </tr>
                        `;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    refreshIcons();

    document.getElementById('shift-scope-mine')?.addEventListener('click', () => {
      scopeMode = 'mine';
      render();
    });

    document.getElementById('shift-scope-all')?.addEventListener('click', () => {
      scopeMode = 'all_today';
      render();
    });

    document.getElementById('btn-print-shift-report')?.addEventListener('click', () => {
      const printArea = document.getElementById('print-area');
      if (!printArea) return;
      printArea.innerHTML = `
        <div style="max-width:300px;margin:0 auto;padding:12px;font-family:monospace;font-size:12px;line-height:1.45;">
          <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;">
            <strong style="font-size:14px;">${escapeHTML(settings.storeName)}</strong><br/>
            <span>SLIP REKAP SETORAN KASIR</span><br/>
            <span>${formatDateTime(new Date().toISOString())}</span>
          </div>
          <div>Kasir: ${escapeHTML(currentUser.fullName)}</div>
          <div>Total Transaksi: ${todayTrx.length}</div>
          <div>Total Item Terjual: ${totalCupSold}</div>
          <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:8px 0;margin:8px 0;">
            <div>Uang Tunai Laci : <strong>${formatRupiah(totalCash)}</strong></div>
            <div>Non-Tunai/QRIS  : <strong>${formatRupiah(totalNonCash)}</strong></div>
            <div style="margin-top:4px;font-size:13px;">TOTAL PENJUALAN : <strong>${formatRupiah(totalSales)}</strong></div>
          </div>
          <div style="margin-top:18px;display:flex;justify-content:space-between;text-align:center;">
            <div>Kasir,<br/><br/><br/>( ${escapeHTML(currentUser.fullName)} )</div>
            <div>Penerima/Admin,<br/><br/><br/>( ................ )</div>
          </div>
        </div>
      `;
      window.print();
    });
  }

  render();
}
