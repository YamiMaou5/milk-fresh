import { auth } from '../auth.js';
import { db } from '../db.js';
import {
  closeModal,
  escapeHTML,
  formatDateTime,
  formatRupiah,
  hashPassword,
  openModal,
  printReceipt,
  refreshIcons,
  showToast,
} from '../utils.js';

export function renderOrdersView() {
  const content = document.getElementById('app-content');
  const currentUser = auth.getUser();
  const isAdmin = auth.isAdmin();
  const settings = db.getSettings();
  let statusFilter = 'ALL';
  let searchQuery = '';

  async function verifyAdminPasswordForCancel(plainPassword) {
    const adminUser = auth.getUser();
    if (!adminUser || adminUser.role !== 'admin') {
      throw new Error('Hanya Administrator yang bisa membatalkan pesanan.');
    }
    if (!plainPassword) {
      throw new Error('Masukkan password Admin terlebih dahulu.');
    }
    const inputHash = await hashPassword(plainPassword, adminUser.salt);
    if (inputHash !== adminUser.passwordHash) {
      throw new Error('Password Admin salah. Pembatalan dibatalkan.');
    }
    return true;
  }

  function openCancelOrderModal(trx) {
    openModal({
      title: `Konfirmasi Batalkan Pesanan — ${trx.transactionNumber}`,
      bodyHTML: `
        <div style="padding:10px 12px;background:var(--danger-bg);border:1px solid #fecaca;border-radius:9px;margin-bottom:12px;color:var(--danger);font-size:12px;">
          <strong>Peringatan:</strong> Membatalkan pesanan akan mengubah status menjadi <strong>Dibatalkan</strong> dan mengembalikan stok produk.
        </div>
        <div style="padding:10px 12px;background:var(--surface-subtle);border-radius:9px;margin-bottom:12px;font-size:12.5px;">
          <div>No. Transaksi: <strong>${escapeHTML(trx.transactionNumber)}</strong></div>
          <div>Pelanggan: <strong>${escapeHTML(trx.customerName || '-')}</strong> • Total: <strong>${formatRupiah(trx.grandTotal)}</strong></div>
        </div>
        <form id="confirm-cancel-ord-form" autocomplete="off">
          <div class="form-group">
            <label class="form-label">Masukkan Password Admin untuk Membatalkan *</label>
            <input type="password" id="cancel-ord-admin-pw" class="form-control" autocomplete="new-password" placeholder="Masukkan password Admin" required />
          </div>
          <div id="cancel-ord-err" class="hidden" style="color:var(--danger);font-size:12px;font-weight:600;margin-bottom:10px;"></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button type="button" class="btn btn-outline" id="btn-close-cancel-ord">Tutup</button>
            <button type="submit" class="btn btn-outline-danger">Ya, Batalkan Pesanan</button>
          </div>
        </form>
      `,
    });

    const pwInput = document.getElementById('cancel-ord-admin-pw');
    const errBox = document.getElementById('cancel-ord-err');
    setTimeout(() => pwInput?.focus(), 50);

    document.getElementById('btn-close-cancel-ord')?.addEventListener('click', closeModal);

    document.getElementById('confirm-cancel-ord-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox?.classList.add('hidden');
      try {
        await verifyAdminPasswordForCancel(pwInput.value);
        db.updateOrderStatus(trx.id, 'Dibatalkan', currentUser.fullName);
        closeModal();
        showToast(`Pesanan ${trx.transactionNumber} dibatalkan & stok dikembalikan.`, 'warning');
        render();
      } catch (err) {
        if (errBox) {
          errBox.textContent = err.message || 'Password Admin salah.';
          errBox.classList.remove('hidden');
        } else {
          showToast(err.message, 'error');
        }
      }
    });
  }

  function openSettleOpenBillModal(trx) {
    let settleMethod = settings.paymentMethods?.[0] || 'Tunai';
    let settleCash = trx.grandTotal;

    function renderSettleModal() {
      const change = settleMethod === 'Tunai' ? Math.max(0, settleCash - trx.grandTotal) : 0;
      openModal({
        title: `Pelunasan Open Bill — ${trx.transactionNumber}`,
        bodyHTML: `
          <div style="padding:10px 12px;background:var(--surface-subtle);border-radius:9px;margin-bottom:12px;">
            <div style="font-size:12px;color:var(--text-secondary);">Pelanggan: <strong>${escapeHTML(trx.customerName || '-')}</strong></div>
            <div style="font-size:16px;font-weight:800;color:var(--primary-green);margin-top:4px;">Total Tagihan: ${formatRupiah(trx.grandTotal)}</div>
          </div>

          <div class="form-group">
            <label class="form-label">Metode Pembayaran *</label>
            <select id="stl-method" class="form-control">
              ${(settings.paymentMethods || ['Tunai', 'QRIS'])
                .map((m) => `<option value="${escapeHTML(m)}" ${m === settleMethod ? 'selected' : ''}>${escapeHTML(m)}</option>`)
                .join('')}
            </select>
          </div>

          ${
            settleMethod === 'Tunai'
              ? `
                <div class="form-group">
                  <label class="form-label">Uang Tunai Diterima (Rp) *</label>
                  <input type="number" id="stl-cash" class="form-control" value="${settleCash}" min="${trx.grandTotal}" step="500" />
                  <div style="margin-top:6px;font-size:13px;font-weight:700;color:var(--accent-cocoa);">
                    Kembalian: <span id="stl-change">${formatRupiah(change)}</span>
                  </div>
                </div>
              `
              : ''
          }
        `,
        footerHTML: `
          <button type="button" class="btn btn-outline" id="stl-cancel">Batal</button>
          <button type="button" class="btn btn-primary" id="stl-confirm">Konfirmasi Lunas &amp; Cetak Struk</button>
        `,
      });

      document.getElementById('stl-method')?.addEventListener('change', (e) => {
        settleMethod = e.target.value;
        if (settleMethod !== 'Tunai') settleCash = trx.grandTotal;
        renderSettleModal();
      });

      document.getElementById('stl-cash')?.addEventListener('input', (e) => {
        settleCash = Math.max(0, Number(e.target.value) || 0);
        const chgEl = document.getElementById('stl-change');
        if (chgEl) chgEl.textContent = formatRupiah(Math.max(0, settleCash - trx.grandTotal));
      });

      document.getElementById('stl-cancel')?.addEventListener('click', closeModal);

      document.getElementById('stl-confirm')?.addEventListener('click', () => {
        if (settleMethod === 'Tunai' && settleCash < trx.grandTotal) {
          showToast('Nominal uang tunai kurang dari tagihan.', 'error');
          return;
        }
        trx.paymentMethod = settleMethod;
        trx.amountPaid = settleMethod === 'Tunai' ? settleCash : trx.grandTotal;
        trx.changeAmount = settleMethod === 'Tunai' ? Math.max(0, settleCash - trx.grandTotal) : 0;
        trx.status = 'Selesai';
        db.save();

        closeModal();
        showToast(`Tagihan ${trx.transactionNumber} berhasil dilunasi!`, 'success');
        printReceipt(trx, db.getSettings());
        render();
      });
    }

    renderSettleModal();
  }

  function render() {
    const filtered = db.data.transactions.filter((t) => {
      const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        t.transactionNumber.toLowerCase().includes(q) ||
        (t.customerName || '').toLowerCase().includes(q) ||
        (t.cashierName || '').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });

    content.innerHTML = `
      <div class="card" style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
          <input type="text" id="ord-search" class="form-control" style="max-width:300px;"
            value="${escapeHTML(searchQuery)}" placeholder="Cari nomor transaksi atau nama pelanggan..." />
          ${
            !isAdmin
              ? `<span class="badge badge-neutral">Mode Kasir: Lunasi Open Bill, Selesaikan Pesanan &amp; Cetak Struk</span>`
              : `<span class="badge badge-cocoa">Mode Admin: Kontrol penuh status &amp; pembatalan</span>`
          }
        </div>

        <div class="cat-pills-row" style="margin-bottom:0;">
          ${['ALL', 'Menunggu pembayaran', 'Sedang diproses', 'Selesai', 'Dibatalkan']
            .map(
              (st) => `
            <button type="button" class="cat-pill ${statusFilter === st ? 'active' : ''}" data-ord-status="${st}">
              ${st === 'ALL' ? 'Semua Pesanan' : st === 'Menunggu pembayaran' ? 'Open Bill (Belum Bayar)' : st}
            </button>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>No. Transaksi</th>
                <th>Waktu</th>
                <th>Pelanggan</th>
                <th>Detail Pesanan</th>
                <th>Total</th>
                <th>Pembayaran &amp; Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${
                filtered.length === 0
                  ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">Tidak ada pesanan yang sesuai filter.</td></tr>`
                  : filtered
                      .map((t) => {
                        const itemsText = t.items
                          .map((i) => {
                            const addons = (i.additionals || []).map((a) => a.name).join(', ');
                            return `${i.qty}x ${i.productName} (${i.size})${addons ? ` [${addons}]` : ''}`;
                          })
                          .join('; ');

                        const isUnpaid = t.status === 'Menunggu pembayaran';
                        const badgeClass =
                          t.status === 'Selesai' || t.status === 'Sudah dibayar'
                            ? 'badge-success'
                            : t.status === 'Sedang diproses'
                            ? 'badge-info'
                            : isUnpaid
                            ? 'badge-warning'
                            : 'badge-danger';

                        return `
                          <tr>
                            <td class="selectable-text" style="font-family:var(--font-mono);font-weight:700;">${escapeHTML(t.transactionNumber)}</td>
                            <td>${formatDateTime(t.createdAt)}</td>
                            <td><strong>${escapeHTML(t.customerName || '-')}</strong></td>
                            <td style="max-width:250px;">${escapeHTML(itemsText)}</td>
                            <td style="font-weight:800;">${formatRupiah(t.grandTotal)}</td>
                            <td>
                              <span class="badge ${badgeClass}">${escapeHTML(isUnpaid ? 'Open Bill (Belum Bayar)' : t.status)}</span><br/>
                              <small style="color:var(--text-muted);">${escapeHTML(t.paymentMethod)}</small>
                            </td>
                            <td>
                              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                                ${
                                  isUnpaid
                                    ? `<button type="button" class="btn btn-primary btn-sm" data-settle-ord="${t.id}">Lunasi Bayar</button>`
                                    : t.status !== 'Dibatalkan' && t.status !== 'Selesai'
                                    ? `<button type="button" class="btn btn-primary btn-sm" data-complete-ord="${t.id}">Pesanan Selesai</button>`
                                    : ''
                                }
                                <button type="button" class="btn btn-outline btn-sm" data-print-ord="${t.id}">Struk</button>
                                ${
                                  isAdmin && t.status !== 'Dibatalkan'
                                    ? `<button type="button" class="btn btn-outline-danger btn-sm" data-cancel-ord="${t.id}">Batalkan</button>`
                                    : ''
                                }
                              </div>
                            </td>
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

    document.getElementById('ord-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
      const el = document.getElementById('ord-search');
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });

    content.querySelectorAll('[data-ord-status]').forEach((btn) => {
      btn.addEventListener('click', () => {
        statusFilter = btn.getAttribute('data-ord-status');
        render();
      });
    });

    content.querySelectorAll('[data-settle-ord]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const trx = db.data.transactions.find((t) => t.id === btn.getAttribute('data-settle-ord'));
        if (trx) openSettleOpenBillModal(trx);
      });
    });

    content.querySelectorAll('[data-complete-ord]').forEach((btn) => {
      btn.addEventListener('click', () => {
        try {
          db.updateOrderStatus(btn.getAttribute('data-complete-ord'), 'Selesai', currentUser.fullName);
          showToast('Pesanan ditandai Selesai diserahkan ke pelanggan.', 'success');
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    content.querySelectorAll('[data-print-ord]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const trx = db.data.transactions.find((t) => t.id === btn.getAttribute('data-print-ord'));
        if (trx) printReceipt(trx, db.getSettings());
      });
    });

    content.querySelectorAll('[data-cancel-ord]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!isAdmin) return;
        const trx = db.data.transactions.find((t) => t.id === btn.getAttribute('data-cancel-ord'));
        if (trx) openCancelOrderModal(trx);
      });
    });
  }

  render();
}
