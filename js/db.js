import { APP_CONFIG, DEFAULT_STORE_SETTINGS } from './config.js';
import {
  generateId,
  generateTransactionNumber,
  generateExpenseNumber,
  hashPassword,
} from './utils.js';

class MilkPosDatabase {
  constructor() {
    this.data = null;
  }

  async init() {
    const raw = localStorage.getItem(APP_CONFIG.STORAGE_KEY);
    if (raw) {
      try {
        this.data = JSON.parse(raw);
        this.ensureSchemaIntegrity();
        return;
      } catch (err) {
        console.error('Database gagal dibaca:', err);
      }
    }
    this.createCleanStructure();
  }

  createCleanStructure() {
    this.data = {
      isSetupCompleted: false,
      settings: { ...DEFAULT_STORE_SETTINGS },
      users: [],
      categories: [],
      products: [],
      additionals: [],
      transactions: [],
      stockLogs: [],
      expenses: [],
      syncedTransactionIds: [],
      syncLogs: [],
      authLogs: [],
    };
    this.save();
  }

  ensureSchemaIntegrity() {
    if (typeof this.data.isSetupCompleted !== 'boolean') {
      this.data.isSetupCompleted = Array.isArray(this.data.users) && this.data.users.length > 0;
    }
    if (!this.data.settings) this.data.settings = { ...DEFAULT_STORE_SETTINGS };
    if (!Array.isArray(this.data.users)) this.data.users = [];
    if (!Array.isArray(this.data.categories)) this.data.categories = [];
    if (!Array.isArray(this.data.products)) this.data.products = [];
    if (!Array.isArray(this.data.additionals)) this.data.additionals = [];
    if (!Array.isArray(this.data.transactions)) this.data.transactions = [];
    if (!Array.isArray(this.data.stockLogs)) this.data.stockLogs = [];
    if (!Array.isArray(this.data.expenses)) this.data.expenses = [];
    if (!Array.isArray(this.data.syncedTransactionIds)) this.data.syncedTransactionIds = [];
    if (!Array.isArray(this.data.syncLogs)) this.data.syncLogs = [];
    if (!Array.isArray(this.data.authLogs)) this.data.authLogs = [];

    // Bersihkan SVG placeholder lama yang rusak jika ada
    let cleaned = false;
    for (const p of this.data.products) {
      if (typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:image/svg+xml')) {
        p.imageUrl = '';
        cleaned = true;
      }
    }
    if (cleaned) this.save();
  }

  hasAdminAccount() {
    return this.data.users.some((u) => u.role === 'admin' && u.active);
  }

  save() {
    localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(this.data));
  }

  logAuthEvent(username, action, status, note = '') {
    this.data.authLogs.unshift({
      id: generateId('AUTH'),
      timestamp: new Date().toISOString(),
      username: username || '-',
      action,
      status,
      note,
    });
    if (this.data.authLogs.length > 100) {
      this.data.authLogs = this.data.authLogs.slice(0, 100);
    }
    this.save();
  }

  async completeInitialProductionSetup({
    storeName,
    storeAddress,
    storePhone,
    adminFullName,
    adminUsername,
    adminEmail,
    adminPassword,
    loadStandardCatalog = true,
  }) {
    const cleanUser = String(adminUsername || '').trim().toLowerCase();
    const cleanEmail = String(adminEmail || '').trim().toLowerCase();

    if (!storeName || !adminFullName || !cleanUser || !cleanEmail || !adminPassword) {
      throw new Error('Seluruh data wajib diisi untuk menyelesaikan aktivasi toko.');
    }
    if (adminPassword.length < 6) {
      throw new Error('Password Admin minimal 6 karakter.');
    }

    const recoveryKey = `MF-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;
    const recoveryHash = await hashPassword(recoveryKey, 'MASTER_RECOVERY_SALT');

    const adminSalt = `SALT_${Date.now()}`;
    const adminHash = await hashPassword(adminPassword, adminSalt);

    this.data.settings = {
      ...DEFAULT_STORE_SETTINGS,
      storeName: storeName.trim(),
      storeAddress: storeAddress.trim(),
      storePhone: storePhone.trim(),
      masterRecoveryKeyHash: recoveryHash,
    };

    this.data.users = [
      {
        id: 'usr_super_admin',
        fullName: adminFullName.trim(),
        username: cleanUser,
        email: cleanEmail,
        role: 'admin',
        salt: adminSalt,
        passwordHash: adminHash,
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];

    this.data.categories = [
      { id: 'cat_orig', name: 'Susu Murni Original', active: true },
      { id: 'cat_rasa', name: 'Susu Murni Aneka Rasa', active: true },
      { id: 'cat_prem', name: 'Susu Murni Premium', active: true },
      { id: 'cat_botol', name: 'Susu Murni Botol', active: true },
      { id: 'cat_paket', name: 'Paket Hemat', active: true },
      { id: 'cat_spesial', name: 'Menu Spesial', active: true },
    ];

    this.data.additionals = [
      { id: 'add_g1', group: 'level_gula', name: 'Normal Sugar', price: 0, active: true },
      { id: 'add_g2', group: 'level_gula', name: 'Less Sugar', price: 0, active: true },
      { id: 'add_g3', group: 'level_gula', name: 'Half Sugar', price: 0, active: true },
      { id: 'add_g4', group: 'level_gula', name: 'No Sugar', price: 0, active: true },
      { id: 'add_g5', group: 'level_gula', name: 'Extra Sugar', price: 1000, active: true },
      { id: 'add_s1', group: 'pilihan_suhu', name: 'Dingin (Es)', price: 0, active: true },
      { id: 'add_s2', group: 'pilihan_suhu', name: 'Normal (Tanpa Es)', price: 0, active: true },
      { id: 'add_s3', group: 'pilihan_suhu', name: 'Hangat', price: 0, active: true },
      { id: 'add_r1', group: 'extra_rasa', name: 'Extra Cokelat', price: 3000, active: true },
      { id: 'add_r2', group: 'extra_rasa', name: 'Extra Strawberry', price: 3000, active: true },
      { id: 'add_r3', group: 'extra_rasa', name: 'Extra Vanilla', price: 3000, active: true },
      { id: 'add_r4', group: 'extra_rasa', name: 'Extra Matcha', price: 4000, active: true },
      { id: 'add_r5', group: 'extra_rasa', name: 'Extra Taro', price: 3500, active: true },
      { id: 'add_t1', group: 'topping', name: 'Oreo Crumbs', price: 3000, active: true },
      { id: 'add_t2', group: 'topping', name: 'Brown Sugar Boba', price: 4000, active: true },
      { id: 'add_t3', group: 'topping', name: 'Coffee Jelly', price: 3000, active: true },
      { id: 'add_t4', group: 'topping', name: 'Keju Parut', price: 4000, active: true },
      { id: 'add_t5', group: 'topping', name: 'Whipped Cream', price: 4500, active: true },
      { id: 'add_t6', group: 'topping', name: 'Cincau Hitam', price: 2500, active: true },
      { id: 'add_e1', group: 'extra_lainnya', name: 'Extra Susu Murni', price: 4000, active: true },
      { id: 'add_e2', group: 'extra_lainnya', name: 'Extra Es Batu', price: 0, active: true },
      { id: 'add_e3', group: 'extra_lainnya', name: 'Extra Double Topping', price: 5000, active: true },
    ];

    if (loadStandardCatalog) {
      const allGroups = ['level_gula', 'pilihan_suhu', 'extra_rasa', 'topping', 'extra_lainnya'];
      const bottleGroups = ['level_gula', 'extra_rasa'];
      this.data.products = [
        {
          id: 'prd_01',
          name: 'Susu Murni Original',
          categoryId: 'cat_orig',
          size: 'Regular',
          hargaJual: 10000,
          hargaModal: 5500,
          stok: 50,
          active: true,
          description: 'Susu sapi murni segar pasteurisasi 100% tanpa pengawet.',
          imageUrl: '',
          allowedAdditionalGroups: allGroups,
        },
        {
          id: 'prd_02',
          name: 'Susu Murni Cokelat',
          categoryId: 'cat_rasa',
          size: 'Regular',
          hargaJual: 13000,
          hargaModal: 7000,
          stok: 40,
          active: true,
          description: 'Perpaduan susu murni dengan bubuk kakao premium.',
          imageUrl: '',
          allowedAdditionalGroups: allGroups,
        },
        {
          id: 'prd_03',
          name: 'Susu Murni Strawberry',
          categoryId: 'cat_rasa',
          size: 'Regular',
          hargaJual: 13000,
          hargaModal: 7000,
          stok: 35,
          active: true,
          description: 'Susu murni segar dengan selai buah stroberi asli.',
          imageUrl: '',
          allowedAdditionalGroups: allGroups,
        },
        {
          id: 'prd_04',
          name: 'Susu Murni Vanilla',
          categoryId: 'cat_rasa',
          size: 'Regular',
          hargaJual: 13000,
          hargaModal: 6800,
          stok: 35,
          active: true,
          description: 'Aroma ekstrak vanila lembut menyatu dengan susu murni.',
          imageUrl: '',
          allowedAdditionalGroups: allGroups,
        },
        {
          id: 'prd_05',
          name: 'Susu Murni Matcha',
          categoryId: 'cat_prem',
          size: 'Large',
          hargaJual: 16000,
          hargaModal: 8500,
          stok: 30,
          active: true,
          description: 'Pure Uji Matcha Jepang dicampur susu murni creamy.',
          imageUrl: '',
          allowedAdditionalGroups: allGroups,
        },
        {
          id: 'prd_06',
          name: 'Susu Murni Taro',
          categoryId: 'cat_prem',
          size: 'Large',
          hargaJual: 15000,
          hargaModal: 8000,
          stok: 30,
          active: true,
          description: 'Rasa talas ungu manis lembut dengan tekstur susu kental.',
          imageUrl: '',
          allowedAdditionalGroups: allGroups,
        },
        {
          id: 'prd_07',
          name: 'Susu Murni Botol 500 ml',
          categoryId: 'cat_botol',
          size: '500 ml',
          hargaJual: 18000,
          hargaModal: 10000,
          stok: 25,
          active: true,
          description: 'Kemasan botol higienis siap simpan di kulkas.',
          imageUrl: '',
          allowedAdditionalGroups: bottleGroups,
        },
        {
          id: 'prd_08',
          name: 'Susu Murni Botol 1 Liter',
          categoryId: 'cat_botol',
          size: '1 Liter',
          hargaJual: 32000,
          hargaModal: 18500,
          stok: 20,
          active: true,
          description: 'Kemasan keluarga 1 Liter susu murni pasteurisasi.',
          imageUrl: '',
          allowedAdditionalGroups: bottleGroups,
        },
      ];
    } else {
      this.data.products = [];
    }

    this.data.transactions = [];
    this.data.expenses = [];
    this.data.stockLogs = this.data.products.map((p) => ({
      id: generateId('STK'),
      productId: p.id,
      productName: p.name,
      type: 'STOK_AWAL',
      qtyChange: p.stok,
      stockBefore: 0,
      stockAfter: p.stok,
      note: 'Stok awal aktivasi toko',
      actor: adminFullName.trim(),
      createdAt: new Date().toISOString(),
    }));

    this.data.isSetupCompleted = true;
    this.logAuthEvent(cleanUser, 'SETUP_TOKO', 'BERHASIL', 'Aktivasi awal Admin & toko selesai');
    this.save();

    return { recoveryKey };
  }

  getSettings() {
    return this.data.settings;
  }

  updateSettings(partial) {
    this.data.settings = { ...this.data.settings, ...partial };
    this.save();
    return this.data.settings;
  }
  recordTransaction(payload) {
    return this.createTransaction(payload);
  }

  createTransaction(payload) {
    const {
      items,
      customerName = '',
      cashierId,
      cashierName,
      discountLabel = 'Tanpa Diskon',
      discountAmount = 0,
      taxAmount = 0,
      paymentMethod = 'Tunai',
      amountPaid = 0,
      status = 'Sudah dibayar',
      idempotencyKey = '',
    } = payload;

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Keranjang belanja masih kosong.');
    }

    if (idempotencyKey) {
      const existing = this.data.transactions.find((t) => t.idempotencyKey === idempotencyKey);
      if (existing) return existing;
    }

    const qtyNeededByProduct = {};
    for (const item of items) {
      qtyNeededByProduct[item.productId] = (qtyNeededByProduct[item.productId] || 0) + item.qty;
    }

    for (const [productId, neededQty] of Object.entries(qtyNeededByProduct)) {
      const prod = this.data.products.find((p) => p.id === productId);
      if (!prod) throw new Error('Produk tidak ditemukan.');
      if (!prod.active) throw new Error(`Produk "${prod.name}" sedang dinonaktifkan.`);
      if (prod.stok < neededQty) {
        throw new Error(`Stok "${prod.name}" tidak mencukupi (tersisa ${prod.stok}, diminta ${neededQty}).`);
      }
    }

    let subtotal = 0;
    let totalModal = 0;

    const normalizedItems = items.map((item) => {
      const prod = this.data.products.find((p) => p.id === item.productId);
      const addonsTotalPerUnit = (item.additionals || []).reduce((sum, a) => sum + (Number(a.price) || 0), 0);
      const unitFinalPrice = (Number(item.basePrice) || prod.hargaJual) + addonsTotalPerUnit;
      const lineSubtotal = unitFinalPrice * item.qty;
      const lineModal = (Number(prod.hargaModal) || 0) * item.qty;

      subtotal += lineSubtotal;
      totalModal += lineModal;

      return {
        productId: prod.id,
        productName: prod.name,
        categoryId: prod.categoryId,
        size: prod.size,
        qty: item.qty,
        basePrice: Number(item.basePrice) || prod.hargaJual,
        hargaModal: Number(prod.hargaModal) || 0,
        additionals: item.additionals || [],
        addonsTotalPerUnit,
        unitFinalPrice,
        lineSubtotal,
        note: item.note || '',
      };
    });

    const validDiscount = Math.min(Math.max(0, Number(discountAmount) || 0), subtotal);
    const validTax = Math.max(0, Number(taxAmount) || 0);
    const grandTotal = Math.max(0, subtotal - validDiscount + validTax);
    const grossProfit = grandTotal - totalModal;
    const paid = paymentMethod === 'Tunai' ? Number(amountPaid) || 0 : grandTotal;

    if (status !== 'Menunggu pembayaran' && paymentMethod === 'Tunai' && paid < grandTotal) {
      throw new Error('Nominal uang tunai diterima kurang dari total pembayaran.');
    }

    const changeAmount = Math.max(0, paid - grandTotal);
    const trxNumber = generateTransactionNumber();
    const nowISO = new Date().toISOString();

    for (const [productId, neededQty] of Object.entries(qtyNeededByProduct)) {
      const prod = this.data.products.find((p) => p.id === productId);
      const before = prod.stok;
      prod.stok = Math.max(0, before - neededQty);

      this.data.stockLogs.unshift({
        id: generateId('STK'),
        productId: prod.id,
        productName: prod.name,
        type: 'PENJUALAN',
        qtyChange: -neededQty,
        stockBefore: before,
        stockAfter: prod.stok,
        note: `Transaksi ${trxNumber}`,
        actor: cashierName || 'Kasir',
        createdAt: nowISO,
      });
    }

    const transaction = {
      id: generateId('TXID'),
      transactionNumber: trxNumber,
      idempotencyKey,
      createdAt: nowISO,
      customerName: customerName.trim(),
      cashierId,
      cashierName,
      items: normalizedItems,
      totalItemsCount: normalizedItems.reduce((acc, i) => acc + i.qty, 0),
      subtotal,
      discountLabel,
      discountAmount: validDiscount,
      taxAmount: validTax,
      grandTotal,
      totalModal,
      grossProfit,
      paymentMethod,
      amountPaid: paid,
      changeAmount,
      status,
    };

    this.data.transactions.unshift(transaction);
    this.save();
    return transaction;
  }

  updateOrderStatus(transactionId, newStatus, actorName = 'Admin') {
    const trx = this.data.transactions.find((t) => t.id === transactionId);
    if (!trx) throw new Error('Pesanan tidak ditemukan.');

    const prevStatus = trx.status;
    if (prevStatus === newStatus) return trx;

    if (newStatus === 'Dibatalkan' && prevStatus !== 'Dibatalkan') {
      for (const item of trx.items) {
        const prod = this.data.products.find((p) => p.id === item.productId);
        if (prod) {
          const before = prod.stok;
          prod.stok = before + item.qty;
          this.data.stockLogs.unshift({
            id: generateId('STK'),
            productId: prod.id,
            productName: prod.name,
            type: 'PEMBATALAN',
            qtyChange: item.qty,
            stockBefore: before,
            stockAfter: prod.stok,
            note: `Pembatalan ${trx.transactionNumber}`,
            actor: actorName,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    trx.status = newStatus;
    trx.updatedAt = new Date().toISOString();
    this.save();
    return trx;
  }

  adjustStock(productId, type, qty, note = '', actor = 'Admin') {
    const prod = this.data.products.find((p) => p.id === productId);
    if (!prod) throw new Error('Produk tidak ditemukan.');
    const numQty = Math.abs(Number(qty) || 0);
    if (numQty <= 0) throw new Error('Jumlah perubahan stok harus lebih dari 0.');

    const before = prod.stok;
    let delta = 0;

    if (type === 'STOK_MASUK') {
      delta = numQty;
    } else if (type === 'STOK_KELUAR') {
      if (before < numQty) throw new Error(`Stok saat ini (${before}) tidak mencukupi untuk dikurangi ${numQty}.`);
      delta = -numQty;
    } else {
      throw new Error('Jenis penyesuaian stok tidak valid.');
    }

    prod.stok = before + delta;
    this.data.stockLogs.unshift({
      id: generateId('STK'),
      productId: prod.id,
      productName: prod.name,
      type,
      qtyChange: delta,
      stockBefore: before,
      stockAfter: prod.stok,
      note: note || (type === 'STOK_MASUK' ? 'Penambahan stok masuk' : 'Pengurangan stok manual'),
      actor,
      createdAt: new Date().toISOString(),
    });

    this.save();
    return prod;
  }

  addExpense({ date, category, description, amount, recordedBy }) {
    const val = Number(amount) || 0;
    if (val <= 0) throw new Error('Nominal pengeluaran harus lebih dari Rp 0.');
    const expense = {
      id: generateId('EXPID'),
      expenseNumber: generateExpenseNumber(),
      date: date || new Date().toISOString(),
      category,
      description: description.trim(),
      amount: val,
      recordedBy,
      createdAt: new Date().toISOString(),
    };
    this.data.expenses.unshift(expense);
    this.save();
    return expense;
  }

  deleteExpense(expenseId) {
    this.data.expenses = this.data.expenses.filter((e) => e.id !== expenseId);
    this.save();
  }
}

export const db = new MilkPosDatabase();





/* MOOMENT_LOCAL_DB_V1 */
(async function moomentDbLocal() {
  try {
    if (typeof db === 'undefined') return;
    if (typeof db.init === 'function') await db.init();
    if (typeof db.getAll === 'function') {
      const users = (await db.getAll('users')) || [];
      const hasNamedKasir = users.some((u) => u && u.role === 'kasir' && (u.fullName || u.name));
      for (const u of users) {
        if (!u) continue;
        const rawName = String(u.fullName || u.name || '').trim();
        if (u.role === 'kasir' && !rawName && hasNamedKasir && users.filter((x) => x && x.username === u.username).length > 1) {
          if (typeof db.delete === 'function') await db.delete('users', u.id);
          continue;
        }
        const safeName = rawName || (u.username === 'owner' || u.username === 'maou' ? 'Mahmud' : (u.username === 'kasir' ? 'Sari' : u.username));
        if (u.name !== safeName || u.fullName !== safeName) {
          if (typeof db.put === 'function') await db.put('users', { ...u, name: safeName, fullName: safeName });
        }
      }
    }
    if (typeof db.getSettings === 'function' && typeof db.saveSettings === 'function') {
      const st = (await db.getSettings()) || {};
      if (!st.adminPin) await db.saveSettings({ ...st, adminPin: '123456' });
    }
    const addons = [
      { id: 'add-keju', name: 'Keju', price: 2000, cost: 1000, stock: 100, active: true },
      { id: 'add-coklat', name: 'Coklat', price: 2000, cost: 1000, stock: 100, active: true },
      { id: 'add-oreo', name: 'Oreo', price: 2000, cost: 1000, stock: 100, active: true },
      { id: 'add-rasa', name: 'Rasa', price: 2000, cost: 800, stock: 100, active: true }
    ];
    for (const store of ['additionals', 'addons']) {
      try {
        const cur = (await db.getAll(store)) || [];
        if (cur.length === 0) for (const a of addons) await db.put(store, a);
      } catch (_) {}
    }
  } catch (e) { console.warn('DB check:', e); }
})();
/* MOOMENT_KASIR_TOPPING_DB_V62 */
(async function () {
  try {
    if (typeof db === "undefined") return;
    if (typeof db.init === "function") await db.init();
    const toppings = [
      { id: "add-keju", name: "Keju", price: 2000, cost: 1000, stock: 100, active: true },
      { id: "add-coklat", name: "Coklat", price: 2000, cost: 1000, stock: 100, active: true },
      { id: "add-oreo", name: "Oreo", price: 2000, cost: 1000, stock: 100, active: true },
      { id: "add-rasa", name: "Rasa", price: 2000, cost: 800, stock: 100, active: true }
    ];
    for (const store of ["additionals", "addons"]) {
      try {
        const existing = (await db.getAll(store)) || [];
        if (existing.length === 0) {
          for (const t of toppings) await db.put(store, t);
        }
      } catch (_) {}
    }
  } catch (_) {}
})();
