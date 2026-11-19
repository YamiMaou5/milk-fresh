import { db } from '../db.js';
import {
  escapeHTML,
  formatDateTime,
  formatRupiah,
  refreshIcons,
} from '../utils.js';

export function renderDashboardView() {
  const content = document.getElementById('app-content');
  const settings = db.getSettings();
  const lowThresh = Number(settings.lowStockThreshold) || 10;

  const todayStr = new Date().toDateString();
  const validTrx = db.data.transactions.filter((t) => t.status !== 'Dibatalkan');
  const todayTrx = validTrx.filter((t) => new Date(t.createdAt).toDateString() === todayStr);
  const todayExpenses = db.data.expenses.filter((e) => new Date(e.date).toDateString() === todayStr);

  const todayOmzet = todayTrx.reduce((s, t) => s + (Number(t.grandTotal) || 0), 0);
  const todayGross = todayTrx.reduce((s, t) => s + (Number(t.grossProfit) || 0), 0);
  const todayExpenseTotal = todayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const todayNetProfit = todayGross - todayExpenseTotal;
  const todayCups = todayTrx.reduce((s, t) => s + (Number(t.totalItemsCount) || 0), 0);

  const lowStockProducts = db.data.products.filter((p) => p.active && p.stok <= lowThresh);

  // Grafik 7 hari terakhir
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const label = d.toLocaleDateString('id-ID', { weekday: 'short' });
    const daySum = validTrx
      .filter((t) => new Date(t.createdAt).toDateString() === key)
      .reduce((s, t) => s + (Number(t.grandTotal) || 0), 0);
    days.push({ label, total: daySum });
  }
  const maxDayVal = Math.max(1, ...days.map((d) => d.total));

  content.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-top">
          <span>Omzet Hari Ini</span>
          <div class="kpi-icon"><i data-lucide="banknote" style="width:16px;height:16px;"></i></div>
        </div>
        <div class="kpi-value" style="color:var(--primary-green);">${formatRupiah(todayOmzet)}</div>
        <div class="kpi-foot">${todayTrx.length} transaksi hari ini</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top">
          <span>Laba Bersih Hari Ini</span>
          <div class="kpi-icon" style="background:var(--success-bg);color:var(--success);"><i data-lucide="trending-up" style="width:16px;height:16px;"></i></div>
        </div>
        <div class="kpi-value">${formatRupiah(todayNetProfit)}</div>
        <div class="kpi-foot">Laba kotor ${formatRupiah(todayGross)} &minus; biaya ${formatRupiah(todayExpenseTotal)}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top">
          <span>Produk Terjual Hari Ini</span>
          <div class="kpi-icon" style="background:var(--accent-cocoa-soft);color:var(--accent-cocoa);"><i data-lucide="milk" style="width:16px;height:16px;"></i></div>
        </div>
        <div class="kpi-value">${todayCups} unit</div>
        <div class="kpi-foot">Total gelas &amp; botol keluar</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top">
          <span>Peringatan Stok Menipis</span>
          <div class="kpi-icon" style="background:${lowStockProducts.length > 0 ? 'var(--warning-bg)' : 'var(--primary-green-soft)'};color:${lowStockProducts.length > 0 ? 'var(--warning)' : 'var(--primary-green)'};">
            <i data-lucide="alert-triangle" style="width:16px;height:16px;"></i>
          </div>
        </div>
        <div class="kpi-value">${lowStockProducts.length} menu</div>
        <div class="kpi-foot">Batas aman &gt; ${lowThresh} unit</div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Grafik Penjualan 7 Hari Terakhir</h3>
        </div>
        <div class="chart-bars">
          ${days
            .map((d) => {
              const pct = Math.max(4, Math.round((d.total / maxDayVal) * 100));
              const shortVal = d.total >= 1000 ? `${Math.round(d.total / 1000)}k` : d.total;
              return `
                <div class="chart-bar-col">
                  <div class="chart-bar-val">${shortVal}</div>
                  <div class="chart-bar-fill" style="height:${pct}%;"></div>
                  <div class="chart-bar-label">${escapeHTML(d.label)}</div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Stok Perlu Restock (&le; ${lowThresh} unit)</h3>
        </div>
        ${
          lowStockProducts.length === 0
            ? `<div style="padding:24px 12px;text-align:center;color:var(--text-muted);font-size:13px;">
                Seluruh stok produk susu murni dalam kondisi aman.
              </div>`
            : `
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>Ukuran</th>
                      <th>Sisa</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${lowStockProducts
                      .map(
                        (p) => `
                      <tr>
                        <td><strong>${escapeHTML(p.name)}</strong></td>
                        <td>${escapeHTML(p.size)}</td>
                        <td><span class="badge ${p.stok === 0 ? 'badge-danger' : 'badge-warning'}">${p.stok} unit</span></td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
        }
      </div>
    </div>

    <div class="card" style="margin-top:16px;">
      <div class="card-header">
        <h3 class="card-title">Transaksi Terbaru</h3>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>No. Transaksi</th>
              <th>Waktu</th>
              <th>Kasir</th>
              <th>Pelanggan</th>
              <th>Metode</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${
              db.data.transactions.length === 0
                ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px;">Belum ada transaksi tercatat.</td></tr>`
                : db.data.transactions
                    .slice(0, 8)
                    .map(
                      (t) => `
                    <tr>
                      <td class="selectable-text" style="font-family:var(--font-mono);font-weight:700;">${escapeHTML(t.transactionNumber)}</td>
                      <td>${formatDateTime(t.createdAt)}</td>
                      <td>${escapeHTML(t.cashierName || '-')}</td>
                      <td>${escapeHTML(t.customerName || '-')}</td>
                      <td>${escapeHTML(t.paymentMethod)}</td>
                      <td style="font-weight:800;color:var(--primary-green);">${formatRupiah(t.grandTotal)}</td>
                      <td><span class="badge ${t.status === 'Dibatalkan' ? 'badge-danger' : 'badge-success'}">${escapeHTML(t.status)}</span></td>
                    </tr>
                  `
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  refreshIcons();
}
