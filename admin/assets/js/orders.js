// ============================================
// orders.js - مدیریت سفارش‌ها
// ============================================

(function() {
  'use strict';

  // ============================================
  // بارگذاری لیست سفارش‌ها
  // ============================================
  async function loadOrders() {
    var search = document.getElementById("orders-search")?.value?.trim() || "";
    var status = document.getElementById("orders-status")?.value?.trim() || "";
    var payment_status = document.getElementById("orders-payment-status")?.value?.trim() || "";

    var params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (payment_status) params.set("payment_status", payment_status);

    var query = params.toString();
    var result = await window.api("/api/admin/orders" + (query ? "?" + query : ""));
    var tbody = document.getElementById("orders-body");

    if (!result.ok || !result.data?.success) {
      tbody.innerHTML = '<tr><td colspan="9">دریافت سفارش‌ها انجام نشد.</td></tr>';
      return;
    }

    var orders = Array.isArray(result.data.orders) ? result.data.orders : [];

    tbody.innerHTML = orders.map(function(order) {
      var totalAmount = Number(order.total_amount || 0);
      var walletUsedAmount = Number(order.wallet_used_amount || 0);
      var payableAmount = order.payable_amount != null ? Number(order.payable_amount || 0) : Math.max(0, totalAmount - walletUsedAmount);

      return '<tr>' +
        '<td class="table-number">' + window.esc(order.order_number) + '</td>' +
        '<td>' + window.esc(order.full_name || "-") + '</td>' +
        '<td>' + window.esc(order.email || "-") + '</td>' +
        '<td>' + window.badge(order.status) + '</td>' +
        '<td class="table-number">' + window.money(totalAmount) + '</td>' +
        '<td class="table-number">' + window.money(walletUsedAmount) + '</td>' +
        '<td class="table-number">' + window.money(payableAmount) + '</td>' +
        '<td class="table-number">' + window.formatDate(order.created_at) + '</td>' +
        '<td>' +
          '<div class="panel-actions" style="margin-top:0;">' +
            '<button class="btn btn-secondary" type="button" data-view-order="' + window.esc(order.order_number) + '">جزئیات</button>' +
            '<button class="btn btn-secondary" type="button" data-delete-order="' + window.esc(order.order_number) + '">حذف</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join("") || '<tr><td colspan="9">سفارشی پیدا نشد.</td></tr>';
  }

  // ============================================
  // بارگذاری جزئیات یک سفارش
  // ============================================
  async function loadOrderDetail(orderNumber) {
    var result = await window.api("/api/admin/orders/" + encodeURIComponent(orderNumber));
    var box = document.getElementById("order-detail");

    if (!box) {
      console.error("❌ عنصر order-detail پیدا نشد.");
      return;
    }

    if (!result.ok || !result.data?.success) {
      box.classList.remove("admin-hidden");
      box.innerHTML = '<h4>خطا</h4><p>' + window.esc(result.data?.error || "دریافت جزئیات سفارش انجام نشد.") + '</p>';
      return;
    }

    var order = result.data.order || {};
    var items = Array.isArray(order.items) ? order.items : [];
    var address = order.shipping_address || null;

    var totalAmount = Number(order.total_amount || 0);
    var shippingAmount = Number(order.shipping_amount || 0);
    var walletUsedAmount = Number(order.wallet_used_amount || 0);
    var payableAmount = order.payable_amount != null ? Number(order.payable_amount || 0) : Math.max(0, totalAmount - walletUsedAmount);
    var cashbackAmount = Number(order.cashback_amount || 0);

    box.classList.remove("admin-hidden");
    box.innerHTML = 
      '<h4>جزئیات سفارش ' + window.esc(order.order_number || "-") + '</h4>' +
      '<p>' +
        'کاربر: ' + window.esc(order.full_name || "-") + '<br>' +
        'ایمیل: ' + window.esc(order.email || "-") + '<br>' +
        'شماره: ' + window.esc(order.phone || "-") + '<br>' +
        'وضعیت: ' + window.esc(window.faOrderStatus(order.status)) + '<br>' +
        'وضعیت پرداخت: ' + window.esc(window.faPaymentStatus(order.payment_status)) + '<br>' +
        'مبلغ فاکتور: ' + window.money(totalAmount) + ' تومان<br>' +
        'مبلغ ارسال: ' + window.money(shippingAmount) + ' تومان<br>' +
        'برداشت از کیف پول: ' + window.money(walletUsedAmount) + ' تومان<br>' +
        'مانده قابل پرداخت: ' + window.money(payableAmount) + ' تومان<br>' +
        'کش‌بک: ' + window.money(cashbackAmount) + ' تومان<br>' +
        'وضعیت کش‌بک: ' + window.esc(order.cashback_status || "-") + '<br>' +
        'نرخ دلار در زمان ثبت: ' + (order.rate_at_purchase ? window.money(order.rate_at_purchase) + ' تومان' : '-') + '<br>' +
        'تاریخ: ' + window.formatDate(order.created_at) +
      '</p>';

    if (address) {
      box.innerHTML += 
        '<div class="detail-card" style="margin-top:16px;">' +
          '<h4>آدرس ارسال</h4>' +
          '<p>' +
            'نام: ' + window.esc(address.full_name || "-") + '<br>' +
            'موبایل: ' + window.esc(address.phone || "-") + '<br>' +
            'آدرس: ' + window.esc(address.address_line || "-") + '<br>' +
            'شهر: ' + window.esc(address.city || "-") + '<br>' +
            'استان: ' + window.esc(address.state || "-") + '<br>' +
            'کد پستی: ' + window.esc(address.postal_code || "-") +
          '</p>' +
        '</div>';
    }

    box.innerHTML +=
      '<div class="panel-actions">' +
        '<select id="detail-status">' +
          '<option value="order_created">سفارش ثبت شد</option>' +
          '<option value="payment_pending">در انتظار پرداخت</option>' +
          '<option value="payment_success">پرداخت موفق</option>' +
          '<option value="payment_failed">پرداخت ناموفق</option>' +
          '<option value="payment_review">بررسی پرداخت</option>' +
          '<option value="order_confirmed">تأیید سفارش</option>' +
          '<option value="processing">در حال پردازش</option>' +
          '<option value="ready_to_ship">آماده ارسال</option>' +
          '<option value="courier_delivery">ارسال با پیک</option>' +
          '<option value="bus_shipping">ارسال با اتوبوس</option>' +
          '<option value="shipped">ارسال شد</option>' +
          '<option value="delivered">تحویل داده شد</option>' +
          '<option value="completed">تکمیل شد</option>' +
          '<option value="cancelled">لغو شد</option>' +
          '<option value="returned">مرجوع شد</option>' +
          '<option value="processing_failed">پردازش ناموفق</option>' +
        '</select>' +
        '<button class="btn btn-primary" type="button" id="save-order-status-btn">ذخیره وضعیت</button>' +
        '<button class="btn btn-secondary" type="button" id="delete-order-detail-btn">حذف سفارش</button>' +
      '</div>';

    if (items.length) {
      box.innerHTML += 
        '<div class="table-wrap" style="margin-top:16px;">' +
          '<table class="admin-table">' +
            '<thead><tr><th>محصول</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr></thead>' +
            '<tbody>' +
            items.map(function(item) {
              return '<tr>' +
                '<td>' + window.esc(item.product_name || "-") + '</td>' +
                '<td class="table-number">' + window.esc(item.quantity) + '</td>' +
                '<td class="table-number">' + window.money(item.unit_price) + '</td>' +
                '<td class="table-number">' + window.money(item.total_price) + '</td>' +
              '</tr>';
            }).join("") +
            '</tbody>' +
          '</table>' +
        '</div>';
    }

    // مقداردهی dropdown وضعیت
    var statusSelect = document.getElementById("detail-status");
    if (statusSelect) {
      statusSelect.value = order.status || "order_created";
    }

    // رویداد ذخیره وضعیت
    var saveBtn = document.getElementById("save-order-status-btn");
    if (saveBtn) {
      // حذف رویدادهای قبلی
      var newSaveBtn = saveBtn.cloneNode(true);
      saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
      newSaveBtn.addEventListener("click", async function() {
        var status = document.getElementById("detail-status").value;
        var saveResult = await window.api("/api/admin/orders/" + encodeURIComponent(order.order_number), {
          method: "POST",
          body: JSON.stringify({ status: status })
        });

        if (!saveResult.ok || !saveResult.data?.success) {
          window.setAdminMessage(saveResult.data?.error || "ذخیره وضعیت سفارش انجام نشد.");
          return;
        }

        var cashbackMessage = saveResult.data?.cashback_result?.applied ? " کش‌بک هم اعمال شد." : "";
        window.setAdminMessage("وضعیت سفارش با موفقیت ذخیره شد." + cashbackMessage, "success");
        await loadOrders();
        await loadOrderDetail(order.order_number);
        await loadDashboard();
        await loadUsers();
      });
    }

    // رویداد حذف سفارش
    var deleteBtn = document.getElementById("delete-order-detail-btn");
    if (deleteBtn) {
      var newDeleteBtn = deleteBtn.cloneNode(true);
      deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
      newDeleteBtn.addEventListener("click", async function() {
        await deleteOrder(order.order_number);
      });
    }
  }

  // ============================================
  // حذف سفارش
  // ============================================
  async function deleteOrder(orderNumber) {
    if (!orderNumber) {
      window.setAdminMessage("شماره سفارش معتبر نیست.");
      return false;
    }

    var firstConfirm = window.confirm("آیا از حذف سفارش " + orderNumber + " مطمئن هستی؟");
    if (!firstConfirm) return false;

    var secondConfirm = window.confirm("این عملیات قابل بازگشت نیست. حذف انجام شود؟");
    if (!secondConfirm) return false;

    var result = await window.api("/api/admin/orders", {
      method: "DELETE",
      body: JSON.stringify({ order_number: orderNumber })
    });

    if (!result.ok || !result.data?.success) {
      window.setAdminMessage(result.data?.error || "حذف سفارش انجام نشد.");
      return false;
    }

    window.setAdminMessage("سفارش با موفقیت حذف شد.", "success");
    var detailBox = document.getElementById("order-detail");
    if (detailBox) {
      detailBox.classList.add("admin-hidden");
      detailBox.innerHTML = "";
    }
    await loadOrders();
    await loadDashboard();
    return true;
  }

  // ============================================
  // اتصال رویدادها با Event Delegation روی document
  // ============================================
  function setupOrderEvents() {
    // حذف رویدادهای قبلی (برای جلوگیری از چندباره)
    document.removeEventListener("click", handleOrderClick);
    document.addEventListener("click", handleOrderClick);
  }

  function handleOrderClick(event) {
    var target = event.target;

    // دکمه جزئیات
    var viewBtn = target.closest("[data-view-order]");
    if (viewBtn) {
      event.preventDefault();
      var orderNumber = viewBtn.getAttribute("data-view-order");
      if (orderNumber) {
        loadOrderDetail(orderNumber);
      }
      return;
    }

    // دکمه حذف
    var deleteBtn = target.closest("[data-delete-order]");
    if (deleteBtn) {
      event.preventDefault();
      var orderNumber = deleteBtn.getAttribute("data-delete-order");
      if (orderNumber) {
        deleteOrder(orderNumber);
      }
      return;
    }
  }

  // ============================================
  // صادر کردن توابع
  // ============================================
  window.loadOrders = loadOrders;
  window.loadOrderDetail = loadOrderDetail;
  window.deleteOrder = deleteOrder;
  window.setupOrderEvents = setupOrderEvents;

  // اتصال خودکار رویدادها هنگام بارگذاری ماژول
  setupOrderEvents();

  console.log("✅ Orders module loaded successfully");

})();