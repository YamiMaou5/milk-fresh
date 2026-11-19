import { auth } from '../auth.js';
import { db } from '../db.js';
import {
  escapeHTML,
  formatDateTime,
  generateId,
  refreshIcons,
  showToast,
} from '../utils.js';

export function renderStockView() {
  const content = document.getElementById('app-content');
  const currentUser = auth.getUser();
  const isAdmin = auth.isAdmin();
  const settings = db.getSettings();
  const lowThresh = Number(settings.lowStockThreshold) || 10;

  function revertStockLog(logId) {
    const idx = db.data.stockLogs.findIndex((l) => l.id === logId);
    if (idx === -1) return;
    const log = db.data.stockLogs[idx];
    const change = Number(log.qtyChange) || 0;

    if (log.productId) {
      const prod = db.data.products.find((p) => p.id === log.productId);
      if (prod) {
        prod.stok = Math.max(0, (Number(prod.stok) || 0) - change);
      }
    }

    db.data.stockLogs.splice(idx, 1);
    db.save();
  }

  function deleteProductFromStock(productId) {
    const prod = db.data.products.find((p) => p.id === productId);
    if (!prod) return;
    db.data.products = db.data.products.filter((p) => p.id !== productId);
    db.data.stockLogs.unshift({
      id: generateId('SLOG'),
      createdAt: new Date().toISOString(),
      productId: prod.id,
      productName: `${prod.name} (${prod.size})`,
      type: 'HAPUS_PRODUK',
      qtyChange: -(Number(prod.stok) || 0),
      stockAfter: 0,
      note: 'Produk dihapus dari daftar stok',
      actor: currentUser?.fullName || 'Admin',
    });
    db.save();
  }

  function render() {
    const products = db.data.products;

    content.innerHTML = `
      ${
        isAdmin
          ? `
            <div class="card" style="margin-bottom:16px;">
              <div class="card-header">
                <h3 class="card-title">Penyesuaian Stok Masuk / Keluar (Admin)</h3>
              </div>
              <form id="stock-adjust-form" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px;align-items:end;">
                <div>
                  <label class="form-label">Pilih Produk *</label>
                  <select id="stk-prod-id" class="form-control" required>
                    ${products
                      .map((p) => `<option value="${p.id}">${escapeHTML(p.name)} (${escapeHTML(p.size)}) — Sisa: ${p.stok}</option>`)
                      .join('')}
                  </select>
                </div>
                <div>
                  <label class="form-label">Jenis Mutasi *</label>
                  <select id="stk-type" class="form-control" required>
                    <option value="STOK_MASUK">+ Stok Masuk (Restock)</option>
                    <option value="STOK_KELUAR">- Stok Keluar (Rusak / Basi)</option>
                  </select>
                </div>
                <div>
                  <label class="form-label">Jumlah Unit *</label>
                  <input type="number" id="stk-qty" class="form-control" min="1" value="10" required />
                </div>
                <div>
                  <label class="form-label">Keterangan</label>
                  <input type="text" id="stk-note" class="form-control" placeholder="Contoh: Kiriman susu pagi" />
                </div>
                <div>
                  <button type="submit" class="btn btn-primary btn-block">Simpan Stok</button>
                </div>
              </form>
            </div>
          `
          : `
            <div class="card" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <div>
                <h3 class="card-title">Daftar Ketersediaan Stok Menu</h3>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:2px;">
                  Gunakan halaman ini untuk mengecek sisa stok produk sebelum menerima pesanan pelanggan.
                </p>
              </div>
              <span class="badge badge-neutral">Akses Kasir: Lihat Stok</span>
            </div>
          `
      }

      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <h3 class="card-title">Status Stok Saat Ini (${products.length} Produk)</h3>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nama Produk</th>
                <th>Ukuran</th>
                <th>Sisa Stok</th>
                <th>Status Ketersediaan</th>
                ${isAdmin ? `<th>Aksi</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${
                products.length === 0
                  ? `<tr><td colspan="${isAdmin ? 5 : 4}" style="text-align:center;color:var(--text-muted);padding:20px;">Belum ada produk di daftar stok.</td></tr>`
                  : products
                      .map((p) => {
                        const statusBadge =
                          p.stok <= 0
                            ? `<span class="badge badge-danger">Habis</span>`
                            : p.stok <= lowThresh
                            ? `<span class="badge badge-warning">Menipis (Segera Info Admin)</span>`
                            : `<span class="badge badge-success">Stok Aman</span>`;
                        return `
                          <tr>
                            <td><strong>${escapeHTML(p.name)}</strong></td>
                            <td>${escapeHTML(p.size)}</td>
                            <td style="font-size:14px;font-weight:800;">${p.stok} unit</td>
                            <td>${statusBadge}</td>
                            ${
                              isAdmin
                                ? `<td>
                                    <button type="button" class="btn btn-outline-danger btn-sm" data-del-stock-prod="${p.id}">
                                      Hapus
                                    </button>
                                  </td>`
                                : ''
                            }
                          </tr>
                        `;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      ${
        isAdmin
          ? `
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Riwayat Mutasi Stok Terbaru (${db.data.stockLogs.length})</h3>
              </div>
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Produk</th>
                      <th>Jenis</th>
                      <th>Perubahan</th>
                      <th>Stok Akhir</th>
                      <th>Catatan</th>
                      <th>Petugas</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      db.data.stockLogs.length === 0
                        ? `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px;">Belum ada riwayat mutasi stok.</td></tr>`
                        : db.data.stockLogs
                            .slice(0, 50)
                            .map(
                              (log) => `
                            <tr>
                              <td>${formatDateTime(log.createdAt)}</td>
                              <td><strong>${escapeHTML(log.productName)}</strong></td>
                              <td><span class="badge badge-neutral">${escapeHTML(log.type)}</span></td>
                              <td style="font-weight:700;color:${log.qtyChange >= 0 ? 'var(--success)' : 'var(--danger)'};">
                                ${log.qtyChange >= 0 ? `+${log.qtyChange}` : log.qtyChange}
                              </td>
                              <td><strong>${log.stockAfter}</strong></td>
                              <td>${escapeHTML(log.note || '-')}</td>
                              <td>${escapeHTML(log.actor || '-')}</td>
                              <td>
                                <button type="button" class="btn btn-outline-danger btn-sm" data-del-stock-log="${log.id}">
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          `
                            )
                            .join('')
                    }
                  </tbody>
                </table>
              </div>
            </div>
          `
          : ''
      }
    `;

    refreshIcons();

    document.getElementById('stock-adjust-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!isAdmin) return;
      try {
        const prodId = document.getElementById('stk-prod-id').value;
        const type = document.getElementById('stk-type').value;
        const qty = document.getElementById('stk-qty').value;
        const note = document.getElementById('stk-note').value;
        db.adjustStock(prodId, type, qty, note, currentUser.fullName);
        showToast('Stok produk berhasil diperbarui.', 'success');
        render();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    content.querySelectorAll('[data-del-stock-prod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!isAdmin) return;
        const pid = btn.getAttribute('data-del-stock-prod');
        const prod = db.data.products.find((p) => p.id === pid);
        if (!prod) return;
        if (!window.confirm(`Hapus produk "${prod.name} (${prod.size})" dari daftar stok?`)) return;
        deleteProductFromStock(pid);
        showToast(`Produk "${prod.name}" dihapus dari stok.`, 'warning');
        render();
      });
    });

    content.querySelectorAll('[data-del-stock-log]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!isAdmin) return;
        const logId = btn.getAttribute('data-del-stock-log');
        const log = db.data.stockLogs.find((l) => l.id === logId);
        if (!log) return;
        if (!window.confirm(`Hapus riwayat mutasi "${log.productName} (${log.qtyChange >= 0 ? '+' : ''}${log.qtyChange})"? Sisa stok produk akan disesuaikan otomatis.`)) return;
        revertStockLog(logId);
        showToast('Riwayat mutasi dihapus & sisa stok disesuaikan.', 'warning');
        render();
      });
    });
  }

  render();
}
