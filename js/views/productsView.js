import { ADDITIONAL_GROUPS } from '../config.js';
import { db } from '../db.js';
import {
  closeModal,
  escapeHTML,
  formatRupiah,
  generateId,
  openModal,
  refreshIcons,
  showToast,
} from '../utils.js';

export function renderProductsView() {
  const content = document.getElementById('app-content');
  let activeSubTab = 'products';
  let searchQuery = '';

  function openProductFormModal(existingProd = null) {
    const isEdit = Boolean(existingProd);
    const categories = db.data.categories;
    const allowedSet = new Set(
      existingProd?.allowedAdditionalGroups || ['level_gula', 'pilihan_suhu', 'extra_rasa', 'topping', 'extra_lainnya']
    );
    let uploadedImageDataUrl = existingProd?.imageUrl || '';

    openModal({
      title: isEdit ? `Edit Produk — ${existingProd.name}` : 'Tambah Produk Susu Murni Baru',
      bodyHTML: `
        <form id="product-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nama Produk *</label>
              <input type="text" id="prd-name" class="form-control" value="${escapeHTML(existingProd?.name || '')}" placeholder="Contoh: Susu Murni Kurma" required />
            </div>
            <div class="form-group">
              <label class="form-label">Kategori *</label>
              <select id="prd-cat" class="form-control" required>
                ${categories
                  .map(
                    (c) => `<option value="${c.id}" ${existingProd?.categoryId === c.id ? 'selected' : ''}>${escapeHTML(c.name)}</option>`
                  )
                  .join('')}
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Ukuran / Kemasan *</label>
              <input type="text" id="prd-size" class="form-control" value="${escapeHTML(existingProd?.size || 'Regular')}" placeholder="Regular / Large / 500 ml / 1 Liter" required />
            </div>
            <div class="form-group">
              <label class="form-label">Stok Awal (Unit) *</label>
              <input type="number" id="prd-stock" class="form-control" min="0" value="${existingProd?.stok ?? 20}" ${isEdit ? 'readonly' : ''} required />
              ${isEdit ? '<small style="color:var(--text-muted);">Ubah stok melalui menu Manajemen Stok.</small>' : ''}
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Harga Modal / HPP (Rp) *</label>
              <input type="number" id="prd-modal" class="form-control" min="0" step="100" value="${existingProd?.hargaModal ?? 6000}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Harga Jual (Rp) *</label>
              <input type="number" id="prd-jual" class="form-control" min="0" step="100" value="${existingProd?.hargaJual ?? 12000}" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Deskripsi Singkat Menu (Opsional)</label>
            <input type="text" id="prd-desc" class="form-control" value="${escapeHTML(existingProd?.description || '')}" placeholder="Contoh: Susu murni segar dengan madu asli" />
          </div>

          <div class="form-group">
            <label class="form-label">Upload Foto Produk (Opsional — Biarkan kosong untuk kartu teks bersih)</label>
            <input type="file" id="prd-photo-file" class="form-control" accept="image/*" style="padding:7px;" />
          </div>

          <div class="form-group">
            <label class="form-label">Kelompok Additional yang Diizinkan pada Produk Ini:</label>
            <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;">
              ${ADDITIONAL_GROUPS.map(
                (g) => `
                <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer;">
                  <input type="checkbox" class="prd-grp-chk" value="${g.id}" ${allowedSet.has(g.id) ? 'checked' : ''} />
                  <span>${escapeHTML(g.name)}</span>
                </label>
              `
              ).join('')}
            </div>
          </div>

          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;">
              <input type="checkbox" id="prd-active" ${existingProd?.active !== false ? 'checked' : ''} />
              <span>Produk Aktif &amp; Tampil di Layar Kasir</span>
            </label>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
            <button type="button" class="btn btn-outline" id="prd-cancel-btn">Batal</button>
            <button type="submit" class="btn btn-primary">Simpan Produk</button>
          </div>
        </form>
      `,
    });

    document.getElementById('prd-photo-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        uploadedImageDataUrl = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('prd-cancel-btn')?.addEventListener('click', closeModal);

    document.getElementById('product-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('prd-name').value.trim();
      const categoryId = document.getElementById('prd-cat').value;
      const size = document.getElementById('prd-size').value.trim();
      const stok = Math.max(0, Number(document.getElementById('prd-stock').value) || 0);
      const hargaModal = Math.max(0, Number(document.getElementById('prd-modal').value) || 0);
      const hargaJual = Math.max(0, Number(document.getElementById('prd-jual').value) || 0);
      const description = document.getElementById('prd-desc').value.trim();
      const active = document.getElementById('prd-active').checked;
      const allowedAdditionalGroups = Array.from(document.querySelectorAll('.prd-grp-chk:checked')).map(
        (el) => el.value
      );

      if (isEdit) {
        existingProd.name = name;
        existingProd.categoryId = categoryId;
        existingProd.size = size;
        existingProd.hargaModal = hargaModal;
        existingProd.hargaJual = hargaJual;
        existingProd.description = description;
        existingProd.active = active;
        existingProd.allowedAdditionalGroups = allowedAdditionalGroups;
        if (uploadedImageDataUrl) existingProd.imageUrl = uploadedImageDataUrl;
        showToast(`Produk "${name}" berhasil diperbarui.`, 'success');
      } else {
        db.data.products.push({
          id: generateId('PRD'),
          name,
          categoryId,
          size,
          hargaModal,
          hargaJual,
          stok,
          description,
          active,
          imageUrl: uploadedImageDataUrl || '',
          allowedAdditionalGroups,
        });
        showToast(`Produk baru "${name}" berhasil ditambahkan.`, 'success');
      }

      db.save();
      closeModal();
      render();
    });
  }

  function render() {
    let bodyHTML = '';

    if (activeSubTab === 'products') {
      const filtered = db.data.products.filter(
        (p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      bodyHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
          <input type="text" id="prd-search" class="form-control" style="max-width:280px;"
            value="${escapeHTML(searchQuery)}" placeholder="Cari nama produk..." />
          <button type="button" class="btn btn-primary" id="btn-add-product">
            <i data-lucide="plus"></i>
            <span>Tambah Produk</span>
          </button>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Kategori</th>
                <th>Ukuran</th>
                <th>Harga Modal</th>
                <th>Harga Jual</th>
                <th>Margin</th>
                <th>Stok</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${
                filtered.length === 0
                  ? `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px;">Belum ada produk. Klik "Tambah Produk" untuk membuat menu.</td></tr>`
                  : filtered
                      .map((p) => {
                        const cat = db.data.categories.find((c) => c.id === p.categoryId)?.name || '-';
                        const margin = p.hargaJual - p.hargaModal;
                        const hasPhoto = p.imageUrl && !p.imageUrl.startsWith('data:image/svg+xml');
                        return `
                          <tr>
                            <td>
                              <div style="display:flex;align-items:center;gap:10px;">
                                ${
                                  hasPhoto
                                    ? `<img src="${escapeHTML(p.imageUrl)}" alt="" style="width:36px;height:36px;border-radius:8px;object-fit:cover;" />`
                                    : `<div style="width:36px;height:36px;border-radius:8px;background:var(--primary-green-soft);color:var(--primary-green);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                        <i data-lucide="milk" style="width:17px;height:17px;"></i>
                                      </div>`
                                }
                                <strong>${escapeHTML(p.name)}</strong>
                              </div>
                            </td>
                            <td>${escapeHTML(cat)}</td>
                            <td>${escapeHTML(p.size)}</td>
                            <td>${formatRupiah(p.hargaModal)}</td>
                            <td style="font-weight:700;">${formatRupiah(p.hargaJual)}</td>
                            <td style="color:var(--success);font-weight:600;">${formatRupiah(margin)}</td>
                            <td><strong>${p.stok}</strong></td>
                            <td>
                              <span class="badge ${p.active ? 'badge-success' : 'badge-neutral'}">
                                ${p.active ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </td>
                            <td>
                              <div style="display:flex;gap:6px;">
                                <button type="button" class="btn btn-outline btn-sm" data-edit-prd="${p.id}">Edit</button>
                                <button type="button" class="btn btn-outline-danger btn-sm" data-del-prd="${p.id}">Hapus</button>
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
      `;
    } else {
      bodyHTML = `
        <form id="add-cat-form" style="display:flex;gap:8px;max-width:440px;margin-bottom:16px;">
          <input type="text" id="new-cat-name" class="form-control" placeholder="Nama kategori baru..." required />
          <button type="submit" class="btn btn-primary">Tambah</button>
        </form>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nama Kategori</th>
                <th>Jumlah Produk</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${db.data.categories
                .map((c) => {
                  const count = db.data.products.filter((p) => p.categoryId === c.id).length;
                  return `
                    <tr>
                      <td><strong>${escapeHTML(c.name)}</strong></td>
                      <td>${count} produk</td>
                      <td><span class="badge ${c.active ? 'badge-success' : 'badge-neutral'}">${c.active ? 'Aktif' : 'Nonaktif'}</span></td>
                      <td>
                        <div style="display:flex;gap:6px;">
                          <button type="button" class="btn btn-outline btn-sm" data-toggle-cat="${c.id}">
                            ${c.active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button type="button" class="btn btn-outline-danger btn-sm" data-del-cat="${c.id}">Hapus</button>
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    content.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button type="button" class="cat-pill ${activeSubTab === 'products' ? 'active' : ''}" data-ptab="products">
          Daftar Produk (${db.data.products.length})
        </button>
        <button type="button" class="cat-pill ${activeSubTab === 'categories' ? 'active' : ''}" data-ptab="categories">
          Kategori Menu (${db.data.categories.length})
        </button>
      </div>

      <div class="card">
        ${bodyHTML}
      </div>
    `;

    refreshIcons();

    content.querySelectorAll('[data-ptab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSubTab = btn.getAttribute('data-ptab');
        render();
      });
    });

    document.getElementById('prd-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
      const el = document.getElementById('prd-search');
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });

    document.getElementById('btn-add-product')?.addEventListener('click', () => openProductFormModal(null));

    content.querySelectorAll('[data-edit-prd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = db.data.products.find((x) => x.id === btn.getAttribute('data-edit-prd'));
        if (p) openProductFormModal(p);
      });
    });

    content.querySelectorAll('[data-del-prd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = db.data.products.find((x) => x.id === btn.getAttribute('data-del-prd'));
        if (!p) return;
        if (!window.confirm(`Hapus produk "${p.name}"?`)) return;
        db.data.products = db.data.products.filter((x) => x.id !== p.id);
        db.save();
        showToast(`Produk "${p.name}" dihapus.`, 'warning');
        render();
      });
    });

    document.getElementById('add-cat-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-cat-name').value.trim();
      if (!name) return;
      db.data.categories.push({ id: generateId('CAT'), name, active: true });
      db.save();
      showToast(`Kategori "${name}" ditambahkan.`, 'success');
      render();
    });

    content.querySelectorAll('[data-toggle-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const c = db.data.categories.find((x) => x.id === btn.getAttribute('data-toggle-cat'));
        if (!c) return;
        c.active = !c.active;
        db.save();
        render();
      });
    });

    content.querySelectorAll('[data-del-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-del-cat');
        const used = db.data.products.some((p) => p.categoryId === catId);
        if (used) {
          showToast('Kategori tidak dapat dihapus karena masih digunakan oleh produk.', 'error');
          return;
        }
        db.data.categories = db.data.categories.filter((c) => c.id !== catId);
        db.save();
        showToast('Kategori dihapus.', 'warning');
        render();
      });
    });
  }

  render();
}
