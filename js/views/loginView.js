import { auth } from "../auth.js";
import { db } from "../db.js";
import { escapeHTML, hashPassword, refreshIcons, showToast } from "../utils.js";

let activeTab = "kasir"; // "kasir" | "admin"
let showActivation = false;

async function ensureDefaultAccounts() {
  try {
    if (typeof db.init === "function") await db.init();
    const users = (typeof db.getAll === "function" ? await db.getAll("users") : (db.data?.users || [])) || [];
    const hasAdmin = users.some((u) => u && (u.role === "owner" || u.role === "admin"));
    const hasKasir = users.some((u) => u && u.role === "kasir");

    const defaultAdminPass = await hashPassword("owner123");
    const defaultKasirPass = await hashPassword("kasir123");

    if (!hasAdmin) {
      const ownerRecord = {
        id: "usr-owner-default",
        name: "Owner Mooment",
        username: "owner",
        password: defaultAdminPass,
        passwordHash: defaultAdminPass,
        role: "owner",
        email: "owner@mooment.id",
        active: true,
        createdAt: new Date().toISOString()
      };
      if (typeof db.put === "function") await db.put("users", ownerRecord);
      else if (typeof db.add === "function") await db.add("users", ownerRecord);
      else if (Array.isArray(db.data?.users)) db.data.users.push(ownerRecord);
    }

    if (!hasKasir) {
      const kasirRecord = {
        id: "usr-kasir-sari",
        name: "Sari",
        username: "kasir",
        password: defaultKasirPass,
        passwordHash: defaultKasirPass,
        role: "kasir",
        active: true,
        createdAt: new Date().toISOString()
      };
      if (typeof db.put === "function") await db.put("users", kasirRecord);
      else if (typeof db.add === "function") await db.add("users", kasirRecord);
      else if (Array.isArray(db.data?.users)) db.data.users.push(kasirRecord);
    }
  } catch (e) {
    console.warn("Seed default user:", e);
  }
}

async function performLogin(username, password, targetRole) {
  await ensureDefaultAccounts();
  const cleanUser = String(username || "").trim();
  const cleanPass = String(password || "");
  if (!cleanUser || !cleanPass) {
    throw new Error("Username dan password wajib diisi.");
  }

  // 1. Coba lewat method bawaan auth.js jika tersedia
  if (auth && typeof auth["login"] === "function") {
    try {
      const res = await auth["login"](cleanUser, cleanPass, targetRole);
      if (res) return res;
    } catch (err) {
      // Lanjut cek fallback verifikasi langsung ke db jika role owner/admin berbeda penamaan
      if (!/tidak ditemukan|invalid|salah|role/i.test(String(err?.message || ""))) {
        throw err;
      }
    }
  }

  // 2. Verifikasi langsung terhadap tabel users di db.js
  const users = (typeof db.getAll === "function" ? await db.getAll("users") : (db.data?.users || [])) || [];
  const hashed = await hashPassword(cleanPass);
  const found = users.find((u) => {
    if (!u || u.active === false) return false;
    const unameMatch = String(u.username || "").toLowerCase() === cleanUser.toLowerCase();
    const passMatch = u.password === hashed || u.passwordHash === hashed || u.password === cleanPass;
    const roleMatch = targetRole === "admin"
      ? (u.role === "owner" || u.role === "admin")
      : (u.role === "kasir" || u.role === "owner" || u.role === "admin");
    return unameMatch && passMatch && roleMatch;
  });

  if (!found) {
    throw new Error(targetRole === "admin"
      ? "Username atau password Admin salah. Coba klik pill Owner (@owner)."
      : "Username atau password Kasir salah. Coba klik pill Sari (@kasir).");
  }

  // Simpan sesi ke auth & localStorage agar router mengenali user sudah login
  if (auth) {
    auth.currentUser = found;
    if (typeof auth.setSession === "function") await auth.setSession(found, true);
  }
  localStorage.setItem("milk_fresh_session", JSON.stringify(found));
  localStorage.setItem("pos_current_user", JSON.stringify(found));
  return found;
}

export async function renderLoginView(container) {
  const host = container || document.getElementById("app") || document.body;
  if (!host) return;
  await ensureDefaultAccounts();

  const users = (typeof db.getAll === "function" ? await db.getAll("users") : (db.data?.users || [])) || [];
  const adminAccount = users.find((u) => u && (u.role === "owner" || u.role === "admin")) || { name: "Owner Mooment", username: "owner" };
  const kasirAccount = users.find((u) => u && u.role === "kasir") || { name: "Sari", username: "kasir" };

  let storeName = "Susu Murni Mooment";
  try {
    const settings = typeof db.getSettings === "function" ? await db.getSettings() : (db.data?.settings || {});
    if (settings?.storeName && settings.storeName !== "MILK FRESH POS") storeName = settings.storeName;
  } catch (_) {}

  if (showActivation) {
    host.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 50%,#f8fafc 100%);">
        <div style="width:100%;max-width:460px;background:#fff;border-radius:20px;box-shadow:0 12px 32px rgba(20,83,45,0.10);padding:26px;border:1px solid #dcfce7;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <button type="button" id="btn-back-to-login" style="display:inline-flex;align-items:center;gap:6px;background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d;font-weight:700;font-size:12.5px;padding:6px 12px;border-radius:999px;cursor:pointer;">
              &larr; Kembali ke Login
            </button>
            <span style="font-size:11px;font-weight:700;color:#15803d;background:#dcfce7;padding:4px 10px;border-radius:999px;">Aktivasi Gerai</span>
          </div>

          <h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#111827;">Profil Toko &amp; Akun Pemilik</h2>
          <p style="margin:0 0 16px;font-size:12.5px;color:#6b7280;">Sesuaikan identitas gerai dan kredensial Owner/Admin utama.</p>

          <form id="form-store-activation" style="display:flex;flex-direction:column;gap:12px;">
            <div>
              <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:4px;">Nama Usaha / Gerai *</label>
              <input type="text" id="act-store-name" value="${escapeHTML(storeName)}" required style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:13.5px;box-sizing:border-box;" />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div>
                <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:4px;">No. WhatsApp Toko</label>
                <input type="text" id="act-store-wa" placeholder="0812xxxxxxxx" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:13.5px;box-sizing:border-box;" />
              </div>
              <div>
                <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:4px;">Alamat Gerai</label>
                <input type="text" id="act-store-addr" placeholder="Jl. Contoh No. 12" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:13.5px;box-sizing:border-box;" />
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div>
                <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:4px;">Nama Pemilik *</label>
                <input type="text" id="act-owner-name" value="${escapeHTML(adminAccount.name || "Owner Mooment")}" required style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:13.5px;box-sizing:border-box;" />
              </div>
              <div>
                <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:4px;">Username Admin *</label>
                <input type="text" id="act-owner-user" value="${escapeHTML(adminAccount.username || "owner")}" required style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:13.5px;box-sizing:border-box;" />
              </div>
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:4px;">Password Admin Baru (Minimal 6 karakter) *</label>
              <input type="password" id="act-owner-pass" placeholder="Masukkan password baru" minlength="6" required style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:13.5px;box-sizing:border-box;" />
            </div>
            <button type="submit" style="margin-top:6px;width:100%;padding:12px;background:#14532d;color:#fff;border:none;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;">
              Simpan Aktivasi &amp; Masuk Dashboard
            </button>
          </form>
        </div>
      </div>
    `;

    document.getElementById("btn-back-to-login")?.addEventListener("click", () => {
      showActivation = false;
      renderLoginView(host);
    });

    document.getElementById("form-store-activation")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const sName = document.getElementById("act-store-name").value.trim() || "Susu Murni Mooment";
        const sWa = document.getElementById("act-store-wa").value.trim();
        const sAddr = document.getElementById("act-store-addr").value.trim();
        const oName = document.getElementById("act-owner-name").value.trim();
        const oUser = document.getElementById("act-owner-user").value.trim();
        const oPass = document.getElementById("act-owner-pass").value;

        const hashed = await hashPassword(oPass);
        const updatedOwner = {
          ...adminAccount,
          id: adminAccount.id || "usr-owner-default",
          name: oName,
          username: oUser,
          password: hashed,
          passwordHash: hashed,
          role: "owner",
          active: true
        };
        if (typeof db.put === "function") await db.put("users", updatedOwner);
        if (typeof db.saveSettings === "function") {
          await db.saveSettings({ storeName: sName, whatsapp: sWa, address: sAddr, setupCompleted: true });
        }
        await performLogin(oUser, oPass, "admin");
        if (typeof showToast === "function") showToast("Aktivasi toko berhasil!", "success");
        showActivation = false;
        window.location.hash = "#dashboard";
        window.location.reload();
      } catch (err) {
        alert(err.message || "Gagal menyimpan aktivasi.");
      }
    });
    if (typeof refreshIcons === "function") refreshIcons();
    return;
  }

  const isKasir = activeTab === "kasir";

  host.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 50%,#f8fafc 100%);">
      <div style="width:100%;max-width:430px;background:#fff;border-radius:20px;box-shadow:0 12px 32px rgba(20,83,45,0.10);padding:28px 26px 22px;border:1px solid #dcfce7;">
        
        <!-- Header Brand -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div style="width:44px;height:44px;border-radius:12px;background:#14532d;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">
            <i data-lucide="milk"></i>
          </div>
          <div>
            <h1 style="margin:0;font-size:18px;font-weight:800;color:#111827;line-height:1.2;">${escapeHTML(storeName)}</h1>
            <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">Sistem Kasir &amp; Manajemen Kedai Susu Murni</p>
          </div>
        </div>

        <!-- Bar Tab: Login Kasir | Login Admin | Ikon Kecil Aktivasi Toko -->
        <div style="display:flex;align-items:center;gap:6px;background:#f3f4f6;padding:5px;border-radius:12px;margin-bottom:20px;">
          <button type="button" id="tab-login-kasir" style="flex:1;padding:9px 10px;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;${isKasir ? "background:#14532d;color:#fff;box-shadow:0 2px 6px rgba(20,83,45,.2);" : "background:transparent;color:#4b5563;"}">
            <i data-lucide="store" style="width:15px;height:15px;"></i> Login Kasir
          </button>
          <button type="button" id="tab-login-admin" style="flex:1;padding:9px 10px;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;${!isKasir ? "background:#14532d;color:#fff;box-shadow:0 2px 6px rgba(20,83,45,.2);" : "background:transparent;color:#4b5563;"}">
            <i data-lucide="shield-check" style="width:15px;height:15px;"></i> Login Admin
          </button>
          <button type="button" id="btn-top-activation" title="Aktivasi Toko &amp; Akun Pemilik" style="padding:8px 9px;border:1px solid #d1fae5;background:#ecfdf5;color:#15803d;border-radius:9px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">
            <i data-lucide="sparkles" style="width:13px;height:13px;"></i> Aktivasi
          </button>
        </div>

        <!-- Badge & Judul Portal -->
        <div style="text-align:center;margin-bottom:16px;">
          <span style="display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.5px;color:#15803d;background:#dcfce7;padding:4px 10px;border-radius:999px;margin-bottom:6px;">
            ${isKasir ? "PORTAL KASIR • TRANSAKSI & SHIFT" : "PORTAL ADMIN • MANAJEMEN & LAPORAN"}
          </span>
          <h2 style="margin:0 0 4px;font-size:19px;font-weight:800;color:#111827;">
            ${isKasir ? "Masuk Shift Kasir" : "Masuk Dashboard Admin"}
          </h2>
          <p style="margin:0;font-size:12.5px;color:#6b7280;">
            ${isKasir ? "Khusus melayani transaksi penjualan, antrean pesanan & setoran shift." : "Kelola menu produk, stok bahan, laporan keuangan & pengaturan toko."}
          </p>
        </div>

        <!-- Pilih Cepat Akun -->
        <div style="margin-bottom:14px;">
          <div style="font-size:11.5px;color:#6b7280;margin-bottom:6px;">
            ${isKasir ? "Pilih Cepat Kasir (Klik untuk mengisi):" : "Pilih Cepat Admin (Klik untuk mengisi):"}
          </div>
          <button type="button" id="btn-quick-fill" style="display:inline-flex;align-items:center;gap:6px;background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;cursor:pointer;">
            ${isKasir ? `${escapeHTML(kasirAccount.name)} (@${escapeHTML(kasirAccount.username)})` : `${escapeHTML(adminAccount.name)} (@${escapeHTML(adminAccount.username)})`}
          </button>
        </div>

        <!-- Form Login -->
        <form id="form-main-login" style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:5px;">
              ${isKasir ? "Username Kasir" : "Username Admin / Owner"}
            </label>
            <input type="text" id="login-username" placeholder="${isKasir ? "Ketik username kasir" : "Ketik username admin"}" required autocomplete="username" style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:10px;font-size:13.5px;box-sizing:border-box;" />
          </div>

          <div>
            <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:5px;">Password</label>
            <div style="position:relative;">
              <input type="password" id="login-password" placeholder="Ketik password Anda" required autocomplete="current-password" style="width:100%;padding:11px 38px 11px 13px;border:1px solid #d1d5db;border-radius:10px;font-size:13.5px;box-sizing:border-box;" />
              <button type="button" id="btn-toggle-pass" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#6b7280;cursor:pointer;padding:2px;">
                <i data-lucide="eye" style="width:16px;height:16px;"></i>
              </button>
            </div>
            ${!isKasir ? `
              <div style="text-align:right;margin-top:5px;">
                <button type="button" id="btn-forgot-pass" style="background:none;border:none;color:#15803d;font-size:11.5px;font-weight:600;cursor:pointer;padding:0;">Lupa Password?</button>
              </div>
            ` : ""}
          </div>

          <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:#374151;cursor:pointer;">
            <input type="checkbox" id="login-remember" checked style="accent-color:#14532d;width:15px;height:15px;" />
            Ingat sesi login saya
          </label>

          <div id="login-error-msg" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:12.5px;padding:9px 12px;border-radius:9px;"></div>

          <button type="submit" id="btn-submit-login" style="margin-top:4px;width:100%;padding:12px;background:#14532d;color:#fff;border:none;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <i data-lucide="log-in" style="width:16px;height:16px;"></i>
            ${isKasir ? "Buka Layar Kasir" : "Masuk Dashboard Admin"}
          </button>
        </form>

        <!-- Footer Paling Bawah: Aktivasi Toko -->
        <div style="margin-top:18px;padding-top:13px;border-top:1px dashed #e5e7eb;text-align:center;font-size:12px;color:#6b7280;">
          Belum atur profil kedai baru?
          <button type="button" id="btn-bottom-activation" style="background:none;border:none;color:#15803d;font-weight:700;cursor:pointer;text-decoration:underline;padding:0 2px;">
            Aktivasi Toko
          </button>
        </div>
      </div>
    </div>
  `;

  // Event Listeners
  document.getElementById("tab-login-kasir")?.addEventListener("click", () => {
    activeTab = "kasir";
    renderLoginView(host);
  });

  document.getElementById("tab-login-admin")?.addEventListener("click", () => {
    activeTab = "admin";
    renderLoginView(host);
  });

  const openActivation = () => {
    showActivation = true;
    renderLoginView(host);
  };
  document.getElementById("btn-top-activation")?.addEventListener("click", openActivation);
  document.getElementById("btn-bottom-activation")?.addEventListener("click", openActivation);

  document.getElementById("btn-quick-fill")?.addEventListener("click", () => {
    const uInput = document.getElementById("login-username");
    const pInput = document.getElementById("login-password");
    if (isKasir) {
      if (uInput) uInput.value = kasirAccount.username || "kasir";
      if (pInput) pInput.value = "kasir123";
    } else {
      if (uInput) uInput.value = adminAccount.username || "owner";
      if (pInput) pInput.value = "owner123";
    }
  });

  document.getElementById("btn-toggle-pass")?.addEventListener("click", () => {
    const pInput = document.getElementById("login-password");
    if (pInput) pInput.type = pInput.type === "password" ? "text" : "password";
  });

  document.getElementById("btn-forgot-pass")?.addEventListener("click", () => {
    alert("Akun default Admin: username 'owner' | password 'owner123'. Anda juga dapat mengubahnya lewat tombol 'Aktivasi' di pojok kanan atas tab.");
  });

  document.getElementById("form-main-login")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("login-error-msg");
    if (errBox) errBox.style.display = "none";

    const uVal = document.getElementById("login-username")?.value || "";
    const pVal = document.getElementById("login-password")?.value || "";

    try {
      await performLogin(uVal, pVal, isKasir ? "kasir" : "admin");
      if (typeof showToast === "function") {
        showToast(isKasir ? "Selamat bertugas di Shift Kasir!" : "Selamat datang di Dashboard Admin!", "success");
      }
      window.location.hash = isKasir ? "#pos" : "#dashboard";
      window.location.reload();
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message || "Gagal masuk. Periksa kembali username dan password.";
        errBox.style.display = "block";
      }
    }
  });

  if (typeof refreshIcons === "function") refreshIcons();
}
