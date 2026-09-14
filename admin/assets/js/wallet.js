(function () {
  'use strict';

  var currentWalletPayload = null;
  var userSearchSequence = 0;

  function el(id) { return document.getElementById(id); }
  function esc(v) { return window.esc ? window.esc(v) : String(v ?? ''); }
  function money(v) { return window.money ? window.money(v || 0) : String(Number(v || 0)); }

  async function searchWalletUsers() {
    var seq = ++userSearchSequence;
    var select = el('wallet-user-id');
    var status = el('wallet-search-status');
    if (!select || !status) return;
    status.textContent = 'در حال دریافت کاربران…';
    try {
      var q = el('wallet-user-search')?.value.trim() || '';
      var r = await window.api('/api/v1/admin/wallet?view=users&limit=200&search=' + encodeURIComponent(q));
      if (seq !== userSearchSequence) return;
      if (!r.ok || !r.data?.success) throw new Error(r.data?.error || 'دریافت کاربران انجام نشد.');
      var selected = select.value;
      select.replaceChildren(new Option('یک کاربر انتخاب کنید', ''));
      (r.data.users || []).forEach(function (u) {
        select.add(new Option([u.full_name, u.email, u.phone, 'ID: ' + u.id].filter(Boolean).join(' — '), String(u.id)));
      });
      select.value = selected;
      status.textContent = (r.data.users || []).length ? 'کاربر موردنظر را انتخاب کنید.' : 'کاربری پیدا نشد.';
    } catch (e) {
      if (seq === userSearchSequence) status.textContent = e.message || 'ارتباط برقرار نشد.';
    }
  }

  function getWalletSummary(txs) {
    var s = { total_credit: 0, total_debit: 0, credit_count: 0, debit_count: 0 };
    (txs || []).forEach(function (tx) {
      var type = String(tx.type || '').toLowerCase();
      var amount = Number(tx.amount || 0);
      if (type === 'debit' || amount < 0) {
        s.total_debit += Math.abs(amount); s.debit_count += 1;
      } else {
        s.total_credit += Math.abs(amount); s.credit_count += 1;
      }
    });
    return s;
  }

  function renderWalletHero(user, txs) {
    var box = el('wallet-hero-card');
    if (!box) return;
    var last = txs?.[0];
    box.innerHTML =
      '<div class="wallet-hero-top"><div><div class="wallet-hero-kicker">کیف پول کاربر</div>' +
      '<h3 style="margin:14px 0 0;font-size:1.2rem;">' + esc(user.full_name || 'کاربر بدون نام') + '</h3>' +
      '<p style="margin:8px 0 0;color:rgba(255,255,255,.78);line-height:1.9;">' + esc(user.email || '-') + '</p></div>' +
      '<div>' + (window.badge ? window.badge(user.role || 'user') : esc(user.role || 'user')) + '</div></div>' +
      '<div class="wallet-balance"><span>موجودی کل</span><strong>' + money(user.wallet_balance) + ' تومان</strong></div>' +
      '<div class="wallet-meta-line">' +
      '<div class="wallet-meta-pill">موجودی دائمی: ' + money(user.permanent_balance) + ' تومان</div>' +
      '<div class="wallet-meta-pill">کش‌بک فعال: ' + money(user.cashback_balance) + ' تومان</div>' +
      '<div class="wallet-meta-pill">شناسه: ' + esc(user.id) + '</div>' +
      '<div class="wallet-meta-pill">آخرین تراکنش: ' + (last && window.formatDate ? window.formatDate(last.created_at) : '-') + '</div></div>';
  }

  function renderWalletSummary(user, txs) {
    var box = el('wallet-summary-cards');
    if (!box) return;
    var s = getWalletSummary(txs);
    box.innerHTML =
      '<div class="wallet-mini-card"><span>موجودی دائمی</span><strong>' + money(user.permanent_balance) + ' تومان</strong><small>بدون انقضا</small></div>' +
      '<div class="wallet-mini-card"><span>کش‌بک فعال</span><strong>' + money(user.cashback_balance) + ' تومان</strong><small>اول مصرف می‌شود</small></div>' +
      '<div class="wallet-mini-card"><span>جمع واریزی‌ها</span><strong>' + money(s.total_credit) + ' تومان</strong><small>' + money(s.credit_count) + ' تراکنش</small></div>' +
      '<div class="wallet-mini-card"><span>جمع برداشت‌ها</span><strong>' + money(s.total_debit) + ' تومان</strong><small>' + money(s.debit_count) + ' تراکنش</small></div>';
  }

  function renderWalletUser(user) {
    var box = el('wallet-user-box');
    if (!box) return;
    box.innerHTML =
      '<div class="wallet-user-head"><div><h4 class="wallet-user-name">' + esc(user.full_name || '-') + '</h4><p class="wallet-user-email">' + esc(user.email || '-') + '</p></div>' +
      '<div>' + (window.badge ? window.badge(user.role || 'user') : esc(user.role || 'user')) + '</div></div>' +
      '<div class="wallet-user-list">' +
      '<div class="wallet-user-row"><span>شناسه کاربر</span><strong>' + esc(user.id) + '</strong></div>' +
      '<div class="wallet-user-row"><span>شماره تماس</span><strong>' + esc(user.phone || '-') + '</strong></div>' +
      '<div class="wallet-user-row"><span>موجودی کل</span><strong>' + money(user.wallet_balance) + ' تومان</strong></div>' +
      '<div class="wallet-user-row"><span>موجودی دائمی</span><strong>' + money(user.permanent_balance) + ' تومان</strong></div>' +
      '<div class="wallet-user-row"><span>کش‌بک فعال</span><strong>' + money(user.cashback_balance) + ' تومان</strong></div>' +
      '</div>';
  }

  function renderWalletAdjust() {
    var box = el('wallet-adjust-box');
    if (!box) return;
    box.innerHTML =
      '<div class="wallet-card-head"><div><h4>ثبت عملیات کیف پول</h4><p>واریز، برداشت، کش‌بک، بازگشت وجه یا تعدیل.</p></div></div>' +
      '<div class="filters-grid filters-grid-3">' +
      '<div class="form-field"><label>نوع عملیات</label><select id="wallet-type"><option value="credit">واریز</option><option value="debit">برداشت</option><option value="cashback">کش‌بک</option><option value="refund">بازگشت وجه</option><option value="adjustment">تعدیل</option></select></div>' +
      '<div class="form-field"><label>مبلغ</label><input id="wallet-amount" type="number" min="1" /></div>' +
      '<div class="form-field"><label>شناسه مرجع</label><input id="wallet-reference-id" type="text" /></div></div>' +
      '<div class="filters-grid filters-grid-2">' +
      '<div class="form-field"><label>منبع ثبت</label><select id="wallet-reference-type"><option value="admin">ادمین</option><option value="order">سفارش</option><option value="cashback">کش‌بک</option><option value="refund">بازگشت وجه</option></select></div>' +
      '<div class="form-field"><label>یادداشت</label><input id="wallet-note" type="text" /></div></div>' +
      '<div class="wallet-inline-actions"><button class="btn btn-primary" id="wallet-save-btn" type="button">ثبت عملیات</button><button class="btn btn-secondary" id="wallet-refresh-btn" type="button">به‌روزرسانی</button></div>';
  }

  function renderWalletSettings(s) {
    var box = el('wallet-settings-box');
    if (!box) return;
    s = s || {};
    var statuses = Array.isArray(s.cashback_statuses) ? s.cashback_statuses : ['completed'];
    var ids = Array.isArray(s.cashback_selected_user_ids) ? s.cashback_selected_user_ids.join(', ') : (s.cashback_selected_user_ids || '');
    var mode = s.cashback_eligibility_mode || 'all';
    var enabled = s.cashback_enabled !== false;

    box.innerHTML =
      '<div class="wallet-card-head"><div><h4>تنظیمات کش‌بک</h4><p>درصد، حداقل سفارش، سقف، کاربران مجاز و تاریخ انقضا را مدیریت کن.</p></div></div>' +
      '<div class="filters-grid filters-grid-3">' +
      '<div class="form-field"><label>وضعیت</label><select id="cashback-enabled"><option value="1"' + (enabled ? ' selected' : '') + '>فعال</option><option value="0"' + (!enabled ? ' selected' : '') + '>غیرفعال</option></select></div>' +
      '<div class="form-field"><label>درصد کش‌بک</label><input id="cashback-percent" type="number" min="0" max="100" step="0.01" value="' + esc(s.cashback_percent ?? 0) + '" /></div>' +
      '<div class="form-field"><label>انقضا (ماه)</label><input id="cashback-expiry-months" type="number" min="0" max="12" value="' + esc(s.cashback_expiry_months ?? 6) + '" /><small>۰ = بدون انقضا</small></div></div>' +
      '<div class="filters-grid filters-grid-2">' +
      '<div class="form-field"><label>حداقل مبلغ سفارش</label><input id="cashback-min-order" type="number" min="0" value="' + esc(s.cashback_min_order_amount ?? 0) + '" /></div>' +
      '<div class="form-field"><label>حداکثر کش‌بک هر سفارش</label><input id="cashback-max-order" type="number" min="0" value="' + esc(s.cashback_max_per_order ?? 0) + '" /><small>۰ = بدون سقف</small></div></div>' +
      '<div class="filters-grid filters-grid-2">' +
      '<div class="form-field"><label>کاربران مجاز</label><select id="cashback-eligibility-mode"><option value="all"' + (mode === 'all' ? ' selected' : '') + '>همه کاربران</option><option value="vip"' + (mode === 'vip' ? ' selected' : '') + '>فقط VIP</option><option value="selected"' + (mode === 'selected' ? ' selected' : '') + '>فقط کاربران انتخاب‌شده</option></select></div>' +
      '<div class="form-field"><label>شناسه کاربران انتخاب‌شده</label><input id="cashback-selected-users" type="text" value="' + esc(ids) + '" placeholder="12, 35, 81" /></div></div>' +
      '<div class="form-field"><label>وضعیت‌های مجاز سفارش</label><input id="cashback-statuses" type="text" value="' + esc(statuses.join(', ')) + '" /></div>' +
      '<div class="wallet-inline-actions"><button class="btn btn-primary" id="wallet-save-settings-btn" type="button">ذخیره تنظیمات کش‌بک</button></div>';
  }

  function renderWalletHistory(txs) {
    var box = el('wallet-history-box');
    if (!box) return;
    txs = txs || [];
    var typeFilter = el('wallet-quick-type')?.value || '';
    var q = el('wallet-history-search')?.value?.trim().toLowerCase() || '';
    var filtered = txs.filter(function (tx) {
      if (typeFilter && String(tx.type || '').toLowerCase() !== typeFilter) return false;
      if (!q) return true;
      return String(tx.note || '').toLowerCase().includes(q) || String(tx.type || '').toLowerCase().includes(q);
    });

    box.innerHTML = '<div class="wallet-card-head"><div><h4>تاریخچه تراکنش‌ها</h4><p>مانده کش‌بک و تاریخ انقضا نیز نمایش داده می‌شود.</p></div></div>' +
      '<div class="wallet-history-tools"><div class="form-field"><label>جستجو</label><input id="wallet-history-search" type="text" value="' + esc(q) + '" /></div></div>' +
      '<div class="table-wrap"><table class="admin-table"><thead><tr><th>شناسه</th><th>نوع</th><th>مبلغ</th><th>بعد</th><th>مانده کش‌بک</th><th>انقضا</th><th>وضعیت</th><th>یادداشت</th><th>تاریخ</th></tr></thead><tbody>' +
      (filtered.length ? filtered.map(function (tx) {
        return '<tr><td>' + esc(tx.id) + '</td><td>' + (window.walletTypeChip ? window.walletTypeChip(tx.type) : esc(tx.type)) + '</td><td>' + money(tx.amount) + '</td><td>' + money(tx.balance_after) + '</td><td>' + (String(tx.type || '').toLowerCase() === 'cashback' ? money(tx.remaining_amount) : '-') + '</td><td>' + (tx.expires_at && window.formatDate ? window.formatDate(tx.expires_at) : '-') + '</td><td>' + (window.badge ? window.badge(tx.status) : esc(tx.status)) + '</td><td>' + esc(tx.note || '-') + '</td><td>' + (window.formatDate ? window.formatDate(tx.created_at) : esc(tx.created_at || '-')) + '</td></tr>';
      }).join('') : '<tr><td colspan="9">تراکنشی ثبت نشده است.</td></tr>') + '</tbody></table></div>';
  }

  async function loadWalletUser() {
    var userId = Number(el('wallet-user-id')?.value || 0);
    var limit = Number(el('wallet-limit')?.value || 50);
    if (!userId) return window.setAdminMessage('یک کاربر از فهرست انتخاب کن.');

    var r = await window.api('/api/admin/wallet?user_id=' + encodeURIComponent(userId) + '&limit=' + encodeURIComponent(limit));
    if (!r.ok || !r.data?.success) return window.setAdminMessage(r.data?.error || 'دریافت کیف پول انجام نشد.');

    currentWalletPayload = r.data;
    el('wallet-empty-state')?.classList.add('admin-hidden');
    el('wallet-content')?.classList.remove('admin-hidden');
    renderWalletHero(r.data.user || {}, r.data.transactions || []);
    renderWalletSummary(r.data.user || {}, r.data.transactions || []);
    renderWalletUser(r.data.user || {});
    renderWalletAdjust();
    renderWalletHistory(r.data.transactions || []);
  }

  async function saveWalletTransaction(userId) {
    var amount = Number(el('wallet-amount')?.value || 0);
    if (!amount || amount <= 0) return window.setAdminMessage('مبلغ معتبر وارد کن.');
    var r = await window.api('/api/admin/wallet', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        type: el('wallet-type')?.value || 'credit',
        amount: amount,
        note: el('wallet-note')?.value?.trim() || '',
        reference_type: el('wallet-reference-type')?.value || 'admin',
        reference_id: el('wallet-reference-id')?.value?.trim() || ''
      })
    });
    if (!r.ok || !r.data?.success) return window.setAdminMessage(r.data?.error || 'ثبت عملیات انجام نشد.');
    window.setAdminMessage('عملیات کیف پول با موفقیت ثبت شد.', 'success');
    await loadWalletUser();
  }

  async function saveWalletSettings() {
    var statuses = (el('cashback-statuses')?.value || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    var r = await window.api('/api/admin/wallet', {
      method: 'POST',
      body: JSON.stringify({
        action: 'save_settings',
        cashback_enabled: el('cashback-enabled')?.value !== '0',
        cashback_percent: Number(el('cashback-percent')?.value || 0),
        cashback_statuses: statuses,
        cashback_min_order_amount: Number(el('cashback-min-order')?.value || 0),
        cashback_max_per_order: Number(el('cashback-max-order')?.value || 0),
        cashback_eligibility_mode: el('cashback-eligibility-mode')?.value || 'all',
        cashback_selected_user_ids: el('cashback-selected-users')?.value || '',
        cashback_expiry_months: Number(el('cashback-expiry-months')?.value || 0)
      })
    });
    if (!r.ok || !r.data?.success) return window.setAdminMessage(r.data?.error || 'ذخیره تنظیمات کش‌بک انجام نشد.');
    window.setAdminMessage('تنظیمات کش‌بک با موفقیت ذخیره شد.', 'success');
    renderWalletSettings(r.data.settings || {});
  }

  function handleClick(event) {
    var t = event.target;
    var section = t.closest('[data-wallet-section]');
    if (section) {
      var cashback = section.dataset.walletSection === 'cashback';
      el('wallet-management-panel')?.classList.toggle('admin-hidden', cashback);
      el('wallet-cashback-panel')?.classList.toggle('admin-hidden', !cashback);
      document.querySelectorAll('[data-wallet-section]').forEach(function (b) {
        var active = b === section;
        b.setAttribute('aria-pressed', String(active));
        b.classList.toggle('btn-primary', active);
        b.classList.toggle('btn-secondary', !active);
      });
      if (cashback && !el('cashback-percent')) {
        var status = el('wallet-cashback-status');
        if (status) status.textContent = 'در حال دریافت تنظیمات…';
        window.api('/api/v1/admin/wallet?limit=1').then(function (r) {
          if (!r.ok || !r.data?.success) throw new Error(r.data?.error || 'دریافت تنظیمات انجام نشد.');
          renderWalletSettings(r.data.settings || {});
          if (status) status.textContent = '';
        }).catch(function (e) { if (status) status.textContent = e.message; });
      }
      return;
    }
    if (t.closest('#wallet-search-btn')) { event.preventDefault(); return void searchWalletUsers(); }
    if (t.closest('#wallet-load-btn')) { event.preventDefault(); return void loadWalletUser(); }
    if (t.closest('#wallet-refresh-btn')) { event.preventDefault(); return void loadWalletUser(); }
    if (t.closest('#wallet-save-settings-btn')) { event.preventDefault(); return void saveWalletSettings(); }
    if (t.closest('#wallet-save-btn')) {
      event.preventDefault();
      var id = Number(el('wallet-user-id')?.value || 0);
      if (!id) return window.setAdminMessage('ابتدا کاربر را انتخاب کن.');
      return void saveWalletTransaction(id);
    }
  }

  function handleInput(event) {
    if (event.target.id === 'wallet-history-search' && currentWalletPayload?.transactions) {
      clearTimeout(event.target._walletTimer);
      event.target._walletTimer = setTimeout(function () { renderWalletHistory(currentWalletPayload.transactions); }, 250);
    }
  }

  function handleChange(event) {
    if (event.target.id === 'wallet-quick-type' && currentWalletPayload?.transactions) renderWalletHistory(currentWalletPayload.transactions);
  }

  document.removeEventListener('click', handleClick);
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);

  window.loadWalletUser = loadWalletUser;
  window.getWalletSummary = getWalletSummary;
  window.renderWalletHero = renderWalletHero;
  window.renderWalletSummary = renderWalletSummary;
  window.renderWalletUser = renderWalletUser;
  window.renderWalletAdjust = renderWalletAdjust;
  window.renderWalletSettings = renderWalletSettings;
  window.renderWalletHistory = renderWalletHistory;
  window.saveWalletTransaction = saveWalletTransaction;
  window.saveWalletSettings = saveWalletSettings;
  window.setupWalletEvents = function () {};
})();
