(function () {
  'use strict';
  var api = '/api/v1/admin/delivery-schedules';
  var weekdayRows = [];
  function showMessage(message, type) {
    if (typeof window.setAdminMessage === 'function') window.setAdminMessage(message, type || 'info');
    else if (message) window.alert(message);
  }
  var days = [
    { label: 'شنبه', value: 6 }, { label: 'یکشنبه', value: 0 },
    { label: 'دوشنبه', value: 1 }, { label: 'سه‌شنبه', value: 2 },
    { label: 'چهارشنبه', value: 3 }, { label: 'پنجشنبه', value: 4 },
    { label: 'جمعه', value: 5 }
  ];
  function post(body) {
    return window.api(api, { method: 'POST', body: JSON.stringify(body) });
  }
  function initPicker() {
    var grid = document.getElementById('jalali-grid');
    var monthTitle = document.getElementById('jalali-month');
    var output = document.getElementById('holiday-date');
    if (!grid) return;
    if (grid.dataset.ready) {
      if (typeof grid.refreshToToday === 'function') grid.refreshToToday();
      return;
    }
    grid.dataset.ready = '1';
    function getToday() {
      var parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
        timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric'
      }).formatToParts(new Date());
      var value = {};
      parts.forEach(function (part) { if (part.type !== 'literal') value[part.type] = Number(part.value); });
      return { year: value.year, month: value.month, day: value.day };
    }
    var today = getToday();
    var month = today.month, year = today.year;
    var months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
    function draw() {
      today = getToday();
      monthTitle.textContent = months[month - 1] + ' ' + year;
      grid.innerHTML = '';
      var head = document.createElement('div'); head.className = 'jalali-weekdays';
      ['ش','ی','د','س','چ','پ','ج'].forEach(function (label) { var cell = document.createElement('span'); cell.textContent = label; head.appendChild(cell); });
      grid.appendChild(head);
      var dates = [];
      for (var date = new Date(2025, 0, 1); date < new Date(2041, 0, 1); date.setDate(date.getDate() + 1)) {
        var parts = new Intl.DateTimeFormat('en-US-u-ca-persian', { year:'numeric', month:'numeric', day:'numeric' }).formatToParts(date);
        var y = +parts.find(function (p) { return p.type === 'year'; }).value;
        var m = +parts.find(function (p) { return p.type === 'month'; }).value;
        var d = +parts.find(function (p) { return p.type === 'day'; }).value;
        if (y === year && m === month) dates.push({ day:d, weekday:date.getDay() });
      }
      var offset = dates.length ? (dates[0].weekday + 1) % 7 : 0;
      for (var i = 0; i < offset; i++) { var blank = document.createElement('span'); blank.className = 'jalali-blank'; grid.appendChild(blank); }
      dates.forEach(function (item) {
        var button = document.createElement('button'); button.type = 'button'; button.textContent = item.day;
        button.dataset.friday = item.weekday === 5 ? '1' : '0';
        var isToday = year === today.year && month === today.month && item.day === today.day;
        var isPast = year < today.year || (year === today.year && (month < today.month || (month === today.month && item.day < today.day)));
        button.disabled = isPast;
        if (isToday) { button.classList.add('is-today'); button.title = 'امروز'; }
        button.addEventListener('click', function () {
          output.value = year + '/' + String(month).padStart(2, '0') + '/' + String(item.day).padStart(2, '0');
          grid.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); }); button.classList.add('selected');
        });
        grid.appendChild(button);
      });
      var previous = document.getElementById('jalali-prev');
      if (previous) previous.disabled = year < today.year || (year === today.year && month <= today.month);
    }
    grid.refreshToToday = function () {
      today = getToday();
      month = today.month;
      year = today.year;
      draw();
    };
    document.getElementById('jalali-prev').addEventListener('click', function () { month--; if (month < 1) { month = 12; year--; } draw(); });
    document.getElementById('jalali-next').addEventListener('click', function () { month++; if (month > 12) { month = 1; year++; } draw(); });
    draw();
  }
  function renderWeeklyRows(rows) {
    var host = document.getElementById('weekly-slot-rows'); if (!host) return;
    host.innerHTML = '';
    days.forEach(function (day) {
      var existing = rows.find(function (row) { return Number(row.weekday) === day.value && !row.specific_date; });
      var row = document.createElement('div'); row.className = 'weekly-slot-row'; row.dataset.weekday = day.value;
      row.innerHTML = '<label><input type="checkbox" data-active></label><strong></strong><label>ساعت <input type="time" data-start></label><label>ساعت <input type="time" data-end></label><label>بیک <input type="number" min="0" data-capacity></label><label>ساعت پیش از <input type="number" min="0" data-cutoff></label>';
      row.querySelector('strong').textContent = day.label;
      row.querySelector('[data-active]').checked = !!(existing && Number(existing.is_active));
      row.querySelector('[data-start]').value = existing && existing.start_time || '09:00';
      row.querySelector('[data-end]').value = existing && existing.end_time || '15:00';
      row.querySelector('[data-capacity]').value = existing && existing.capacity || 0;
      row.querySelector('[data-cutoff]').value = existing ? Math.floor(Number(existing.cutoff_minutes || 0) / 60) : 2;
      host.appendChild(row);
    });
  }
  async function load() {
    initPicker();
    try {
      var response = await window.api(api, { cache: 'no-store' }); var data = response.data || {};
      if (!response.ok || !data.success) throw new Error(data.error || 'بارگذاری تنظیمات ارسال انجام نشد.');
      var chips = document.getElementById('holiday-chips');
      if (chips) {
        chips.innerHTML = '';
        (data.holidays || []).forEach(function (holiday) {
          var chip = document.createElement('span'); chip.appendChild(document.createTextNode(holiday.holiday_date + ' '));
          var remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.dataset.holidayDelete = holiday.id; chip.appendChild(remove); chips.appendChild(chip);
        });
      }
      var blocked = []; try { blocked = JSON.parse(data.settings && data.settings.blocked_weekdays || '[]'); } catch (_) {}
      document.querySelectorAll('#blocked-weekdays input').forEach(function (input) { input.checked = blocked.includes(Number(input.value)); });
      var settings = data.settings || {};
      var minDays = document.getElementById('delivery-min-days'); if (minDays) minDays.value = settings.minimum_days || '2';
      var horizon = document.getElementById('delivery-horizon-days'); if (horizon) horizon.value = settings.horizon_days || '14';
      var cutoff = document.getElementById('delivery-same-day-cutoff'); if (cutoff) cutoff.value = settings.same_day_cutoff || '14:00';
      var placement = document.getElementById('delivery-checkout-placement'); if (placement) placement.value = settings.checkout_placement || 'after_shipping';
      var checkoutMessage = document.getElementById('delivery-checkout-message'); if (checkoutMessage) checkoutMessage.value = settings.checkout_message || '';
      var notificationLabel = document.getElementById('delivery-notification-label'); if (notificationLabel) notificationLabel.value = settings.delivery_notification_label || 'زمان ارسال';
      var alwaysShow = document.getElementById('delivery-always-show'); if (alwaysShow) alwaysShow.checked = settings.delivery_always_visible !== '0';
      var paymentRule = {}; try { paymentRule = JSON.parse(settings.payment_location_rule || '{}'); } catch (_) {}
      var paymentLocation = document.getElementById('delivery-payment-location'); if (paymentLocation) paymentLocation.value = paymentRule.location || '';
      var disabledMethods = document.getElementById('delivery-disabled-methods'); if (disabledMethods) disabledMethods.value = paymentRule.methods || '';
      var paymentEnabled = document.getElementById('delivery-payment-location-enabled'); if (paymentEnabled) paymentEnabled.checked = !!paymentRule.enabled;
      weekdayRows = data.schedules || []; renderWeeklyRows(weekdayRows);
    } catch (error) { showMessage(error.message || 'بارگذاری تنظیمات ارسال انجام نشد.', 'error'); }
  }
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (target.closest && target.closest('[data-admin-panel="delivery-schedules"]')) {
      load();
    }
    if (target.id === 'save-blocked-weekdays') {
      var blocked = Array.from(document.querySelectorAll('#blocked-weekdays input:checked')).map(function (input) { return Number(input.value); });
      post({ action:'save_weekdays', weekdays:blocked }).then(load);
    }
    if (target.id === 'save-weekly-slots') {
      var rows = Array.from(document.querySelectorAll('.weekly-slot-row')).map(function (row) {
        return { weekday:Number(row.dataset.weekday), title:'زمان ارسال', active:row.querySelector('[data-active]').checked, start_time:row.querySelector('[data-start]').value, end_time:row.querySelector('[data-end]').value, capacity:row.querySelector('[data-capacity]').value, cutoff_hours:row.querySelector('[data-cutoff]').value };
      });
      post({ action:'save_weekly_slots', rows:rows }).then(load);
    }
    if (target.id === 'save-delivery-defaults') {
      post({ action:'save_defaults', minimum_days:document.getElementById('delivery-min-days').value, horizon_days:document.getElementById('delivery-horizon-days').value, same_day_cutoff:document.getElementById('delivery-same-day-cutoff').value }).then(load);
    }
    if (target.id === 'save-delivery-display') {
      post({ action:'save_display', checkout_placement:document.getElementById('delivery-checkout-placement').value, checkout_message:document.getElementById('delivery-checkout-message').value, delivery_notification_label:document.getElementById('delivery-notification-label').value, delivery_always_visible:document.getElementById('delivery-always-show').checked ? '1' : '0' }).then(load);
    }
    if (target.id === 'save-delivery-payment-location') {
      post({ action:'save_payment_location', location:document.getElementById('delivery-payment-location').value, methods:document.getElementById('delivery-disabled-methods').value, enabled:document.getElementById('delivery-payment-location-enabled').checked }).then(load);
    }
    if (target.dataset.holidayDelete) post({ action:'holiday_delete', id:target.dataset.holidayDelete }).then(load);
  });
  document.addEventListener('submit', function (event) {
    if (event.target.id !== 'holiday-form') return;
    event.preventDefault();
    var dateInput = document.getElementById('holiday-date');
    var holidayDate = dateInput ? String(dateInput.value || '').trim() : '';
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(holidayDate)) {
      showMessage('ابتدا یک تاریخ را از تقویم انتخاب کنید.', 'error');
      return;
    }
    var form = new FormData(event.target), body = { action:'holiday' }; form.forEach(function (value, key) { body[key] = value; });
    var formElement = event.target;
    var submitButton = formElement.querySelector('button[type="submit"], button:not([type])');
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'در حال ذخیره...'; }
    post(body).then(function (response) {
      if (!response.ok || !response.data || !response.data.success) {
        throw new Error(response.data && response.data.error || 'ذخیره تاریخ انجام نشد.');
      }
      formElement.reset();
      if (dateInput) dateInput.value = '';
      var grid = document.getElementById('jalali-grid');
      if (grid) grid.querySelectorAll('.selected').forEach(function (node) { node.classList.remove('selected'); });
      showMessage('تاریخ بدون پیک ذخیره شد.', 'success');
      return load();
    }).catch(function (error) {
      showMessage(error.message || 'ذخیره تاریخ انجام نشد.', 'error');
    }).finally(function () {
      if (submitButton) { submitButton.disabled = false; submitButton.textContent = '+ اضافه کردن تاریخ'; }
    });
  });
  window.loadDeliverySchedules = load;
  load();
})();
