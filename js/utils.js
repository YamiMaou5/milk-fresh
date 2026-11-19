export function generateId(prefix = 'ID') {
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

export function generateTransactionNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TRX-${y}${m}${day}-${rand}`;
}

export function generateExpenseNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `EXP-${y}${m}${day}-${rand}`;
}

function sha256Fallback(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const maxWord = Math.pow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = ascii.length * 8;
  const hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export async function hashPassword(password, salt = '') {
  const text = `${salt}:${password}`;
  if (window.crypto && window.crypto.subtle) {
    const enc = new TextEncoder().encode(text);
    const buf = await window.crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const utf8Str = unescape(encodeURIComponent(text));
  return sha256Fallback(utf8Str);
}

export function formatRupiah(amount) {
  const num = Number(amount) || 0;
  const sign = num < 0 ? '-' : '';
  return `${sign}Rp ${Math.abs(Math.round(num)).toLocaleString('id-ID')}`;
}

export function formatDateTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateOnly(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function refreshIcons() {
  try {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  } catch {
    // Abaikan jika ikon belum dimuat
  }
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.25s ease';
    setTimeout(() => toast.remove(), 260);
  }, 3200);
}

export function openModal({ title, bodyHTML, footerHTML = '' }) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3 class="card-title">${escapeHTML(title)}</h3>
        <button type="button" class="btn btn-outline btn-sm" id="modal-close-x" style="padding:4px 8px;">&times;</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
    </div>
  `;
  root.classList.remove('hidden');
  document.getElementById('modal-close-x')?.addEventListener('click', closeModal);
  refreshIcons();
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.classList.add('hidden');
  root.innerHTML = '';
}

export function printReceipt(trx, settings = {}) {
  const initialSize = settings.receiptPaperSize === '80mm' ? '80mm' : '58mm';

  function buildReceiptHtml(paperSize) {
    const is58 = paperSize === '58mm';
    const widthCss = is58 ? '58mm' : '80mm';
    const innerWidthCss = is58 ? '52mm' : '72mm';
    const fontSizeCss = is58 ? '10.5px' : '12px';
    const titleSizeCss = is58 ? '13.5px' : '16px';
    const dashLine = is58 ? '--------------------------------' : '----------------------------------------------';

    const itemsHTML = (trx.items || [])
      .map((item) => {
        const addons = (item.additionals || []).map((a) => a.name).join(', ');
        return `
          <div class="item">
            <div class="item-top">
              <span class="item-name">${escapeHTML(item.productName)} (${escapeHTML(item.size)})</span>
              <span class="val">${formatRupiah(item.lineSubtotal)}</span>
            </div>
            <div class="item-sub">${item.qty} x ${formatRupiah(item.unitFinalPrice)}</div>
            ${addons ? `<div class="item-sub">+ ${escapeHTML(addons)}</div>` : ''}
            ${item.note ? `<div class="item-sub">Catatan: ${escapeHTML(item.note)}</div>` : ''}
          </div>
        `;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>Struk ${escapeHTML(trx.transactionNumber)}</title>
<style>
  @page {
    size: ${widthCss} auto;
    margin: 2mm;
  }
  * {
    box-sizing: border-box;
  }
  html, body {
    width: ${widthCss};
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #000000;
    font-family: 'Courier New', Courier, monospace;
    font-size: ${fontSizeCss};
    line-height: 1.32;
  }
  .receipt {
    width: ${innerWidthCss};
    margin: 0 auto;
    padding: 2mm 0;
  }
  .center {
    text-align: center;
  }
  .store-name {
    font-size: ${titleSizeCss};
    font-weight: 800;
    margin-bottom: 2px;
  }
  .store-meta {
    font-size: 0.92em;
    line-height: 1.25;
  }
  .sep {
    font-size: 0.85em;
    letter-spacing: -0.5px;
    white-space: nowrap;
    overflow: hidden;
    margin: 5px 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 6px;
    margin: 2px 0;
  }
  .val {
    text-align: right;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .item {
    margin: 5px 0;
  }
  .item-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 6px;
    font-weight: 700;
  }
  .item-sub {
    font-size: 0.9em;
    padding-left: 6px;
    margin-top: 1px;
  }
  .total-row {
    font-size: 1.15em;
    font-weight: 800;
    margin: 4px 0;
  }
  .footer {
    text-align: center;
    font-size: 0.92em;
    margin-top: 6px;
    line-height: 1.3;
  }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      <div class="store-name">${escapeHTML(settings.storeName || 'MILK FRESH POS')}</div>
      ${settings.storeAddress ? `<div class="store-meta">${escapeHTML(settings.storeAddress)}</div>` : ''}
      ${settings.storePhone ? `<div class="store-meta">Telp: ${escapeHTML(settings.storePhone)}</div>` : ''}
    </div>

    <div class="sep">${dashLine}</div>

    <div class="row"><span>No</span><span class="val">${escapeHTML(trx.transactionNumber)}</span></div>
    <div class="row"><span>Tgl</span><span class="val">${escapeHTML(formatDateTime(trx.createdAt))}</span></div>
    <div class="row"><span>Kasir</span><span class="val">${escapeHTML(trx.cashierName || '-')}</span></div>
    ${trx.customerName ? `<div class="row"><span>Plg</span><span class="val">${escapeHTML(trx.customerName)}</span></div>` : ''}

    <div class="sep">${dashLine}</div>

    ${itemsHTML}

    <div class="sep">${dashLine}</div>

    <div class="row"><span>Subtotal</span><span class="val">${formatRupiah(trx.subtotal)}</span></div>
    ${
      Number(trx.discountAmount) > 0
        ? `<div class="row"><span>Diskon${trx.discountLabel ? ` (${escapeHTML(trx.discountLabel)})` : ''}</span><span class="val">-${formatRupiah(trx.discountAmount)}</span></div>`
        : ''
    }
    ${
      Number(trx.taxAmount) > 0
        ? `<div class="row"><span>Pajak</span><span class="val">${formatRupiah(trx.taxAmount)}</span></div>`
        : ''
    }

    <div class="row total-row"><span>TOTAL</span><span class="val">${formatRupiah(trx.grandTotal)}</span></div>

    <div class="sep">${dashLine}</div>

    <div class="row"><span>Bayar (${escapeHTML(trx.paymentMethod)})</span><span class="val">${formatRupiah(trx.amountPaid)}</span></div>
    <div class="row"><span>Kembali</span><span class="val">${formatRupiah(trx.changeAmount)}</span></div>

    <div class="sep">${dashLine}</div>

    <div class="footer">${escapeHTML(settings.receiptFooter || 'Terima kasih telah berbelanja!')}</div>
  </div>
</body>
</html>`;
  }

  function triggerIframePrint(htmlString) {
    let iframe = document.getElementById('thermal-print-frame');
    if (iframe) iframe.remove();

    iframe = document.createElement('iframe');
    iframe.id = 'thermal-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(htmlString);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.warn('Gagal memicu print iframe:', err);
      }
    }, 200);
  }

  let activeSize = initialSize;
  const previewBody = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--text-secondary);">Pilih ukuran kertas thermal:</span>
      <div style="display:flex;gap:6px;">
        <button type="button" id="rcpt-sz-58" class="btn btn-sm ${activeSize === '58mm' ? 'btn-primary' : 'btn-outline'}">Thermal 58mm</button>
        <button type="button" id="rcpt-sz-80" class="btn btn-sm ${activeSize === '80mm' ? 'btn-primary' : 'btn-outline'}">Thermal 80mm</button>
      </div>
    </div>
    <div style="background:#f3f4f6;padding:14px;border-radius:10px;display:flex;justify-content:center;overflow:auto;">
      <iframe id="rcpt-preview-frame" style="width:${activeSize === '58mm' ? '230px' : '310px'};height:390px;background:#fff;border:1px solid #d1d5db;border-radius:6px;"></iframe>
    </div>
  `;

  openModal({
    title: `Struk ${trx.transactionNumber}`,
    bodyHTML: previewBody,
    footerHTML: `
      <button type="button" class="btn btn-outline" id="rcpt-btn-close">Tutup</button>
      <button type="button" class="btn btn-primary" id="rcpt-btn-print">Cetak Struk</button>
    `,
  });

  function updatePreviewFrame() {
    const frame = document.getElementById('rcpt-preview-frame');
    if (!frame) return;
    frame.style.width = activeSize === '58mm' ? '230px' : '310px';
    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write(buildReceiptHtml(activeSize));
    doc.close();
  }

  updatePreviewFrame();

  document.getElementById('rcpt-sz-58')?.addEventListener('click', () => {
    activeSize = '58mm';
    document.getElementById('rcpt-sz-58')?.classList.replace('btn-outline', 'btn-primary');
    document.getElementById('rcpt-sz-80')?.classList.replace('btn-primary', 'btn-outline');
    updatePreviewFrame();
  });

  document.getElementById('rcpt-sz-80')?.addEventListener('click', () => {
    activeSize = '80mm';
    document.getElementById('rcpt-sz-80')?.classList.replace('btn-outline', 'btn-primary');
    document.getElementById('rcpt-sz-58')?.classList.replace('btn-primary', 'btn-outline');
    updatePreviewFrame();
  });

  document.getElementById('rcpt-btn-close')?.addEventListener('click', closeModal);
  document.getElementById('rcpt-btn-print')?.addEventListener('click', () => {
    triggerIframePrint(buildReceiptHtml(activeSize));
  });
}





export function toLocalDateKey(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}
