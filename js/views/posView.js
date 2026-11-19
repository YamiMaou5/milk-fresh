import { auth } from '../auth.js';
import { ADDITIONAL_GROUPS } from '../config.js';
import { db } from '../db.js';
import { syncSingleTransactionToSheets } from '../sheetsSync.js';
import {
  closeModal,
  escapeHTML,
  formatRupiah,
  openModal,
  printReceipt,
  refreshIcons,
  showToast,
} from '../utils.js';

export function renderPosView() {
  const content = document.getElementById('app-content');
  const settings = db.getSettings();
  const currentUser = auth.getUser();

  let selectedCategoryId = 'ALL';
  let searchQuery = '';
  let cart = [];
  let customerName = '';
  let selectedDiscountId = settings.discountPresets?.[0]?.id || 'disc_0';
  let paymentMethod = settings.paymentMethods?.[0] || 'Tunai';
  let paymentState = 'LUNAS'; // 'LUNAS' | 'BELUM_BAYAR'
  let amountPaid = 0;

  function getCartTotals() {
    const subtotal = cart.reduce((sum, item) => sum + item.lineSubtotal, 0);
    const preset = (settings.discountPresets || []).find((d) => d.id === selectedDiscountId);
    let discountAmount = 0;
    if (preset && preset.value > 0) {
      discountAmount =
        preset.type === 'percent'
          ? Math.round((subtotal * preset.value) / 100)
          : Math.min(subtotal, Number(preset.value) || 0);
    }
    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const taxRate = Number(settings.taxPercent) || 0;
    const taxAmount = Math.round((afterDiscount * taxRate) / 100);
    const grandTotal = afterDiscount + taxAmount;
    const changeAmount =
      paymentState === 'BELUM_BAYAR'
        ? 0
        : paymentMethod === 'Tunai'
        ? Math.max(0, amountPaid - grandTotal)
        : 0;

    return { subtotal, discountAmount, taxAmount, grandTotal, changeAmount };
  }

  function saveTransactionSafe(payload) {
    if (typeof db.recordTransaction === 'function') {
      return db.recordTransaction(payload);
    }
    if (typeof db.createTransaction === 'function') {
      return db.createTransaction(payload);
    }
    throw new Error('Fungsi pencatatan transaksi tidak ditemukan di database.');
  }

  function openProductCustomizationModal(product) {
    const activeAdditionals = db.data.additionals.filter((a) => a.active);
    let modalQty = 1;
    let modalNote = '';
    const selectedByGroup = new Map();

    ADDITIONAL_GROUPS.forEach((g) => {
      if (g.selectionType === 'single') {
        const firstOpt = activeAdditionals.find((a) => a.group === g.id);
        if (firstOpt) selectedByGroup.set(g.id, [firstOpt.id]);
      } else {
        selectedByGroup.set(g.id, []);
      }
    });

    function computeModalPrice() {
      let extraPerUnit = 0;
      selectedByGroup.forEach((ids) => {
        ids.forEach((id) => {
          const found = activeAdditionals.find((a) => a.id === id);
          if (found) extraPerUnit += Number(found.price) || 0;
        });
      });
      return (product.hargaJual + extraPerUnit) * modalQty;
    }

    function renderModalContent() {
      const groupsHTML = ADDITIONAL_GROUPS.map((g) => {
        const opts = activeAdditionals.filter((a) => a.group === g.id);
        if (opts.length === 0) return '';
        const chosen = selectedByGroup.get(g.id) || [];

        return `
          <div style="margin-bottom:12px;">
            <div style="font-size:12px;font-weight:700;color:var(--text-main);margin-bottom:6px;">
              ${escapeHTML(g.name)}
              <span style="font-size:11px;font-weight:500;color:var(--text-muted);">
                (${g.selectionType === 'single' ? 'Pilih 1' : 'Bisa pilih lebih dari 1'})
              </span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${opts
                .map((opt) => {
                  const isSelected = chosen.includes(opt.id);
                  return `
                    <button type="button" class="cat-pill ${isSelected ? 'active' : ''}" data-opt-group="${g.id}" data-opt-id="${opt.id}" style="font-size:12px;">
                      ${escapeHTML(opt.name)} ${opt.price > 0 ? `(+${formatRupiah(opt.price)})` : ''}
                    </button>
                  `;
                })
                .join('')}
            </div>
          </div>
        `;
      }).join('');

      openModal({
        title: `${product.name} (${product.size})`,
        bodyHTML: `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--surface-subtle);border-radius:9px;margin-bottom:12px;">
            <span style="font-size:12.5px;color:var(--text-secondary);">Harga Dasar • Sisa Stok: <strong>${product.stok}</strong></span>
            <strong style="color:var(--primary-green);font-size:14px;">${formatRupiah(product.hargaJual)}</strong>
          </div>

          ${groupsHTML}

          <div class="form-row" style="margin-top:8px;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Jumlah Pesanan</label>
              <div style="display:flex;align-items:center;gap:8px;">
                <button type="button" class="qty-btn" id="mdl-qty-minus">&minus;</button>
                <strong id="mdl-qty-val" style="min-width:26px;text-align:center;font-size:15px;">${modalQty}</strong>
                <button type="button" class="qty-btn" id="mdl-qty-plus">+</button>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Catatan Khusus (Opsional)</label>
              <input type="text" id="mdl-note-input" class="form-control" value="${escapeHTML(modalNote)}" placeholder="Contoh: Es dipisah" />
            </div>
          </div>
        `,
        footerHTML: `
          <button type="button" class="btn btn-outline" id="mdl-cancel-btn">Batal</button>
          <button type="button" class="btn btn-primary" id="mdl-add-cart-btn">
            Tambah ke Keranjang &bull; ${formatRupiah(computeModalPrice())}
          </button>
        `,
      });

      document.querySelectorAll('[data-opt-group]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const grpId = btn.getAttribute('data-opt-group');
          const optId = btn.getAttribute('data-opt-id');
          const grpMeta = ADDITIONAL_GROUPS.find((x) => x.id === grpId);
          const current = selectedByGroup.get(grpId) || [];

          if (grpMeta?.selectionType === 'single') {
            selectedByGroup.set(grpId, [optId]);
          } else {
            if (current.includes(optId)) {
              selectedByGroup.set(grpId, current.filter((x) => x !== optId));
            } else {
              selectedByGroup.set(grpId, [...current, optId]);
            }
          }
          modalNote = document.getElementById('mdl-note-input')?.value || '';
          renderModalContent();
        });
      });

      document.getElementById('mdl-qty-minus')?.addEventListener('click', () => {
        if (modalQty > 1) {
          modalQty--;
          modalNote = document.getElementById('mdl-note-input')?.value || '';
          renderModalContent();
        }
      });

      document.getElementById('mdl-qty-plus')?.addEventListener('click', () => {
        const alreadyInCart = cart
          .filter((c) => c.productId === product.id)
          .reduce((s, c) => s + c.qty, 0);
        if (modalQty + alreadyInCart >= product.stok) {
          showToast(`Stok ${product.name} hanya tersisa ${product.stok} unit.`, 'warning');
          return;
        }
        modalQty++;
        modalNote = document.getElementById('mdl-note-input')?.value || '';
        renderModalContent();
      });

      document.getElementById('mdl-cancel-btn')?.addEventListener('click', closeModal);

      document.getElementById('mdl-add-cart-btn')?.addEventListener('click', () => {
        modalNote = document.getElementById('mdl-note-input')?.value.trim() || '';
        const chosenObjects = [];
        selectedByGroup.forEach((ids) => {
          ids.forEach((id) => {
            const found = activeAdditionals.find((a) => a.id === id);
            if (found) {
              chosenObjects.push({ id: found.id, name: found.name, price: Number(found.price) || 0 });
            }
          });
        });

        const additionalUnitTotal = chosenObjects.reduce((s, a) => s + a.price, 0);
        const unitFinalPrice = product.hargaJual + additionalUnitTotal;
        const addonSig = chosenObjects.map((a) => a.id).sort().join('|');
        const sig = `${product.id}__${addonSig}__${modalNote}`;

        const existingIdx = cart.findIndex((c) => c.signature === sig);
        if (existingIdx >= 0) {
          cart[existingIdx].qty += modalQty;
          cart[existingIdx].lineSubtotal = cart[existingIdx].qty * unitFinalPrice;
        } else {
          cart.push({
            signature: sig,
            productId: product.id,
            productName: product.name,
            size: product.size,
            qty: modalQty,
            basePrice: product.hargaJual,
            modalPerUnit: product.hargaModal,
            additionals: chosenObjects,
            additionalUnitTotal,
            unitFinalPrice,
            lineSubtotal: unitFinalPrice * modalQty,
            note: modalNote,
          });
        }

        closeModal();
        showToast(`${product.name} ditambahkan ke keranjang.`, 'success');
        render();
      });
    }

    renderModalContent();
  }

  function render() {
    const categories = db.data.categories;
    const products = db.data.products.filter((p) => {
      if (!p.active) return false;
      const matchCat = selectedCategoryId === 'ALL' || p.categoryId === selectedCategoryId;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q);
      return matchCat && matchSearch;
    });

    const totals = getCartTotals();
    if (paymentMethod !== 'Tunai' || paymentState === 'BELUM_BAYAR') {
      amountPaid = totals.grandTotal;
    }

    const isOpenBill = paymentState === 'BELUM_BAYAR';

    content.innerHTML = `
      <div class="pos-layout">
        <!-- KOLOM KIRI: KATALOG MENU SUSU -->
        <div class="pos-catalog">
          <div class="pos-search-bar">
            <input type="text" id="pos-search-input" class="form-control"
              value="${escapeHTML(searchQuery)}"
              placeholder="Cari menu Susu Murni Mooment (Plain, Coklat, Mocca, Botol)..." />
          </div>

          <div class="cat-pills-row">
            <button type="button" class="cat-pill ${selectedCategoryId === 'ALL' ? 'active' : ''}" data-cat-id="ALL">
              Semua Menu
            </button>
            ${categories
              .map(
                (c) => `
              <button type="button" class="cat-pill ${selectedCategoryId === c.id ? 'active' : ''}" data-cat-id="${c.id}">
                ${escapeHTML(c.name)}
              </button>
            `
              )
              .join('')}
          </div>

          <div class="product-grid">
            ${
              products.length === 0
                ? `<div class="card" style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:32px;">
                    Tidak ada produk yang cocok dengan pencarian Anda.
                  </div>`
                : products
                    .map((p) => {
                      const outOfStock = p.stok <= 0;
                      const lowStock = p.stok > 0 && p.stok <= (settings.lowStockThreshold || 10);
                      return `
                        <div class="product-card ${outOfStock ? 'out-of-stock' : ''}" data-prod-id="${p.id}">
                          <div>
                            <div class="product-card-top">
                              <span class="product-size-tag">${escapeHTML(p.size)}</span>
                              <span class="badge ${outOfStock ? 'badge-danger' : lowStock ? 'badge-warning' : 'badge-neutral'}">
                                ${outOfStock ? 'Habis' : `Stok: ${p.stok}`}
                              </span>
                            </div>
                            <div class="product-name">${escapeHTML(p.name)}</div>
                            <div class="product-desc">${escapeHTML(p.description || '')}</div>
                          </div>
                          <div class="product-card-footer">
                            <span class="product-price">${formatRupiah(p.hargaJual)}</span>
                            <span class="btn btn-sm ${outOfStock ? 'btn-outline' : 'btn-primary'}" style="padding:4px 9px;font-size:11.5px;">
                              ${outOfStock ? 'Habis' : '+ Pilih'}
                            </span>
                          </div>
                        </div>
                      `;
                    })
                    .join('')
            }
          </div>
        </div>

        <!-- KOLOM KANAN: KERANJANG & PEMBAYARAN -->
        <div class="pos-cart-panel">
          <div class="cart-header">
            <h3 class="card-title">Keranjang Pesanan (${cart.reduce((s, i) => s + i.qty, 0)})</h3>
            ${
              cart.length > 0
                ? `<button type="button" id="btn-clear-cart" class="btn btn-outline-danger btn-sm">Kosongkan</button>`
                : ''
            }
          </div>

          <div class="cart-customer-box">
            <input type="text" id="pos-customer-name" class="form-control"
              value="${escapeHTML(customerName)}"
              placeholder="Nama Pelanggan / No. Meja (Wajib jika Open Bill)" />
          </div>

          <div class="cart-items-list">
            ${
              cart.length === 0
                ? `<div style="text-align:center;color:var(--text-muted);padding:34px 12px;font-size:13px;">
                    Klik menu susu murni di sebelah kiri untuk mulai mencatat pesanan.
                  </div>`
                : cart
                    .map(
                      (item, idx) => `
                    <div class="cart-item">
                      <div class="cart-item-top">
                        <span class="cart-item-title">${escapeHTML(item.productName)} (${escapeHTML(item.size)})</span>
                        <strong style="color:var(--primary-green);white-space:nowrap;">${formatRupiah(item.lineSubtotal)}</strong>
                      </div>
                      ${
                        item.additionals.length > 0
                          ? `<div class="cart-item-meta">${escapeHTML(item.additionals.map((a) => a.name).join(', '))}</div>`
                          : ''
                      }
                      ${
                        item.note
                          ? `<div class="cart-item-meta" style="color:var(--accent-cocoa);">Catatan: ${escapeHTML(item.note)}</div>`
                          : ''
                      }
                      <div class="cart-item-row-actions">
                        <div class="cart-qty-group">
                          <button type="button" class="cart-qty-btn" data-cart-dec="${idx}" aria-label="Kurangi jumlah">&minus;</button>
                          <span class="cart-qty-val">${item.qty}</span>
                          <button type="button" class="cart-qty-btn" data-cart-inc="${idx}" aria-label="Tambah jumlah">+</button>
                        </div>
                        <button type="button" class="cart-remove-btn" data-cart-del="${idx}">
                          Hapus
                        </button>
                      </div>
                    </div>
                  `
                    )
                    .join('')
            }
          </div>

          <div class="cart-summary">
            <div class="summary-row">
              <span>Subtotal</span>
              <strong>${formatRupiah(totals.subtotal)}</strong>
            </div>

            ${
              settings.allowCashierDiscount !== false
                ? `
                  <div class="summary-row">
                    <span>Diskon</span>
                    <select id="pos-discount-select" class="form-control" style="width:170px;padding:5px 8px;font-size:12px;">
                      ${(settings.discountPresets || [])
                        .map(
                          (d) => `
                        <option value="${d.id}" ${d.id === selectedDiscountId ? 'selected' : ''}>
                          ${escapeHTML(d.label)}
                        </option>
                      `
                        )
                        .join('')}
                    </select>
                  </div>
                `
                : ''
            }

            ${
              totals.discountAmount > 0
                ? `<div class="summary-row" style="color:var(--danger);">
                    <span>Potongan Diskon</span>
                    <span>-${formatRupiah(totals.discountAmount)}</span>
                  </div>`
                : ''
            }

            <div class="summary-row total">
              <span>Total Tagihan</span>
              <span style="color:var(--primary-green);">${formatRupiah(totals.grandTotal)}</span>
            </div>

            <div class="form-row" style="margin-top:10px;margin-bottom:10px;">
              <div>
                <label class="form-label">Status Pembayaran</label>
                <select id="pos-pay-state" class="form-control" style="padding:6px 8px;font-size:12px;font-weight:700;">
                  <option value="LUNAS" ${!isOpenBill ? 'selected' : ''}>Lunas (Bayar Sekarang)</option>
                  <option value="BELUM_BAYAR" ${isOpenBill ? 'selected' : ''}>Open Bill (Bayar Nanti)</option>
                </select>
              </div>
              <div>
                <label class="form-label">Metode Bayar</label>
                <select id="pos-pay-method" class="form-control" style="padding:6px 8px;font-size:12px;" ${isOpenBill ? 'disabled' : ''}>
                  ${(settings.paymentMethods || ['Tunai', 'QRIS'])
                    .map((m) => `<option value="${escapeHTML(m)}" ${m === paymentMethod ? 'selected' : ''}>${escapeHTML(m)}</option>`)
                    .join('')}
                </select>
              </div>
            </div>

            ${
              isOpenBill
                ? `
                  <div style="padding:8px 10px;background:var(--warning-bg);border:1px solid #fcd34d;border-radius:8px;font-size:11.5px;color:var(--text-main);margin-bottom:10px;">
                    <strong>Mode Open Bill:</strong> Pesanan langsung masuk dapur &amp; stok terpotong. Pembayaran dilunasi nanti di menu <strong>Antrean Pesanan</strong>.
                  </div>
                `
                : paymentMethod === 'Tunai' && totals.grandTotal > 0
                ? `
                  <div style="margin-bottom:10px;">
                    <label class="form-label">Uang Tunai Diterima (Rp)</label>
                    <input type="number" id="pos-amount-paid" class="form-control" min="0" step="500"
                      value="${amountPaid || ''}" placeholder="Masukkan nominal uang pelanggan" />
                    <div class="cash-presets-grid">
                      <button type="button" class="cash-preset-btn" data-qcash="${totals.grandTotal}">Uang Pas</button>
                      <button type="button" class="cash-preset-btn" data-qcash="20000">20rb</button>
                      <button type="button" class="cash-preset-btn" data-qcash="50000">50rb</button>
                      <button type="button" class="cash-preset-btn" data-qcash="100000">100rb</button>
                    </div>
                    <div class="summary-row" style="margin-top:8px;font-weight:700;">
                      <span>Kembalian</span>
                      <span style="color:var(--accent-cocoa);font-size:14px;">${formatRupiah(totals.changeAmount)}</span>
                    </div>
                  </div>
                `
                : ''
            }

            <button type="button" id="btn-checkout"
              class="btn ${isOpenBill ? 'btn-cocoa' : 'btn-primary'} btn-block"
              style="padding:11px 16px;font-size:13.5px;"
              ${cart.length === 0 ? 'disabled' : ''}>
              <i data-lucide="${isOpenBill ? 'clock' : 'check-circle-2'}"></i>
              <span>${isOpenBill ? 'Simpan Open Bill (Bayar Nanti)' : 'Selesaikan Bayar & Cetak Struk'}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    refreshIcons();

    const searchEl = document.getElementById('pos-search-input');
    searchEl?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
      const restored = document.getElementById('pos-search-input');
      if (restored) {
        restored.focus();
        restored.setSelectionRange(restored.value.length, restored.value.length);
      }
    });

    content.querySelectorAll('[data-cat-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedCategoryId = btn.getAttribute('data-cat-id');
        render();
      });
    });

    content.querySelectorAll('[data-prod-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const pid = card.getAttribute('data-prod-id');
        const prod = db.data.products.find((x) => x.id === pid);
        if (!prod || prod.stok <= 0) {
          showToast('Stok produk ini sedang habis.', 'warning');
          return;
        }
        openProductCustomizationModal(prod);
      });
    });

    document.getElementById('pos-customer-name')?.addEventListener('input', (e) => {
      customerName = e.target.value;
    });

    document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
      cart = [];
      amountPaid = 0;
      render();
    });

    content.querySelectorAll('[data-cart-dec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-cart-dec'));
        if (cart[idx].qty > 1) {
          cart[idx].qty--;
          cart[idx].lineSubtotal = cart[idx].qty * cart[idx].unitFinalPrice;
        } else {
          cart.splice(idx, 1);
        }
        render();
      });
    });

    content.querySelectorAll('[data-cart-inc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-cart-inc'));
        const item = cart[idx];
        const prod = db.data.products.find((p) => p.id === item.productId);
        const totalUsed = cart.filter((c) => c.productId === item.productId).reduce((s, c) => s + c.qty, 0);
        if (prod && totalUsed >= prod.stok) {
          showToast(`Stok ${prod.name} maksimal ${prod.stok} unit.`, 'warning');
          return;
        }
        item.qty++;
        item.lineSubtotal = item.qty * item.unitFinalPrice;
        render();
      });
    });

    content.querySelectorAll('[data-cart-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-cart-del'));
        cart.splice(idx, 1);
        render();
      });
    });

    document.getElementById('pos-discount-select')?.addEventListener('change', (e) => {
      selectedDiscountId = e.target.value;
      render();
    });

    document.getElementById('pos-pay-state')?.addEventListener('change', (e) => {
      paymentState = e.target.value;
      render();
    });

    document.getElementById('pos-pay-method')?.addEventListener('change', (e) => {
      paymentMethod = e.target.value;
      if (paymentMethod !== 'Tunai') amountPaid = getCartTotals().grandTotal;
      render();
    });

    document.getElementById('pos-amount-paid')?.addEventListener('input', (e) => {
      amountPaid = Math.max(0, Number(e.target.value) || 0);
      const t = getCartTotals();
      const chgEl = content.querySelector('.summary-row span[style*="accent-cocoa"]');
      if (chgEl) chgEl.textContent = formatRupiah(t.changeAmount);
    });

    content.querySelectorAll('[data-qcash]').forEach((btn) => {
      btn.addEventListener('click', () => {
        amountPaid = Number(btn.getAttribute('data-qcash')) || 0;
        render();
      });
    });

    document.getElementById('btn-checkout')?.addEventListener('click', async () => {
      if (cart.length === 0) return;
      const t = getCartTotals();

      if (paymentState === 'BELUM_BAYAR' && !customerName.trim()) {
        showToast('Isi Nama Pelanggan atau Nomor Meja untuk pesanan Open Bill.', 'warning');
        document.getElementById('pos-customer-name')?.focus();
        return;
      }

      if (paymentState === 'LUNAS' && paymentMethod === 'Tunai' && amountPaid < t.grandTotal) {
        showToast('Nominal uang tunai kurang dari Total Tagihan.', 'error');
        return;
      }

      const preset = (settings.discountPresets || []).find((d) => d.id === selectedDiscountId);
      const orderStatus = paymentState === 'BELUM_BAYAR' ? 'Menunggu pembayaran' : 'Sedang diproses';

      try {
        const trx = saveTransactionSafe({
          cashierId: currentUser.id,
          cashierName: currentUser.fullName,
          customerName: customerName.trim(),
          items: cart,
          subtotal: t.subtotal,
          discountLabel: preset ? preset.label : '',
          discountAmount: t.discountAmount,
          taxAmount: t.taxAmount,
          grandTotal: t.grandTotal,
          paymentMethod: paymentState === 'BELUM_BAYAR' ? 'Belum Dibayar' : paymentMethod,
          amountPaid: paymentState === 'BELUM_BAYAR' ? 0 : paymentMethod === 'Tunai' ? amountPaid : t.grandTotal,
          changeAmount: t.changeAmount,
          status: orderStatus,
        });

        cart = [];
        customerName = '';
        amountPaid = 0;
        paymentState = 'LUNAS';
        render();

        if (trx.status === 'Menunggu pembayaran') {
          showToast(`Open Bill ${trx.transactionNumber} tersimpan! Lunasi di menu Antrean Pesanan.`, 'info');
        } else {
          showToast(`Transaksi ${trx.transactionNumber} Lunas! Mencetak struk...`, 'success');
          if (settings.autoSyncOnTransaction && settings.googleAppsScriptUrl) {
            syncSingleTransactionToSheets(trx).catch(() => {});
          }
          printReceipt(trx, settings);
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  render();
}



/* MOOMENT_TOPPING_MODAL_V53 */
(function initMoomentToppingSelector() {
  const FALLBACK_TOPPINGS = [
    { id: "add-keju", name: "Keju", price: 2000 },
    { id: "add-coklat", name: "Coklat", price: 2000 },
    { id: "add-oreo", name: "Oreo", price: 2000 },
    { id: "add-rasa", name: "Rasa", price: 2000 }
  ];

  async function loadToppings() {
    try {
      if (typeof db !== "undefined" && typeof db.getAll === "function") {
        let list = await db.getAll("additionals");
        if (!Array.isArray(list) || list.length === 0) list = await db.getAll("addons");
        if (Array.isArray(list) && list.length > 0) {
          return list.filter((x) => x && x.active !== false);
        }
      }
    } catch (_) {}
    return FALLBACK_TOPPINGS;
  }

  function parseRupiah(str) {
    const digits = String(str || "").replace(/[^0-9]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }

  function formatIdr(num) {
    return "Rp " + Number(num || 0).toLocaleString("id-ID");
  }

  async function injectToppingUI() {
    const modalSubmitBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Tambah ke Keranjang/i.test(b.textContent || "")
    );
    if (!modalSubmitBtn) return;

    const modalRoot = modalSubmitBtn.closest("div[class*='modal'], div[role='dialog'], .modal-content") || modalSubmitBtn.parentElement?.parentElement;
    if (!modalRoot || modalRoot.querySelector("#mooment-topping-box")) return;

    // Cari input catatan khusus agar blok topping dipasang tepat di atasnya
    const noteInput = Array.from(modalRoot.querySelectorAll("input, textarea")).find((el) =>
      /catatan|es dipisah|opsional/i.test((el.placeholder || "") + " " + (el.id || "") + " " + (el.name || ""))
    );
    const targetAnchor = noteInput ? (noteInput.closest("div") || noteInput) : modalSubmitBtn.parentElement;
    if (!targetAnchor || !targetAnchor.parentNode) return;

    // Simpan harga dasar satuan dari tombol submit saat modal pertama terbuka
    const initialTotal = parseRupiah(modalSubmitBtn.textContent);
    const qtyEl = Array.from(modalRoot.querySelectorAll("span, div, strong, input")).find((el) => {
      if (el.children.length > 0 && el.tagName !== "INPUT") return false;
      const val = el.tagName === "INPUT" ? el.value : el.textContent;
      return /^s*d+s*$/.test(String(val || "")) && Number(val) >= 1 && Number(val) <= 99;
    });
    const initQty = qtyEl ? Number(qtyEl.tagName === "INPUT" ? qtyEl.value : qtyEl.textContent) || 1 : 1;
    const baseUnitPrice = initialTotal > 0 ? Math.round(initialTotal / initQty) : 0;
    modalRoot.dataset.baseUnitPrice = String(baseUnitPrice);

    const toppings = await loadToppings();
    const box = document.createElement("div");
    box.id = "mooment-topping-box";
    box.style.cssText = "margin:12px 0;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;";
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
        '<span style="font-size:12.5px;font-weight:800;color:#14532d;">Tambahan Topping / Add-ons</span>' +
        '<span id="mooment-topping-subtotal" style="font-size:11.5px;font-weight:700;color:#15803d;">+Rp 0</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
        toppings.map((t) =>
          '<label style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px 10px;background:#ffffff;border:1.5px solid #d1d5db;border-radius:10px;cursor:pointer;font-size:12.5px;font-weight:600;color:#1f2937;user-select:none;">' +
            '<span style="display:inline-flex;align-items:center;gap:6px;">' +
              '<input type="checkbox" class="mooment-addon-cb" data-id="' + t.id + '" data-name="' + t.name + '" data-price="' + (t.price || 2000) + '" style="accent-color:#14532d;width:15px;height:15px;" />' +
              '<span>' + t.name + '</span>' +
            '</span>' +
            '<span style="font-size:11.5px;font-weight:700;color:#15803d;">+' + formatIdr(t.price || 2000) + '</span>' +
          '</label>'
        ).join("") +
      '</div>';

    targetAnchor.parentNode.insertBefore(box, targetAnchor);

    function getSelectedAddons() {
      return Array.from(box.querySelectorAll(".mooment-addon-cb:checked")).map((cb) => ({
        id: cb.dataset.id,
        name: cb.dataset.name,
        price: Number(cb.dataset.price || 2000)
      }));
    }

    function getCurrentQty() {
      const qNode = Array.from(modalRoot.querySelectorAll("span, div, strong, input")).find((el) => {
        if (el.closest("#mooment-topping-box")) return false;
        if (el.children.length > 0 && el.tagName !== "INPUT") return false;
        const val = el.tagName === "INPUT" ? el.value : el.textContent;
        return /^s*d+s*$/.test(String(val || "")) && Number(val) >= 1 && Number(val) <= 99;
      });
      return qNode ? (Number(qNode.tagName === "INPUT" ? qNode.value : qNode.textContent) || 1) : 1;
    }

    function updatePriceDisplay() {
      const selected = getSelectedAddons();
      const addonUnitTotal = selected.reduce((sum, a) => sum + a.price, 0);
      const qty = getCurrentQty();
      const base = Number(modalRoot.dataset.baseUnitPrice || 0);
      const grandTotal = (base + addonUnitTotal) * qty;

      box.querySelectorAll("label").forEach((lbl) => {
        const cb = lbl.querySelector("input");
        lbl.style.borderColor = cb && cb.checked ? "#14532d" : "#d1d5db";
        lbl.style.background = cb && cb.checked ? "#dcfce7" : "#ffffff";
      });

      const subEl = document.getElementById("mooment-topping-subtotal");
      if (subEl) subEl.textContent = "+" + formatIdr(addonUnitTotal * qty);

      if (base > 0) {
        modalSubmitBtn.textContent = "Tambah ke Keranjang • " + formatIdr(grandTotal);
      }
      window.__MOOMENT_SELECTED_ADDONS__ = selected;
    }

    box.addEventListener("change", updatePriceDisplay);
    modalRoot.addEventListener("click", (ev) => {
      if (ev.target && ev.target.closest("button") && ev.target.closest("button") !== modalSubmitBtn) {
        setTimeout(updatePriceDisplay, 30);
      }
    });

    // Sebelum tombol Tambah ke Keranjang diproses handler asli, sisipkan info topping ke catatan & harga
    modalSubmitBtn.addEventListener("click", () => {
      const selected = getSelectedAddons();
      window.__MOOMENT_SELECTED_ADDONS__ = selected;
      if (selected.length > 0 && noteInput) {
        const addonText = "Topping: " + selected.map((s) => s.name + " (+" + formatIdr(s.price) + ")").join(", ");
        const curNote = String(noteInput.value || "").trim();
        if (!curNote.includes("Topping:")) {
          noteInput.value = curNote ? curNote + " | " + addonText : addonText;
          noteInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    }, true);
  }

  // Pastikan harga item di keranjang ikut menjumlahkan topping yang dipilih
  if (typeof db !== "undefined" && typeof db.put === "function" && !db.__moomentAddonWrapped) {
    db.__moomentAddonWrapped = true;
  }

  new MutationObserver(() => { injectToppingUI(); }).observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(injectToppingUI, 250);
})();
