import { db } from './db.js';
import { hashPassword } from './utils.js';

const SESSION_KEY = 'MILK_FRESH_POS_SESSION_V1';
const OTP_STORE = new Map();

class AuthService {
  constructor() {
    this.currentUser = null;
  }

  init() {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const found = db.data.users.find((u) => u.id === parsed.userId && u.active);
      if (found) {
        this.currentUser = found;
        return found;
      }
    } catch {
      // Abaikan sesi rusak
    }
    this.logout();
    return null;
  }

  getUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return Boolean(this.currentUser);
  }

  isAdmin() {
    return this.currentUser?.role === 'admin';
  }

  isCashier() {
    return this.currentUser?.role === 'cashier';
  }

  normalizePhone(phone) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) digits = '62' + digits.slice(1);
    if (!digits.startsWith('62') && digits.startsWith('8')) digits = '62' + digits;
    return digits;
  }

  findUserByIdentifier(identifier) {
    const clean = String(identifier || '').trim().toLowerCase();
    const cleanPhone = this.normalizePhone(identifier);
    if (!clean) return null;
    return (
      db.data.users.find(
        (u) =>
          u.username.toLowerCase() === clean ||
          (u.email && u.email.toLowerCase() === clean) ||
          (cleanPhone && u.whatsapp && this.normalizePhone(u.whatsapp) === cleanPhone)
      ) || null
    );
  }

  establishSession(user, rememberMe = true, methodLabel = 'Password') {
    this.currentUser = user;
    const payload = JSON.stringify({
      userId: user.id,
      role: user.role,
      loggedInAt: new Date().toISOString(),
    });

    if (rememberMe) {
      localStorage.setItem(SESSION_KEY, payload);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, payload);
      localStorage.removeItem(SESSION_KEY);
    }

    db.logAuthEvent(user.username, 'LOGIN', 'BERHASIL', `Masuk sebagai ${user.role.toUpperCase()} (${methodLabel})`);
    return user;
  }

  async login(identifier, password, rememberMe = true, expectedRole = null) {
    const user = this.findUserByIdentifier(identifier);
    if (!user) {
      db.logAuthEvent(identifier, 'LOGIN', 'GAGAL', 'Akun tidak ditemukan');
      throw new Error('Username, email, atau nomor WhatsApp tidak terdaftar.');
    }

    if (!user.active) {
      db.logAuthEvent(user.username, 'LOGIN', 'GAGAL', 'Akun dinonaktifkan');
      throw new Error('Akun ini sedang dinonaktifkan oleh Administrator.');
    }

    const inputHash = await hashPassword(password, user.salt);
    if (inputHash !== user.passwordHash) {
      db.logAuthEvent(user.username, 'LOGIN', 'GAGAL', 'Password salah');
      throw new Error('Password yang Anda masukkan salah.');
    }

    if (expectedRole === 'cashier' && user.role !== 'cashier') {
      throw new Error('Akun ini adalah akun Administrator. Silakan masuk melalui tab "Login Admin".');
    }

    if (expectedRole === 'admin' && user.role !== 'admin') {
      throw new Error('Akun ini adalah akun Kasir. Silakan masuk melalui tab "Login Kasir".');
    }

    return this.establishSession(user, rememberMe, 'Password');
  }

  async requestWhatsappOtp(identifier, expectedRole = null) {
    const user = this.findUserByIdentifier(identifier);
    if (!user) {
      throw new Error('Akun dengan Username / Email / No. WhatsApp tersebut tidak ditemukan.');
    }
    if (!user.active) {
      throw new Error('Akun ini sedang dinonaktifkan oleh Administrator.');
    }
    if (expectedRole === 'cashier' && user.role !== 'cashier') {
      throw new Error('Akun ini adalah Administrator. Gunakan tab "Login Admin".');
    }
    if (expectedRole === 'admin' && user.role !== 'admin') {
      throw new Error('Akun ini adalah Kasir. Gunakan tab "Login Kasir".');
    }

    const waNumber = this.normalizePhone(user.whatsapp);
    if (!waNumber) {
      throw new Error(`Akun "${user.fullName}" belum memiliki nomor WhatsApp. Tambahkan nomor WA di menu Pengaturan & Cloud terlebih dahulu.`);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    OTP_STORE.set(user.id, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000, // Berlaku 5 menit
    });

    const settings = db.getSettings();
    const storeName = settings.storeName || 'MILK FRESH POS';
    const messageText = `[${storeName}] Kode OTP masuk Anda adalah: *${code}*. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.`;

    let deliveredViaGateway = false;
    const fonnteToken = (settings.fonnteApiToken || '').trim();

    if (fonnteToken) {
      try {
        const formData = new FormData();
        formData.append('target', waNumber);
        formData.append('message', messageText);
        const res = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { Authorization: fonnteToken },
          body: formData,
        });
        if (res.ok) deliveredViaGateway = true;
      } catch (err) {
        console.warn('Gagal kirim via Fonnte API, beralih ke mode WA lokal:', err);
      }
    }

    const maskedWa = `+${waNumber.slice(0, 4)}****${waNumber.slice(-3)}`;
    const waWebLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(messageText)}`;

    return {
      userId: user.id,
      userName: user.fullName,
      maskedWa,
      code,
      deliveredViaGateway,
      waWebLink,
    };
  }

  loginWithWhatsappOtp(userId, inputCode, rememberMe = true) {
    const entry = OTP_STORE.get(userId);
    if (!entry) throw new Error('Silakan minta kode OTP WhatsApp terlebih dahulu.');
    if (Date.now() > entry.expiresAt) {
      OTP_STORE.delete(userId);
      throw new Error('Kode OTP WhatsApp sudah kedaluwarsa. Minta kode baru.');
    }
    if (String(inputCode || '').trim() !== entry.code) {
      throw new Error('Kode OTP 6-digit tidak cocok.');
    }

    OTP_STORE.delete(userId);
    const user = db.data.users.find((u) => u.id === userId && u.active);
    if (!user) throw new Error('Akun tidak ditemukan atau nonaktif.');

    return this.establishSession(user, rememberMe, 'OTP WhatsApp');
  }

  verifyWhatsappOtpOnly(userId, inputCode) {
    const entry = OTP_STORE.get(userId);
    if (!entry) throw new Error('Silakan minta kode OTP WhatsApp terlebih dahulu.');
    if (Date.now() > entry.expiresAt) {
      OTP_STORE.delete(userId);
      throw new Error('Kode OTP sudah kedaluwarsa.');
    }
    if (String(inputCode || '').trim() !== entry.code) {
      throw new Error('Kode OTP 6-digit tidak cocok.');
    }
    OTP_STORE.delete(userId);
    return true;
  }

  logout() {
    if (this.currentUser) {
      db.logAuthEvent(this.currentUser.username, 'LOGOUT', 'BERHASIL', 'Keluar dari sistem');
    }
    this.currentUser = null;
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  async changeOwnPassword(oldPassword, newPassword) {
    if (!this.currentUser) throw new Error('Sesi login tidak ditemukan.');
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password baru minimal 6 karakter.');
    }
    const oldHash = await hashPassword(oldPassword, this.currentUser.salt);
    if (oldHash !== this.currentUser.passwordHash) {
      throw new Error('Password lama tidak sesuai.');
    }
    const newSalt = `SALT_${Date.now()}`;
    const newHash = await hashPassword(newPassword, newSalt);
    this.currentUser.salt = newSalt;
    this.currentUser.passwordHash = newHash;
    db.save();
    db.logAuthEvent(this.currentUser.username, 'GANTI_PASSWORD', 'BERHASIL', 'Mengubah password sendiri');
  }

  async verifyMasterRecoveryKey(inputKey) {
    const cleanKey = String(inputKey || '').trim().toUpperCase();
    const savedHash = db.getSettings().masterRecoveryKeyHash;
    if (!savedHash) throw new Error('Master Recovery Key belum dikonfigurasi.');
    const hashed = await hashPassword(cleanKey, 'MASTER_RECOVERY_SALT');
    if (hashed !== savedHash) {
      throw new Error('Master Recovery Key tidak valid.');
    }
    return true;
  }

  async resetPasswordDirect(targetUserId, newPassword, methodLabel = 'Recovery') {
    const user = db.data.users.find((u) => u.id === targetUserId);
    if (!user) throw new Error('Akun pengguna tidak ditemukan.');
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password baru minimal 6 karakter.');
    }
    const newSalt = `SALT_${Date.now()}`;
    const newHash = await hashPassword(newPassword, newSalt);
    user.salt = newSalt;
    user.passwordHash = newHash;
    db.save();
    db.logAuthEvent(user.username, 'RESET_PASSWORD', 'BERHASIL', `Reset via ${methodLabel}`);
  }
}

export const auth = new AuthService();
