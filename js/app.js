import { auth } from './auth.js';
import { db } from './db.js';
import {
  escapeHTML,
  refreshIcons,
  showToast,
} from './utils.js';
import { renderLoginView } from './views/loginView.js?v=56.0';

const ADMIN_NAV_ITEMS = [
  { section: 'UTAMA', id: 'dashboard', label: 'Dashboard', icon: 'layout-grid' },
  { section: 'UTAMA', id: 'pos', label: 'Kasir / POS', icon: 'shopping-cart' },
  { section: 'OPERASIONAL', id: 'orders', label: 'Manajemen Pesanan', icon: 'clipboard-list' },
  { section: 'KATALOG', id: 'products', label: 'Produk & Kategori', icon: 'milk' },
  { section: 'KATALOG', id: 'additionals', label: 'Additional / Topping', icon: 'sparkles' },
  { section: 'INVENTORI & BIAYA', id: 'stock', label: 'Manajemen Stok', icon: 'package' },
  { section: 'INVENTORI & BIAYA', id: 'expenses', label: 'Pengeluaran Toko', icon: 'receipt' },
  { section: 'ANALISIS', id: 'reports', label: 'Laporan & Keuangan', icon: 'bar-chart-3' },
  { section: 'SISTEM', id: 'settings', label: 'Pengaturan & Cloud', icon: 'settings' },
];

const CASHIER_NAV_ITEMS = [
  { section: 'TUGAS KASIR', id: 'pos', label: 'Kasir / POS', icon: 'shopping-cart' },
  { section: 'TUGAS KASIR', id: 'orders', label: 'Antrean Pesanan', icon: 'clipboard-list' },
  { section: 'TUGAS KASIR', id: 'stock', label: 'Cek Stok Menu', icon: 'package-search' },
  { section: 'TUTUP SHIFT', id: 'shift', label: 'Rekap Setoran Shift', icon: 'wallet' },
];

let currentRoute = 'dashboard';
let clockInterval = null;

function getAllowedNavItems() {
  return auth.isAdmin() ? ADMIN_NAV_ITEMS : CASHIER_NAV_ITEMS;
}

function updateTopbarClock() {
  const el = document.getElementById('topbar-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function updateSheetsStatusPill() {
  const pill = document.getElementById('sheets-status-pill');
  if (!pill) return;
  const settings = db.getSettings();
  if (settings.googleAppsScriptUrl) {
    pill.className = 'status-pill connected';
    pill.innerHTML = `<i data-lucide="cloud-check"></i><span>Sheets Terhubung</span>`;
  } else {
    pill.className = 'status-pill neutral';
    pill.innerHTML = `<i data-lucide="database"></i><span>Penyimpanan Lokal</span>`;
  }
  refreshIcons();
}

function renderSidebarNav() {
  const navContainer = document.getElementById('sidebar-nav');
  if (!navContainer) return;

  const visibleItems = getAllowedNavItems();
  const sections = [...new Set(visibleItems.map((i) => i.section))];

  navContainer.innerHTML = sections
    .map((sec) => {
      const items = visibleItems.filter((i) => i.section === sec);
      return `
        <div class="nav-section-title">${escapeHTML(sec)}</div>
        ${items
          .map(
            (item) => `
          <button type="button" class="nav-item ${currentRoute === item.id ? 'active' : ''}" data-nav-route="${item.id}">
            <i data-lucide="${item.icon}"></i>
            <span>${escapeHTML(item.label)}</span>
          </button>
        `
          )
          .join('')}
      `;
    })
    .join('');

  navContainer.querySelectorAll('[data-nav-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-nav-route');
      navigateTo(target);
      closeMobileSidebar();
    });
  });

  refreshIcons();
}

function syncUserShellInfo() {
  const user = auth.getUser();
  const settings = db.getSettings();
  if (!user) return;

  const isAdmin = user.role === 'admin';
  const storeNameEl = document.getElementById('sidebar-store-name');
  const logoBox = document.getElementById('sidebar-logo-box');
  if (storeNameEl) storeNameEl.textContent = settings.storeName;
  if (logoBox) {
    logoBox.innerHTML = settings.logoDataUrl
      ? `<img src="${settings.logoDataUrl}" alt="Logo" />`
      : `<i data-lucide="milk"></i>`;
  }

  document.getElementById('sidebar-user-avatar').textContent = (user.fullName || 'U').charAt(0).toUpperCase();
  const roleBadge = document.getElementById('sidebar-role-badge');
  roleBadge.textContent = isAdmin ? 'ADMIN / PEMILIK' : 'KASIR SHIFT';
  roleBadge.style.background = isAdmin ? 'var(--accent-cocoa-soft)' : 'var(--primary-green-soft)';
  roleBadge.style.color = isAdmin ? 'var(--accent-cocoa)' : 'var(--primary-green)';

  document.getElementById('sidebar-user-name').textContent = user.fullName;
  document.getElementById('sidebar-user-username').textContent = `@${user.username}`;

  const userCard = document.querySelector('.user-card');
  if (userCard) {
    userCard.style.cursor = isAdmin ? 'pointer' : 'default';
    userCard.title = isAdmin ? 'Klik untuk membuka Pengaturan & Cloud' : 'Perubahan password hanya melalui Admin';
  }
}

async function navigateTo(route) {
  const allowedItems = getAllowedNavItems();
  const fallbackRoute = auth.isAdmin() ? 'dashboard' : 'pos';
  const isAllowed = allowedItems.some((item) => item.id === route);

  currentRoute = isAllowed ? route : fallbackRoute;
  const activeItem = allowedItems.find((i) => i.id === currentRoute);

  const titleEl = document.getElementById('topbar-page-title');
  if (titleEl && activeItem) {
    titleEl.textContent = activeItem.label;
  }

  renderSidebarNav();
  updateSheetsStatusPill();

  const content = document.getElementById('app-content');
  try {
    switch (currentRoute) {
      case 'dashboard': {
        const mod = await import('./views/dashboardView.js?v=56.0');
        mod.renderDashboardView();
        break;
      }
      case 'pos': {
        const mod = await import('./views/posView.js?v=56.0');
        mod.renderPosView();
        break;
      }
      case 'orders': {
        const mod = await import('./views/ordersView.js?v=56.0');
        mod.renderOrdersView();
        break;
      }
      case 'products': {
        const mod = await import('./views/productsView.js?v=56.0');
        mod.renderProductsView();
        break;
      }
      case 'additionals': {
        const mod = await import('./views/additionalsView.js?v=56.0');
        mod.renderAdditionalsView();
        break;
      }
      case 'stock': {
        const mod = await import('./views/stockView.js?v=56.0');
        mod.renderStockView();
        break;
      }
      case 'shift': {
        const mod = await import('./views/cashierShiftView.js?v=56.0');
        mod.renderCashierShiftView();
        break;
      }
      case 'expenses': {
        const mod = await import('./views/expensesView.js?v=56.0');
        mod.renderExpensesView();
        break;
      }
      case 'reports': {
        const mod = await import('./views/reportsView.js?v=56.0');
        mod.renderReportsView();
        break;
      }
      case 'settings': {
        const mod = await import('./views/settingsView.js?v=56.0');
        mod.renderSettingsView();
        break;
      }
      default: {
        const mod = await import('./views/posView.js?v=56.0');
        mod.renderPosView();
      }
    }
  } catch (err) {
    console.error('Gagal memuat halaman:', err);
    if (content) {
      content.innerHTML = `
        <div class="card" style="border-color:#fecaca;background:var(--danger-bg);color:var(--danger);">
          <strong>Gagal memuat halaman "${escapeHTML(currentRoute)}":</strong>
          <p style="margin-top:6px;font-size:12.5px;">${escapeHTML(err.message || String(err))}</p>
        </div>
      `;
    }
  }
}

function closeMobileSidebar() {
  document.getElementById('app-sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}

function showAuthenticatedShell() {
  const user = auth.getUser();
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');

  syncUserShellInfo();
  currentRoute = user?.role === 'cashier' ? 'pos' : 'dashboard';
  navigateTo(currentRoute);

  if (clockInterval) clearInterval(clockInterval);
  updateTopbarClock();
  clockInterval = setInterval(updateTopbarClock, 1000);
}

function showLoginScreen() {
  if (clockInterval) clearInterval(clockInterval);
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  renderLoginView(() => {
    showAuthenticatedShell();
  });
}

async function bootstrap() {
  try {
    await db.init();
    const existingSession = auth.init();

    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
      document.getElementById('app-sidebar')?.classList.toggle('open');
      document.getElementById('sidebar-overlay')?.classList.toggle('open');
    });

    document.getElementById('sidebar-overlay')?.addEventListener('click', closeMobileSidebar);

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      auth.logout();
      showToast('Anda telah keluar dari sistem.', 'info');
      showLoginScreen();
    });

    document.querySelector('.user-card')?.addEventListener('click', () => {
      if (auth.isAdmin()) {
        navigateTo('settings');
        closeMobileSidebar();
      }
    });

    if (existingSession) {
      showAuthenticatedShell();
    } else {
      showLoginScreen();
    }
  } catch (err) {
    console.error('Gagal inisialisasi aplikasi:', err);
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
      loginScreen.classList.remove('hidden');
      loginScreen.innerHTML = `
        <div class="auth-wrapper">
          <div class="auth-card" style="border-color:#fecaca;">
            <h2 style="color:var(--danger);font-size:16px;margin-bottom:8px;">Terjadi Kesalahan Memuat Aplikasi</h2>
            <p style="font-size:12.5px;color:var(--text-secondary);">${escapeHTML(err.message || String(err))}</p>
          </div>
        </div>
      `;
    }
  }
}

bootstrap();












/* ROLE_SIDEBAR_GUARD */
(function initRoleSidebarGuard() {
  const ADMIN_ONLY = new Set(["products", "additionals", "reports", "settings"]);
  function applyRole() {
    let isAdmin = true;
    try {
      const raw = localStorage.getItem("milkfresh_session") || sessionStorage.getItem("milkfresh_session");
      if (raw) { const p = JSON.parse(raw); if (p && p.role && p.role !== "admin") isAdmin = false; }
    } catch (_) {}
    document.querySelectorAll("[data-route], [data-view]").forEach((el) => {
      const r = el.getAttribute("data-route") || el.getAttribute("data-view");
      if (r) el.style.display = (!isAdmin && ADMIN_ONLY.has(r)) ? "none" : "";
    });
    document.querySelectorAll(".nav-section-title, .sidebar-section-title, .menu-label").forEach((hdr) => {
      const t = (hdr.textContent || "").trim().toUpperCase();
      if (t === "KATALOG" || t === "ANALISIS" || t === "SISTEM") hdr.style.display = !isAdmin ? "none" : "";
    });
    const h = (window.location.hash || "").replace(/^#\/?/, "");
    if (!isAdmin && ADMIN_ONLY.has(h)) window.location.hash = "#pos";
  }
  window.addEventListener("DOMContentLoaded", applyRole);
  window.addEventListener("hashchange", applyRole);
  setInterval(applyRole, 800);
})();