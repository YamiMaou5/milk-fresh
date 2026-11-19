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
      title: `Edit Akun ${isAdminAccount ? 'Admin' : 'Kasir'} — ${user.fullName}`,
      bodyHTML: `
        <form id="edit-account-form" autocomplete="off">
          <div class="form-group">
            <label class="form-label">Nama Lengkap *</label>
            <input type="text" id="edt-acc-name" class="form-control" value="${escapeHTML(user.fullName)}" required />
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
        document.getElementById('sidebar-user-name').textContent = user.fullName;
        document.getElementById('sidebar-user-username').textContent = `@${user.username}`;
      }

      closeModal();
      showToast(`Data akun ${user.fullName} berhasil diperbarui.`, 'success');
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
                          <strong>${escapeHTML(u.fullName)}</strong>
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
        const newPw = window.prompt(`Masukkan password baru untuk ${target.fullName} (minimal 6 karakter):`);
        if (!newPw) return;
        try {
          await auth.resetPasswordDirect(uid, newPw, 'Reset oleh Admin');
          showToast(`Password untuk ${target.fullName} berhasil diubah.`, 'success');
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
        showToast(`Status akun ${target.fullName} diperbarui.`, 'info');
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


