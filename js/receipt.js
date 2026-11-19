import { db } from './db.js';
import {
  closeModal,
  escapeHTML,
  formatDateTime,
  formatRupiah,
  openModal,
  refreshIcons,
} from './utils.js';

export function buildReceiptHTML(transaction, paperSize = '80mm') {
  const settings = db.getSettings();
  const isCompact = paperSize === '58mm';

  const itemsHTML = transaction.items
    .map((item) => {
      const addons = Array.isArray(item.additionals) ? item.additionals : [];
      const addonsText =
        addons.length > 0
          ? addons
              .map(
                (a) =>
                  `<div class="rcp-addon">+ ${escapeHTML(a.name)} ${
                    Number(a.price) > 0 ? `(${formatRupiah(a.price)})` : '(Gratis)'
                  }</div>`
              )
              .join('')
          : '';

      const noteText = item.note
        ? `<div class="rcp-addon" style="font-style:italic;">Catatan: ${escapeHTML(item.note)}</div>`
        : '';

      return `
        <div class="rcp-item">
          <div class="rcp-bold">${escapeHTML(item.productName)} (${escapeHTML(item.size)})</div>
          <div class="rcp-row">
            <span>${item.qty} x ${formatRupiah(item.unitFinalPrice)}</span>
            <span class="rcp-bold">${formatRupiah(item.lineSubtotal)}</span>
          </div>
          ${addonsText}
          ${noteText}
        </div>
      `;
    })
    .join('');

  return `
    <div class="receipt-sheet" style="font-family:'JetBrains Mono','Courier New',monospace;color:#000;background:#fff;">
      <div class="rcp-center">
        ${
          settings.logoDataUrl
            ? `<img src="${settings.logoDataUrl}" alt="Logo" class="rcp-logo" style="max-height:42px;margin:0 auto 4px;display:block;" />`
            : ''
        }
        <div class="rcp-bold" style="font-size:${isCompact ? '13px' : '15px'};">${escapeHTML(settings.storeName)}</div>
        <div>${escapeHTML(settings.storeAddress || '')}</div>
        ${settings.storePhone ? `<div>Telp: ${escapeHTML(settings.storePhone)}</div>` : ''}
      </div>

      <div class="rcp-hr" style="border-top:1px dashed #000;margin:6px 0;"></div>

      <div class="rcp-row"><span>No. Trx</span><span class="rcp-bold">${escapeHTML(transaction.transactionNumber)}</span></div>
      <div class="rcp-row"><span>Waktu</span><span>${formatDateTime(transaction.createdAt)}</span></div>
      <div class="rcp-row"><span>Kasir</span><span>${escapeHTML(transaction.cashierName)}</span></div>
      ${
        transaction.customerName
          ? `<div class="rcp-row"><span>Pelanggan</span><span>${escapeHTML(transaction.customerName)}</span></div>`
          : ''
      }
      <div class="rcp-row"><span>Status</span><span>${escapeHTML(transaction.status)}</span></div>

      <div class="rcp-hr" style="border-top:1px dashed #000;margin:6px 0;"></div>

      ${itemsHTML}

      <div class="rcp-hr" style="border-top:1px dashed #000;margin:6px 0;"></div>

      <div class="rcp-row">
        <span>Subtotal</span>
        <span>${formatRupiah(transaction.subtotal)}</span>
      </div>

      ${
        Number(transaction.discountAmount) > 0
          ? `<div class="rcp-row">
              <span>Diskon (${escapeHTML(transaction.discountLabel || 'Promo')})</span>
              <span>-${formatRupiah(transaction.discountAmount)}</span>
            </div>`
          : ''
      }

      ${
        Number(transaction.taxAmount) > 0
          ? `<div class="rcp-row">
              <span>Pajak</span>
              <span>${formatRupiah(transaction.taxAmount)}</span>
            </div>`
          : ''
      }

      <div class="rcp-row rcp-bold" style="font-size:${isCompact ? '12px' : '13.5px'};margin-top:4px;">
        <span>TOTAL BAYAR</span>
        <span>${formatRupiah(transaction.grandTotal)}</span>
      </div>

      <div class="rcp-hr" style="border-top:1px dashed #000;margin:6px 0;"></div>

      <div class="rcp-row">
        <span>Metode Bayar</span>
        <span class="rcp-bold">${escapeHTML(transaction.paymentMethod)}</span>
      </div>
      <div class="rcp-row">
        <span>Diterima</span>
        <span>${formatRupiah(transaction.amountPaid)}</span>
      </div>
      <div class="rcp-row">
        <span>Kembalian</span>
        <span class="rcp-bold">${formatRupiah(transaction.changeAmount)}</span>
      </div>

      <div class="rcp-hr" style="border-top:1px dashed #000;margin:6px 0;"></div>

      <div class="rcp-center" style="margin-top:6px;">
        <div>${escapeHTML(settings.receiptFooterNote || 'Terima kasih atas kunjungan Anda!')}</div>
        <div style="font-size:10px;margin-top:3px;">Powered by MILK FRESH POS</div>
      </div>
    </div>
  `;
}

export function printTransactionReceipt(transaction, paperSizeOverride = null) {
  const settings = db.getSettings();
  const paperSize = paperSizeOverride || settings.receiptPaperSize || '80mm';
  const printArea = document.getElementById('print-area');
  if (!printArea) return;

  printArea.className = `paper-${paperSize}`;
  printArea.innerHTML = buildReceiptHTML(transaction, paperSize);

  setTimeout(() => {
    window.print();
  }, 120);
}

export function openReceiptPreviewModal(transaction) {
  const settings = db.getSettings();
  let selectedPaper = settings.receiptPaperSize || '80mm';

  openModal({
    title: `Struk Pembayaran — ${transaction.transactionNumber}`,
    bodyHTML: `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <span style="font-size:12.5px;font-weight:700;color:var(--text-secondary);">Format Kertas:</span>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn btn-sm ${selectedPaper === '58mm' ? 'btn-primary' : 'btn-outline'}" data-paper="58mm">Thermal 58mm</button>
          <button type="button" class="btn btn-sm ${selectedPaper === '80mm' ? 'btn-primary' : 'btn-outline'}" data-paper="80mm">Thermal 80mm</button>
          <button type="button" class="btn btn-sm ${selectedPaper === 'standard' ? 'btn-primary' : 'btn-outline'}" data-paper="standard">Cetak Biasa</button>
        </div>
      </div>

      <div id="receipt-preview-wrapper" style="background:var(--bg-cream);padding:16px;border-radius:10px;display:flex;justify-content:center;overflow-x:auto;">
        <div id="receipt-paper-box" style="width:300px;background:#fff;padding:14px;border:1px solid var(--border-color);box-shadow:var(--shadow-xs);font-size:11.5px;line-height:1.4;">
          ${buildReceiptHTML(transaction, selectedPaper)}
        </div>
      </div>
    `,
    footerHTML: `
      <button type="button" class="btn btn-outline" id="btn-close-receipt-modal">Tutup</button>
      <button type="button" class="btn btn-primary" id="btn-execute-print">
        <i data-lucide="printer"></i>
        <span>Cetak Struk Sekarang</span>
      </button>
    `,
  });

  refreshIcons();

  const paperBox = document.getElementById('receipt-paper-box');
  const modalRoot = document.getElementById('modal-root');

  modalRoot.querySelectorAll('[data-paper]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPaper = btn.getAttribute('data-paper');
      modalRoot.querySelectorAll('[data-paper]').forEach((b) => {
        b.className = `btn btn-sm ${b.getAttribute('data-paper') === selectedPaper ? 'btn-primary' : 'btn-outline'}`;
      });
      paperBox.style.width = selectedPaper === '58mm' ? '235px' : selectedPaper === '80mm' ? '305px' : '400px';
      paperBox.style.fontSize = selectedPaper === '58mm' ? '10.5px' : '11.5px';
      paperBox.innerHTML = buildReceiptHTML(transaction, selectedPaper);
    });
  });

  document.getElementById('btn-close-receipt-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-execute-print')?.addEventListener('click', () => {
    printTransactionReceipt(transaction, selectedPaper);
  });
}
