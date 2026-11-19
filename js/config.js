export const APP_CONFIG = {
  APP_NAME: 'MILK FRESH POS',
  VERSION: '5.0.0',
  STORAGE_KEY: 'MILK_FRESH_POS_DB_V1',
};

export const DEFAULT_STORE_SETTINGS = {
  storeName: 'MILK FRESH POS',
  storeAddress: '',
  storePhone: '',
  receiptFooter: 'Terima kasih telah berbelanja! Nikmati kesegaran susu murni setiap hari.',
  taxPercent: 0,
  lowStockThreshold: 10,
  allowCashierDiscount: true,
  paymentMethods: ['Tunai', 'QRIS', 'Transfer Bank', 'E-Wallet'],
  discountPresets: [
    { id: 'disc_0', label: 'Tanpa Diskon', type: 'percent', value: 0 },
    { id: 'disc_5', label: 'Diskon Member 5%', type: 'percent', value: 5 },
    { id: 'disc_10', label: 'Promo 10%', type: 'percent', value: 10 },
    { id: 'disc_2k', label: 'Potongan Rp 2.000', type: 'fixed', value: 2000 },
  ],
  googleAppsScriptUrl: '',
  autoSyncOnTransaction: false,
  logoDataUrl: '',
  masterRecoveryKeyHash: '',
};

export const ADDITIONAL_GROUPS = [
  { id: 'level_gula', name: 'Level Gula', selectionType: 'single' },
  { id: 'pilihan_suhu', name: 'Pilihan Suhu', selectionType: 'single' },
  { id: 'extra_rasa', name: 'Extra Rasa', selectionType: 'multiple' },
  { id: 'topping', name: 'Topping', selectionType: 'multiple' },
  { id: 'extra_lainnya', name: 'Extra Lainnya', selectionType: 'multiple' },
];

export const EXPENSE_CATEGORIES = [
  'Bahan Baku Susu & Gula',
  'Cup, Botol & Kemasan',
  'Topping & Bubuk Rasa',
  'Es Batu & Gas/Listrik',
  'Gaji & Operasional',
  'Lain-lain',
];

export const NAV_ITEMS = [
  { id: "dashboard", route: "dashboard", label: "Dashboard", section: "UTAMA", roles: ["admin", "cashier"] },
  { id: "pos", route: "pos", label: "Kasir / POS", section: "UTAMA", roles: ["admin", "cashier"] },
  { id: "orders", route: "orders", label: "Manajemen Pesanan", section: "OPERASIONAL", roles: ["admin", "cashier"] },
  { id: "shift", route: "shift", label: "Shift Kasir", section: "OPERASIONAL", roles: ["admin", "cashier"] },
  { id: "products", route: "products", label: "Produk & Kategori", section: "KATALOG", roles: ["admin"] },
  { id: "additionals", route: "additionals", label: "Additional / Topping", section: "KATALOG", roles: ["admin"] },
  { id: "stock", route: "stock", label: "Manajemen Stok", section: "INVENTORI & BIAYA", roles: ["admin", "cashier"] },
  { id: "expenses", route: "expenses", label: "Pengeluaran Toko", section: "INVENTORI & BIAYA", roles: ["admin", "cashier"] },
  { id: "reports", route: "reports", label: "Laporan & Keuangan", section: "ANALISIS", roles: ["admin"] },
  { id: "settings", route: "settings", label: "Pengaturan & Cloud", section: "SISTEM", roles: ["admin"] }
];
