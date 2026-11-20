import { auth } from './auth.js';
import { NAV_ITEMS } from './config.js';
import { escapeHTML, refreshIcons, showToast } from './utils.js';
import { renderAdditionalsView } from './views/additionalsView.js';
import { renderDashboardView } from './views/dashboardView.js';
import { renderExpensesView } from './views/expensesView.js';
import { renderOrdersView } from './views/ordersView.js';
import { renderPosView } from './views/posView.js?v=66.0';
import { renderProductsView } from './views/productsView.js';
import { renderReportsView } from './views/reportsView.js';
import { renderSettingsView } from './views/settingsView.js';
import { renderStockView } from './views/stockView.js';

class AppRouter {
  constructor() {
    this.currentRoute = 'dashboard';
  }

  renderSidebarNav() {
    const navEl = document.getElementById('sidebar-nav');
    if (!navEl) return;

    const allowedItems = NAV_ITEMS.filter((item) => auth.hasPermission(item.id));
    const sections = {};
    for (const item of allowedItems) {
      if (!sections[item.section]) sections[item.section] = [];
      sections[item.section].push(item);
    }

    let html = '';
    for (const [secName, items] of Object.entries(sections)) {
      html += `<div class="nav-section-title">${escapeHTML(secName)}</div>`;
      for (const item of items) {
        const isActive = item.id === this.currentRoute ? 'active' : '';
        html += `
          <button type="button" class="nav-item ${isActive}" data-route="${item.id}">
            <i data-lucide="${item.icon}"></i>
            <span>${escapeHTML(item.label)}</span>
          </button>
        `;
      }
    }

    navEl.innerHTML = html;
    refreshIcons();

    navEl.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-route');
        this.navigate(target);
        this.closeMobileSidebar();
      });
    });
  }

  closeMobileSidebar() {
    document.getElementById('app-sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('open');
  }

  navigate(routeId) {
    if (!auth.hasPermission(routeId)) {
      showToast('Anda tidak memiliki hak akses ke halaman tersebut.', 'error');
      routeId = 'dashboard';
    }

    this.currentRoute = routeId;
    this.renderSidebarNav();

    const navDef = NAV_ITEMS.find((n) => n.id === routeId);
    const titleEl = document.getElementById('topbar-page-title');
    if (titleEl && navDef) titleEl.textContent = navDef.label;

    const handlers = {
      dashboard: renderDashboardView,
      pos: renderPosView,
      orders: renderOrdersView,
      products: renderProductsView,
      additionals: renderAdditionalsView,
      stock: renderStockView,
      expenses: renderExpensesView,
      reports: renderReportsView,
      settings: renderSettingsView,
    };

    const fn = handlers[routeId] || renderDashboardView;
    fn();
  }
}

export const router = new AppRouter();
