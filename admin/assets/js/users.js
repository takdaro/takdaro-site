// ============================================
// users.js - مدیریت کاربران
// ============================================

(function () {
  "use strict";

  // ============================================
  // متغیرهای محلی
  // ============================================

  var currentUsers = [];

  // ============================================
  // گرفتن المنت‌ها
  // مهم: به دلیل لود ماژولار، المنت‌ها را هنگام نیاز می‌گیریم
  // ============================================

  function getUserElements() {
    return {
      toggleInput: document.getElementById("registration-toggle-input"),
      toggleStatus: document.getElementById("registration-toggle-status"),
      userCreateBox: document.getElementById("user-create-box"),
      userEditBox: document.getElementById("user-edit-box"),
      usersBody: document.getElementById("users-body"),
      searchInput: document.getElementById("users-search"),
      roleSelect: document.getElementById("users-role")
    };
  }

  // ============================================
  // نمایش پیام
  // ============================================

  function showMessage(message, type) {
    if (typeof window.setAdminMessage === "function") {
      window.setAdminMessage(message, type);
      return;
    }

    if (message) {
      console.log("[Users]", message);
    }
  }

  // ============================================
  // بارگذاری لیست کاربران
  // ============================================

  async function loadUsers() {
    var elements = getUserElements();

    if (!elements.usersBody) {
      return;
    }

    var search =
      elements.searchInput && elements.searchInput.value
        ? elements.searchInput.value.trim()
        : "";

    var role =
      elements.roleSelect && elements.roleSelect.value
        ? elements.roleSelect.value.trim()
        : "";

    var params = new URLSearchParams();

    if (search) {
      params.set("search", search);
    }

    if (role) {
      params.set("role", role);
    }

    var query = params.toString();

    elements.usersBody.innerHTML =
      '<tr><td colspan="8">در حال بارگذاری...</td></tr>';

    try {
      var result = await window.api(
        "/api/admin/users" + (query ? "?" + query : "")
      );

      if (!result || !result.ok || !result.data || !result.data.success) {
        elements.usersBody.innerHTML =
          '<tr><td colspan="8">دریافت کاربران انجام نشد.</td></tr>';

        currentUsers = [];
        return;
      }

      var users = Array.isArray(result.data.users)
        ? result.data.users
        : [];

      currentUsers = users;

      if (!users.length) {
        elements.usersBody.innerHTML =
          '<tr><td colspan="8">کاربری پیدا نشد.</td></tr>';
        return;
      }

      elements.usersBody.innerHTML = users
        .map(function (user) {
          return (
            "<tr>" +

            '<td class="table-number">' +
            window.esc(user.id) +
            "</td>" +

            "<td>" +
            window.esc(user.full_name || "-") +
            "</td>" +

            "<td>" +
            window.esc(user.email || "-") +
            "</td>" +

            "<td>" +
            window.esc(user.phone || "-") +
            "</td>" +

            "<td>" +
            window.badge(user.role || "user") +
            "</td>" +

            '<td class="table-number">' +
            window.money(Number(user.wallet_balance || 0)) +
            "</td>" +

            '<td class="table-number">' +
            window.esc(user.orders_count || 0) +
            "</td>" +

            "<td>" +
            '<div class="panel-actions" style="margin-top:0;">' +

            '<button class="btn btn-secondary" type="button" ' +
            'data-action="edit-user" ' +
            'data-user-id="' +
            window.esc(user.id) +
            '">ویرایش</button>' +

            '<button class="btn btn-secondary" type="button" ' +
            'data-action="delete-user" ' +
            'data-user-id="' +
            window.esc(user.id) +
            '">حذف</button>' +

            "</div>" +
            "</td>" +

            "</tr>"
          );
        })
        .join("");

    } catch (error) {
      console.error("Error loading users:", error);

      elements.usersBody.innerHTML =
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

      '<p class="admin-help">برای ساخت کاربر جدید، اطلاعات ضروری را کامل کن.</p>' +

      '<div class="panel-actions">' +
      '<button class="btn btn-primary" type="button" id="create-user-btn">ایجاد کاربر</button>' +
      '<button class="btn btn-secondary" type="button" id="cancel-create-user-btn">بستن</button>' +
      "</div>";

    var createButton = document.getElementById("create-user-btn");
    var cancelButton = document.getElementById("cancel-create-user-btn");

    if (createButton) {
      createButton.addEventListener("click", createUser);
    }

    if (cancelButton) {
      cancelButton.addEventListener("click", closeUserCreateBox);
    }
  }

  // ============================================
  // ایجاد کاربر
  // ============================================

  async function createUser() {
    var fullNameEl = document.getElementById("create-user-full-name");
    var emailEl = document.getElementById("create-user-email");
    var phoneEl = document.getElementById("create-user-phone");
    var roleEl = document.getElementById("create-user-role");
    var passwordEl = document.getElementById("create-user-password");
    var passwordConfirmEl = document.getElementById(
      "create-user-password-confirm"
    );

    var payload = {
      full_name: fullNameEl ? fullNameEl.value.trim() : "",
      email: emailEl ? emailEl.value.trim() : "",
      phone: phoneEl ? phoneEl.value.trim() : "",
      role: roleEl ? roleEl.value.trim() : "user",
      password: passwordEl ? passwordEl.value : "",
      password_confirm: passwordConfirmEl
        ? passwordConfirmEl.value
        : ""
    };

    if (
      !payload.full_name ||
      !payload.email ||
      !payload.role ||
      !payload.password ||
      !payload.password_confirm
    ) {
      showMessage(
        "برای ایجاد کاربر، همه فیلدهای ضروری را کامل کن.",
        "error"
      );
      return;
    }

    if (payload.password.length < 8) {
      showMessage(
        "رمز عبور باید حداقل 8 کاراکتر باشد.",
        "error"
      );
      return;
    }

    if (payload.password !== payload.password_confirm) {
      showMessage(
        "رمز عبور و تکرار آن یکسان نیست.",
        "error"
      );
      return;
    }

    try {
      var result = await window.api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (!result || !result.ok || !result.data || !result.data.success) {
        showMessage(
          result && result.data && result.data.error
            ? result.data.error
            : "ایجاد کاربر انجام نشد.",
          "error"
        );
        return;
      }

      showMessage(
        "کاربر جدید با موفقیت ایجاد شد.",
        "success"
      );

      closeUserCreateBox();

      await loadUsers();

      if (typeof window.loadDashboard === "function") {
        await window.loadDashboard();
      }

    } catch (error) {
      console.error("Error creating user:", error);

      showMessage(
        "خطا در ارتباط با سرور.",
        "error"
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

    if (!currentUsers.length) {
      await loadUsers();
    }

    var user = currentUsers.find(function (item) {
      return Number(item.id) === Number(userId);
    });

    if (!user) {
      showMessage(
        "کاربر موردنظر پیدا نشد. لطفاً دوباره تلاش کن.",
        "error"
      );
      return;
    }

    box.classList.remove("admin-hidden");

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
      '<button class="btn btn-primary" type="button" id="save-user-btn">ذخیره اطلاعات</button>' +
      '<button class="btn btn-secondary" type="button" id="save-user-password-btn">ذخیره رمز عبور</button>' +
      '<button class="btn btn-secondary" type="button" id="delete-user-btn">حذف کاربر</button>' +
      '<button class="btn btn-secondary" type="button" id="close-user-edit-btn">بستن</button>' +
      "</div>";

    var roleSelect = document.getElementById("edit-user-role");

    if (roleSelect) {
      roleSelect.value = user.role || "user";
    }

    var saveButton = document.getElementById("save-user-btn");
    var passwordButton = document.getElementById(
      "save-user-password-btn"
    );
    var deleteButton = document.getElementById("delete-user-btn");
    var closeButton = document.getElementById(
      "close-user-edit-btn"
    );

    if (saveButton) {
      saveButton.addEventListener("click", function () {
        saveUserInfo(user);
      });
    }

    if (passwordButton) {
      passwordButton.addEventListener("click", function () {
        saveUserPassword(user);
      });
    }

    if (deleteButton) {
      deleteButton.addEventListener("click", function () {
        deleteUser(user.id);
      });
    }

    if (closeButton) {
      closeButton.addEventListener("click", closeUserEditBox);
    }
  }

  // ============================================
  // ذخیره اطلاعات کاربر
  // ============================================

  async function saveUserInfo(user) {
    var fullNameEl = document.getElementById("edit-user-full-name");
    var emailEl = document.getElementById("edit-user-email");
    var phoneEl = document.getElementById("edit-user-phone");
    var roleEl = document.getElementById("edit-user-role");

    var payload = {
      user_id: user.id,
      full_name: fullNameEl ? fullNameEl.value.trim() : "",
      email: emailEl ? emailEl.value.trim() : "",
      phone: phoneEl ? phoneEl.value.trim() : "",
      role: roleEl ? roleEl.value.trim() : "user"
    };

    if (!payload.full_name || !payload.email || !payload.role) {
      showMessage(
        "نام، ایمیل و نقش کاربر ضروری هستند.",
        "error"
      );
      return;
    }

    try {
      var result = await window.api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (!result || !result.ok || !result.data || !result.data.success) {
        showMessage(
          result && result.data && result.data.error
            ? result.data.error
            : "ذخیره اطلاعات کاربر انجام نشد.",
          "error"
        );
        return;
      }

      showMessage(
        "اطلاعات کاربر با موفقیت ذخیره شد.",
        "success"
      );

      await loadUsers();

      if (typeof window.loadDashboard === "function") {
        await window.loadDashboard();
      }

    } catch (error) {
      console.error("Error saving user:", error);

      showMessage(
        "خطا در ارتباط با سرور.",
        "error"
      );
    }
  }

  // ============================================
  // تغییر رمز عبور کاربر
  // ============================================

  async function saveUserPassword(user) {
    var passwordEl = document.getElementById("edit-user-password");
    var confirmEl = document.getElementById(
      "edit-user-password-confirm"
    );

    var password = passwordEl ? passwordEl.value : "";
    var passwordConfirm = confirmEl ? confirmEl.value : "";

    if (!password || !passwordConfirm) {
      showMessage(
        "رمز عبور و تکرار آن را وارد کن.",
        "error"
      );
      return;
    }

    if (password.length < 8) {
      showMessage(
        "رمز عبور باید حداقل 8 کاراکتر باشد.",
        "error"
      );
      return;
    }

    if (password !== passwordConfirm) {
      showMessage(
        "رمز عبور و تکرار آن یکسان نیست.",
        "error"
      );
      return;
    }

    try {
      var result = await window.api("/api/admin/users/password", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          password: password,
          password_confirm: passwordConfirm
        })
      });

      if (!result || !result.ok || !result.data || !result.data.success) {
        showMessage(
          result && result.data && result.data.error
            ? result.data.error
            : "ذخیره رمز عبور انجام نشد.",
          "error"
        );
        return;
      }

      if (passwordEl) {
        passwordEl.value = "";
      }

      if (confirmEl) {
        confirmEl.value = "";
      }

      showMessage(
        "رمز عبور کاربر با موفقیت به‌روزرسانی شد.",
        "success"
      );

    } catch (error) {
      console.error("Error saving password:", error);

      showMessage(
        "خطا در ارتباط با سرور.",
        "error"
      );
    }
  }

  // ============================================
  // حذف کاربر
  // ============================================

  async function deleteUser(userId) {
    var userIdNum = Number(userId || 0);

    if (!userIdNum) {
      showMessage(
        "شناسه کاربر معتبر نیست.",
        "error"
      );
      return false;
    }

    var user = currentUsers.find(function (item) {
      return Number(item.id) === userIdNum;
    });

    var userName = user
      ? user.full_name || "#" + userIdNum
      : "#" + userIdNum;

    var firstConfirm = window.confirm(
      "آیا از حذف کاربر «" + userName + "» مطمئن هستی؟"
    );

    if (!firstConfirm) {
      return false;
    }

    var secondConfirm = window.confirm(
      "این عملیات قابل بازگشت نیست. حذف انجام شود؟"
    );

    if (!secondConfirm) {
      return false;
    }

    try {
      var result = await window.api("/api/admin/users", {
        method: "DELETE",
        body: JSON.stringify({
          user_id: userIdNum
        })
      });

      if (!result || !result.ok || !result.data || !result.data.success) {
        showMessage(
          result && result.data && result.data.error
            ? result.data.error
            : "حذف کاربر انجام نشد.",
          "error"
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

      if (typeof window.loadDashboard === "function") {
        await window.loadDashboard();
      }

      return true;

    } catch (error) {
      console.error("Error deleting user:", error);

      showMessage(
        "خطا در ارتباط با سرور.",
        "error"
      );

      return false;
    }
  }

  // ============================================
  // دریافت وضعیت ثبت‌نام عمومی
  // ============================================

  async function loadRegistrationSetting() {
    var elements = getUserElements();

    if (!elements.toggleInput) {
      return;
    }

    try {
      var result = await window.api("/api/admin/settings", {
        method: "GET"
      });

      if (!result || !result.ok || !result.data || !result.data.success) {
        return;
      }

      var settings = result.data.settings || {};

      var rawValue = settings.allow_public_registration;

      var isEnabled =
        rawValue === true ||
        rawValue === "true" ||
        rawValue === "1" ||
        rawValue === 1;

      // Toggle در HTML یعنی:
      // روشن = عدم ثبت‌نام توسط کاربر
      elements.toggleInput.checked = !isEnabled;

      updateToggleStatus(!isEnabled);

    } catch (error) {
      console.error(
        "Error loading registration setting:",
        error
      );
    }
  }

  // ============================================
  // ذخیره وضعیت ثبت‌نام عمومی
  // ============================================

  async function saveRegistrationSetting(disabled) {
    var elements = getUserElements();

    var allowRegistration = disabled ? "false" : "true";

    try {
      var result = await window.api("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({
          allow_public_registration: allowRegistration
        })
      });

      if (!result || !result.ok || !result.data || !result.data.success) {
        showMessage(
          result && result.data && result.data.error
            ? result.data.error
            : "ذخیره تنظیمات انجام نشد.",
          "error"
        );

        // اگر ذخیره نشد، وضعیت را از سرور دوباره بخوان
        await loadRegistrationSetting();

        return false;
      }

      updateToggleStatus(disabled);

      if (elements.toggleInput) {
        elements.toggleInput.checked = disabled;
      }

      showMessage(
        disabled
          ? "ثبت‌نام عمومی غیرفعال شد."
          : "ثبت‌نام عمومی فعال شد.",
        "success"
      );

      return true;

    } catch (error) {
      console.error(
        "Error saving registration setting:",
        error
      );

      showMessage(
        "خطا در ارتباط با سرور.",
        "error"
      );

      await loadRegistrationSetting();

      return false;
    }
  }

  // ============================================
  // بروزرسانی متن Toggle
  // ============================================

  function updateToggleStatus(isDisabled) {
    var elements = getUserElements();
    var status = elements.toggleStatus;

    if (!status) {
      return;
    }

    if (isDisabled) {
      status.textContent = "غیرفعال";
      status.className = "toggle-status is-disabled";
    } else {
      status.textContent = "فعال";
      status.className = "toggle-status";
    }
  }

  // ============================================
  // مدیریت تغییر Toggle ثبت‌نام
  // ============================================

  async function handleRegistrationToggle(event) {
    var target = event.target;

    if (
      !target ||
      target.id !== "registration-toggle-input"
    ) {
      return;
    }

    var disabled = !!target.checked;

    await saveRegistrationSetting(disabled);
  }

  // ============================================
  // مدیریت کلیک‌های کاربران
  // ============================================

  function handleUserClick(event) {
    var target = event.target;

    if (!target) {
      return;
    }

    // افزودن کاربر
    var createButton = target.closest(
      "#show-create-user-btn"
    );

    if (createButton) {
      event.preventDefault();
      openUserCreate();
      return;
    }

    // اعمال فیلتر
    var filterButton = target.closest(
      "#users-filter-btn"
    );

    if (filterButton) {
      event.preventDefault();
      loadUsers();
      return;
    }

    // ویرایش کاربر
    var editButton = target.closest(
      '[data-action="edit-user"]'
    );

    if (editButton) {
      event.preventDefault();

      var editUserId =
        editButton.getAttribute("data-user-id");

      if (editUserId) {
        openUserEdit(editUserId);
      }

      return;
    }

    // حذف کاربر
    var deleteButton = target.closest(
      '[data-action="delete-user"]'
    );

    if (deleteButton) {
      event.preventDefault();

      var deleteUserId =
        deleteButton.getAttribute("data-user-id");

      if (deleteUserId) {
        deleteUser(deleteUserId);
      }
    }
  }

  // ============================================
  // اتصال Eventها
  // ============================================

  function setupUserEvents() {
    // جلوگیری از ثبت چندباره Eventها
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
  // راه‌اندازی ماژول کاربران
  // ============================================

  async function initUsers() {
    setupUserEvents();

    var elements = getUserElements();

    // فقط زمانی اجرا شود که صفحه کاربران در DOM باشد
    if (
      !elements.usersBody &&
      !elements.toggleInput
    ) {
      return;
    }

    await loadRegistrationSetting();

    if (elements.usersBody) {
      await loadUsers();
    }
  }

  // ============================================
  // صادر کردن توابع
  // ============================================

  window.loadUsers = loadUsers;

  window.openUserCreate = openUserCreate;
  window.closeUserCreateBox = closeUserCreateBox;

  window.openUserEdit = openUserEdit;
  window.closeUserEditBox = closeUserEditBox;

  window.deleteUser = deleteUser;

  window.loadRegistrationSetting =
    loadRegistrationSetting;

  window.saveRegistrationSetting =
    saveRegistrationSetting;

  window.updateToggleStatus =
    updateToggleStatus;

  window.setupUserEvents =
    setupUserEvents;

  window.initUsers =
    initUsers;

  // ============================================
  // اتصال اولیه Eventها
  // ============================================

  setupUserEvents();

  console.log(
    "✅ Users module loaded successfully"
  );

})();