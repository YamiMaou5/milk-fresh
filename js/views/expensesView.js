import { auth } from '../auth.js';
import { EXPENSE_CATEGORIES } from '../config.js';
import { db } from '../db.js';
import {
  escapeHTML,
  formatDateOnly,
  formatRupiah,
  refreshIcons,
  showToast,
} from '../utils.js';

export function renderExpensesView() {
  const content = document.getElementById('app-content');
  const currentUser = auth.getUser();

  function render() {
    const totalAll = db.data.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const todayStr = new Date().toISOString().slice(0, 10);

    content.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <h3 class="card-title">Catat Pengeluaran / Belanja Operasional</h3>
        </div>
        <form id="expense-form" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(175px, 1fr));gap:10px;align-items:end;">
          <div>
            <label class="form-label">Tanggal *</label>
            <input type="date" id="exp-date" class="form-control" value="${todayStr}" required />
          </div>
          <div>
            <label class="form-label">Kategori Biaya *</label>
            <select id="exp-cat" class="form-control" required>
              ${EXPENSE_CATEGORIES.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Keterangan Belanja *</label>
            <input type="text" id="exp-desc" class="form-control" placeholder="Contoh: Susu sapi murni 20 liter" required />
          </div>
          <div>
            <label class="form-label">Nominal (Rp) *</label>
            <input type="number" id="exp-amount" class="form-control" min="100" step="100" placeholder="150000" required />
          </div>
          <div>
            <button type="submit" class="btn btn-primary btn-block">Simpan Biaya</button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Riwayat Pengeluaran (${db.data.expenses.length})</h3>
          <span class="badge badge-danger" style="font-size:12px;">Total Tercatat: ${formatRupiah(totalAll)}</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>No. Bukti</th>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Keterangan</th>
                <th>Nominal</th>
                <th>Dicatat Oleh</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${
                db.data.expenses.length === 0
                  ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px;">Belum ada catatan pengeluaran toko.</td></tr>`
                  : db.data.expenses
                      .map(
                        (e) => `
                      <tr>
                        <td class="selectable-text" style="font-family:var(--font-mono);font-weight:700;">${escapeHTML(e.expenseNumber)}</td>
                        <td>${formatDateOnly(e.date)}</td>
                        <td><span class="badge badge-cocoa">${escapeHTML(e.category)}</span></td>
                        <td>${escapeHTML(e.description)}</td>
                        <td style="font-weight:800;color:var(--danger);">${formatRupiah(e.amount)}</td>
                        <td>${escapeHTML(e.recordedBy || '-')}</td>
                        <td>
                          <button type="button" class="btn btn-outline-danger btn-sm" data-del-exp="${e.id}">Hapus</button>
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
    `;

    refreshIcons();

    document.getElementById('expense-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const dateVal = document.getElementById('exp-date').value;
        const category = document.getElementById('exp-cat').value;
        const description = document.getElementById('exp-desc').value;
        const amount = document.getElementById('exp-amount').value;
        db.addExpense({
          date: dateVal ? new Date(dateVal).toISOString() : new Date().toISOString(),
          category,
          description,
          amount,
          recordedBy: currentUser.fullName,
        });
        showToast('Pengeluaran berhasil dicatat.', 'success');
        render();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    content.querySelectorAll('[data-del-exp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!window.confirm('Hapus catatan pengeluaran ini?')) return;
        db.deleteExpense(btn.getAttribute('data-del-exp'));
        showToast('Pengeluaran dihapus.', 'warning');
        render();
      });
    });
  }

  render();
}
