import { auth } from '../auth.js';
import { db } from '../db.js';
import {
  closeModal,
  escapeHTML,
  openModal,
  refreshIcons,
  showToast,
} from '../utils.js';

function evaluatePasswordStrength(pw) {
  if (!pw) return { label: 'Belum diisi', color: 'var(--text-muted)', pct: 0 };
  let score = 0;
  if (pw.length >= 6) score += 25;
  if (pw.length >= 10) score += 25;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 25;
  if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 25;

  if (score <= 25) return { label: 'Lemah', color: 'var(--danger)', pct: 25 };
  if (score <= 50) return { label: 'Cukup', color: 'var(--warning)', pct: 50 };
  if (score <= 75) return { label: 'Kuat', color: 'var(--info)', pct: 75 };
  return { label: 'Sangat Kuat', color: 'var(--success)', pct: 100 };
}

function buildCompactBrandTopHTML(storeName = 'Susu Murni Mooment', logoDataUrl = '') {
  return `
    <div class="auth-brand-top">
      <div class="auth-brand-logo">
        ${
          logoDataUrl
            ? `<img src="${logoDataUrl}" alt="Logo" />`
            : `<i data-lucide="milk" style="width:20px;height:20px;"></i>`
        }
      </div>
      <div class="auth-brand-text">
        <div class="auth-brand-title">${escapeHTML(storeName)}</div>
        <div class="auth-brand-sub">Sistem Kasir &amp; Manajemen Kedai Susu Murni</div>
      </div>
    </div>
  `;
}

export async function renderLoginView(onLoginSuccess) {

  try {
    if (typeof db !== "undefined") {
      if (typeof db.init === "function") await db.init();
      const users = (typeof db.getAll === "function" ? await db.getAll("users") : []) || [];
      if (!users.some((u) => u && (u.role === "owner" || u.role === "admin"))) {
        const pw = typeof hashPassword === "function" ? await hashPassword("owner123") : "owner123";
        await db.put("users", { id: "usr-owner-1", name: "Mahmud", fullName: "Mahmud", username: "owner", password: pw, passwordHash: pw, role: "owner", active: true });
      }
      if (!users.some((u) => u && u.role === "kasir")) {
        const pwK = typeof hashPassword === "function" ? await hashPassword("kasir123") : "kasir123";
        await db.put("users", { id: "usr-kasir-1", name: "Sari", fullName: "Sari", username: "kasir", password: pwK, passwordHash: pwK, role: "kasir", active: true });
      }
    }
  } catch (_) {}

  const container = document.getElementById('login-screen');

  if (sessionStorage.getItem("mooment_act") === "1") {
    renderInitialSetupWizard(container, onLoginSuccess);
    return;
  }

  renderSeparatedLoginScreen(container, onLoginSuccess);
}

function renderInitialSetupWizard(container, onLoginSuccess) {
  container.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card">
        ${buildCompactBrandTopHTML('Susu Murni Mooment')}

        <div class="auth-header">
          <span class="badge badge-success" style="margin-bottom:5px;">Langkah Awal Aktivasi</span>
          <h1>Buat Profil Toko &amp; Akun Pemilik</h1>
          <p>Lengkapi identitas gerai dan akun Administrator utama Anda.</p>
        </div>

        <form id="initial-setup-form" autocomplete="off">
          <div class="auth-section">
            <div class="auth-section-header cocoa">
              <i data-lucide="store" style="width:13px;height:13px;"></i>
              <span>1. Identitas Toko Susu Murni</span>
            </div>
            <div class="form-group">
              <label class="form-label">Nama Usaha / Gerai *</label>
              <input type="text" id="stp-store-name" class="form-control" placeholder="Contoh: Susu Murni Mooment" required />
            </div>
            <div class="form-row" style="margin-bottom:0;">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">No. WhatsApp Toko / Pemilik *</label>
                <input type="tel" id="stp-phone" class="form-control" placeholder="0812xxxxxxxx" required />
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Alamat Gerai</label>
                <input type="text" id="stp-address" class="form-control" placeholder="Jl. Contoh No. 12" />
              </div>
            </div>
          </div>

          <div class="auth-section">
            <div class="auth-section-header">
              <i data-lucide="shield-check" style="width:13px;height:13px;"></i>
              <span>2. Akun Pemilik Toko (Admin)</span>
            </div>
            <div class="form-row">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Nama Lengkap Pemilik *</label>
                <input type="text" id="stp-admin-name" class="form-control" placeholder="Nama lengkap Anda" required />
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Username Login *</label>
                <input type="text" id="stp-admin-user" class="form-control" placeholder="Contoh: owner" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Gmail / Email Pemulihan *</label>
              <input type="email" id="stp-admin-email" class="form-control" placeholder="emailanda@gmail.com" required />
            </div>

            <div class="form-group" style="margin-bottom:6px;">
              <label class="form-label">Password Admin (Minimal 6 karakter) *</label>
              <div class="password-field-wrap">
                <input type="password" id="stp-admin-pass" class="form-control" minlength="6" placeholder="Buat password yang aman" required />
                <button type="button" id="stp-toggle-pw" class="password-toggle-btn" aria-label="Lihat Password">
                  <i data-lucide="eye" style="width:16px;height:16px;"></i>
                </button>
              </div>
<div style="display:flex;justify-content:flex-end;margin-top:6px;"><a href="#" id="link-forgot-password" style="font-size:11.5px;font-weight:700;color:var(--accent-cocoa);text-decoration:none;">
                              Lupa Password?
                            </a></div>
            </div>

            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <div style="flex:1;height:5px;background:var(--border-color);border-radius:99px;overflow:hidden;">
                <div id="stp-pw-bar" style="height:100%;width:0%;background:var(--danger);transition:all 0.2s;"></div>
              </div>
              <span id="stp-pw-label" style="font-size:11px;font-weight:700;color:var(--text-muted);min-width:72px;text-align:right;">Belum diisi</span>
            </div>

            <label style="display:flex;align-items:flex-start;gap:7px;font-size:11.5px;cursor:pointer;color:var(--text-secondary);">
              <input type="checkbox" id="stp-load-catalog" checked style="margin-top:2px;" />
              <span>Sertakan template menu standar Susu Murni &amp; Topping</span>
            </label>
          </div>

          <button type="submit" class="btn btn-primary btn-block" style="padding:10px 16px;">
            <i data-lucide="check-circle-2"></i>
            <span>Simpan &amp; Masuk ke Dashboard</span>
          </button>
        </form>
      </div>
    </div>
  `;

  refreshIcons();

  const passInput = document.getElementById('stp-admin-pass');
  document.getElementById('stp-toggle-pw')?.addEventListener('click', () => {
    passInput.type = passInput.type === 'password' ? 'text' : 'password';
  });

  passInput?.addEventListener('input', () => {
    const st = evaluatePasswordStrength(passInput.value);
    const bar = document.getElementById('stp-pw-bar');
    const lbl = document.getElementById('stp-pw-label');
    if (bar) {
      bar.style.width = `${st.pct}%`;
      bar.style.background = st.color;
    }
    if (lbl) {
      lbl.textContent = st.label;
      lbl.style.color = st.color;
    }
  });

  document.getElementById('initial-setup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const storeName = document.getElementById('stp-store-name').value;
      const storePhone = document.getElementById('stp-phone').value;
      const storeAddress = document.getElementById('stp-address').value;
      const adminFullName = document.getElementById('stp-admin-name').value;
      const adminUsername = document.getElementById('stp-admin-user').value;
      const adminEmail = document.getElementById('stp-admin-email').value;
      const adminPassword = document.getElementById('stp-admin-pass').value;
      const loadStandardCatalog = document.getElementById('stp-load-catalog').checked;

      const { recoveryKey } = await db.completeInitialProductionSetup({
        storeName,
        storeAddress,
        storePhone,
        adminFullName,
        adminUsername,
        adminEmail,
        adminPassword,
        loadStandardCatalog,
      });

      const adminObj = db.data.users.find((u) => u.role === 'admin');
      if (adminObj && storePhone) {
        adminObj.whatsapp = storePhone;
        db.save();
      }

      const loggedUser = await auth.login(adminUsername, adminPassword, true, 'admin');

      openModal({
        title: 'Simpan Kode Pemulihan Darurat (Recovery Key)',
        bodyHTML: `
          <div style="padding:10px 12px;background:var(--warning-bg);border:1px solid #fcd34d;border-radius:9px;margin-bottom:12px;">
            <strong style="color:var(--warning);display:block;margin-bottom:3px;">Simpan Kode Pemulihan Ini</strong>
            <p style="font-size:12px;color:var(--text-main);">
              Kode ini digunakan untuk mereset password Admin jika diperlukan.
            </p>
          </div>
          <div style="padding:14px;background:var(--bg-cream);border:2px dashed var(--accent-cocoa);border-radius:10px;text-align:center;margin-bottom:12px;">
            <div style="font-size:10.5px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Master Recovery Key</div>
            <div class="selectable-text" style="font-family:var(--font-mono);font-size:20px;font-weight:800;color:var(--accent-cocoa);letter-spacing:2px;margin-top:3px;">
              ${escapeHTML(recoveryKey)}
            </div>
          </div>
          <button type="button" id="btn-copy-recovery-key" class="btn btn-outline btn-block">
            <i data-lucide="copy"></i>
            <span>Salin Kode Pemulihan</span>
          </button>
        `,
        footerHTML: `
          <button type="button" id="btn-finish-recovery-modal" class="btn btn-primary">
            Lanjut ke Dashboard
          </button>
        `,
      });

      refreshIcons();

      document.getElementById('btn-copy-recovery-key')?.addEventListener('click', () => {
        navigator.clipboard?.writeText(recoveryKey);
        showToast('Kode pemulihan berhasil disalin!', 'success');
      });

      document.getElementById('btn-finish-recovery-modal')?.addEventListener('click', () => {
        closeModal();
        onLoginSuccess(loggedUser);
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function renderSeparatedLoginScreen(container, onLoginSuccess) {
  const settings = db.getSettings();
  let activePortal = 'cashier'; // 'cashier' | 'admin'
  let authMethod = 'password'; // 'password' | 'wa_otp'
  let pendingOtpData = null;

  function renderPortal() {
    const isCashierTab = activePortal === 'cashier';
    const activeCashiers = db.data.users.filter((u) => u.role === 'cashier' && u.active);
    const portalKey = `${activePortal}_${authMethod}_${Date.now()}`;

    container.innerHTML = `
      <div class="auth-wrapper">
        <div class="auth-card login-compact">
          ${buildCompactBrandTopHTML(settings.storeName, settings.logoDataUrl)}

          <div class="portal-tabs" role="tablist">
            <button type="button" id="tab-portal-cashier"
              class="portal-tab-btn ${isCashierTab ? 'active-cashier' : ''}">
              <i data-lucide="shopping-bag"></i>
              <span>Login Kasir</span>
            </button>
            <button type="button" id="tab-portal-admin"
              class="portal-tab-btn ${!isCashierTab ? 'active-admin' : ''}">
              <i data-lucide="shield-check"></i>
              <span>Login Admin</span>
            </button>
          </div>

          <div class="auth-header">
            <span class="badge ${isCashierTab ? 'badge-success' : 'badge-cocoa'}" style="margin-bottom:5px;">
              ${isCashierTab ? 'PORTAL KASIR • TRANSAKSI & SHIFT' : 'PORTAL ADMIN • PEMILIK TOKO'}
            </span>
            <h1>${isCashierTab ? 'Masuk Shift Kasir' : 'Masuk Administrator'}</h1>
            <p>
              ${
                isCashierTab
                  ? 'Khusus melayani transaksi penjualan, antrean pesanan & setoran shift.'
                  : 'Kelola produk, stok bahan baku, laporan laba & akun kasir.'
              }
            </p>
          </div>

          <!-- Pemilih Metode Masuk: Password vs OTP WhatsApp -->
          <div style="display:none !important;" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
            <button type="button" id="btn-mode-pw" class="btn btn-sm ${authMethod === 'password' ? 'btn-outline' : ''}"
              style="${authMethod === 'password' ? 'border-color:var(--primary-green);color:var(--primary-green);background:var(--primary-green-soft);' : 'background:var(--surface-subtle);color:var(--text-secondary);'}">
              <i data-lucide="key-round"></i>
              <span>Pakai Password</span>
            </button>
            <button type="button" id="btn-mode-wa-otp" class="btn btn-sm ${authMethod === 'wa_otp' ? 'btn-outline' : ''}"
              style="${authMethod === 'wa_otp' ? 'border-color:var(--primary-green);color:var(--primary-green);background:var(--primary-green-soft);' : 'background:var(--surface-subtle);color:var(--text-secondary);'}">
              <i data-lucide="message-circle"></i>
              <span>OTP WhatsApp</span>
            </button>
          </div>

          ${
            isCashierTab && activeCashiers.length > 0
              ? `
                <div style="margin-bottom:10px;">
                  <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:5px;">Pilih Cepat Kasir (Klik untuk mengisi):</div>
                  <div class="quick-user-chips">
                    ${activeCashiers
                      .map(
                        (c) => `
                      <button type="button" class="quick-user-chip" data-quick-cashier="${escapeHTML(c.username)}">
                        ${escapeHTML(c.fullName)} (@${escapeHTML(c.username)})
                      </button>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              `
              : ''
          }

          ${
            authMethod === 'password'
              ? `
                <form id="login-form" autocomplete="off">
                  <div class="form-group">
                    <label class="form-label" for="login-username">
                      ${isCashierTab ? 'Username Kasir' : 'Username atau Gmail Admin'}
                    </label>
                    <input type="text" id="login-username" name="field_u_${portalKey}" class="form-control"
                      value="" autocomplete="off" autocapitalize="none" spellcheck="false"
                      placeholder="${isCashierTab ? 'Ketik username kasir' : 'Ketik Username atau Gmail admin'}" required />
                  </div>

                  <div class="form-group" style="margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                      <label class="form-label" for="login-password" style="margin-bottom:0;">Password</label>
                      ${
                        !isCashierTab
                          ? ``
                          : ``
                      }
                    </div>
                    <div class="password-field-wrap">
                      <input type="password" id="login-password" name="field_p_${portalKey}" class="form-control"
                        value="" autocomplete="new-password"
                        placeholder="Ketik password Anda" required />
                      <button type="button" id="toggle-pass-btn" class="password-toggle-btn" aria-label="Lihat Password">
                        <i data-lucide="eye" style="width:16px;height:16px;"></i>
                      </button>
                    </div>
                  </div>

                  <div style="display:flex;align-items:center;margin-bottom:14px;">
                    <label style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-secondary);cursor:pointer;">
                      <input type="checkbox" id="login-remember-me" checked />
                      <span>Ingat sesi login saya</span>
                    </label>
                  </div>

                  <div id="login-error-box" class="hidden"
                    style="background:var(--danger-bg);color:var(--danger);padding:8px 10px;border-radius:8px;font-size:12px;font-weight:600;margin-bottom:12px;">
                  </div>

                  <button type="submit" id="btn-submit-login"
                    class="btn ${isCashierTab ? 'btn-primary' : 'btn-cocoa'} btn-block" style="padding:10px 16px;">
                    <i data-lucide="log-in"></i>
                    <span>${isCashierTab ? 'Buka Layar Kasir' : 'Masuk Dashboard Admin'}</span>
                  </button>
                </form>
              `
              : `
                <form id="wa-otp-request-form" autocomplete="off">
                  <div class="form-group">
                    <label class="form-label" for="otp-identifier">
                      Username, Gmail, atau No. WhatsApp Terdaftar *
                    </label>
                    <input type="text" id="otp-identifier" name="field_otp_${portalKey}" class="form-control"
                      value="${escapeHTML(pendingOtpData?.identifier || '')}"
                      autocomplete="off"
                      placeholder="${isCashierTab ? 'Ketik username kasir' : 'Ketik Username atau Gmail admin'}" required />
                  </div>
                  <button type="submit" id="btn-send-wa-otp" class="btn btn-outline btn-block" style="margin-bottom:12px;">
                    <i data-lucide="send"></i>
                    <span>${pendingOtpData ? 'Kirim Ulang Kode OTP WhatsApp' : 'Kirim Kode OTP ke WhatsApp'}</span>
                  </button>
                </form>

                ${
                  pendingOtpData
                    ? `
                      <div style="padding:10px 12px;background:var(--primary-green-soft);border:1px solid var(--primary-green-border);border-radius:9px;margin-bottom:12px;font-size:12px;">
                        <div style="font-weight:700;color:var(--primary-green);margin-bottom:4px;">
                          OTP siap untuk ${escapeHTML(pendingOtpData.userName)} (${escapeHTML(pendingOtpData.maskedWa)})
                        </div>
                        ${
                          pendingOtpData.deliveredViaGateway
                            ? `<div>Kode OTP 6-digit telah dikirim otomatis ke WhatsApp Anda.</div>`
                            : `
                              <div style="margin-bottom:6px;">
                                Kode OTP Anda: <strong class="selectable-text" style="font-family:var(--font-mono);font-size:15px;letter-spacing:2px;color:var(--primary-green);">${escapeHTML(pendingOtpData.code)}</strong>
                              </div>
                              <a href="${pendingOtpData.waWebLink}" target="_blank" rel="noopener" class="btn btn-sm btn-primary" style="text-decoration:none;">
                                <i data-lucide="external-link"></i>
                                <span>Buka WhatsApp &amp; Kirim Pesan OTP</span>
                              </a>
                            `
                        }
                      </div>

                      <form id="wa-otp-verify-form" autocomplete="off">
                        <div class="form-group">
                          <label class="form-label" for="wa-otp-code">Masukkan 6-Digit Kode OTP *</label>
                          <input type="text" id="wa-otp-code" class="form-control" maxlength="6" placeholder="123456"
                            autocomplete="off"
                            style="font-family:var(--font-mono);font-size:18px;letter-spacing:5px;text-align:center;" required />
                        </div>
                        <button type="submit" class="btn ${isCashierTab ? 'btn-primary' : 'btn-cocoa'} btn-block" style="padding:10px 16px;">
                          <i data-lucide="check-circle-2"></i>
                          <span>Verifikasi OTP &amp; Masuk</span>
                        </button>
                      </form>
                    `
                    : ''
                }

                <div id="login-error-box" class="hidden"
                  style="background:var(--danger-bg);color:var(--danger);padding:8px 10px;border-radius:8px;font-size:12px;font-weight:600;margin-top:10px;">
                </div>
              `
          }
        </div>
      </div>
    `;

    refreshIcons();

    const userInput = document.getElementById('login-username') || document.getElementById('otp-identifier');
    const passInput = document.getElementById('login-password');
    const rememberCheck = document.getElementById('login-remember-me');
    const errBox = document.getElementById('login-error-box');

    // Pastikan kolom kosong saat render ulang / pindah tab
    setTimeout(() => {
      if (userInput && !pendingOtpData) userInput.value = '';
      if (passInput) passInput.value = '';
    }, 0);

    document.getElementById('tab-portal-cashier')?.addEventListener('click', () => {
      activePortal = 'cashier';
      pendingOtpData = null;
      renderPortal();
    });

    document.getElementById('tab-portal-admin')?.addEventListener('click', () => {
      activePortal = 'admin';
      pendingOtpData = null;
      renderPortal();
    });

    document.getElementById('btn-mode-pw')?.addEventListener('click', () => {
      authMethod = 'password';
      renderPortal();
    });

    document.getElementById('btn-mode-wa-otp')?.addEventListener('click', () => {
      authMethod = 'wa_otp';
      renderPortal();
    });

    container.querySelectorAll('[data-quick-cashier]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const val = chip.getAttribute('data-quick-cashier') || '';
        if (userInput) {
          userInput.value = val;
          if (passInput) {
            passInput.value = '';
            passInput.focus();
          }
        }
      });
    });

    document.getElementById('toggle-pass-btn')?.addEventListener('click', () => {
      if (passInput) passInput.type = passInput.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('link-forgot-password')?.addEventListener('click', (e) => {
      e.preventDefault();
      openForgotPasswordModal();
    });

    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.classList.add('hidden');
      const btn = document.getElementById('btn-submit-login');
      btn.disabled = true;

      try {
        const user = await auth.login(
          userInput.value,
          passInput.value,
          rememberCheck ? rememberCheck.checked : true,
          activePortal
        );
        showToast(
          user.role === 'cashier'
            ? `Shift Kasir dibuka — Selamat bertugas, ${user.fullName}!`
            : `Selamat datang kembali, ${user.fullName}!`,
          'success'
        );
        onLoginSuccess(user);
      } catch (err) {
        errBox.textContent = err.message || 'Gagal melakukan login.';
        errBox.classList.remove('hidden');
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('wa-otp-request-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.classList.add('hidden');
      const btn = document.getElementById('btn-send-wa-otp');
      btn.disabled = true;
      try {
        const idVal = document.getElementById('otp-identifier').value;
        const otpRes = await auth.requestWhatsappOtp(idVal, activePortal);
        pendingOtpData = { ...otpRes, identifier: idVal };
        showToast(
          otpRes.deliveredViaGateway
            ? `Kode OTP terkirim ke WhatsApp ${otpRes.maskedWa}`
            : 'Kode OTP WhatsApp berhasil dibuat!',
          'success'
        );
        renderPortal();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('wa-otp-verify-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      errBox.classList.add('hidden');
      try {
        const code = document.getElementById('wa-otp-code').value;
        const user = auth.loginWithWhatsappOtp(pendingOtpData.userId, code, true);
        showToast(`Berhasil masuk via OTP WhatsApp — Halo, ${user.fullName}!`, 'success');
        onLoginSuccess(user);
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      }
    });
  }

  renderPortal();
}

function openForgotPasswordModal() {
  let verifiedUserId = null;
  let recoveryMethod = 'wa_otp';
  let waOtpInfo = null;

  function renderStep1() {
    openModal({
      title: 'Pemulihan Akun Admin — Lupa Password',
      bodyHTML: `
        <p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:12px;">
          Pilih metode verifikasi untuk mengatur ulang password Administrator Anda:
        </p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
          <button type="button" class="btn btn-sm ${recoveryMethod === 'wa_otp' ? 'btn-primary' : 'btn-outline'}" id="fp-tab-wa">
            <i data-lucide="message-circle"></i>
            <span>OTP WhatsApp</span>
          </button>
          <button type="button" class="btn btn-sm ${recoveryMethod === 'recovery_key' ? 'btn-primary' : 'btn-outline'}" id="fp-tab-key">
            <i data-lucide="key-round"></i>
            <span>Recovery Key</span>
          </button>
        </div>

        ${
          recoveryMethod === 'wa_otp'
            ? `
              <form id="fp-wa-request-form">
                <div class="form-group">
                  <label class="form-label">Username, Gmail, atau No. WhatsApp Admin *</label>
                  <input type="text" id="fp-wa-identifier" class="form-control" placeholder="Masukkan Username atau Gmail" required />
                </div>
                <button type="submit" id="fp-btn-send-wa" class="btn btn-primary btn-block">
                  Kirim Kode OTP 6-Digit ke WhatsApp
                </button>
              </form>

              ${
                waOtpInfo
                  ? `
                    <form id="fp-wa-verify-form" style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--border-color);">
                      <div style="font-size:12px;color:var(--primary-green);font-weight:600;margin-bottom:8px;">
                        OTP untuk ${escapeHTML(waOtpInfo.maskedWa)} — Kode: <strong class="selectable-text">${escapeHTML(waOtpInfo.code)}</strong>
                      </div>
                      <div class="form-group">
                        <label class="form-label">Masukkan Kode OTP 6-Digit *</label>
                        <input type="text" id="fp-wa-code" class="form-control" maxlength="6" placeholder="123456"
                          style="font-family:var(--font-mono);font-size:17px;letter-spacing:4px;text-align:center;" required />
                      </div>
                      <button type="submit" class="btn btn-cocoa btn-block">Verifikasi Kode OTP</button>
                    </form>
                  `
                  : ''
              }
            `
            : `
              <form id="fp-key-verify-form">
                <div class="form-group">
                  <label class="form-label">Username Admin *</label>
                  <input type="text" id="fp-key-username" class="form-control" placeholder="Masukkan username admin" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Master Recovery Key *</label>
                  <input type="text" id="fp-master-key" class="form-control" placeholder="MF-XXXX-XXXX"
                    style="font-family:var(--font-mono);text-transform:uppercase;" required />
                </div>
                <button type="submit" class="btn btn-primary btn-block">Verifikasi &amp; Buat Password Baru</button>
              </form>
            `
        }
      `,
    });

    refreshIcons();

    document.getElementById('fp-tab-wa')?.addEventListener('click', () => {
      recoveryMethod = 'wa_otp';
      renderStep1();
    });
    document.getElementById('fp-tab-key')?.addEventListener('click', () => {
      recoveryMethod = 'recovery_key';
      renderStep1();
    });

    document.getElementById('fp-wa-request-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const idVal = document.getElementById('fp-wa-identifier').value;
        const res = await auth.requestWhatsappOtp(idVal, 'admin');
        verifiedUserId = res.userId;
        waOtpInfo = res;
        showToast('Kode OTP WhatsApp berhasil dibuat!', 'success');
        renderStep1();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('fp-wa-verify-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const code = document.getElementById('fp-wa-code').value;
        auth.verifyWhatsappOtpOnly(verifiedUserId, code);
        renderStep2NewPassword(verifiedUserId, 'OTP WhatsApp');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('fp-key-verify-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const uname = document.getElementById('fp-key-username').value;
        const mkey = document.getElementById('fp-master-key').value;
        const user = auth.findUserByIdentifier(uname);
        if (!user) throw new Error('Username akun tidak ditemukan.');
        await auth.verifyMasterRecoveryKey(mkey);
        renderStep2NewPassword(user.id, 'Master Recovery Key');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  function renderStep2NewPassword(targetUserId, methodLabel) {
    const targetUser = db.data.users.find((u) => u.id === targetUserId);
    openModal({
      title: 'Buat Password Baru',
      bodyHTML: `
        <div style="padding:9px 11px;background:var(--primary-green-soft);border-radius:8px;margin-bottom:12px;font-size:12.5px;">
          Akun terverifikasi: <strong>${escapeHTML(targetUser?.fullName || '')}</strong> (@${escapeHTML(targetUser?.username || '')})
        </div>
        <form id="fp-new-pass-form">
          <div class="form-group">
            <label class="form-label">Password Baru (Minimal 6 karakter) *</label>
            <input type="password" id="fp-new-pw1" class="form-control" minlength="6" required />
          </div>
          <div class="form-group">
            <label class="form-label">Konfirmasi Password Baru *</label>
            <input type="password" id="fp-new-pw2" class="form-control" minlength="6" required />
          </div>
          <button type="submit" class="btn btn-primary btn-block">Simpan Password Baru</button>
        </form>
      `,
    });

    document.getElementById('fp-new-pass-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = document.getElementById('fp-new-pw1').value;
      const p2 = document.getElementById('fp-new-pw2').value;
      if (p1 !== p2) {
        showToast('Konfirmasi password baru tidak cocok.', 'error');
        return;
      }
      try {
        await auth.resetPasswordDirect(targetUserId, p1, methodLabel);
        closeModal();
        showToast('Password berhasil diperbarui! Silakan login kembali.', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  renderStep1();
}

/* MOOMENT_CLEAN_LOGIN_V60 */
(function () {
  let lastKling = 0;
  function playKlingWarning() {
    const now = Date.now();
    if (now - lastKling < 900) return;
    lastKling = now;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      if (ctx.state === "suspended") ctx.resume();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1174.66, t);
      osc.frequency.setValueAtTime(987.77, t + 0.11);
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    } catch (_) {}
  }

  function showWrongAlert(msg) {
    playKlingWarning();
    const form = document.querySelector("form");
    if (!form) return;
    let box = document.getElementById("m-login-warn");
    if (!box) {
      box = document.createElement("div");
      box.id = "m-login-warn";
      box.style.cssText = "margin:10px 0;padding:10px 12px;background:#fef2f2;border:1.5px solid #ef4444;color:#991b1b;border-radius:10px;font-size:12.5px;font-weight:700;";
      form.insertBefore(box, form.querySelector("button[type='submit']") || null);
    }
    box.textContent = "Peringatan: " + (msg || "Username atau password salah! Silakan periksa kembali.");
  }

  function mountLoginExtras() {
    const txt = document.body ? document.body.textContent || "" : "";
    if (/Buat Profil Toko|Langkah Awal Aktivasi/i.test(txt) && !document.getElementById("m-back-login")) {
      const form = document.querySelector("form");
      if (form && form.parentNode) {
        const nav = document.createElement("div");
        nav.style.cssText = "margin-bottom:12px;text-align:left;";
        nav.innerHTML = '<button type="button" id="m-back-login" style="background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d;font-weight:700;font-size:12px;padding:6px 12px;border-radius:999px;cursor:pointer;">&larr; Kembali ke Halaman Login</button>';
        form.parentNode.insertBefore(nav, form);
        document.getElementById("m-back-login").onclick = () => {
          sessionStorage.removeItem("mooment_act");
          window.location.reload();
        };
        form.addEventListener("submit", () => sessionStorage.removeItem("mooment_act"));
      }
    }

    if (/Login Admin/i.test(txt) && !/Buat Profil Toko/i.test(txt) && !document.getElementById("m-act-footer")) {
      const form = document.querySelector("form");
      if (form && form.parentNode) {
        const box = document.createElement("div");
        box.id = "m-act-footer";
        box.style.cssText = "margin-top:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;text-align:center;";
        box.innerHTML =
          '<p style="margin:0 0 8px;font-size:12px;color:#475569;">Ingin mengatur ulang profil kedai atau akun pemilik baru?</p>' +
          '<button type="button" id="m-open-act" style="width:100%;padding:9px;background:#fff;color:#15803d;border:1.5px solid #16a34a;border-radius:10px;font-size:12.5px;font-weight:700;cursor:pointer;">Aktivasi Toko &amp; Akun Pemilik</button>';
        form.parentNode.appendChild(box);
        document.getElementById("m-open-act").onclick = () => {
          sessionStorage.setItem("mooment_act", "1");
          window.location.reload();
        };
      }
    }
  }

  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (!form || !form.querySelector("input[type='password']")) return;
    setTimeout(() => {
      if (document.querySelector("input[type='password']")) {
        const err = Array.from(document.querySelectorAll("div, p, span")).find((el) =>
          el.id !== "m-login-warn" && /salah|tidak ditemukan|gagal|invalid|nonaktif/i.test(el.textContent || "") && (el.textContent || "").length < 140
        );
        showWrongAlert(err ? err.textContent.trim() : null);
      }
    }, 320);
  }, true);

  new MutationObserver(mountLoginExtras).observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(mountLoginExtras, 150);
})();
