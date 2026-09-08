// ============================================
// users.js - مدیریت کاربران
// ============================================

(function () {
  "use strict";

  var currentUsers = [];

  // ============================================
  // تبدیل نقش کاربر به عنوان فارسی
  // ============================================

  function getRoleLabel(role) {
    var normalizedRole = String(
      role || ""
    )
      .trim()
      .toLowerCase();

    var roles = {
      user: "مشتری",
      admin: "ادمین",
      super_admin: "مدیر کل"
    };

    return roles[normalizedRole] || "نامشخص";
  }

  // ============================================
  // نمایش Badge نقش کاربر
  // ============================================

  function getRoleBadge(role) {
    var normalizedRole = String(
      role || ""
    )
      .trim()
      .toLowerCase();

    var label = getRoleLabel(
      normalizedRole
    );

    var className = "status-badge";

    if (normalizedRole === "user") {
      className += " status-badge--user";
    } else if (normalizedRole === "admin") {
      className += " status-badge--admin";
    } else if (
      normalizedRole === "super_admin"
    ) {
      className +=
        " status-badge--super-admin";
    } else {
      className +=
        " status-badge--warning";
    }

    return (
      '<span class="' +
      className +
      '">' +
      window.esc(label) +
      "</span>"
    );
  }

  // ============================================
  // دریافت عناصر صفحه کاربران
  // ============================================

  function getUserElements() {
    return {
      toggleInput: document.getElementById(
        "registration-toggle-input"
      ),

      toggleStatus: document.getElementById(
        "registration-toggle-status"
      ),

      userCreateBox: document.getElementById(
        "user-create-box"
      ),

      userEditBox: document.getElementById(
        "user-edit-box"
      ),

      usersBody: document.getElementById(
        "users-body"
      )
    };
  }

  // ============================================
  // نمایش پیام مدیریت
  // ============================================

  function showMessage(message, type) {
    if (typeof window.setAdminMessage === "function") {
      window.setAdminMessage(
        message,
        type || "error"
      );
    } else {
      alert(message);
    }
  }

  // ============================================
  // بارگذاری لیست کاربران
  // ============================================

  async function loadUsers() {
    var elements = getUserElements();
    var tbody = elements.usersBody;

    if (!tbody) {
      return;
    }

    var search =
      document.getElementById("users-search")
        ?.value
        ?.trim() || "";

    var role =
      document.getElementById("users-role")
        ?.value
        ?.trim() || "";

    var params = new URLSearchParams();

    if (search) {
      params.set("search", search);
    }

    if (role) {
      params.set("role", role);
    }

    var query = params.toString();

    try {
      var result = await window.api(
        "/api/admin/users" +
        (query ? "?" + query : "")
      );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        tbody.innerHTML =
          '<tr><td colspan="8">دریافت کاربران انجام نشد.</td></tr>';

        currentUsers = [];
        return;
      }

      var users =
        result.data.users || [];

      currentUsers = users;

      tbody.innerHTML =
        users.map(function (user) {
          return (
            "<tr>" +

            '<td class="table-number">' +
            window.esc(user.id) +
            "</td>" +

            "<td>" +
            window.esc(
              user.full_name || "-"
            ) +
            "</td>" +

            "<td>" +
            window.esc(
              user.email || "-"
            ) +
            "</td>" +

            "<td>" +
            window.esc(
              user.phone || "-"
            ) +
            "</td>" +

            "<td>" +
            getRoleBadge(user.role) +
            "</td>" +

            '<td class="table-number">' +
            window.money(
              user.wallet_balance || 0
            ) +
            "</td>" +

            '<td class="table-number">' +
            window.esc(
              user.orders_count || 0
            ) +
            "</td>" +

            "<td>" +
            '<div class="panel-actions" style="margin-top:0;">' +

            '<button class="btn btn-secondary" ' +
            'type="button" ' +
            'data-action="edit-user" ' +
            'data-user-id="' +
            window.esc(user.id) +
            '">' +
            "ویرایش" +
            "</button>" +

            '<button class="btn btn-secondary" ' +
            'type="button" ' +
            'data-action="delete-user" ' +
            'data-user-id="' +
            window.esc(user.id) +
            '">' +
            "حذف" +
            "</button>" +

            "</div>" +
            "</td>" +

            "</tr>"
          );
        }).join("") ||
        '<tr><td colspan="8">کاربری پیدا نشد.</td></tr>';

    } catch (_) {
      tbody.innerHTML =
        '<tr><td colspan="8">خطا در ارتباط با سرور.</td></tr>';

      currentUsers = [];
    }
  }

  // ============================================
  // بستن فرم افزودن کاربر
  // ============================================

  function closeUserCreateBox() {
    var elements = getUserElements();
    var box = elements.userCreateBox;

    if (!box) {
      return;
    }

    box.classList.add("admin-hidden");
    box.innerHTML = "";
  }

  // ============================================
  // بستن فرم ویرایش کاربر
  // ============================================

  function closeUserEditBox() {
    var elements = getUserElements();
    var box = elements.userEditBox;

    if (!box) {
      return;
    }

    box.classList.add("admin-hidden");
    box.innerHTML = "";
  }

  // ============================================
  // باز کردن فرم افزودن کاربر
  // ============================================

  function openUserCreate() {
    var elements = getUserElements();
    var box = elements.userCreateBox;

    closeUserEditBox();

    if (!box) {
      return;
    }

    box.classList.remove("admin-hidden");

    box.innerHTML =
      "<h4>افزودن کاربر جدید</h4>" +

      '<div class="filters-grid">' +

      '<div class="form-field">' +
      '<label for="create-user-full-name">نام</label>' +
      '<input id="create-user-full-name" type="text" placeholder="نام و نام خانوادگی" />' +
      "</div>" +

      '<div class="form-field">' +
      '<label for="create-user-email">ایمیل</label>' +
      '<input id="create-user-email" type="email" placeholder="example@mail.com" />' +
      "</div>" +

      '<div class="form-field">' +
      '<label for="create-user-phone">شماره</label>' +
      '<input id="create-user-phone" type="text" placeholder="0912..." />' +
      "</div>" +

      '<div class="form-field">' +
      '<label for="create-user-role">نقش</label>' +
      '<select id="create-user-role">' +
      '<option value="user">مشتری</option>' +
      '<option value="admin">ادمین</option>' +
      '<option value="super_admin">مدیر کل</option>' +
      "</select>" +
      "</div>" +

      '<div class="form-field">' +
      '<label for="create-user-password">رمز عبور</label>' +
      '<input id="create-user-password" type="password" placeholder="حداقل 8 کاراکتر" />' +
      "</div>" +

      '<div class="form-field">' +
      '<label for="create-user-password-confirm">تکرار رمز عبور</label>' +
      '<input id="create-user-password-confirm" type="password" placeholder="تکرار رمز عبور" />' +
      "</div>" +

      "</div>" +

      '<p class="admin-help">' +
      "برای ساخت کاربر جدید، اطلاعات ضروری را کامل کن." +
      "</p>" +

      '<div class="panel-actions">' +

      '<button class="btn btn-primary" type="button" id="create-user-btn">' +
      "ایجاد کاربر" +
      "</button>" +

      '<button class="btn btn-secondary" type="button" id="cancel-create-user-btn">' +
      "بستن" +
      "</button>" +

      "</div>";

    var createButton =
      document.getElementById(
        "create-user-btn"
      );

    var cancelButton =
      document.getElementById(
        "cancel-create-user-btn"
      );

    if (createButton) {
      createButton.addEventListener(
        "click",
        async function () {
          var payload = {
            full_name:
              document.getElementById(
                "create-user-full-name"
              ).value.trim(),

            email:
              document.getElementById(
                "create-user-email"
              ).value.trim(),

            phone:
              document.getElementById(
                "create-user-phone"
              ).value.trim(),

            role:
              document.getElementById(
                "create-user-role"
              ).value.trim(),

            password:
              document.getElementById(
                "create-user-password"
              ).value,

            password_confirm:
              document.getElementById(
                "create-user-password-confirm"
              ).value
          };

          if (
            !payload.full_name ||
            !payload.email ||
            !payload.role ||
            !payload.password ||
            !payload.password_confirm
          ) {
            showMessage(
              "برای ایجاد کاربر، همه فیلدهای ضروری را کامل کن."
            );
            return;
          }

          if (
            payload.password.length < 8
          ) {
            showMessage(
              "رمز عبور باید حداقل 8 کاراکتر باشد."
            );
            return;
          }

          if (
            payload.password !==
            payload.password_confirm
          ) {
            showMessage(
              "رمز عبور و تکرار آن یکسان نیست."
            );
            return;
          }

          try {
            var result =
              await window.api(
                "/api/admin/users",
                {
                  method: "POST",
                  body: JSON.stringify(
                    payload
                  )
                }
              );

            if (
              !result.ok ||
              !result.data?.success
            ) {
              showMessage(
                result.data?.error ||
                "ایجاد کاربر انجام نشد."
              );
              return;
            }

            showMessage(
              "کاربر جدید با موفقیت ایجاد شد.",
              "success"
            );

            closeUserCreateBox();
            await loadUsers();

            if (
              typeof window.loadDashboard ===
              "function"
            ) {
              await window.loadDashboard();
            }

          } catch (_) {
            showMessage(
              "خطا در ارتباط با سرور."
            );
          }
        }
      );
    }

    if (cancelButton) {
      cancelButton.addEventListener(
        "click",
        closeUserCreateBox
      );
    }
  }

  // ============================================
  // باز کردن فرم ویرایش کاربر
  // ============================================

  async function openUserEdit(userId) {
    var elements = getUserElements();
    var box = elements.userEditBox;

    closeUserCreateBox();

    if (!box) {
      return;
    }

    if (
      currentUsers.length === 0
    ) {
      await loadUsers();
    }

    var user =
      currentUsers.find(
        function (item) {
          return (
            Number(item.id) ===
            Number(userId)
          );
        }
      );

    if (!user) {
      showMessage(
        "کاربر یافت نشد. لطفاً صفحه را به‌روزرسانی کنید."
      );
      return;
    }

    box.classList.remove(
      "admin-hidden"
    );

    box.innerHTML =
      "<h4>ویرایش کاربر #" +
      window.esc(user.id) +
      "</h4>" +

      '<div class="filters-grid">' +

      '<div class="form-field">' +
      '<label for="edit-user-full-name">نام</label>' +
      '<input id="edit-user-full-name" type="text" value="' +
      window.esc(user.full_name || "") +
      '" />' +
      "</div>" +

      '<div class="form-field">' +
      '<label for="edit-user-email">ایمیل</label>' +
      '<input id="edit-user-email" type="email" value="' +
      window.esc(user.email || "") +
      '" />' +
      "</div>" +

      '<div class="form-field">' +
      '<label for="edit-user-phone">شماره</label>' +
      '<input id="edit-user-phone" type="text" value="' +
      window.esc(user.phone || "") +
      '" />' +
      "</div>" +

      '<div class="form-field">' +
      '<label for="edit-user-role">نقش</label>' +
      '<select id="edit-user-role">' +
      '<option value="user">مشتری</option>' +
      '<option value="admin">ادمین</option>' +
      '<option value="super_admin">مدیر کل</option>' +
      "</select>" +
      "</div>" +

      '<div class="form-field">' +
      '<label for="edit-user-password">رمز عبور جدید</label>' +
      '<input id="edit-user-password" type="password" placeholder="اختیاری" />' +
      "</div>" +

      '<div class="form-field">' +
      '<label for="edit-user-password-confirm">تکرار رمز عبور</label>' +
      '<input id="edit-user-password-confirm" type="password" placeholder="تکرار رمز عبور" />' +
      "</div>" +

      "</div>" +

      '<div class="panel-actions">' +

      '<button class="btn btn-primary" type="button" id="save-user-btn">' +
      "ذخیره اطلاعات" +
      "</button>" +

      '<button class="btn btn-secondary" type="button" id="save-user-password-btn">' +
      "ذخیره رمز عبور" +
      "</button>" +

      '<button class="btn btn-secondary" type="button" id="delete-user-btn">' +
      "حذف کاربر" +
      "</button>" +

      '<button class="btn btn-secondary" type="button" id="close-user-edit-btn">' +
      "بستن" +
      "</button>" +

      "</div>";

    var roleSelect =
      document.getElementById(
        "edit-user-role"
      );

    if (roleSelect) {
      roleSelect.value =
        String(user.role || "user")
          .trim()
          .toLowerCase();

      if (!roleSelect.value) {
        roleSelect.value = "user";
      }
    }

    var saveButton =
      document.getElementById(
        "save-user-btn"
      );

    if (saveButton) {
      saveButton.addEventListener(
        "click",
        async function () {
          var payload = {
            user_id: user.id,

            full_name:
              document.getElementById(
                "edit-user-full-name"
              ).value.trim(),

            email:
              document.getElementById(
                "edit-user-email"
              ).value.trim(),

            phone:
              document.getElementById(
                "edit-user-phone"
              ).value.trim(),

            role:
              document.getElementById(
                "edit-user-role"
              ).value.trim()
          };

          try {
            var result =
              await window.api(
                "/api/admin/users",
                {
                  method: "POST",
                  body: JSON.stringify(
                    payload
                  )
                }
              );

            if (
              !result.ok ||
              !result.data?.success
            ) {
              showMessage(
                result.data?.error ||
                "ذخیره اطلاعات کاربر انجام نشد."
              );
              return;
            }

            showMessage(
              "اطلاعات کاربر با موفقیت ذخیره شد.",
              "success"
            );

            closeUserEditBox();
            await loadUsers();

            if (
              typeof window.loadDashboard ===
              "function"
            ) {
              await window.loadDashboard();
            }

          } catch (_) {
            showMessage(
              "خطا در ارتباط با سرور."
            );
          }
        }
      );
    }

    var passwordButton =
      document.getElementById(
        "save-user-password-btn"
      );

    if (passwordButton) {
      passwordButton.addEventListener(
        "click",
        async function () {
          var password =
            document.getElementById(
              "edit-user-password"
            ).value;

          var passwordConfirm =
            document.getElementById(
              "edit-user-password-confirm"
            ).value;

          if (
            !password ||
            !passwordConfirm
          ) {
            showMessage(
              "رمز عبور و تکرار آن را وارد کن."
            );
            return;
          }

          if (
            password.length < 8
          ) {
            showMessage(
              "رمز عبور باید حداقل 8 کاراکتر باشد."
            );
            return;
          }

          if (
            password !== passwordConfirm
          ) {
            showMessage(
              "رمز عبور و تکرار آن یکسان نیست."
            );
            return;
          }

          try {
            var result =
              await window.api(
                "/api/admin/users/password",
                {
                  method: "POST",
                  body: JSON.stringify({
                    user_id: user.id,
                    password: password,
                    password_confirm:
                      passwordConfirm
                  })
                }
              );

            if (
              !result.ok ||
              !result.data?.success
            ) {
              showMessage(
                result.data?.error ||
                "ذخیره رمز عبور انجام نشد."
              );
              return;
            }

            showMessage(
              "رمز عبور کاربر با موفقیت به‌روزرسانی شد.",
              "success"
            );

            closeUserEditBox();

          } catch (_) {
            showMessage(
              "خطا در ارتباط با سرور."
            );
          }
        }
      );
    }

    var deleteButton =
      document.getElementById(
        "delete-user-btn"
      );

    if (deleteButton) {
      deleteButton.addEventListener(
        "click",
        async function () {
          await deleteUser(user.id);
        }
      );
    }

    var closeButton =
      document.getElementById(
        "close-user-edit-btn"
      );

    if (closeButton) {
      closeButton.addEventListener(
        "click",
        closeUserEditBox
      );
    }
  }

  // ============================================
  // حذف کاربر
  // ============================================

  async function deleteUser(userId) {
    var userIdNum =
      Number(userId || 0);

    if (!userIdNum) {
      showMessage(
        "شناسه کاربر معتبر نیست."
      );
      return false;
    }

    var user =
      currentUsers.find(
        function (item) {
          return (
            Number(item.id) ===
            userIdNum
          );
        }
      );

    var userName =
      user?.full_name ||
      "#" + userIdNum;

    if (
      !window.confirm(
        "آیا از حذف کاربر " +
        userName +
        " مطمئن هستی؟"
      )
    ) {
      return false;
    }

    if (
      !window.confirm(
        "این عملیات قابل بازگشت نیست و اطلاعات وابسته کاربر هم حذف می‌شود. حذف انجام شود؟"
      )
    ) {
      return false;
    }

    try {
      var result =
        await window.api(
          "/api/admin/users",
          {
            method: "DELETE",
            body: JSON.stringify({
              user_id: userIdNum
            })
          }
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        showMessage(
          result.data?.error ||
          "حذف کاربر انجام نشد."
        );

        return false;
      }

      showMessage(
        "کاربر با موفقیت حذف شد.",
        "success"
      );

      closeUserEditBox();
      closeUserCreateBox();

      await loadUsers();

      if (
        typeof window.loadDashboard ===
        "function"
      ) {
        await window.loadDashboard();
      }

      return true;

    } catch (_) {
      showMessage(
        "خطا در ارتباط با سرور."
      );

      return false;
    }
  }

  // ============================================
  // ایجاد بخش کد عبور داخل صفحه کاربران
  // ============================================

  function ensureAccessCodeControls() {
    var existing =
      document.getElementById(
        "site-access-code-settings"
      );

    if (existing) {
      return existing;
    }

    var elements = getUserElements();

    var anchor =
      elements.toggleInput;

    if (!anchor) {
      return null;
    }

    var container =
      anchor.closest(
        ".settings-card, .panel-card, .admin-card, .panel-section"
      ) ||
      anchor.parentElement?.parentElement ||
      anchor.parentElement;

    if (!container) {
      return null;
    }

    var box =
      document.createElement("div");

    box.id =
      "site-access-code-settings";

    box.style.marginTop =
      "20px";

    box.style.paddingTop =
      "20px";

    box.style.borderTop =
      "1px solid var(--border, #e5e7eb)";

    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;">' +

      "<div>" +
      '<h4 style="margin:0 0 6px;">کد عبور سایت</h4>' +

      '<p class="admin-help" style="margin:0;">' +
      "با فعال کردن این گزینه، کاربران برای ورود و ثبت‌نام باید علاوه بر اطلاعات حساب خود، کد عبور سایت را نیز وارد کنند." +
      "</p>" +

      "</div>" +

      '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;">' +
      '<span id="site-access-code-status" class="toggle-status is-disabled">غیرفعال</span>' +
      '<input id="site-access-code-enabled" type="checkbox" />' +
      "</label>" +

      "</div>" +

      '<div class="filters-grid">' +
      '<div class="form-field">' +
      '<label for="site-access-code-value">کد عبور سایت</label>' +

      '<input id="site-access-code-value" type="password" ' +
      'autocomplete="new-password" ' +
      'placeholder="کد عبور مورد نظر را وارد کن" />' +

      '<p class="admin-help" style="margin:8px 0 0;">' +
      "برای تغییر کد، کد جدید را وارد و ذخیره کن. برای غیرفعال کردن الزام کد، Toggle را خاموش کن." +
      "</p>" +

      "</div>" +
      "</div>" +

      '<div class="panel-actions">' +
      '<button class="btn btn-primary" type="button" id="save-site-access-code-btn">' +
      "ذخیره تنظیمات کد عبور" +
      "</button>" +
      "</div>";

    container.appendChild(box);

    return box;
  }

  // ============================================
  // بروزرسانی وضعیت کد عبور
  // ============================================

  function updateAccessCodeStatus(enabled) {
    var input =
      document.getElementById(
        "site-access-code-enabled"
      );

    var status =
      document.getElementById(
        "site-access-code-status"
      );

    if (input) {
      input.checked =
        Boolean(enabled);
    }

    if (!status) {
      return;
    }

    if (enabled) {
      status.textContent =
        "فعال";

      status.className =
        "toggle-status";
    } else {
      status.textContent =
        "غیرفعال";

      status.className =
        "toggle-status is-disabled";
    }
  }

  // ============================================
  // بارگذاری تنظیمات ثبت‌نام و کد عبور
  // ============================================

  async function loadRegistrationSetting() {
    ensureAccessCodeControls();

    try {
      var result =
        await window.api(
          "/api/admin/settings",
          {
            method: "GET"
          }
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        return;
      }

      var settings =
        result.data.settings || {};

      var registrationEnabled =
        String(
          settings.allow_public_registration ??
          "true"
        ).toLowerCase() ===
        "true";

      var elements =
        getUserElements();

      if (
        elements.toggleInput
      ) {
        elements.toggleInput.checked =
          !registrationEnabled;
      }

      updateToggleStatus(
        !registrationEnabled
      );

      var accessCodeEnabled =
        String(
          settings.site_access_code_enabled ??
          "false"
        ).toLowerCase() ===
        "true";

      updateAccessCodeStatus(
        accessCodeEnabled
      );

    } catch (_) {}
  }

  // ============================================
  // ذخیره تنظیمات ثبت‌نام عمومی
  // ============================================

  async function saveRegistrationSetting(
    disabled
  ) {
    var value =
      disabled
        ? "false"
        : "true";

    try {
      var result =
        await window.api(
          "/api/admin/settings",
          {
            method: "POST",
            body: JSON.stringify({
              allow_public_registration:
                value
            })
          }
        );

      if (
        result.ok &&
        result.data?.success
      ) {
        showMessage(
          "تنظیمات ثبت‌نام با موفقیت ذخیره شد.",
          "success"
        );

        updateToggleStatus(
          disabled
        );

        return true;
      }

      showMessage(
        result.data?.error ||
        "ذخیره تنظیمات انجام نشد."
      );

      return false;

    } catch (_) {
      showMessage(
        "خطا در ارتباط با سرور."
      );

      return false;
    }
  }

  // ============================================
  // ذخیره تنظیمات کد عبور سایت
  // ============================================

  async function saveSiteAccessCodeSetting() {
    var enabledInput =
      document.getElementById(
        "site-access-code-enabled"
      );

    var codeInput =
      document.getElementById(
        "site-access-code-value"
      );

    if (!enabledInput) {
      return false;
    }

    var enabled =
      enabledInput.checked;

    var accessCode =
      codeInput
        ? codeInput.value.trim()
        : "";

    if (
      enabled &&
      accessCode.length < 4
    ) {
      showMessage(
        "برای فعال کردن کد عبور، یک کد حداقل 4 کاراکتری وارد کن."
      );

      return false;
    }

    try {
      var payload = {
        site_access_code_enabled:
          enabled
            ? "true"
            : "false"
      };

      if (accessCode) {
        payload.site_access_code =
          accessCode;
      }

      var result =
        await window.api(
          "/api/admin/settings",
          {
            method: "POST",
            body: JSON.stringify(
              payload
            )
          }
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        showMessage(
          result.data?.error ||
          "ذخیره تنظیمات کد عبور انجام نشد."
        );

        return false;
      }

      if (codeInput) {
        codeInput.value = "";
      }

      updateAccessCodeStatus(
        enabled
      );

      showMessage(
        enabled
          ? "کد عبور سایت با موفقیت فعال و ذخیره شد."
          : "الزام وارد کردن کد عبور سایت غیرفعال شد.",
        "success"
      );

      return true;

    } catch (_) {
      showMessage(
        "خطا در ارتباط با سرور."
      );

      return false;
    }
  }

  // ============================================
  // بروزرسانی وضعیت Toggle ثبت‌نام
  // ============================================

  function updateToggleStatus(
    isDisabled
  ) {
    var elements =
      getUserElements();

    var status =
      elements.toggleStatus;

    if (!status) {
      return;
    }

    if (isDisabled) {
      status.textContent =
        "غیرفعال";

      status.className =
        "toggle-status is-disabled";
    } else {
      status.textContent =
        "فعال";

      status.className =
        "toggle-status";
    }
  }

  // ============================================
  // تغییر Toggle ثبت‌نام
  // ============================================

  async function handleRegistrationToggle(
    event
  ) {
    var target =
      event.target;

    if (
      !target ||
      target.id !==
      "registration-toggle-input"
    ) {
      return;
    }

    await saveRegistrationSetting(
      target.checked
    );
  }

  // ============================================
  // اتصال رویدادها
  // ============================================

  function setupUserEvents() {
    document.removeEventListener(
      "click",
      handleUserClick
    );

    document.removeEventListener(
      "change",
      handleRegistrationToggle
    );

    document.addEventListener(
      "click",
      handleUserClick
    );

    document.addEventListener(
      "change",
      handleRegistrationToggle
    );
  }

  // ============================================
  // مدیریت کلیک‌ها
  // ============================================

  function handleUserClick(event) {
    var target =
      event.target;

    var createButton =
      target.closest(
        "#show-create-user-btn"
      );

    if (createButton) {
      event.preventDefault();
      openUserCreate();
      return;
    }

    var filterButton =
      target.closest(
        "#users-filter-btn"
      );

    if (filterButton) {
      event.preventDefault();
      loadUsers();
      return;
    }

    var editButton =
      target.closest(
        '[data-action="edit-user"]'
      );

    if (editButton) {
      event.preventDefault();

      var editUserId =
        editButton.getAttribute(
          "data-user-id"
        );

      if (editUserId) {
        openUserEdit(
          editUserId
        );
      }

      return;
    }

    var deleteButton =
      target.closest(
        '[data-action="delete-user"]'
      );

    if (deleteButton) {
      event.preventDefault();

      var deleteUserId =
        deleteButton.getAttribute(
          "data-user-id"
        );

      if (deleteUserId) {
        deleteUser(
          deleteUserId
        );
      }

      return;
    }

    var saveAccessCodeButton =
      target.closest(
        "#save-site-access-code-btn"
      );

    if (saveAccessCodeButton) {
      event.preventDefault();
      saveSiteAccessCodeSetting();
      return;
    }
  }

  // ============================================
  // راه‌اندازی بخش کاربران
  // ============================================

  async function initUsers() {
    setupUserEvents();

    var elements =
      getUserElements();

    if (
      !elements.usersBody &&
      !elements.toggleInput
    ) {
      return;
    }

    ensureAccessCodeControls();

    await loadRegistrationSetting();

    if (elements.usersBody) {
      await loadUsers();
    }
  }

  // ============================================
  // صادر کردن توابع
  // ============================================

  window.getRoleLabel =
    getRoleLabel;

  window.getRoleBadge =
    getRoleBadge;

  window.loadUsers =
    loadUsers;

  window.openUserCreate =
    openUserCreate;

  window.closeUserCreateBox =
    closeUserCreateBox;

  window.openUserEdit =
    openUserEdit;

  window.closeUserEditBox =
    closeUserEditBox;

  window.deleteUser =
    deleteUser;

  window.loadRegistrationSetting =
    loadRegistrationSetting;

  window.saveRegistrationSetting =
    saveRegistrationSetting;

  window.saveSiteAccessCodeSetting =
    saveSiteAccessCodeSetting;

  window.updateToggleStatus =
    updateToggleStatus;

  window.updateAccessCodeStatus =
    updateAccessCodeStatus;

  window.setupUserEvents =
    setupUserEvents;

  window.initUsers =
    initUsers;

  // ============================================
  // اجرای اولیه
  // ============================================

  setupUserEvents();

  console.log(
    "Users module loaded successfully"
  );

})();