import fs from "node:fs"; const code = `import { auth } from "../auth.js";
import { db } from "../db.js";
import { closeModal, escapeHTML, formatDateTime, formatRupiah, hashPassword, openModal, refreshIcons, showToast } from "../utils.js";

function isoOffset(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export async function renderReportsView(container) {
  const host = container || document.getElementById("app-content");
  if (!host) return;

  let range = { from: isoOffset(19), to: isoOffset(0) };

  const computeReport = () => {
    const t0 = new Date(range.from + "T00:00:00").getTime();
    const t1 = new Date(range.to + "T23:59:59.999").getTime();

    const validTrx = (db.data.transactions || []).filter((t) => {
      if (t.status === "Dibatalkan" || t.status === "Menunggu pembayaran") return false;
      const ts = new Date(t.createdAt).getTime();
      return ts >= t0 && ts <= t1;
    });

    const expenses = (db.data.expenses || []).filter((e) => {
      const ts = new Date(e.date + "T12:00:00").getTime();
      return ts >= t0 && ts <= t1;
    });

    const omzet = validTrx.reduce((acc, t) => acc + (Number(t.grandTotal) || 0), 0);
    const modal = validTrx.reduce((acc, t) => acc + (Number(t.totalModal) || 0), 0);
    const biaya = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const labaKotor = omzet - modal;
    const labaBersih = labaKotor - biaya;

    const paymentMap = new Map();
    const cashierMap = new Map();

    for (const t of validTrx) {
      const pm = t.paymentMethod || "Lainnya";
      paymentMap.set(pm, (paymentMap.get(pm) || 0) + (Number(t.grandTotal) || 0));

      const cn = t.cashierName || "Kasir";
      const cur = cashierMap.get(cn) || { name: cn, count: 0, omzet: 0 };
      cur.count += 1;
      cur.omzet += Number(t.grandTotal) || 0;
      cashierMap.set(cn, cur);
    }

    return { validTrx, expenses, omzet, modal, biaya, labaKotor, labaBersih, paymentMap, cashierList: [...cashierMap.values()] };
  };

  const verifyAdmin = async (pw) => {
    const user = auth.getUser();
    if (!user || user.role !== "admin") throw new Error("Hanya Admin yang dapat menghapus transaksi.");
    if (!pw) throw new Error("Password Admin wajib diisi.");
    const hash = await hashPassword(pw, user.salt);
    if (hash !== user.passwordHash) throw new Error("Password Admin tidak cocok.");
    return true;
  };

  const removeTransaction = (id) => {
    const list = db.data.transactions || [];
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    const target = list[idx];

    if (target.status !== "Dibatalkan" && Array.isArray(target.items)) {
      for (const item of target.items) {
        const prod = (db.data.products || []).find((p) => p.id === item.productId);
        if (prod) prod.stok = (Number(prod.stok) || 0) + (Number(item.qty) || 0);
      }
    }

    list.splice(idx, 1);
    db.save();
    db.logAuthEvent?.(auth.getUser()?.username || "admin", "HAPUS_TRANSAKSI", "BERHASIL", "Hapus " + target.transactionNumber + " (" + formatRupiah(target.grandTotal) + ")");
    return true;
  };

  const promptDeleteModal = (trx) => {
    openModal({
      title: "Hapus Transaksi " + escapeHTML(trx.transactionNumber),
      bodyHTML:
        "<div style=\\"padding:10px 12px;background:var(--danger-bg);border:1px solid #fecaca;border-radius:9px;margin-bottom:12px;color:var(--danger);font-size:12px;\\"><strong>Perhatian:</strong> Menghapus transaksi akan memperbarui Omzet, Modal, Laba Bersih, dan mengembalikan stok item.</div>" +
        "<div style=\\"padding:10px 12px;background:var(--surface-subtle);border-radius:9px;margin-bottom:12px;font-size:12.5px;\\">" +
          "<div>No. Transaksi: <strong>" + escapeHTML(trx.transactionNumber) + "</strong></div>" +
          "<div>Kasir: <strong>" + escapeHTML(trx.cashierName || "-") + "</strong> • Metode: <strong>" + escapeHTML(trx.paymentMethod || "-") + "</strong></div>" +
          "<div>Total: <strong style=\\"color:var(--primary-green);\\">" + formatRupiah(trx.grandTotal) + "</strong></div>" +
        "</div>" +
        "<form id=\\"rep-del-form\\" autocomplete=\\"off\\">" +
          "<div class=\\"form-group\\"><label class=\\"form-label\\">Password Admin *</label><input type=\\"password\\" id=\\"rep-del-pw\\" class=\\"form-control\\" autocomplete=\\"new-password\\" placeholder=\\"Masukkan password Admin\\" required /></div>" +
          "<div id=\\"rep-del-err\\" class=\\"hidden\\" style=\\"color:var(--danger);font-size:12px;font-weight:600;margin-bottom:10px;\\"></div>" +
          "<div style=\\"display:flex;justify-content:flex-end;gap:8px;\\"><button type=\\"button\\" class=\\"btn btn-outline\\" id=\\"rep-del-cancel\\">Batal</button><button type=\\"submit\\" class=\\"btn btn-outline-danger\\">Konfirmasi Hapus</button></div>" +
        "</form>"
    });

    const input = document.getElementById("rep-del-pw");
    const errEl = document.getElementById("rep-del-err");
    setTimeout(() => input?.focus(), 40);
    document.getElementById("rep-del-cancel")?.addEventListener("click", closeModal);

    document.getElementById("rep-del-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl?.classList.add("hidden");
      try {
        await verifyAdmin(input.value);
        const ok = removeTransaction(trx.id);
        closeModal();
        if (ok) {
          showToast("Transaksi " + trx.transactionNumber + " dihapus.", "warning");
          draw();
        }
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || "Gagal verifikasi.";
          errEl.classList.remove("hidden");
        }
      }
    });
  };

  const exportWorkbook = (rep) => {
    if (typeof XLSX === "undefined") {
      showToast("SheetJS (XLSX) belum tersedia.", "error");
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["LAPORAN KEUANGAN - MILK FRESH POS"],
      ["Periode", range.from + " s/d " + range.to],
      [],
      ["Metrik", "Nilai (Rp)"],
      ["Total Omzet", rep.omzet],
      ["Total Modal (HPP)", rep.modal],
      ["Laba Kotor", rep.labaKotor],
      ["Biaya Operasional", rep.biaya],
      ["Laba Bersih", rep.labaBersih]
    ]), "Ringkasan");

    const trxRows = rep.validTrx.map((t) => ({
      "No. Transaksi": t.transactionNumber,
      Waktu: formatDateTime(t.createdAt),
      Kasir: t.cashierName,
      Pelanggan: t.customerName || "-",
      "Metode Bayar": t.paymentMethod,
      Subtotal: t.subtotal,
      Diskon: t.discountAmount,
      "Total Bayar": t.grandTotal,
      "Modal (HPP)": t.totalModal,
      "Laba Kotor": t.grossProfit
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trxRows.length ? trxRows : [{ Info: "Tidak ada transaksi" }]), "Penjualan");

    const expRows = rep.expenses.map((e) => ({
      Kode: e.code,
      Tanggal: e.date,
      Kategori: e.category,
      Keterangan: e.description,
      Nominal: e.amount,
      Petugas: e.createdBy
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows.length ? expRows : [{ Info: "Tidak ada pengeluaran" }]), "Pengeluaran");

    XLSX.writeFile(wb, "Laporan_MilkFreshPOS_" + range.from + "_to_" + range.to + ".xlsx");
    showToast("Berhasil export Excel (.xlsx).", "success");
  };

  const draw = () => {
    const isAdmin = auth.isAdmin();
    const rep = computeReport();

    const payRows = [...rep.paymentMap.entries()].map(([m, v]) =>
      "<div style=\\"display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:13px;\\"><strong>" + escapeHTML(m) + "</strong><span style=\\"font-weight:700;color:var(--primary-green);\\">" + formatRupiah(v) + "</span></div>"
    ).join("");

    const cashRows = rep.cashierList.map((c) =>
      "<div style=\\"display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:13px;\\"><div><strong>" + escapeHTML(c.name) + "</strong><small style=\\"color:var(--text-muted);display:block;\\">" + c.count + " transaksi</small></div><span style=\\"font-weight:700;\\">" + formatRupiah(c.omzet) + "</span></div>"
    ).join("");

    const trxHtml = rep.validTrx.length === 0
      ? "<tr><td colspan=\\"" + (isAdmin ? 8 : 7) + "\\" style=\\"text-align:center;color:var(--text-muted);padding:20px;\\">Tidak ada transaksi sukses pada periode ini.</td></tr>"
      : rep.validTrx.map((t) =>
          "<tr>" +
            "<td class=\\"selectable-text\\" style=\\"font-family:var(--font-mono);font-weight:700;\\">" + escapeHTML(t.transactionNumber) + "</td>" +
            "<td>" + formatDateTime(t.createdAt) + "</td>" +
            "<td>" + escapeHTML(t.cashierName) + "</td>" +
            "<td>" + escapeHTML(t.paymentMethod) + "</td>" +
            "<td style=\\"font-weight:700;\\">" + formatRupiah(t.grandTotal) + "</td>" +
            "<td>" + formatRupiah(t.totalModal) + "</td>" +
            "<td style=\\"font-weight:700;color:var(--primary-green);\\">" + formatRupiah(t.grossProfit) + "</td>" +
            (isAdmin ? "<td><button type=\\"button\\" class=\\"btn btn-outline-danger btn-sm\\" data-rep-del=\\"" + t.id + "\\">Hapus</button></td>" : "") +
          "</tr>"
        ).join("");

    host.innerHTML =
      "<div class=\\"card\\" style=\\"margin-bottom:16px;\\">" +
        "<div style=\\"display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;\\">" +
          "<form id=\\"rep-filter\\" style=\\"display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;\\">" +
            "<div><label class=\\"form-label\\">Dari Tanggal</label><input type=\\"date\\" id=\\"rep-from\\" class=\\"form-control\\" value=\\"" + range.from + "\\" required /></div>" +
            "<div><label class=\\"form-label\\">Sampai Tanggal</label><input type=\\"date\\" id=\\"rep-to\\" class=\\"form-control\\" value=\\"" + range.to + "\\" required /></div>" +
            "<button type=\\"submit\\" class=\\"btn btn-primary\\">Terapkan Periode</button>" +
          "</form>" +
          "<button type=\\"button\\" id=\\"rep-xlsx\\" class=\\"btn btn-cocoa\\"><i data-lucide=\\"file-spreadsheet\\"></i><span>Export Excel (.xlsx)</span></button>" +
        "</div>" +
      "</div>" +
      "<div class=\\"kpi-grid\\">" +
        "<div class=\\"kpi-card green\\"><div class=\\"kpi-label\\">Total Omzet</div><div class=\\"kpi-value\\">" + formatRupiah(rep.omzet) + "</div><div class=\\"kpi-sub\\">" + rep.validTrx.length + " transaksi sukses</div></div>" +
        "<div class=\\"kpi-card cocoa\\"><div class=\\"kpi-label\\">Total Modal (HPP)</div><div class=\\"kpi-value\\">" + formatRupiah(rep.modal) + "</div><div class=\\"kpi-sub\\">Harga pokok penjualan</div></div>" +
        "<div class=\\"kpi-card amber\\"><div class=\\"kpi-label\\">Biaya Operasional</div><div class=\\"kpi-value\\">" + formatRupiah(rep.biaya) + "</div><div class=\\"kpi-sub\\">" + rep.expenses.length + " catatan pengeluaran</div></div>" +
        "<div class=\\"kpi-card blue\\"><div class=\\"kpi-label\\">Laba Bersih</div><div class=\\"kpi-value\\" style=\\"color:" + (rep.labaBersih >= 0 ? "var(--success)" : "var(--danger)") + ";\\">" + formatRupiah(rep.labaBersih) + "</div><div class=\\"kpi-sub\\">Omzet &minus; Modal &minus; Biaya</div></div>" +
      "</div>" +
      "<div style=\\"display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:16px;\\">" +
        "<div class=\\"card\\"><div class=\\"card-header\\"><h3 class=\\"card-title\\">Omzet per Metode Pembayaran</h3></div>" + (payRows || "<p style=\\"color:var(--text-muted);font-size:13px;\\">Belum ada data pada periode ini.</p>") + "</div>" +
        "<div class=\\"card\\"><div class=\\"card-header\\"><h3 class=\\"card-title\\">Performa Kasir</h3></div>" + (cashRows || "<p style=\\"color:var(--text-muted);font-size:13px;\\">Belum ada transaksi kasir pada periode ini.</p>") + "</div>" +
      "</div>" +
      "<div class=\\"card\\"><div class=\\"card-header\\"><h3 class=\\"card-title\\">Rincian Penjualan Periode Terpilih</h3></div><div class=\\"table-responsive\\"><table class=\\"data-table\\"><thead><tr><th>No. Transaksi</th><th>Waktu</th><th>Kasir</th><th>Metode</th><th>Omzet</th><th>Modal</th><th>Laba Kotor</th>" + (isAdmin ? "<th>AKSI</th>" : "") + "</tr></thead><tbody>" + trxHtml + "</tbody></table></div></div>";

    refreshIcons();

    host.querySelector("#rep-filter")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = host.querySelector("#rep-from")?.value;
      const t = host.querySelector("#rep-to")?.value;
      if (f && t && f > t) {
        showToast("Tanggal awal tidak boleh melebihi tanggal akhir.", "warning");
        return;
      }
      range = { from: f || range.from, to: t || range.to };
      draw();
    });

    host.querySelector("#rep-xlsx")?.addEventListener("click", () => exportWorkbook(rep));

    host.querySelectorAll("[data-rep-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!auth.isAdmin()) return;
        const id = btn.getAttribute("data-rep-del");
        const trx = (db.data.transactions || []).find((x) => x.id === id);
        if (trx) promptDeleteModal(trx);
      });
    });
  };

  draw();
}

export default renderReportsView;
`;
fs.writeFileSync("js/views/reportsView.js", code, "utf8");
for (const file of ["js/app.js", "index.html"]) {
  if (fs.existsSync(file)) {
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/\?v=\d+\.\d+/g, "?v=30.0"), "utf8");
  }
}
console.log("OK_REPORTS_VIEW");
