import { ADDITIONAL_GROUPS } from '../config.js';
import { db } from '../db.js';
import {
  escapeHTML,
  formatRupiah,
  generateId,
  refreshIcons,
  showToast,
} from '../utils.js';

export function renderAdditionalsView() {
  const content = document.getElementById('app-content');
  let selectedGroup = 'ALL';

  function render() {
    const filtered = db.data.additionals.filter(
      (a) => selectedGroup === 'ALL' || a.group === selectedGroup
    );

    content.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <h3 class="card-title">Tambah Opsi Additional / Topping Baru</h3>
        </div>
        <form id="add-additional-form" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px;align-items:end;">
          <div>
            <label class="form-label">Kelompok *</label>
            <select id="add-grp" class="form-control" required>
              ${ADDITIONAL_GROUPS.map((g) => `<option value="${g.id}">${escapeHTML(g.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Nama Pilihan / Topping *</label>
            <input type="text" id="add-name" class="form-control" placeholder="Contoh: Regal Crumbs" required />
          </div>
          <div>
            <label class="form-label">Harga Tambahan (Rp) *</label>
            <input type="number" id="add-price" class="form-control" min="0" step="500" value="3000" required />
          </div>
          <div>
            <button type="submit" class="btn btn-primary btn-block">Tambah Opsi</button>
          </div>
        </form>
      </div>

      <div class="cat-pills-row">
        <button type="button" class="cat-pill ${selectedGroup === 'ALL' ? 'active' : ''}" data-agrp="ALL">Semua Kelompok</button>
        ${ADDITIONAL_GROUPS.map(
          (g) => `<button type="button" class="cat-pill ${selectedGroup === g.id ? 'active' : ''}" data-agrp="${g.id}">${escapeHTML(g.name)}</button>`
        ).join('')}
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Kelompok</th>
                <th>Nama Pilihan</th>
                <th>Harga Tambahan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${filtered
                .map((a) => {
                  const grpName = ADDITIONAL_GROUPS.find((g) => g.id === a.group)?.name || a.group;
                  return `
                    <tr>
                      <td><span class="badge badge-cocoa">${escapeHTML(grpName)}</span></td>
                      <td><strong>${escapeHTML(a.name)}</strong></td>
                      <td style="font-weight:700;">${a.price > 0 ? `+${formatRupiah(a.price)}` : 'Gratis (Rp 0)'}</td>
                      <td><span class="badge ${a.active ? 'badge-success' : 'badge-neutral'}">${a.active ? 'Aktif' : 'Nonaktif'}</span></td>
                      <td>
                        <div style="display:flex;gap:6px;">
                          <button type="button" class="btn btn-outline btn-sm" data-toggle-add="${a.id}">${a.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                          <button type="button" class="btn btn-outline-danger btn-sm" data-del-add="${a.id}">Hapus</button>
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    refreshIcons();

    content.querySelectorAll('[data-agrp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedGroup = btn.getAttribute('data-agrp');
        render();
      });
    });

    document.getElementById('add-additional-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const group = document.getElementById('add-grp').value;
      const name = document.getElementById('add-name').value.trim();
      const price = Math.max(0, Number(document.getElementById('add-price').value) || 0);
      if (!name) return;

      db.data.additionals.push({
        id: generateId('ADD'),
        group,
        name,
        price,
        active: true,
      });
      db.save();
      showToast(`Opsi "${name}" ditambahkan.`, 'success');
      render();
    });

    content.querySelectorAll('[data-toggle-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = db.data.additionals.find((a) => a.id === btn.getAttribute('data-toggle-add'));
        if (!item) return;
        item.active = !item.active;
        db.save();
        render();
      });
    });

    content.querySelectorAll('[data-del-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-add');
        db.data.additionals = db.data.additionals.filter((a) => a.id !== id);
        db.save();
        showToast('Opsi additional dihapus.', 'warning');
        render();
      });
    });
  }

  render();
}
