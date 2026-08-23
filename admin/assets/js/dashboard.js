// ============================================
// dashboard.js - مدیریت داشبورد
// ============================================

(function() {
  'use strict';

  // ============================================
  // بارگذاری داشبورد
  // ============================================
  async function loadDashboard() {
    var result = await window.api("/api/admin/stats");
    if (!result.ok || !result.data?.success) {
      window.setAdminMessage(result.data?.error || "دریافت آمار انجام نشد.");
      return;
    }

    var stats = result.data.stats || {};

    var statUsers = document.getElementById("stat-users");
    var statOrders = document.getElementById("stat-orders");
    var statPending = document.getElementById("stat-pending");
    var statRevenue = document.getElementById("stat-revenue");
    var statWallet = document.getElementById("stat-wallet");

    if (statUsers) statUsers.textContent = window.money(stats.total_users || 0);
    if (statOrders) statOrders.textContent = window.money(stats.total_orders || 0);
    if (statPending) statPending.textContent = window.money(stats.pending_orders || 0);
    if (statRevenue) statRevenue.textContent = window.money(stats.total_revenue || 0);
    if (statWallet) statWallet.textContent = window.money(stats.total_wallet_balance || 0);

    var latestUsersBody = document.getElementById("latest-users-body");
    if (latestUsersBody) {
      var users = result.data.latest_users || [];
      latestUsersBody.innerHTML = users.map(function(user) {
        return '<tr>' +
          '<td class="table-number">' + window.esc(user.id) + '</td>' +
          '<td>' + window.esc(user.full_name) + '</td>' +
          '<td>' + window.esc(user.email) + '</td>' +
          '<td>' + window.badge(user.role) + '</td>' +
          '<td class="table-number">' + window.formatDate(user.created_at) + '</td>' +
        '</tr>';
      }).join("") || '<tr><td colspan="5">داده‌ای موجود نیست.</td></tr>';
    }

    var latestOrdersBody = document.getElementById("latest-orders-body");
    if (latestOrdersBody) {
      var orders = result.data.latest_orders || [];
      latestOrdersBody.innerHTML = orders.map(function(order) {
        return '<tr>' +
          '<td class="table-number">' + window.esc(order.order_number) + '</td>' +
          '<td>' + window.badge(order.status) + '</td>' +
          '<td class="table-number">' + window.money(order.total_amount) + '</td>' +
          '<td class="table-number">' + window.formatDate(order.created_at) + '</td>' +
        '</tr>';
      }).join("") || '<tr><td colspan="4">داده‌ای موجود نیست.</td></tr>';
    }
  }

  // ============================================
  // صادر کردن توابع
  // ============================================
  window.loadDashboard = loadDashboard;

  console.log("✅ Dashboard module loaded successfully");

})();