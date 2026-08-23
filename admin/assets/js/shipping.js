// ============================================
// shipping.js - مدیریت کامل حمل‌ونقل Admin
// اتصال مستقیم به /api/admin/shipping
// ============================================

(function () {
  "use strict";

  var API_URL = "/api/admin/shipping";
  var initialized = false;
  var activeTab = "methods";

  var state = {
    methods: [],
    costs: [],
    thresholds: [],
    selectedProvince: "",
    selectedCity: "",
    loadedCosts: false
  };

  // ============================================
  // Helpers
  // ============================================

  function esc(value) {
    if (window.esc) {
      return window.esc(value == null ? "" : value);
    }

    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function money(value) {
    if (window.money) {
      return window.money(value);
    }

    var number = Number(value || 0);

    return new Intl.NumberFormat("fa-IR").format(number);
  }

  function showMessage(message, type) {
    if (typeof window.setAdminMessage === "function") {
      window.setAdminMessage(
        message || "",
        type || "info"
      );
      return;
    }

    if (message) {
      alert(message);
    }
  }

  async function api(url, options) {
    if (typeof window.api === "function") {
      return await window.api(url, options || {});
    }

    var response = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      ...(options || {})
    });

    var data = null;

    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data: data
    };
  }

  function getContainer(id) {
    return document.getElementById(id);
  }

  function getValue(container, selector) {
    var element = container
      ? container.querySelector(selector)
      : null;

    return element
      ? element.value
      : "";
  }

  function getChecked(container, selector) {
    var element = container
      ? container.querySelector(selector)
      : null;

    return !!(
      element &&
      element.checked
    );
  }

  // ============================================
  // GET METHODS
  // ============================================

  async function loadMethods() {
    var result = await api(
      API_URL + "?action=methods"
    );

    if (
      !result.ok ||
      !result.data ||
      !result.data.success
    ) {
      showMessage(
        result.data &&
        result.data.error
          ? result.data.error
          : "دریافت روش‌های حمل‌ونقل انجام نشد.",
        "error"
      );

      return [];
    }

    state.methods =
      Array.isArray(result.data.methods)
        ? result.data.methods
        : [];

    return state.methods;
  }

  // ============================================
  // GET FREE THRESHOLDS
  // ============================================

  async function loadFreeThresholds() {
    var result = await api(
      API_URL + "?action=free-thresholds"
    );

    if (
      !result.ok ||
      !result.data ||
      !result.data.success
    ) {
      showMessage(
        result.data &&
        result.data.error
          ? result.data.error
          : "دریافت تنظیمات ارسال رایگان انجام نشد.",
        "error"
      );

      return [];
    }

    state.thresholds =
      Array.isArray(result.data.thresholds)
        ? result.data.thresholds
        : [];

    return state.thresholds;
  }

  // ============================================
  // GET COSTS
  // ============================================

  async function loadCosts(
    province,
    city,
    silent
  ) {
    province = String(
      province || ""
    ).trim();

    city = String(
      city || ""
    ).trim();

    if (!province || !city) {
      if (!silent) {
        showMessage(
          "استان و شهر را وارد کن.",
          "error"
        );
      }

      return [];
    }

    state.selectedProvince =
      province;

    state.selectedCity =
      city;

    var url =
      API_URL +
      "?action=costs&province=" +
      encodeURIComponent(province) +
      "&city=" +
      encodeURIComponent(city);

    var result =
      await api(url);

    if (
      !result.ok ||
      !result.data ||
      !result.data.success
    ) {
      if (!silent) {
        showMessage(
          result.data &&
          result.data.error
            ? result.data.error
            : "دریافت هزینه‌های ارسال انجام نشد.",
          "error"
        );
      }

      state.costs = [];
      return [];
    }

    state.costs =
      Array.isArray(result.data.costs)
        ? result.data.costs
        : [];

    state.loadedCosts = true;

    return state.costs;
  }

  // ============================================
  // METHODS HTML
  // ============================================

  function methodsTable() {
    if (!state.methods.length) {
      return (
        '<div class="detail-card">' +
          "<p>هنوز روش حمل‌ونقلی ثبت نشده است.</p>" +
        "</div>"
      );
    }

    return (
      '<div class="table-wrap">' +
        '<table class="admin-table">' +

          "<thead>" +
            "<tr>" +
              "<th>شناسه</th>" +
              "<th>نام</th>" +
              "<th>Slug</th>" +
              "<th>زمان تحویل</th>" +
              "<th>هزینه پایه</th>" +
              "<th>وضعیت</th>" +
              "<th>ترتیب</th>" +
              "<th>اقدام</th>" +
            "</tr>" +
          "</thead>" +

          "<tbody>" +

            state.methods
              .map(function (method) {
                return (
                  "<tr>" +

                    '<td class="table-number">' +
                      esc(method.id) +
                    "</td>" +

                    "<td>" +
                      esc(method.name) +
                    "</td>" +

                    "<td>" +
                      esc(method.slug) +
                    "</td>" +

                    "<td>" +
                      esc(method.delivery_time || "-") +
                    "</td>" +

                    '<td class="table-number">' +
                      money(method.default_cost || 0) +
                      " تومان" +
                    "</td>" +

                    "<td>" +
                      (
                        Number(method.is_active) === 1
                          ? '<span class="status-badge status-badge--success">فعال</span>'
                          : '<span class="status-badge status-badge--danger">غیرفعال</span>'
                      ) +
                    "</td>" +

                    '<td class="table-number">' +
                      esc(method.sort_order || 0) +
                    "</td>" +

                    "<td>" +
                      '<div class="panel-actions" style="margin-top:0">' +

                        '<button ' +
                          'type="button" ' +
                          'class="btn btn-secondary" ' +
                          'data-shipping-edit-method="' +
                          esc(method.id) +
                          '">' +
                          "ویرایش" +
                        "</button>" +

                        '<button ' +
                          'type="button" ' +
                          'class="btn btn-secondary" ' +
                          'data-shipping-delete-method="' +
                          esc(method.id) +
                          '">' +
                          "حذف" +
                        "</button>" +

                      "</div>" +
                    "</td>" +

                  "</tr>"
                );
              })
              .join("") +

          "</tbody>" +

        "</table>" +
      "</div>"
    );
  }

  // ============================================
  // METHOD FORM
  // ============================================

  function methodForm(method) {
    method = method || {};

    var isEdit =
      !!method.id;

    return (
      '<div ' +
        'class="detail-card" ' +
        'data-shipping-method-form' +
        'style="margin-top:16px;">' +

        "<h4>" +
          (
            isEdit
              ? "ویرایش روش حمل‌ونقل"
              : "افزودن روش حمل‌ونقل"
          ) +
        "</h4>" +

        '<div class="filters-grid filters-grid-3">' +

          '<div class="form-field">' +
            "<label>نام روش *</label>" +
            '<input ' +
              'data-method-field="name" ' +
              'type="text" ' +
              'value="' +
              esc(method.name || "") +
              '" ' +
              'placeholder="مثلاً پست پیشتاز" />' +
          "</div>" +

          '<div class="form-field">' +
            "<label>Slug *</label>" +
            '<input ' +
              'data-method-field="slug" ' +
              'type="text" ' +
              'value="' +
              esc(method.slug || "") +
              '" ' +
              'placeholder="مثلاً post" />' +
          "</div>" +

          '<div class="form-field">' +
            "<label>زمان تحویل</label>" +
            '<input ' +
              'data-method-field="delivery_time" ' +
              'type="text" ' +
              'value="' +
              esc(method.delivery_time || "") +
              '" ' +
              'placeholder="مثلاً 2 تا 4 روز کاری" />' +
          "</div>" +

        "</div>" +

        '<div class="filters-grid filters-grid-3">' +

          '<div class="form-field">' +
            "<label>هزینه پایه</label>" +
            '<input ' +
              'data-method-field="default_cost" ' +
              'type="number" ' +
              'min="0" ' +
              'value="' +
              Number(method.default_cost || 0) +
              '" />' +
          "</div>" +

          '<div class="form-field">' +
            "<label>ترتیب نمایش</label>" +
            '<input ' +
              'data-method-field="sort_order" ' +
              'type="number" ' +
              'min="0" ' +
              'value="' +
              Number(method.sort_order || 0) +
              '" />' +
          "</div>" +

          '<div class="form-field">' +
            "<label>وضعیت</label>" +
            '<select data-method-field="is_active">' +
              '<option value="1" ' +
                (
                  Number(method.is_active) !== 0
                    ? "selected"
                    : ""
                ) +
              '>فعال</option>' +

              '<option value="0" ' +
                (
                  Number(method.is_active) === 0
                    ? "selected"
                    : ""
                ) +
              '>غیرفعال</option>' +

            "</select>" +
          "</div>" +

        "</div>" +

        '<div class="form-field">' +
          "<label>توضیحات</label>" +
          '<textarea ' +
            'data-method-field="description" ' +
            'rows="3" ' +
            'placeholder="توضیح کوتاه برای این روش">' +
              esc(method.description || "") +
          "</textarea>" +
        "</div>" +

        '<div class="panel-actions">' +

          '<button ' +
            'type="button" ' +
            'class="btn btn-primary" ' +
            'data-save-shipping-method' +
            (isEdit
              ? ' data-method-id="' +
                esc(method.id) +
                '"'
              : "") +
          ">" +
            (
              isEdit
                ? "ذخیره تغییرات"
                : "ایجاد روش"
            ) +
          "</button>" +

          '<button ' +
            'type="button" ' +
            'class="btn btn-secondary" ' +
            'data-close-shipping-method-form>' +
            "بستن" +
          "</button>" +

        "</div>" +

      "</div>"
    );
  }

  // ============================================
  // RENDER METHODS
  // ============================================

  async function renderMethods(
    container
  ) {
    if (!container) {
      return;
    }

    container.innerHTML =
      '<div class="admin-loading">در حال بارگذاری روش‌های حمل‌ونقل...</div>';

    await loadMethods();

    container.innerHTML =
      '<div class="products-toolbar">' +
        "<div>" +
          "<h4 style=\"margin:0;color:var(--primary);\">" +
            "روش‌های حمل‌ونقل" +
          "</h4>" +
          '<p class="admin-help">' +
            "روش‌های فعال ارسال و هزینه پایه آن‌ها را مدیریت کن." +
          "</p>" +
        "</div>" +

        '<button ' +
          'type="button" ' +
          'class="btn btn-primary" ' +
          'data-shipping-create-method>' +
          "افزودن روش حمل‌ونقل" +
        "</button>" +

      "</div>" +

      '<div id="shipping-method-form-holder"></div>' +

      methodsTable();

    container._shippingMethodsLoaded =
      true;
  }

  // ============================================
  // RENDER COSTS
  // ============================================

  async function renderCosts(
    container
  ) {
    if (!container) {
      return;
    }

    await loadMethods();

    container.innerHTML =
      '<div class="products-toolbar">' +
        "<div>" +
          "<h4 style=\"margin:0;color:var(--primary);\">" +
            "هزینه ارسال" +
          "</h4>" +
          '<p class="admin-help">' +
            "هزینه ارسال یک استان و شهر را بر اساس روش حمل‌ونقل مدیریت کن." +
          "</p>" +
        "</div>" +
      "</div>" +

      '<div class="filters-grid filters-grid-3">' +

        '<div class="form-field">' +
          "<label>استان</label>" +
          '<input ' +
            'id="shipping-cost-province" ' +
            'type="text" ' +
            'value="' +
            esc(state.selectedProvince) +
            '" ' +
            'placeholder="مثلاً تهران" />' +
        "</div>" +

        '<div class="form-field">' +
          "<label>شهر</label>" +
          '<input ' +
            'id="shipping-cost-city" ' +
            'type="text" ' +
            'value="' +
            esc(state.selectedCity) +
            '" ' +
            'placeholder="مثلاً تهران" />' +
        "</div>" +

        '<div class="form-field" style="justify-content:flex-end;">' +
          '<label style="opacity:0;">اقدام</label>' +

          '<button ' +
            'type="button" ' +
            'class="btn btn-primary" ' +
            'data-shipping-load-costs>' +
            "بارگذاری هزینه‌ها" +
          "</button>" +

        "</div>" +

      "</div>" +

      '<div id="shipping-cost-form-holder"></div>' +

      '<div id="shipping-cost-results">' +
        (
          state.loadedCosts
            ? costsTable()
            : '<div class="wallet-empty">استان و شهر را وارد کن و روی «بارگذاری هزینه‌ها» بزن.</div>'
        ) +
      "</div>";
  }

  // ============================================
  // COST TABLE
  // ============================================

  function costsTable() {
    if (!state.costs.length) {
      return (
        '<div class="detail-card">' +
          "<p>" +
            "برای این شهر هنوز هزینه‌ای ثبت نشده است." +
          "</p>" +
        "</div>"
      );
    }

    return (
      '<div class="table-wrap">' +

        '<table class="admin-table">' +

          "<thead>" +
            "<tr>" +
              "<th>روش</th>" +
              "<th>نوع هزینه</th>" +
              "<th>هزینه پایه</th>" +
              "<th>هزینه مازاد</th>" +
              "<th>هزینه نهایی</th>" +
              "<th>زمان تحویل</th>" +
              "<th>وضعیت</th>" +
              "<th>اقدام</th>" +
            "</tr>" +
          "</thead>" +

          "<tbody>" +

            state.costs.map(function (cost) {

              return (
                "<tr>" +

                  "<td>" +
                    esc(cost.method_name || "-") +
                  "</td>" +

                  "<td>" +
                    esc(cost.cost_type || "-") +
                  "</td>" +

                  '<td class="table-number">' +
                    money(cost.default_cost || 0) +
                    " تومان" +
                  "</td>" +

                  '<td class="table-number">' +
                    money(cost.extra_cost || 0) +
                    " تومان" +
                  "</td>" +

                  '<td class="table-number">' +
                    money(cost.cost_amount || 0) +
                    " تومان" +
                  "</td>" +

                  "<td>" +
                    esc(cost.delivery_time || "-") +
                  "</td>" +

                  "<td>" +
                    (
                      Number(cost.is_active) === 1
                        ? '<span class="status-badge status-badge--success">فعال</span>'
                        : '<span class="status-badge status-badge--danger">غیرفعال</span>'
                    ) +
                  "</td>" +

                  "<td>" +
                    '<button ' +
                      'type="button" ' +
                      'class="btn btn-secondary" ' +
                      'data-shipping-delete-cost="' +
                      esc(cost.id) +
                    '">' +
                      "حذف" +
                    "</button>" +
                  "</td>" +

                "</tr>"
              );
            }).join("") +

          "</tbody>" +

        "</table>" +

      "</div>"
    );
  }

  // ============================================
  // COST FORM
  // ============================================

  function costForm() {
    var province =
      state.selectedProvince;

    var city =
      state.selectedCity;

    var options =
      state.methods
        .map(function (method) {

          return (
            '<option value="' +
            esc(method.id) +
            '">' +
            esc(method.name) +
            " — پایه: " +
            money(
              method.default_cost || 0
            ) +
            " تومان" +
            "</option>"
          );
        })
        .join("");

    return (
      '<div ' +
        'class="detail-card" ' +
        'data-shipping-cost-form>' +

        "<h4>ثبت / ویرایش هزینه ارسال</h4>" +

        '<div class="filters-grid filters-grid-3">' +

          '<div class="form-field">' +
            "<label>استان</label>" +
            '<input data-cost-field="province" type="text" value="' +
            esc(province) +
            '" />' +
          "</div>" +

          '<div class="form-field">' +
            "<label>شهر</label>" +
            '<input data-cost-field="city" type="text" value="' +
            esc(city) +
            '" />' +
          "</div>" +

          '<div class="form-field">' +
            "<label>روش حمل‌ونقل *</label>" +
            '<select data-cost-field="shipping_method_id">' +
              '<option value="">انتخاب کنید</option>' +
              options +
            "</select>" +
          "</div>" +

        "</div>" +

        '<div class="filters-grid filters-grid-3">' +

          '<div class="form-field">' +
            "<label>نوع هزینه</label>" +
            '<select data-cost-field="cost_type">' +
              '<option value="fixed">ثابت</option>' +
              '<option value="extra">مازاد</option>' +
            "</select>" +
          "</div>" +

          '<div class="form-field">' +
            "<label>هزینه مازاد</label>" +
            '<input ' +
              'data-cost-field="extra_cost" ' +
              'type="number" ' +
              'min="0" ' +
              'value="0" />' +
          "</div>" +

          '<div class="form-field">' +
            "<label>زمان تحویل</label>" +
            '<input ' +
              'data-cost-field="delivery_time" ' +
              'type="text" ' +
              'placeholder="مثلاً 2 تا 4 روز" />' +
          "</div>" +

        "</div>" +

        '<div class="form-field">' +
          "<label>" +
            '<input ' +
              'data-cost-field="is_active" ' +
              'type="checkbox" ' +
              'checked /> ' +
            "فعال باشد" +
          "</label>" +
        "</div>" +

        '<div class="admin-help">' +
          "هزینه نهایی از هزینه پایه روش + هزینه مازاد محاسبه می‌شود." +
        "</div>" +

        '<div class="panel-actions">' +

          '<button ' +
            'type="button" ' +
            'class="btn btn-primary" ' +
            'data-save-shipping-cost>' +
            "ذخیره هزینه" +
          "</button>" +

          '<button ' +
            'type="button" ' +
            'class="btn btn-secondary" ' +
            'data-close-shipping-cost-form>' +
            "بستن" +
          "</button>" +

        "</div>" +

      "</div>"
    );
  }

  // ============================================
  // RENDER FREE
  // ============================================

  async function renderFree(
    container
  ) {
    if (!container) {
      return;
    }

    await Promise.all([
      loadMethods(),
      loadFreeThresholds()
    ]);

    container.innerHTML =
      '<div class="products-toolbar">' +
        "<div>" +
          "<h4 style=\"margin:0;color:var(--primary);\">" +
            "ارسال رایگان" +
          "</h4>" +
          '<p class="admin-help">' +
            "حداقل مبلغ سفارش برای فعال شدن ارسال رایگان هر روش را تعیین کن." +
          "</p>" +
        "</div>" +
      "</div>" +

      '<div id="shipping-free-form-holder"></div>' +

      freeTable();
  }

  // ============================================
  // FREE TABLE
  // ============================================

  function freeTable() {
    return (
      '<div class="table-wrap">' +

        '<table class="admin-table">' +

          "<thead>" +
            "<tr>" +
              "<th>روش حمل‌ونقل</th>" +
              "<th>حداقل مبلغ سفارش</th>" +
              "<th>وضعیت</th>" +
              "<th>آخرین بروزرسانی</th>" +
              "<th>اقدام</th>" +
            "</tr>" +
          "</thead>" +

          "<tbody>" +

            (
              state.methods.length
                ? state.methods.map(function(method) {

                    var threshold =
                      state.thresholds.find(
                        function(item) {
                          return Number(
                            item.shipping_method_id
                          ) === Number(
                            method.id
                          );
                        }
                      );

                    return (
                      "<tr>" +

                        "<td>" +
                          esc(method.name) +
                        "</td>" +

                        '<td class="table-number">' +
                          money(
                            threshold
                              ? threshold.min_order_amount
                              : 0
                          ) +
                          " تومان" +
                        "</td>" +

                        "<td>" +
                          (
                            threshold &&
                            Number(
                              threshold.is_active
                            ) === 1

                              ? '<span class="status-badge status-badge--success">فعال</span>'

                              : '<span class="status-badge status-badge--danger">غیرفعال</span>'
                          ) +
                        "</td>" +

                        "<td>" +
                          (
                            threshold
                              ? esc(
                                  threshold.updated_at ||
                                  threshold.created_at ||
                                  "-"
                                )
                              : "-"
                          ) +
                        "</td>" +

                        "<td>" +

                          '<button ' +
                            'type="button" ' +
                            'class="btn btn-secondary" ' +
                            'data-shipping-edit-free="' +
                            esc(method.id) +
                            '">' +
                            "تنظیم" +
                          "</button>" +

                        "</td>" +

                      "</tr>"
                    );
                  }).join("")

                : (
                    '<tr>' +
                      '<td colspan="5">' +
                        "ابتدا حداقل یک روش حمل‌ونقل فعال ایجاد کن." +
                      "</td>" +
                    "</tr>"
                  )
            ) +

          "</tbody>" +

        "</table>" +

      "</div>"
    );
  }

  // ============================================
  // FREE FORM
  // ============================================

  function freeForm(methodId) {
    var method =
      state.methods.find(
        function(item) {
          return Number(item.id) === Number(methodId);
        }
      );

    if (!method) {
      return;
    }

    var threshold =
      state.thresholds.find(
        function(item) {
          return Number(
            item.shipping_method_id
          ) === Number(method.id);
        }
      );

    var holder =
      getContainer(
        "shipping-tab-free"
      );

    if (!holder) {
      return;
    }

    var formHolder =
      holder.querySelector(
        "#shipping-free-form-holder"
      );

    if (!formHolder) {
      return;
    }

    formHolder.innerHTML =
      '<div class="detail-card" data-shipping-free-form>' +

        "<h4>" +
          "تنظیم ارسال رایگان — " +
          esc(method.name) +
        "</h4>" +

        '<div class="filters-grid filters-grid-2">' +

          '<div class="form-field">' +
            "<label>حداقل مبلغ سفارش *</label>" +
            '<input ' +
              'data-free-field="min_order_amount" ' +
              'type="number" ' +
              'min="1" ' +
              'value="' +
              Number(
                threshold
                  ? threshold.min_order_amount
                  : 0
              ) +
              '" />' +
          "</div>" +

          '<div class="form-field">' +
            "<label>وضعیت</label>" +
            '<select data-free-field="is_active">' +

              '<option value="1" ' +
                (
                  threshold &&
                  Number(
                    threshold.is_active
                  ) === 1
                    ? "selected"
                    : ""
                ) +
              '>فعال</option>' +

              '<option value="0" ' +
                (
                  !threshold ||
                  Number(
                    threshold.is_active
                  ) === 0
                    ? "selected"
                    : ""
                ) +
              '>غیرفعال</option>' +

            "</select>" +
          "</div>" +

        "</div>" +

        '<div class="panel-actions">' +

          '<button ' +
            'type="button" ' +
            'class="btn btn-primary" ' +
            'data-save-shipping-free="' +
            esc(method.id) +
            '">' +
            "ذخیره تنظیمات" +
          "</button>" +

          '<button ' +
            'type="button" ' +
            'class="btn btn-secondary" ' +
            'data-close-shipping-free-form>' +
            "بستن" +
          "</button>" +

        "</div>" +

      "</div>";

    formHolder.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // ============================================
  // CREATE METHOD
  // ============================================

  function openMethodCreate() {
    var container =
      getContainer(
        "shipping-tab-methods"
      );

    if (!container) {
      return;
    }

    var holder =
      container.querySelector(
        "#shipping-method-form-holder"
      );

    if (!holder) {
      return;
    }

    holder.innerHTML =
      methodForm({});

    holder.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // ============================================
  // EDIT METHOD
  // ============================================

  function openMethodEdit(
    methodId
  ) {
    var method =
      state.methods.find(
        function(item) {
          return Number(item.id) === Number(methodId);
        }
      );

    if (!method) {
      showMessage(
        "روش حمل‌ونقل پیدا نشد.",
        "error"
      );

      return;
    }

    var container =
      getContainer(
        "shipping-tab-methods"
      );

    if (!container) {
      return;
    }

    var holder =
      container.querySelector(
        "#shipping-method-form-holder"
      );

    if (!holder) {
      return;
    }

    holder.innerHTML =
      methodForm(method);

    holder.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // ============================================
  // SAVE METHOD
  // ============================================

  async function saveMethod(
    form
  ) {
    if (!form) {
      return;
    }

    var id =
      form.getAttribute(
        "data-method-id"
      );

    var payload = {
      action:
        id
          ? "update_method"
          : "create_method",

      id:
        id
          ? Number(id)
          : undefined,

      name:
        getValue(
          form,
          '[data-method-field="name"]'
        ).trim(),

      slug:
        getValue(
          form,
          '[data-method-field="slug"]'
        ).trim(),

      description:
        getValue(
          form,
          '[data-method-field="description"]'
        ).trim(),

      delivery_time:
        getValue(
          form,
          '[data-method-field="delivery_time"]'
        ).trim(),

      default_cost:
        Number(
          getValue(
            form,
            '[data-method-field="default_cost"]'
          ) || 0
        ),

      sort_order:
        Number(
          getValue(
            form,
            '[data-method-field="sort_order"]'
          ) || 0
        ),

      is_active:
        getValue(
          form,
          '[data-method-field="is_active"]'
        ) === "1"
    };

    if (!payload.name) {
      showMessage(
        "نام روش حمل‌ونقل الزامی است.",
        "error"
      );
      return;
    }

    if (!payload.slug) {
      showMessage(
        "Slug روش حمل‌ونقل الزامی است.",
        "error"
      );
      return;
    }

    var result =
      await api(
        API_URL,
        {
          method: "POST",
          body: JSON.stringify(
            payload
          )
        }
      );

    if (
      !result.ok ||
      !result.data ||
      !result.data.success
    ) {
      showMessage(
        result.data &&
        result.data.error
          ? result.data.error
          : "ذخیره روش حمل‌ونقل انجام نشد.",
        "error"
      );

      return;
    }

    showMessage(
      result.data.message ||
      "روش حمل‌ونقل ذخیره شد.",
      "success"
    );

    var container =
      getContainer(
        "shipping-tab-methods"
      );

    await renderMethods(
      container
    );
  }

  // ============================================
  // DELETE METHOD
  // ============================================

  async function deleteMethod(
    methodId
  ) {
    if (!methodId) {
      return;
    }

    var method =
      state.methods.find(
        function(item) {
          return Number(item.id) === Number(methodId);
        }
      );

    var methodName =
      method
        ? method.name
        : "#" + methodId;

    if (
      !window.confirm(
        "آیا از حذف روش «" +
        methodName +
        "» مطمئن هستی؟"
      )
    ) {
      return;
    }

    if (
      !window.confirm(
        "حذف این روش ممکن است روی هزینه‌های ارسال مرتبط اثر بگذارد. ادامه می‌دهی؟"
      )
    ) {
      return;
    }

    var result =
      await api(
        API_URL,
        {
          method: "POST",
          body: JSON.stringify({
            action:
              "delete_method",

            id:
              Number(methodId)
          })
        }
      );

    if (
      !result.ok ||
      !result.data ||
      !result.data.success
    ) {
      showMessage(
        result.data &&
        result.data.error
          ? result.data.error
          : "حذف روش انجام نشد.",
        "error"
      );

      return;
    }

    showMessage(
      result.data.message ||
      "روش حمل‌ونقل حذف شد.",
      "success"
    );

    var container =
      getContainer(
        "shipping-tab-methods"
      );

    await renderMethods(
      container
    );
  }

  // ============================================
  // OPEN COST FORM
  // ============================================

  function openCostForm() {
    var container =
      getContainer(
        "shipping-tab-costs"
      );

    if (!container) {
      return;
    }

    var holder =
      container.querySelector(
        "#shipping-cost-form-holder"
      );

    if (!holder) {
      return;
    }

    holder.innerHTML =
      costForm();

    holder.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // ============================================
  // SAVE COST
  // ============================================

  async function saveCost(
    form
  ) {
    if (!form) {
      return;
    }

    var province =
      getValue(
        form,
        '[data-cost-field="province"]'
      ).trim();

    var city =
      getValue(
        form,
        '[data-cost-field="city"]'
      ).trim();

    var shippingMethodId =
      Number(
        getValue(
          form,
          '[data-cost-field="shipping_method_id"]'
        ) || 0
      );

    var costType =
      getValue(
        form,
        '[data-cost-field="cost_type"]'
      ) || "fixed";

    var extraCost =
      Number(
        getValue(
          form,
          '[data-cost-field="extra_cost"]'
        ) || 0
      );

    var deliveryTime =
      getValue(
        form,
        '[data-cost-field="delivery_time"]'
      ).trim();

    var isActive =
      getChecked(
        form,
        '[data-cost-field="is_active"]'
      );

    if (!province || !city) {
      showMessage(
        "استان و شهر الزامی هستند.",
        "error"
      );
      return;
    }

    if (!shippingMethodId) {
      showMessage(
        "روش حمل‌ونقل را انتخاب کن.",
        "error"
      );
      return;
    }

    var result =
      await api(
        API_URL,
        {
          method: "POST",
          body: JSON.stringify({
            action:
              "save_cost",

            province:
              province,

            city:
              city,

            shipping_method_id:
              shippingMethodId,

            cost_type:
              costType,

            cost_amount:
              0,

            extra_cost:
              extraCost,

            delivery_time:
              deliveryTime,

            is_active:
              isActive
          })
        }
      );

    if (
      !result.ok ||
      !result.data ||
      !result.data.success
    ) {
      showMessage(
        result.data &&
        result.data.error
          ? result.data.error
          : "ذخیره هزینه ارسال انجام نشد.",
        "error"
      );

      return;
    }

    state.selectedProvince =
      province;

    state.selectedCity =
      city;

    await loadCosts(
      province,
      city,
      true
    );

    showMessage(
      (
        result.data.message ||
        "هزینه ارسال ذخیره شد."
      ) +
      " هزینه نهایی: " +
      money(
        result.data.final_cost || 0
      ) +
      " تومان",
      "success"
    );

    var container =
      getContainer(
        "shipping-tab-costs"
      );

    await renderCosts(
      container
    );
  }

  // ============================================
  // DELETE COST
  // ============================================

  async function deleteCost(
    costId
  ) {
    if (!costId) {
      return;
    }

    if (
      !window.confirm(
        "آیا از حذف این هزینه ارسال مطمئن هستی؟"
      )
    ) {
      return;
    }

    var result =
      await api(
        API_URL,
        {
          method: "POST",
          body: JSON.stringify({
            action:
              "delete_cost",

            cost_id:
              Number(costId)
          })
        }
      );

    if (
      !result.ok ||
      !result.data ||
      !result.data.success
    ) {
      showMessage(
        result.data &&
        result.data.error
          ? result.data.error
          : "حذف هزینه ارسال انجام نشد.",
        "error"
      );

      return;
    }

    showMessage(
      result.data.message ||
      "هزینه ارسال حذف شد.",
      "success"
    );

    var container =
      getContainer(
        "shipping-tab-costs"
      );

    await loadCosts(
      state.selectedProvince,
      state.selectedCity,
      true
    );

    await renderCosts(
      container
    );
  }

  // ============================================
  // SAVE FREE THRESHOLD
  // ============================================

  async function saveFreeThreshold(
    form,
    methodId
  ) {
    if (!form || !methodId) {
      return;
    }

    var minOrderAmount =
      Number(
        getValue(
          form,
          '[data-free-field="min_order_amount"]'
        ) || 0
      );

    var isActive =
      getValue(
        form,
        '[data-free-field="is_active"]'
      ) === "1";

    if (
      !minOrderAmount ||
      minOrderAmount <= 0
    ) {
      showMessage(
        "حداقل مبلغ سفارش باید بیشتر از صفر باشد.",
        "error"
      );
      return;
    }

    var result =
      await api(
        API_URL,
        {
          method: "POST",
          body: JSON.stringify({
            action:
              "save_free_threshold",

            shipping_method_id:
              Number(methodId),

            min_order_amount:
              minOrderAmount,

            is_active:
              isActive
          })
        }
      );

    if (
      !result.ok ||
      !result.data ||
      !result.data.success
    ) {
      showMessage(
        result.data &&
        result.data.error
          ? result.data.error
          : "ذخیره تنظیمات ارسال رایگان انجام نشد.",
        "error"
      );

      return;
    }

    showMessage(
      result.data.message ||
      "تنظیمات ارسال رایگان ذخیره شد.",
      "success"
    );

    var container =
      getContainer(
        "shipping-tab-free"
      );

    await renderFree(
      container
    );
  }

  // ============================================
  // ADD CITY
  // ============================================

  async function addCity(
    province,
    city
  ) {
    province =
      String(
        province || ""
      ).trim();

    city =
      String(
        city || ""
      ).trim();

    if (!province || !city) {
      showMessage(
        "استان و شهر را وارد کن.",
        "error"
      );
      return;
    }

    var result =
      await api(
        API_URL,
        {
          method: "POST",
          body: JSON.stringify({
            action:
              "add_city",

            province:
              province,

            city:
              city
          })
        }
      );

    if (
      !result.ok ||
      !result.data ||
      !result.data.success
    ) {
      showMessage(
        result.data &&
        result.data.error
          ? result.data.error
          : "افزودن شهر انجام نشد.",
        "error"
      );
      return;
    }

    showMessage(
      result.data.message ||
      "شهر اضافه شد.",
      "success"
    );

    state.selectedProvince =
      province;

    state.selectedCity =
      city;

    var container =
      getContainer(
        "shipping-tab-costs"
      );

    await loadCosts(
      province,
      city,
      true
    );

    await renderCosts(
      container
    );
  }

  // ============================================
  // DELETE CITY
  // ============================================

  async function deleteCity(
    province,
    city
  ) {
    province =
      String(
        province || ""
      ).trim();

    city =
      String(
        city || ""
      ).trim();

    if (!province || !city) {
      return;
    }

    if (
      !window.confirm(
        "تمام هزینه‌های ثبت‌شده برای شهر «" +
        city +
        "» حذف می‌شود. ادامه می‌دهی؟"
      )
    ) {
      return;
    }

    var result =
      await api(
        API_URL,
        {
          method: "POST",
          body: JSON.stringify({
            action:
              "delete_city",

            province:
              province,

            city:
              city
          })
        }
      );

    if (
      !result.ok ||
      !result.data ||
      !result.data.success
    ) {
      showMessage(
        result.data &&
        result.data.error
          ? result.data.error
          : "حذف شهر انجام نشد.",
        "error"
      );

      return;
    }

    showMessage(
      result.data.message ||
      "شهر حذف شد.",
      "success"
    );

    state.costs = [];

    var container =
      getContainer(
        "shipping-tab-costs"
      );

    await renderCosts(
      container
    );
  }

  // ============================================
  // TAB SWITCHING
  // ============================================

  function setActiveTab(
    target
  ) {
    target =
      target || "methods";

    activeTab =
      target;

    var tabs =
      document.querySelectorAll(
        "[data-shipping-tab]"
      );

    tabs.forEach(
      function(tab) {
        tab.classList.toggle(
          "is-active",
          tab.dataset.shippingTab ===
          target
        );
      }
    );

    var contentMap = {
      methods:
        "shipping-tab-methods",

      costs:
        "shipping-tab-costs",

      free:
        "shipping-tab-free"
    };

    Object.keys(contentMap)
      .forEach(
        function(key) {
          var element =
            getContainer(
              contentMap[key]
            );

          if (element) {
            element.classList.toggle(
              "is-active",
              key === target
            );
          }
        }
      );
  }

  // ============================================
  // EVENT DELEGATION
  // ============================================

  function setupEvents() {
    if (
      document.documentElement
        .dataset
        .shippingEventsBound ===
      "1"
    ) {
      return;
    }

    document.documentElement
      .dataset
      .shippingEventsBound =
      "1";

    document.addEventListener(
      "click",
      async function(event) {
        var target =
          event.target;

        // ======================================
        // SHIPPING TABS
        // ======================================

        var tab =
          target.closest(
            "[data-shipping-tab]"
          );

        if (tab) {
          event.preventDefault();

          var targetTab =
            tab.dataset.shippingTab;

          setActiveTab(
            targetTab
          );

          if (
            targetTab ===
            "methods"
          ) {
            var methodsContainer =
              getContainer(
                "shipping-tab-methods"
              );

            await renderMethods(
              methodsContainer
            );

          } else if (
            targetTab ===
            "costs"
          ) {
            var costsContainer =
              getContainer(
                "shipping-tab-costs"
              );

            await renderCosts(
              costsContainer
            );

          } else if (
            targetTab ===
            "free"
          ) {
            var freeContainer =
              getContainer(
                "shipping-tab-free"
              );

            await renderFree(
              freeContainer
            );
          }

          return;
        }

        // ======================================
        // CREATE METHOD
        // ======================================

        if (
          target.closest(
            "[data-shipping-create-method]"
          )
        ) {
          event.preventDefault();

          openMethodCreate();

          return;
        }

        // ======================================
        // EDIT METHOD
        // ======================================

        var editMethodButton =
          target.closest(
            "[data-shipping-edit-method]"
          );

        if (editMethodButton) {
          event.preventDefault();

          await openMethodEdit(
            editMethodButton.getAttribute(
              "data-shipping-edit-method"
            )
          );

          return;
        }

        // ======================================
        // DELETE METHOD
        // ======================================

        var deleteMethodButton =
          target.closest(
            "[data-shipping-delete-method]"
          );

        if (deleteMethodButton) {
          event.preventDefault();

          await deleteMethod(
            deleteMethodButton.getAttribute(
              "data-shipping-delete-method"
            )
          );

          return;
        }

        // ======================================
        // SAVE METHOD
        // ======================================

        var saveMethodButton =
          target.closest(
            "[data-save-shipping-method]"
          );

        if (saveMethodButton) {
          event.preventDefault();

          var methodFormElement =
            saveMethodButton.closest(
              "[data-shipping-method-form]"
            );

          if (methodFormElement) {
            methodFormElement.setAttribute(
              "data-method-id",
              saveMethodButton.getAttribute(
                "data-method-id"
              ) || ""
            );

            await saveMethod(
              methodFormElement
            );
          }

          return;
        }

        // ======================================
        // CLOSE METHOD FORM
        // ======================================

        if (
          target.closest(
            "[data-close-shipping-method-form]"
          )
        ) {
          event.preventDefault();

          var methodHolder =
            getContainer(
              "shipping-method-form-holder"
            );

          if (methodHolder) {
            methodHolder.innerHTML =
              "";
          }

          return;
        }

        // ======================================
        // LOAD COSTS
        // ======================================

        if (
          target.closest(
            "[data-shipping-load-costs]"
          )
        ) {
          event.preventDefault();

          var provinceInput =
            getContainer(
              "shipping-cost-province"
            );

          var cityInput =
            getContainer(
              "shipping-cost-city"
            );

          var province =
            provinceInput
              ? provinceInput.value.trim()
              : "";

          var city =
            cityInput
              ? cityInput.value.trim()
              : "";

          await loadCosts(
            province,
            city
          );

          var costsContainer =
            getContainer(
              "shipping-tab-costs"
            );

          await renderCosts(
            costsContainer
          );

          return;
        }

        // ======================================
        // OPEN COST FORM
        // ======================================

        if (
          target.closest(
            "[data-shipping-create-cost]"
          )
        ) {
          event.preventDefault();

          openCostForm();

          return;
        }

        // ======================================
        // SAVE COST
        // ======================================

        if (
          target.closest(
            "[data-save-shipping-cost]"
          )
        ) {
          event.preventDefault();

          var costFormElement =
            target.closest(
              "[data-shipping-cost-form]"
            );

          if (costFormElement) {
            await saveCost(
              costFormElement
            );
          }

          return;
        }

        // ======================================
        // CLOSE COST FORM
        // ======================================

        if (
          target.closest(
            "[data-close-shipping-cost-form]"
          )
        ) {
          event.preventDefault();

          var costHolder =
            getContainer(
              "shipping-cost-form-holder"
            );

          if (costHolder) {
            costHolder.innerHTML =
              "";
          }

          return;
        }

        // ======================================
        // DELETE COST
        // ======================================

        var deleteCostButton =
          target.closest(
            "[data-shipping-delete-cost]"
          );

        if (deleteCostButton) {
          event.preventDefault();

          await deleteCost(
            deleteCostButton.getAttribute(
              "data-shipping-delete-cost"
            )
          );

          return;
        }

        // ======================================
        // ADD CITY
        // ======================================

        if (
          target.closest(
            "[data-shipping-add-city]"
          )
        ) {
          event.preventDefault();

          var addCityButton =
            target.closest(
              "[data-shipping-add-city]"
            );

          var province =
            addCityButton.getAttribute(
              "data-province"
            );

          var city =
            addCityButton.getAttribute(
              "data-city"
            );

          await addCity(
            province,
            city
          );

          return;
        }

        // ======================================
        // DELETE CITY
        // ======================================

        if (
          target.closest(
            "[data-shipping-delete-city]"
          )
        ) {
          event.preventDefault();

          var deleteCityButton =
            target.closest(
              "[data-shipping-delete-city]"
            );

          await deleteCity(
            deleteCityButton.getAttribute(
              "data-province"
            ),
            deleteCityButton.getAttribute(
              "data-city"
            )
          );

          return;
        }

        // ======================================
        // OPEN FREE FORM
        // ======================================

        var editFreeButton =
          target.closest(
            "[data-shipping-edit-free]"
          );

        if (editFreeButton) {
          event.preventDefault();

          freeForm(
            editFreeButton.getAttribute(
              "data-shipping-edit-free"
            )
          );

          return;
        }

        // ======================================
        // SAVE FREE
        // ======================================

        var saveFreeButton =
          target.closest(
            "[data-save-shipping-free]"
          );

        if (saveFreeButton) {
          event.preventDefault();

          var freeFormElement =
            target.closest(
              "[data-shipping-free-form]"
            );

          if (freeFormElement) {
            await saveFreeThreshold(
              freeFormElement,
              saveFreeButton.getAttribute(
                "data-save-shipping-free"
              )
            );
          }

          return;
        }

        // ======================================
        // CLOSE FREE
        // ======================================

        if (
          target.closest(
            "[data-close-shipping-free-form]"
          )
        ) {
          event.preventDefault();

          var freeHolder =
            getContainer(
              "shipping-free-form-holder"
            );

          if (freeHolder) {
            freeHolder.innerHTML =
              "";
          }

          return;
        }
      }
    );
  }

  // ============================================
  // INITIALIZE
  // ============================================

  async function init() {
    if (initialized) {
      setActiveTab(
        activeTab
      );
      return;
    }

    initialized = true;

    setupEvents();

    setActiveTab(
      activeTab
    );

    var methodsContainer =
      getContainer(
        "shipping-tab-methods"
      );

    if (methodsContainer) {
      await renderMethods(
        methodsContainer
      );
    }

    console.log(
      "✅ Shipping Admin initialized"
    );
  }

  // ============================================
  // PUBLIC API
  // ============================================

  window.ShippingAdmin = {
    init:
      init,

    renderMethods:
      renderMethods,

    renderCosts:
      renderCosts,

    renderFree:
      renderFree,

    loadMethods:
      loadMethods,

    loadCosts:
      loadCosts,

    loadFreeThresholds:
      loadFreeThresholds
  };

  window.setupShippingTabs =
    function () {
      init();
    };

  window.renderMethodsContent =
    function () {
      var container =
        getContainer(
          "shipping-tab-methods"
        );

      return renderMethods(
        container
      );
    };

  window.renderCostsContent =
    function () {
      var container =
        getContainer(
          "shipping-tab-costs"
        );

      return renderCosts(
        container
      );
    };

  window.renderFreeContent =
    function () {
      var container =
        getContainer(
          "shipping-tab-free"
        );

      return renderFree(
        container
      );
    };

  console.log(
    "✅ Shipping module loaded successfully"
  );

})();