// ============================================
// orders.js - مدیریت سفارش‌ها
// ============================================

(function() {
  'use strict';

  // ============================================
  // لیست ۱۲ وضعیتی نهایی
  // ============================================
  const ORDER_STATUSES = [
    { value: 'payment_pending', label: 'در انتظار پرداخت' },
    { value: 'payment_success', label: 'پرداخت موفق' },
    { value: 'payment_failed', label: 'پرداخت ناموفق' },
    { value: 'order_confirmed', label: 'تأیید سفارش' },
    { value: 'courier_delivery', label: 'ارسال با پیک' },
    { value: 'bus_shipping', label: 'ارسال با باربری' },
    { value: 'shipped', label: 'ارسال شد' },
    { value: 'delivered', label: 'تحویل داده شد' },
    { value: 'completed', label: 'تکمیل شد' },
    { value: 'cancelled', label: 'لغو شد' },
    { value: 'returned', label: 'مرجوع شد' }
  ];

  function persianDigits(value) {
    return String(value ?? '').replace(/\d/g, function(digit) { return '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]; });
  }

  function jalaliParts(timestamp) {
    var parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
      timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(new Date(timestamp));
    return Object.fromEntries(parts.filter(function(part) { return part.type !== 'literal'; }).map(function(part) {
      return [part.type, Number(part.value)];
    }));
  }

  function initDeliveryDatePicker(initialValue) {
    var input = document.getElementById('edit-delivery-date');
    var picker = document.getElementById('edit-delivery-calendar');
    var grid = document.getElementById('edit-delivery-calendar-grid');
    var title = document.getElementById('edit-delivery-calendar-title');
    if (!input || !picker || !grid || !title) return;

    var monthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    var weekdays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    var normalized = String(initialValue || '').replace(/[۰-۹]/g, function(digit) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)); }).replace(/-/g, '/');
    var match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    var todayParts = jalaliParts(Date.now());
    var viewYear = match ? Number(match[1]) : todayParts.year;
    var viewMonth = match ? Number(match[2]) : todayParts.month;

    function findMonthStart(year, month) {
      var start = Date.UTC(year + (month >= 11 ? 622 : 621), 0, 1);
      for (var dayOffset = 0; dayOffset <= 370; dayOffset++) {
        var timestamp = start + dayOffset * 86400000;
        var parts = jalaliParts(timestamp);
        if (parts.year === year && parts.month === month && parts.day === 1) return timestamp;
      }
      return null;
    }

    function draw() {
      title.textContent = (monthNames[viewMonth - 1] || '') + ' ' + persianDigits(viewYear);
      grid.innerHTML = '';
      weekdays.forEach(function(label, index) {
        var heading = document.createElement('span');
        heading.textContent = label;
        heading.style.cssText = 'padding:7px 0;text-align:center;color:' + (index === 6 ? '#dc2626' : '#718096') + ';font-size:13px;font-weight:700;';
        grid.appendChild(heading);
      });

      var firstDay = findMonthStart(viewYear, viewMonth);
      if (firstDay == null) return;
      var offset = (new Date(firstDay).getUTCDay() + 1) % 7;
      for (var blankIndex = 0; blankIndex < offset; blankIndex++) {
        var blank = document.createElement('span');
        blank.setAttribute('aria-hidden', 'true');
        grid.appendChild(blank);
      }

      for (var dayOffset = 0; dayOffset < 32; dayOffset++) {
        var timestamp = firstDay + dayOffset * 86400000;
        var parts = jalaliParts(timestamp);
        if (parts.year !== viewYear || parts.month !== viewMonth) break;
        var date = viewYear + '/' + String(viewMonth).padStart(2, '0') + '/' + String(parts.day).padStart(2, '0');
        var button = document.createElement('button');
        button.type = 'button';
        button.dataset.deliveryDate = date;
        button.textContent = persianDigits(parts.day);
        button.style.cssText = 'min-height:40px;border:1px solid #d9e3ec;border-radius:9px;background:#fff;color:' + (new Date(timestamp).getUTCDay() === 5 ? '#dc2626' : '#263746') + ';font:inherit;cursor:pointer;';
        if (normalized === date) button.style.cssText += 'background:#087f8c;color:#fff;border-color:#087f8c;font-weight:700;';
        button.addEventListener('click', function(event) {
          normalized = event.currentTarget.dataset.deliveryDate;
          input.value = persianDigits(normalized);
          picker.hidden = true;
          draw();
        });
        grid.appendChild(button);
      }
    }

    input.value = match ? persianDigits(normalized) : '';
    input.addEventListener('click', function() { picker.hidden = !picker.hidden; });
    document.getElementById('edit-delivery-month-prev')?.addEventListener('click', function() {
      viewMonth--;
      if (viewMonth < 1) { viewMonth = 12; viewYear--; }
      draw();
    });
    document.getElementById('edit-delivery-month-next')?.addEventListener('click', function() {
      viewMonth++;
      if (viewMonth > 12) { viewMonth = 1; viewYear++; }
      draw();
    });
    draw();
  }

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
      tbody.innerHTML = '<tr><td colspan="10">دریافت سفارش‌ها انجام نشد.</td></tr>';
      return;
    }

    var orders = Array.isArray(result.data.orders) ? result.data.orders : [];

    tbody.innerHTML = orders.map(function(order) {
      var totalAmount = Number(order.total_amount || 0);
      var walletUsedAmount = Number(order.wallet_used_amount || 0);
      var payableAmount = order.payable_amount != null ? Number(order.payable_amount || 0) : Math.max(0, totalAmount - walletUsedAmount);
      var deliveryDate = String(order.delivery_date || '').trim();
      var deliveryTime = order.delivery_time_from && order.delivery_time_to
        ? persianDigits(order.delivery_time_from) + ' تا ' + persianDigits(order.delivery_time_to)
        : '';
      var deliveryCell = deliveryDate
        ? '<div style="min-width:110px;line-height:1.8;"><strong>' + window.esc(persianDigits(deliveryDate.replace(/-/g, '/'))) + '</strong>' + (deliveryTime ? '<small style="display:block;color:var(--muted);">' + window.esc(deliveryTime) + '</small>' : '') + '</div>'
        : '<span style="color:var(--muted);">-</span>';

      return '<tr>' +
        '<td class="table-number">' + window.esc(order.order_number) + '</td>' +
        '<td>' + window.esc(order.full_name || "-") + '</td>' +
        '<td>' + window.esc(order.email || "-") + '</td>' +
        '<td>' + window.badge(order.status) + '</td>' +
        '<td class="table-number">' + window.money(totalAmount) + '</td>' +
        '<td class="table-number">' + window.money(walletUsedAmount) + '</td>' +
        '<td class="table-number">' + window.money(payableAmount) + '</td>' +
        '<td class="table-number">' + window.formatDate(order.created_at) + '</td>' +
        '<td>' + deliveryCell + '</td>' +
        '<td>' +
          '<div class="panel-actions" style="margin-top:0;">' +
            '<button class="btn btn-secondary" type="button" data-view-order="' + window.esc(order.order_number) + '">جزئیات</button>' +
            '<button class="btn btn-secondary" type="button" data-delete-order="' + window.esc(order.order_number) + '">حذف</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join("") || '<tr><td colspan="10">سفارشی پیدا نشد.</td></tr>';
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
    var deliveryParts = [order.delivery_date ? persianDigits(String(order.delivery_date).replace(/-/g, "/")) : "", (order.delivery_time_from && order.delivery_time_to) ? persianDigits(order.delivery_time_from) + " تا " + persianDigits(order.delivery_time_to) : ""].filter(Boolean);

    box.classList.remove("admin-hidden");
    box.innerHTML = 
      '<h4>جزئیات سفارش ' + window.esc(order.order_number || "-") + '</h4>' +
      '<p>' +
        'کاربر: ' + window.esc(order.full_name || "-") + '<br>' +
        'ایمیل: ' + window.esc(order.email || "-") + '<br>' +
        'شماره: ' + window.esc(order.phone || "-") + '<br>' +
        'وضعیت: ' + window.esc(window.faOrderStatus(order.status)) + '<br>' +
        // ⭐ حذف شد: 'وضعیت پرداخت: ' + window.esc(window.faPaymentStatus(order.payment_status)) + '<br>' +
        'مبلغ فاکتور: ' + window.money(totalAmount) + ' تومان<br>' +
        'مبلغ ارسال: ' + window.money(shippingAmount) + ' تومان<br>' +
        'برداشت از کیف پول: ' + window.money(walletUsedAmount) + ' تومان<br>' +
        'مانده قابل پرداخت: ' + window.money(payableAmount) + ' تومان<br>' +
        'کش‌بک: ' + window.money(cashbackAmount) + ' تومان<br>' +
        'وضعیت کش‌بک: ' + window.esc(order.cashback_status || "-") + '<br>' +
        window.esc(order.delivery_label || "زمان ارسال") + ': ' + window.esc(deliveryParts.join("، ") || "-") + '<br>' +
        'نرخ دلار در زمان ثبت: ' + (order.rate_at_purchase ? window.money(order.rate_at_purchase) + ' تومان' : '-') + '<br>' +
        'تاریخ: ' + window.formatDate(order.created_at) +
      '</p>';

    box.innerHTML +=
      '<div class="detail-card" style="margin-top:16px;padding:18px;">' +
        '<h4>ویرایش زمان ارسال</h4>' +
        '<p>تاریخ شمسی و ساعت دلخواه را وارد کنید؛ این تغییر به ظرفیت و برنامهٔ عمومی ارسال محدود نیست.</p>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:14px 0;">' +
          '<label style="position:relative;">تاریخ ارسال (شمسی)<input id="edit-delivery-date" type="text" inputmode="numeric" dir="ltr" readonly placeholder="برای انتخاب تاریخ کلیک کنید" style="cursor:pointer;"><div id="edit-delivery-calendar" hidden style="position:absolute;z-index:1000;top:100%;right:0;width:min(340px,calc(100vw - 48px));padding:12px;margin-top:6px;border:1px solid #d6e2ec;border-radius:14px;background:#fff;box-shadow:0 14px 36px rgba(22,43,62,.18);"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;padding:7px;border-radius:9px;background:#f3f7fa;"><button type="button" id="edit-delivery-month-prev" aria-label="ماه قبل">‹</button><strong id="edit-delivery-calendar-title"></strong><button type="button" id="edit-delivery-month-next" aria-label="ماه بعد">›</button></div><div id="edit-delivery-calendar-grid" style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;direction:rtl;"></div></div></label>' +
          '<label>ساعت شروع<input id="edit-delivery-time-from" type="time" value="' + window.esc(order.delivery_time_from || "") + '"></label>' +
          '<label>ساعت پایان<input id="edit-delivery-time-to" type="time" value="' + window.esc(order.delivery_time_to || "") + '"></label>' +
        '</div>' +
        '<button class="btn btn-primary" type="button" id="save-delivery-schedule-btn">ذخیره زمان ارسال</button>' +
      '</div>';
    initDeliveryDatePicker(order.delivery_date);

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

    // ساخت dropdown با ۱۲ وضعیت نهایی
    var statusOptions = ORDER_STATUSES.map(function(s) {
      var selected = (s.value === order.status) ? ' selected' : '';
      return '<option value="' + s.value + '"' + selected + '>' + s.label + '</option>';
    }).join('');

    box.innerHTML +=
      '<div class="panel-actions">' +
        '<select id="detail-status">' +
          statusOptions +
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

    // رویداد ذخیره وضعیت
    var saveBtn = document.getElementById("save-order-status-btn");
    if (saveBtn) {
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

    var deliverySaveBtn = document.getElementById("save-delivery-schedule-btn");
    if (deliverySaveBtn) {
      deliverySaveBtn.addEventListener("click", async function() {
        deliverySaveBtn.disabled = true;
        var saveResult = await window.api("/api/admin/orders/" + encodeURIComponent(order.order_number), {
          method: "POST",
          body: JSON.stringify({
            action: "update_delivery_schedule",
            delivery_date: document.getElementById("edit-delivery-date").value,
            delivery_time_from: document.getElementById("edit-delivery-time-from").value,
            delivery_time_to: document.getElementById("edit-delivery-time-to").value
          })
        });
        deliverySaveBtn.disabled = false;
        if (!saveResult.ok || !saveResult.data?.success) {
          window.setAdminMessage(saveResult.data?.error || "ذخیره زمان ارسال انجام نشد.");
          return;
        }
        window.setAdminMessage("زمان ارسال سفارش به‌روزرسانی شد.", "success");
        await loadOrders();
        await loadOrderDetail(order.order_number);
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
    document.removeEventListener("click", handleOrderClick);
    document.addEventListener("click", handleOrderClick);
  }

  function handleOrderClick(event) {
    var target = event.target;

    var viewBtn = target.closest("[data-view-order]");
    if (viewBtn) {
      event.preventDefault();
      var orderNumber = viewBtn.getAttribute("data-view-order");
      if (orderNumber) {
        loadOrderDetail(orderNumber);
      }
      return;
    }

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

  setupOrderEvents();

  console.log("✅ Orders module loaded successfully");

})();
