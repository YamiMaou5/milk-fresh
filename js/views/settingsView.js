import { auth } from '../auth.js';
import { APP_CONFIG } from '../config.js';
import { db } from '../db.js';
import { syncAllPendingToSheets } from '../sheetsSync.js';
import {
  closeModal,
  escapeHTML,
  hashPassword,
  openModal,
  refreshIcons,
  showToast,
} from '../utils.js';

export function renderSettingsView() {
  const content = document.getElementById('app-content');
  const settings = db.getSettings();

  function openEditAccountModal(user) {
    const isAdminAccount = user.role === 'admin';
    openModal({
      title: `Edit Akun ${isAdminAccount ? 'Admin' : 'Kasir'} — ${((user.fullName || user.name || user.username || "Kasir") || user.name || user.username || "Kasir")}`,
      bodyHTML: `
        <form id="edit-account-form" autocomplete="off">
          <div class="form-group">
            <label class="form-label">Nama Lengkap *</label>
            <input type="text" id="edt-acc-name" class="form-control" value="${escapeHTML((user.fullName || user.name || user.username || "Kasir"))}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Username Login *</label>
            <input type="text" id="edt-acc-user" class="form-control" value="${escapeHTML(user.username)}" required />
          </div>
          ${
            isAdminAccount
              ? `
                <div class="form-group">
                  <label class="form-label">Gmail Pemilik / Pemulihan *</label>
                  <input type="email" id="edt-acc-email" class="form-control" value="${escapeHTML(user.email || '')}"
                    placeholder="contoh@gmail.com" required />
                </div>
              `
              : ''
          }
          <div class="form-group">
            <label class="form-label">Nomor WhatsApp (Untuk Login Kode OTP)</label>
            <input type="tel" id="edt-acc-wa" class="form-control" value="${escapeHTML(user.whatsapp || '')}"
              placeholder="Contoh: 081234567890" />
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
            <button type="button" class="btn btn-outline" id="edt-acc-cancel">Batal</button>
            <button type="submit" class="btn btn-primary">Simpan Perubahan Akun</button>
          </div>
        </form>
      `,
    });

    document.getElementById('edt-acc-cancel')?.addEventListener('click', closeModal);
    document.getElementById('edit-account-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const newName = document.getElementById('edt-acc-name').value.trim();
      const newUser = document.getElementById('edt-acc-user').value.trim();
      const newWa = document.getElementById('edt-acc-wa').value.trim();
      const newEmail = isAdminAccount
        ? (document.getElementById('edt-acc-email')?.value || '').trim()
        : (user.email || '');

      if (!newName || !newUser) {
        showToast('Nama lengkap dan username wajib diisi.', 'error');
        return;
      }

      const duplicate = db.data.users.some(
        (u) => u.id !== user.id && u.username.toLowerCase() === newUser.toLowerCase()
      );
      if (duplicate) {
        showToast(`Username "${newUser}" sudah dipakai akun lain.`, 'error');
        return;
      }

      user.fullName = newName;
      user.username = newUser;
      user.email = newEmail;
      user.whatsapp = newWa;
      db.save();

      if (auth.getUser()?.id === user.id) {
        document.getElementById('sidebar-user-name').textContent = (user.fullName || user.name || user.username || "Kasir");
        document.getElementById('sidebar-user-username').textContent = `@${user.username}`;
      }

      closeModal();
      showToast(`Data akun ${((user.fullName || user.name || user.username || "Kasir") || user.name || user.username || "Kasir")} berhasil diperbarui.`, 'success');
      render();
    });
  }

  function render() {
    const users = db.data.users;
    const adminUser = users.find((u) => u.role === 'admin');

    content.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));gap:16px;">
        <!-- 1. IDENTITAS TOKO & GMAIL ADMIN -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">1. Profil Toko &amp; Gmail Pemilik</h3>
          </div>
          <form id="store-settings-form" autocomplete="off">
            <div class="form-group">
              <label class="form-label">Nama Toko / Gerai *</label>
              <input type="text" id="set-store-name" class="form-control" value="${escapeHTML(settings.storeName)}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Gmail Pemilik / Aktivasi</label>
              <input type="email" id="set-admin-gmail" class="form-control"
                value="${escapeHTML(adminUser?.email || '')}" placeholder="pemilik@gmail.com" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">No. Telepon / WhatsApp Toko</label>
                <input type="text" id="set-store-phone" class="form-control" value="${escapeHTML(settings.storePhone || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Batas Stok Menipis</label>
                <input type="number" id="set-low-stock" class="form-control" min="1" value="${settings.lowStockThreshold || 10}" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Alamat Gerai</label>
              <input type="text" id="set-store-address" class="form-control" value="${escapeHTML(settings.storeAddress || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Catatan Kaki Struk</label>
              <input type="text" id="set-receipt-footer" class="form-control" value="${escapeHTML(settings.receiptFooter || '')}" />
            </div>
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;">
                <input type="checkbox" id="set-cashier-disc" ${settings.allowCashierDiscount !== false ? 'checked' : ''} />
                <span>Izinkan Kasir memilih preset diskon saat transaksi</span>
              </label>
            </div>
                        <div class="form-group">
              <label class="form-label">Ukuran Kertas Struk Default</label>
              <select id="set-receipt-paper" class="form-control">
                <option value="58mm" ${(settings.receiptPaperSize || '58mm') === '58mm' ? 'selected' : ''}>Printer Thermal 58mm (Struk Mini)</option>
                <option value="80mm" ${settings.receiptPaperSize === '80mm' ? 'selected' : ''}>Printer Thermal 80mm (Struk Lebar)</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Simpan Pengaturan</button>
          </form>
        </div>

        <!-- 2. MANAJEMEN AKUN KASIR & ADMIN -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">2. Akun Kasir &amp; Administrator</h3>
          </div>

          <form id="add-cashier-form" autocomplete="off" style="padding:12px;background:var(--surface-subtle);border:1px solid var(--border-color);border-radius:10px;margin-bottom:14px;">
            <div style="font-size:11.5px;font-weight:800;color:var(--primary-green);margin-bottom:8px;text-transform:uppercase;">
              + Tambah Akun Kasir Baru
            </div>
            <div class="form-row" style="margin-bottom:8px;">
              <div>
                <label class="form-label">Nama Lengkap Kasir *</label>
                <input type="text" id="new-csr-name" name="new_cashier_fullname" class="form-control"
                  autocomplete="off" readonly onfocus="this.removeAttribute('readonly');" placeholder="Contoh: Sari" required />
              </div>
              <div>
                <label class="form-label">Username Login *</label>
                <input type="text" id="new-csr-user" name="new_cashier_login" class="form-control"
                  autocomplete="off" readonly onfocus="this.removeAttribute('readonly');" placeholder="Contoh: kasir2" required />
              </div>
            </div>
            <div class="form-row" style="margin-bottom:8px;">
              <div>
                <label class="form-label">No. WhatsApp Kasir (Untuk OTP)</label>
                <input type="tel" id="new-csr-wa" name="new_cashier_wa" class="form-control"
                  autocomplete="off" readonly onfocus="this.removeAttribute('readonly');" placeholder="0812xxxxxxxx" />
              </div>
              <div>
                <label class="form-label">Password Kasir (Min. 6 karakter) *</label>
                <input type="password" id="new-csr-pass" name="new_cashier_secret" class="form-control"
                  autocomplete="new-password" readonly onfocus="this.removeAttribute('readonly');" minlength="6" placeholder="Minimal 6 karakter" required />
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-sm btn-block">Buat Akun Kasir</button>
          </form>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Akun &amp; Kontak</th>
                  <th>Peran</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${users
                  .map((u) => {
                    const isAdm = u.role === 'admin';
                    return `
                      <tr>
                        <td>
                          <strong>${escapeHTML((u.fullName || u.name || u.username || "Kasir"))}</strong>
                          <small style="color:var(--text-muted);">(@${escapeHTML(u.username)})</small><br/>
                          <small style="color:var(--text-secondary);">
                            ${isAdm && u.email ? `Gmail: ${escapeHTML(u.email)}<br/>` : ''}
                            WA OTP: ${u.whatsapp ? escapeHTML(u.whatsapp) : '<em>belum diisi</em>'}
                          </small>
                        </td>
                        <td>
                          <span class="badge ${isAdm ? 'badge-cocoa' : 'badge-success'}">
                            ${isAdm ? 'Admin' : 'Kasir'}
                          </span><br/>
                          <span class="badge ${u.active ? 'badge-success' : 'badge-neutral'}" style="margin-top:4px;">
                            ${u.active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td>
                          <div style="display:flex;flex-direction:column;gap:5px;">
                            <button type="button" class="btn btn-primary btn-sm" data-edit-acc="${u.id}">
                              ${isAdm ? 'Edit Admin' : 'Edit WA'}
                            </button>
                            <button type="button" class="btn btn-outline btn-sm" data-reset-pw="${u.id}">Reset PW</button>
                            ${
                              !isAdm
                                ? `<button type="button" class="btn btn-outline-danger btn-sm" data-toggle-usr="${u.id}">
                                    ${u.active ? 'Nonaktifkan' : 'Aktifkan'}
                                  </button>`
                                : ''
                            }
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

        <!-- 3. OTP WHATSAPP GATEWAY, GOOGLE SHEETS & BACKUP -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">3. OTP WhatsApp, Google Sheets &amp; Backup</h3>
          </div>

          <form id="wa-gateway-form" autocomplete="off" style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border-color);">
            <div class="form-group" style="margin-bottom:6px;">
              <label class="form-label">Token API Fonnte WhatsApp (Opsional)</label>
              <input type="text" id="set-fonnte-token" class="form-control"
                value="${escapeHTML(settings.fonnteApiToken || '')}"
                placeholder="Kosongkan untuk mode WA Web / OTP Lokal gratis" />
              <small style="font-size:11px;color:var(--text-muted);display:block;margin-top:4px;">
                Jika diisi token Fonnte, OTP 6-digit terkirim otomatis ke WA pengguna. Jika kosong, kode OTP tampil &amp; siap dikirim via WhatsApp Web.
              </small>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Simpan Pengaturan OTP WA</button>
          </form>

          <form id="sheets-settings-form" autocomplete="off" style="margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label">URL Web App Google Apps Script</label>
              <input type="url" id="set-sheets-url" class="form-control" value="${escapeHTML(settings.googleAppsScriptUrl || '')}"
                placeholder="https://script.google.com/macros/s/.../exec" />
            </div>
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;">
                <input type="checkbox" id="set-auto-sync" ${settings.autoSyncOnTransaction ? 'checked' : ''} />
                <span>Otomatis kirim setiap transaksi selesai ke Google Sheets</span>
              </label>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="submit" class="btn btn-primary btn-sm">Simpan URL Sheets</button>
              <button type="button" id="btn-sync-now" class="btn btn-outline btn-sm">Sinkronkan Sekarang</button>
            </div>
          </form>

          <div style="border-top:1px solid var(--border-color);padding-top:12px;">
            <div style="font-size:12px;font-weight:700;margin-bottom:8px;">Cadangan Database Lokal (JSON)</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" id="btn-backup-json" class="btn btn-cocoa btn-sm">Download Backup JSON</button>
              <label class="btn btn-outline btn-sm" style="cursor:pointer;">
                <span>Restore File JSON</span>
                <input type="file" id="inp-restore-json" accept=".json" class="hidden" />
              </label>
            </div>
          </div>
        </div>
      </div>
    `;

    refreshIcons();

    document.getElementById('store-settings-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const newGmail = (document.getElementById('set-admin-gmail')?.value || '').trim();
      const owner = db.data.users.find((u) => u.role === 'admin');
      if (owner) {
        owner.email = newGmail;
      }
      db.updateSettings({
        storeName: document.getElementById('set-store-name').value.trim(),
        storePhone: document.getElementById('set-store-phone').value.trim(),
        storeAddress: document.getElementById('set-store-address').value.trim(),
        receiptFooter: document.getElementById('set-receipt-footer').value.trim(),
        lowStockThreshold: Math.max(1, Number(document.getElementById('set-low-stock').value) || 10),
        allowCashierDiscount: document.getElementById('set-cashier-disc').checked,
        receiptPaperSize: document.getElementById('set-receipt-paper')?.value || '58mm',
      });
      document.getElementById('sidebar-store-name').textContent = db.getSettings().storeName;
      showToast('Pengaturan toko & Gmail pemilik berhasil disimpan.', 'success');
      render();
    });

    document.getElementById('add-cashier-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('new-csr-name').value.trim();
      const username = document.getElementById('new-csr-user').value.trim().toLowerCase();
      const whatsapp = document.getElementById('new-csr-wa').value.trim();
      const password = document.getElementById('new-csr-pass').value;

      if (!fullName || !username || password.length < 6) {
        showToast('Lengkapi data kasir dan password minimal 6 karakter.', 'error');
        return;
      }
      if (db.data.users.some((u) => u.username.toLowerCase() === username)) {
        showToast(`Username "${username}" sudah digunakan.`, 'error');
        return;
      }

      const salt = `SALT_${Date.now()}`;
      const passwordHash = await hashPassword(password, salt);
      db.data.users.push({
        id: `usr_csr_${Date.now()}`,
        fullName,
        username,
        email: '',
        whatsapp,
        role: 'cashier',
        salt,
        passwordHash,
        active: true,
        createdAt: new Date().toISOString(),
      });
      db.save();
      showToast(`Akun Kasir "${fullName}" (@${username}) berhasil dibuat!`, 'success');
      render();
    });

    content.querySelectorAll('[data-edit-acc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-edit-acc');
        const target = db.data.users.find((u) => u.id === uid);
        if (target) openEditAccountModal(target);
      });
    });

    content.querySelectorAll('[data-reset-pw]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uid = btn.getAttribute('data-reset-pw');
        const target = db.data.users.find((u) => u.id === uid);
        if (!target) return;
        const newPw = window.prompt(`Masukkan password baru untuk ${((target.fullName || target.name || target.username || "Kasir") || target.name || target.username || "Kasir")} (minimal 6 karakter):`);
        if (!newPw) return;
        try {
          await auth.resetPasswordDirect(uid, newPw, 'Reset oleh Admin');
          showToast(`Password untuk ${((target.fullName || target.name || target.username || "Kasir") || target.name || target.username || "Kasir")} berhasil diubah.`, 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    content.querySelectorAll('[data-toggle-usr]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-toggle-usr');
        const target = db.data.users.find((u) => u.id === uid);
        if (!target || target.role === 'admin') return;
        target.active = !target.active;
        db.save();
        showToast(`Status akun ${((target.fullName || target.name || target.username || "Kasir") || target.name || target.username || "Kasir")} diperbarui.`, 'info');
        render();
      });
    });

    document.getElementById('wa-gateway-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      db.updateSettings({
        fonnteApiToken: document.getElementById('set-fonnte-token').value.trim(),
      });
      showToast('Pengaturan OTP WhatsApp disimpan.', 'success');
    });

    document.getElementById('sheets-settings-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      db.updateSettings({
        googleAppsScriptUrl: document.getElementById('set-sheets-url').value.trim(),
        autoSyncOnTransaction: document.getElementById('set-auto-sync').checked,
      });
      showToast('Pengaturan Google Sheets disimpan.', 'success');
    });

    document.getElementById('btn-sync-now')?.addEventListener('click', async () => {
      try {
        const res = await syncAllPendingToSheets();
        showToast(
          res.syncedCount > 0
            ? `${res.syncedCount} transaksi berhasil dikirim ke Google Sheets!`
            : 'Seluruh transaksi sudah tersinkron.',
          'success'
        );
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('btn-backup-json')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(db.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Backup_MilkFreshPOS_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    });

    document.getElementById('inp-restore-json')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          if (!parsed || !Array.isArray(parsed.users)) throw new Error('Format file backup tidak valid.');
          localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(parsed));
          showToast('Database berhasil dipulihkan! Memuat ulang...', 'success');
          setTimeout(() => window.location.reload(), 800);
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  render();
}




/* MOOMENT_LOCAL_SETTINGS_V1 */
(function moomentSettingsLocal() {
  function playPinError(msg) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.15);
        g.gain.setValueAtTime(0.28, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.35);
      }
    } catch (_) {}
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(msg);
        u.lang = 'id-ID';
        window.speechSynthesis.speak(u);
      }
    } catch (_) {}
  }

  function showPinModal(displayName, username, onConfirmed) {
    document.getElementById('m-pin-modal')?.remove();
    const ov = document.createElement('div');
    ov.id = 'm-pin-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;z-index:9999;';
    ov.innerHTML =
      '<div style="width:100%;max-width:370px;background:#fff;border-radius:18px;padding:22px;box-shadow:0 20px 40px rgba(0,0,0,.22);">' +
        '<h3 style="margin:0 0 6px;font-size:17px;font-weight:800;color:#991b1b;">Hapus Akun Kasir</h3>' +
        '<p style="margin:0 0 12px;font-size:12.5px;color:#475569;">Masukkan <strong>PIN Admin</strong> untuk menghapus akun <strong>' + displayName + ' (@' + username + ')</strong>.</p>' +
        '<input type="password" id="m-pin-input" inputmode="numeric" maxlength="8" placeholder="PIN Admin (default: 123456)" style="width:100%;padding:11px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:15px;letter-spacing:3px;text-align:center;box-sizing:border-box;margin-bottom:8px;" />' +
        '<div id="m-pin-err" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:12px;padding:8px;border-radius:8px;margin-bottom:10px;"></div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button type="button" id="m-pin-cancel" style="flex:1;padding:10px;background:#f1f5f9;color:#334155;border:none;border-radius:10px;font-weight:700;cursor:pointer;">Batal</button>' +
          '<button type="button" id="m-pin-ok" style="flex:1;padding:10px;background:#dc2626;color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;">Hapus Akun</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    const inp = document.getElementById('m-pin-input');
    const err = document.getElementById('m-pin-err');
    inp?.focus();
    document.getElementById('m-pin-cancel').onclick = () => ov.remove();
    document.getElementById('m-pin-ok').onclick = async () => {
      const entered = String(inp?.value || '').trim();
      let pin = '123456';
      try {
        const st = typeof db !== 'undefined' && db.getSettings ? await db.getSettings() : {};
        if (st && st.adminPin) pin = String(st.adminPin).trim();
      } catch (_) {}
      if (!entered || entered !== pin) {
        err.textContent = 'PIN Admin salah! Penghapusan akun kasir dibatalkan.';
        err.style.display = 'block';
        playPinError('PIN Admin salah, penghapusan dibatalkan');
        return;
      }
      ov.remove();
      await onConfirmed();
    };
  }

  async function injectPinControls() {
    const addKasirBtn = Array.from(document.querySelectorAll('button')).find((b) => /Buat Akun Kasir/i.test(b.textContent || ''));
    if (!addKasirBtn) return;

    try {
      if (typeof db !== 'undefined' && db.getAll && db.put) {
        const list = (await db.getAll('users')) || [];
        for (const u of list) {
          if (u && (!u.fullName || !u.name)) {
            const fixed = u.fullName || u.name || (u.username === 'kasir' ? 'Sari' : u.username);
            await db.put('users', { ...u, name: fixed, fullName: fixed });
          }
        }
      }
    } catch (_) {}

    if (!document.getElementById('m-pin-bar')) {
      let pin = '123456';
      try {
        const st = typeof db !== 'undefined' && db.getSettings ? await db.getSettings() : {};
        if (st && st.adminPin) pin = st.adminPin;
      } catch (_) {}
      const bar = document.createElement('div');
      bar.id = 'm-pin-bar';
      bar.style.cssText = 'margin:10px 0 14px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;';
      bar.innerHTML =
        '<span style="font-size:12px;color:#334155;"><strong>PIN Hapus Akun Kasir:</strong></span>' +
        '<div style="display:flex;gap:6px;align-items:center;">' +
          '<input type="text" id="m-pin-cfg" value="' + pin + '" maxlength="8" inputmode="numeric" style="width:88px;padding:6px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-weight:700;text-align:center;" />' +
          '<button type="button" id="m-pin-save-btn" style="padding:6px 11px;background:#14532d;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Simpan PIN</button>' +
        '</div>';
      addKasirBtn.parentNode.insertBefore(bar, addKasirBtn.nextSibling);
      document.getElementById('m-pin-save-btn').onclick = async () => {
        const v = String(document.getElementById('m-pin-cfg')?.value || '').trim();
        if (v.length < 4) return alert('PIN minimal 4 angka.');
        const st = typeof db !== 'undefined' && db.getSettings ? (await db.getSettings()) || {} : {};
        if (typeof db !== 'undefined' && db.saveSettings) await db.saveSettings({ ...st, adminPin: v });
        if (typeof showToast === 'function') showToast('PIN Admin berhasil disimpan!', 'success');
      };
    }

    const toggleBtns = Array.from(document.querySelectorAll('button')).filter((b) => /^(Nonaktifkan|Aktifkan)$/i.test((b.textContent || '').trim()));
    for (const tb of toggleBtns) {
      const cell = tb.parentElement;
      if (!cell || cell.querySelector('.m-del-kasir-btn')) continue;
      const row = cell.closest('tr, div[class*="row"], div[class*="item"]') || cell.parentElement;
      const rTxt = row ? (row.textContent || '') : '';
      if (/Admin/i.test(rTxt) && !/Kasir/i.test(rTxt)) continue;

      const uMatch = rTxt.match(/@([a-zA-Z0-9_.-]+)/);
      const uname = uMatch ? uMatch[1] : 'kasir';
      const nMatch = rTxt.match(/([^\n@]+)\s*\(@/);
      const dName = nMatch && nMatch[1].trim() ? nMatch[1].trim() : uname;

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'm-del-kasir-btn';
      delBtn.textContent = 'Hapus';
      delBtn.style.cssText = 'margin-top:6px;width:100%;padding:7px 12px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;';
      delBtn.onclick = () => {
        showPinModal(dName, uname, async () => {
          const all = typeof db !== 'undefined' && db.getAll ? (await db.getAll('users')) || [] : [];
          const target = all.find((u) => u && u.role === 'kasir' && u.username === uname);
          if (target && target.id !== undefined && db.delete) await db.delete('users', target.id);
          if (typeof showToast === 'function') showToast('Akun kasir ' + dName + ' berhasil dihapus.', 'success');
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
      };
      cell.appendChild(delBtn);
    }
  }
  new MutationObserver(injectPinControls).observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(injectPinControls, 200);
})();