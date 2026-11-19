import { auth } from "../auth.js";
import { db } from "../db.js";
import { escapeHTML, hashPassword, refreshIcons, showToast } from "../utils.js";

let activeTab = "kasir";
let showSetup = false;

async function seedDefaults() {
  if (typeof db.init === "function") await db.init();
  const users = (typeof db.getAll === "function" ? await db.getAll("users") : []) || [];
  if (!users.some((u) => u && (u.role === "owner" || u.role === "admin"))) {
    const pw = await hashPassword("owner123");
    const owner = { id: "usr-owner", name: "Owner Mooment", username: "owner", password: pw, passwordHash: pw, role: "owner", active: true };
    if (typeof db.put === "function") await db.put("users", owner);
    else if (typeof db.add === "function") await db.add("users", owner);
  }
  if (!users.some((u) => u && u.role === "kasir")) {
    const pw = await hashPassword("kasir123");
    const kasir = { id: "usr-kasir", name: "Sari", username: "kasir", password: pw, passwordHash: pw, role: "kasir", active: true };
    if (typeof db.put === "function") await db.put("users", kasir);
    else if (typeof db.add === "function") await db.add("users", kasir);
  }
}

export async function renderLoginView(container) {
  const host = container || document.getElementById("app") || document.body;
  if (!host) return;
  await seedDefaults();

  const users = (typeof db.getAll === "function" ? await db.getAll("users") : []) || [];
  const admin = users.find((u) => u && (u.role === "owner" || u.role === "admin")) || { name: "Owner Mooment", username: "owner" };
  const kasir = users.find((u) => u && u.role === "kasir") || { name: "Sari", username: "kasir" };
  let store = "Susu Murni Mooment";
  try {
    const st = typeof db.getSettings === "function" ? await db.getSettings() : {};
    if (st && st.storeName && st.storeName !== "MILK FRESH POS") store = st.storeName;
  } catch (_) {}

  if (showSetup) {
    host.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:#f0fdf4;">
        <div style="width:100%;max-width:430px;background:#fff;border-radius:18px;padding:24px;box-shadow:0 10px 28px rgba(0,0,0,.08);">
          <button type="button" id="btn-back-login" style="background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d;font-weight:700;font-size:12px;padding:6px 12px;border-radius:999px;cursor:pointer;margin-bottom:14px;">&larr; Kembali ke Login</button>
          <h2 style="margin:0 0 4px;font-size:19px;color:#111827;">Aktivasi Toko &amp; Akun Pemilik</h2>
          <p style="margin:0 0 14px;font-size:12px;color:#6b7280;">Atur nama kedai dan akun Admin utama.</p>
          <form id="form-setup" style="display:flex;flex-direction:column;gap:10px;">
            <input id="s-store" value="${escapeHTML(store)}" placeholder="Nama Kedai" required style="padding:10px;border:1px solid #d1d5db;border-radius:10px;" />
            <input id="s-name" value="${escapeHTML(admin.name)}" placeholder="Nama Pemilik" required style="padding:10px;border:1px solid #d1d5db;border-radius:10px;" />
            <input id="s-user" value="${escapeHTML(admin.username)}" placeholder="Username Admin" required style="padding:10px;border:1px solid #d1d5db;border-radius:10px;" />
            <input id="s-pass" type="password" placeholder="Password Baru (min. 6 karakter)" minlength="6" required style="padding:10px;border:1px solid #d1d5db;border-radius:10px;" />
            <button type="submit" style="padding:12px;background:#14532d;color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;">Simpan &amp; Masuk Dashboard</button>
          </form>
        </div>
      </div>`;
    document.getElementById("btn-back-login").onclick = () => { showSetup = false; renderLoginView(host); };
    document.getElementById("form-setup").onsubmit = async (e) => {
      e.preventDefault();
      const pw = await hashPassword(document.getElementById("s-pass").value);
      const uName = document.getElementById("s-user").value.trim();
      const upd = { ...admin, id: admin.id || "usr-owner", name: document.getElementById("s-name").value.trim(), username: uName, password: pw, passwordHash: pw, role: "owner", active: true };
      if (typeof db.put === "function") await db.put("users", upd);
      if (typeof db.saveSettings === "function") await db.saveSettings({ storeName: document.getElementById("s-store").value.trim() });
      if (typeof auth["login"] === "function") await auth["login"](uName, document.getElementById("s-pass").value);
      showSetup = false;
      window.location.hash = "#dashboard";
      window.location.reload();
    };
    return;
  }

  const isKasir = activeTab === "kasir";
  host.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:#f0fdf4;">
      <div style="width:100%;max-width:420px;background:#fff;border-radius:20px;padding:26px;box-shadow:0 12px 30px rgba(20,83,45,.1);border:1px solid #dcfce7;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
          <div style="width:42px;height:42px;border-radius:12px;background:#14532d;color:#fff;display:flex;align-items:center;justify-content:center;"><i data-lucide="milk"></i></div>
          <div>
            <h1 style="margin:0;font-size:17px;font-weight:800;color:#111827;">${escapeHTML(store)}</h1>
            <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">Sistem Kasir &amp; Manajemen Kedai</p>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:5px;background:#f3f4f6;padding:4px;border-radius:12px;margin-bottom:18px;">
          <button type="button" id="t-kasir" style="flex:1;padding:9px;border:none;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;${isKasir ? "background:#14532d;color:#fff;" : "background:transparent;color:#4b5563;"}">Login Kasir</button>
          <button type="button" id="t-admin" style="flex:1;padding:9px;border:none;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;${!isKasir ? "background:#14532d;color:#fff;" : "background:transparent;color:#4b5563;"}">Login Admin</button>
          <button type="button" id="t-setup" title="Aktivasi Toko" style="padding:8px 9px;border:1px solid #bbf7d0;background:#ecfdf5;color:#15803d;border-radius:9px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:3px;"><i data-lucide="sparkles" style="width:13px;height:13px;"></i>Aktivasi</button>
        </div>

        <div style="text-align:center;margin-bottom:14px;">
          <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;color:#111827;">${isKasir ? "Masuk Shift Kasir" : "Masuk Dashboard Admin"}</h2>
          <p style="margin:0;font-size:12px;color:#6b7280;">${isKasir ? "Transaksi penjualan, antrean & setoran shift." : "Kelola menu, stok, laporan & pengaturan toko."}</p>
        </div>

        <div style="margin-bottom:12px;">
          <button type="button" id="btn-fill" style="background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;cursor:pointer;">
            Isi Cepat: ${isKasir ? escapeHTML(kasir.name) + " (@" + escapeHTML(kasir.username) + ")" : escapeHTML(admin.name) + " (@" + escapeHTML(admin.username) + ")"}
          </button>
        </div>

        <form id="f-login" style="display:flex;flex-direction:column;gap:11px;">
          <input id="l-user" placeholder="${isKasir ? "Username Kasir" : "Username Admin"}" required style="padding:11px;border:1px solid #d1d5db;border-radius:10px;font-size:13.5px;" />
          <input id="l-pass" type="password" placeholder="Password" required style="padding:11px;border:1px solid #d1d5db;border-radius:10px;font-size:13.5px;" />
          ${!isKasir ? '<div style="text-align:right;margin-top:-6px;"><button type="button" id="btn-lupa" style="background:none;border:none;color:#15803d;font-size:11.5px;font-weight:600;cursor:pointer;">Lupa Password?</button></div>' : ""}
          <div id="l-err" style="display:none;color:#b91c1c;background:#fef2f2;padding:8px 10px;border-radius:8px;font-size:12px;"></div>
          <button type="submit" style="padding:12px;background:#14532d;color:#fff;border:none;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;">
            ${isKasir ? "Buka Layar Kasir" : "Masuk Dashboard Admin"}
          </button>
        </form>

        <div style="margin-top:16px;padding-top:12px;border-top:1px dashed #e5e7eb;text-align:center;font-size:12px;color:#6b7280;">
          Kedai baru? <button type="button" id="b-setup" style="background:none;border:none;color:#15803d;font-weight:700;cursor:pointer;text-decoration:underline;">Aktivasi Toko</button>
        </div>
      </div>
    </div>`;

  document.getElementById("t-kasir").onclick = () => { activeTab = "kasir"; renderLoginView(host); };
  document.getElementById("t-admin").onclick = () => { activeTab = "admin"; renderLoginView(host); };
  document.getElementById("t-setup").onclick = () => { showSetup = true; renderLoginView(host); };
  document.getElementById("b-setup").onclick = () => { showSetup = true; renderLoginView(host); };
  document.getElementById("btn-fill").onclick = () => {
    document.getElementById("l-user").value = isKasir ? (kasir.username || "kasir") : (admin.username || "owner");
    document.getElementById("l-pass").value = isKasir ? "kasir123" : "owner123";
  };
  const lupaBtn = document.getElementById("btn-lupa");
  if (lupaBtn) lupaBtn.onclick = () => alert("Default Admin: username 'owner' | password 'owner123'.");

  document.getElementById("f-login").onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("l-err");
    errEl.style.display = "none";
    const u = document.getElementById("l-user").value.trim();
    const p = document.getElementById("l-pass").value;
    try {
      if (typeof auth["login"] === "function") {
        await auth["login"](u, p);
      }
      if (typeof showToast === "function") showToast("Login berhasil!", "success");
      window.location.hash = isKasir ? "#pos" : "#dashboard";
      window.location.reload();
    } catch (err) {
      errEl.textContent = err.message || "Username atau password salah.";
      errEl.style.display = "block";
    }
  };
  if (typeof refreshIcons === "function") refreshIcons();
}
