// ============================================
// admin-shell.js - مدیریت Shell و Navigation
// ============================================

(function() {
  'use strict';

  // ============================================
  // اطلاعات متای هر پنل
  // ============================================
  var panelMeta = {
    dashboard: { title: "داشبورد", description: "نمای کلی وضعیت فروشگاه و آخرین فعالیت‌ها." },
    orders: { title: "سفارش‌ها", description: "مدیریت و بررسی همه سفارش‌های ثبت شده." },
    users: { title: "کاربران", description: "مدیریت کاربران، نقش‌ها و اطلاعات حساب." },
    wallet: { title: "کیف پول", description: "مدیریت حرفه‌ای موجودی، تراکنش‌ها و تنظیمات کش‌بک کاربران." },
    products: { title: "محصولات", description: "مدیریت محصولات، قیمت، موجودی، انتشار و گالری تصاویر." },
    shipping: { title: "🚚 حمل‌ونقل", description: "مدیریت روش‌های حمل‌ونقل، هزینه‌ها و ارسال رایگان." },
    rates: { title: "💰 مدیریت نرخ ارز", description: "مدیریت نرخ دلار، تنظیمات API و مشاهده تاریخچه تغییرات." },
    invoice: { title: "تنظیمات فاکتور", description: "مدیریت اطلاعات نمایش داده شده در فاکتور و صفحه تشکر." },
    notifications: { title: "🔔 اعلان‌ها", description: "مدیریت کانال‌های ارسال اعلان و تاریخچه ارسال‌ها." },
    logout: { title: "خروج", description: "پایان نشست فعلی مدیریت." }
  };

  // ============================================
  // متغیرهای سراسری
  // ============================================
  var isScrolling = false;
  var scrollTimeout = null;
  var observer = null;// ============================================
// admin-shell.js - مدیریت Shell و Navigation
// ============================================

(function () {
  'use strict';

  // ============================================
  // اطلاعات متای هر پنل
  // ============================================
  var panelMeta = {
    dashboard: {
      title: 'داشبورد',
      description: 'نمای کلی وضعیت فروشگاه و آخرین فعالیت‌ها.'
    },
    orders: {
      title: 'سفارش‌ها',
      description: 'مدیریت و بررسی همه سفارش‌های ثبت شده.'
    },
    users: {
      title: 'کاربران',
      description: 'مدیریت کاربران، نقش‌ها و اطلاعات حساب.'
    },
    wallet: {
      title: 'کیف پول',
      description: 'مدیریت حرفه‌ای موجودی، تراکنش‌ها و تنظیمات کش‌بک کاربران.'
    },
    products: {
      title: 'محصولات',
      description: 'مدیریت محصولات، قیمت، موجودی، انتشار و گالری تصاویر.'
    },
    shipping: {
      title: '🚚 حمل‌ونقل',
      description: 'مدیریت روش‌های حمل‌ونقل، هزینه‌ها و ارسال رایگان.'
    },
    rates: {
      title: '💰 مدیریت نرخ ارز',
      description: 'مدیریت نرخ دلار، تنظیمات API و مشاهده تاریخچه تغییرات.'
    },
    invoice: {
      title: 'تنظیمات فاکتور',
      description: 'مدیریت اطلاعات نمایش داده شده در فاکتور و صفحه تشکر.'
    },
    notifications: {
      title: '🔔 اعلان‌ها',
      description: 'مدیریت کانال‌های ارسال اعلان و تاریخچه ارسال‌ها.'
    },
    logout: {
      title: 'خروج',
      description: 'پایان نشست فعلی مدیریت.'
    }
  };

  // ============================================
  // متغیرهای داخلی
  // ============================================
  var adminPanels = [];
  var adminSections = [];
  var adminHeading = null;
  var adminDescription = null;
  var adminLoading = null;
  var adminApp = null;

  var currentPanel = 'dashboard';
  var isInitialized = false;
  var navigationBound = false;

  // برای جلوگیری از اجرای همزمان lifecycle
  var panelLoading = {};

  // ============================================
  // دریافت المان‌ها
  // ============================================
  function initElements() {
    adminPanels = Array.prototype.slice.call(
      document.querySelectorAll('[data-admin-panel]')
    );

    adminSections = Array.prototype.slice.call(
      document.querySelectorAll('.admin-section')
    );

    adminHeading = document.getElementById('admin-panel-heading');
    adminDescription = document.getElementById('admin-panel-description');
    adminLoading = document.getElementById('admin-loading');
    adminApp = document.getElementById('admin-app');
  }

  // ============================================
  // بررسی معتبر بودن نام پنل
  // ============================================
  function isValidPanel(panel) {
    return Object.prototype.hasOwnProperty.call(panelMeta, panel);
  }

  // ============================================
  // دریافت Section مربوط به پنل
  // ============================================
  function getPanelSection(panel) {
    return document.getElementById('admin-panel-' + panel);
  }

  // ============================================
  // دریافت Button مربوط به پنل
  // ============================================
  function getPanelButton(panel) {
    return document.querySelector(
      '[data-admin-panel="' + panel + '"]'
    );
  }

  // ============================================
  // بروزرسانی عنوان پنل
  // ============================================
  function updatePanelMeta(panel) {
    var meta = panelMeta[panel] || panelMeta.dashboard;

    if (adminHeading) {
      adminHeading.textContent = meta.title;
    }

    if (adminDescription) {
      adminDescription.textContent = meta.description;
    }
  }

  // ============================================
  // بروزرسانی وضعیت Tabها
  // ============================================
  function updateTabs(panel) {
    adminPanels.forEach(function (button) {
      var isTarget =
        button.getAttribute('data-admin-panel') === panel;

      button.classList.toggle('is-active', isTarget);
      button.setAttribute(
        'aria-selected',
        isTarget ? 'true' : 'false'
      );

      button.setAttribute('tabindex', isTarget ? '0' : '-1');
    });
  }

  // ============================================
  // بروزرسانی Sectionها
  // ============================================
  function updateSections(panel) {
    adminSections.forEach(function (section) {
      var isTarget =
        section.id === 'admin-panel-' + panel;

      section.classList.toggle('is-active', isTarget);

      section.setAttribute(
        'aria-hidden',
        isTarget ? 'false' : 'true'
      );
    });
  }

  // ============================================
  // Ripple Animation
  // ============================================
  function animateAdminTab(button) {
    if (!button) return;

    var ripple = document.createElement('span');

    ripple.className = 'admin-tab-ripple';

    ripple.style.cssText =
      'position:absolute;' +
      'top:50%;' +
      'right:50%;' +
      'width:0;' +
      'height:0;' +
      'border-radius:50%;' +
      'background:rgba(33,158,188,.14);' +
      'transform:translate(50%,-50%);' +
      'pointer-events:none;' +
      'transition:width .45s ease,height .45s ease,opacity .45s ease;' +
      'z-index:0;';

    button.style.position = 'relative';
    button.style.overflow = 'hidden';

    button.appendChild(ripple);

    requestAnimationFrame(function () {
      ripple.style.width = '220px';
      ripple.style.height = '220px';
      ripple.style.opacity = '0';
    });

    setTimeout(function () {
      if (ripple && ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, 500);
  }

  // ============================================
  // اسکرول به ابتدای پنل
  // ============================================
  function smoothScrollToPanel() {
    var panelElement = document.querySelector('.admin-panel');

    if (!panelElement) return;

    // فقط روی موبایل یا صفحه‌های کوچک اسکرول انجام شود
    if (window.innerWidth > 820) return;

    var rect = panelElement.getBoundingClientRect();

    var header = document.querySelector(
      '.site-header, #site-header'
    );

    var headerHeight = 0;

    if (
      header &&
      window.getComputedStyle(header).display !== 'none'
    ) {
      headerHeight = header.offsetHeight || 0;
    }

    var target =
      rect.top +
      window.pageYOffset -
      headerHeight -
      16;

    window.scrollTo({
      top: Math.max(0, target),
      behavior: 'smooth'
    });
  }

  // ============================================
  // اجرای lifecycle اختصاصی هر پنل
  // ============================================
  function runPanelLifecycle(panel) {
    // جلوگیری از اجرای همزمان یک lifecycle
    if (panelLoading[panel]) {
      return;
    }

    panelLoading[panel] = true;

    try {
      switch (panel) {

        // ----------------------------------------
        // Dashboard
        // ----------------------------------------
        case 'dashboard':
          if (typeof window.loadDashboard === 'function') {
            window.loadDashboard();
          }
          break;

        // ----------------------------------------
        // Orders
        // ----------------------------------------
        case 'orders':
          if (typeof window.loadOrders === 'function') {
            window.loadOrders();
          }
          break;

        // ----------------------------------------
        // Users
        // ----------------------------------------
        case 'users':
          if (typeof window.loadUsers === 'function') {
            window.loadUsers();
          }

          if (
            typeof window.loadRegistrationSetting === 'function'
          ) {
            window.loadRegistrationSetting();
          }
          break;

        // ----------------------------------------
        // Wallet
        // ----------------------------------------
        case 'wallet':
          var walletUserId = document.getElementById(
            'wallet-user-id'
          );

          if (
            walletUserId &&
            walletUserId.value &&
            typeof window.loadWalletUser === 'function'
          ) {
            window.loadWalletUser();
          }
          break;

        // ----------------------------------------
        // Products
        // ----------------------------------------
        case 'products':
          if (typeof window.loadProducts === 'function') {
            window.loadProducts();
          }
          break;

        // ----------------------------------------
        // Shipping
        // ----------------------------------------
        case 'shipping':
          if (
            window.ShippingAdmin &&
            typeof window.ShippingAdmin.init === 'function'
          ) {
            window.ShippingAdmin.init();
          }

          if (
            typeof window.setupShippingTabs === 'function'
          ) {
            window.setupShippingTabs();
          }
          break;

        // ----------------------------------------
        // Rates
        // ----------------------------------------
        case 'rates':
          if (typeof window.loadRates === 'function') {
            window.loadRates();
          }
          break;

        // ----------------------------------------
        // Invoice
        // ----------------------------------------
        case 'invoice':
          if (
            typeof window.loadInvoiceSettingsToForm === 'function'
          ) {
            window.loadInvoiceSettingsToForm();
          }
          break;

        // ----------------------------------------
        // Notifications
        // ----------------------------------------
        case 'notifications':
          if (
            typeof window.setupNotificationTabs === 'function'
          ) {
            window.setupNotificationTabs();
          }

          if (
            typeof window.loadTelegramSettings === 'function'
          ) {
            window.loadTelegramSettings();
          }

          if (
            typeof window.loadSmsSettings === 'function'
          ) {
            window.loadSmsSettings();
          }

          if (
            typeof window.setupSmsSubTabs === 'function'
          ) {
            window.setupSmsSubTabs();
          }
          break;
      }
    } catch (error) {
      console.error(
        '❌ Error running lifecycle for panel:',
        panel,
        error
      );
    } finally {
      // کمی تاخیر برای جلوگیری از کلیک‌های خیلی سریع
      setTimeout(function () {
        panelLoading[panel] = false;
      }, 250);
    }
  }

  // ============================================
  // باز کردن پنل
  // ============================================
  function openAdminPanel(panel, options) {
    options = options || {};

    var animate = options.animate === true;
    var scroll = options.scroll === true;
    var reload = options.reload !== false;

    if (!isValidPanel(panel)) {
      console.warn(
        '⚠️ Invalid admin panel:',
        panel
      );

      panel = 'dashboard';
    }

    var button = getPanelButton(panel);
    var section = getPanelSection(panel);

    if (!button || !section) {
      console.warn(
        '⚠️ Admin panel elements not found:',
        panel
      );
      return false;
    }

    var panelChanged = currentPanel !== panel;

    currentPanel = panel;

    // بروزرسانی رابط کاربری
    updateTabs(panel);
    updateSections(panel);
    updatePanelMeta(panel);

    // انیمیشن
    if (animate) {
      animateAdminTab(button);
    }

    // اجرای lifecycle
    if (reload && panelChanged) {
      runPanelLifecycle(panel);
    }

    // اسکرول فقط در صورت درخواست
    if (scroll) {
      setTimeout(function () {
        smoothScrollToPanel();
      }, 60);
    }

    // رویداد سفارشی برای توسعه آینده
    document.dispatchEvent(
      new CustomEvent('admin:panel-change', {
        detail: {
          panel: panel,
          previousPanel: panelChanged
            ? null
            : currentPanel
        }
      })
    );

    return true;
  }

  // ============================================
  // Handler کلیک روی Navigation
  // ============================================
  function handleNavigationClick(event) {
    var button = event.currentTarget;

    if (!button) return;

    var panel = button.getAttribute(
      'data-admin-panel'
    );

    if (!panel) return;

    event.preventDefault();

    openAdminPanel(panel, {
      animate: true,
      scroll: true,
      reload: true
    });
  }

  // ============================================
  // اتصال Eventها
  // ============================================
  function setupNavigationEvents() {
    if (navigationBound) return;

    adminPanels.forEach(function (button) {
      button.addEventListener(
        'click',
        handleNavigationClick
      );
    });

    navigationBound = true;
  }

  // ============================================
  // پشتیبانی Keyboard Navigation
  // ============================================
  function setupKeyboardNavigation() {
    document.addEventListener('keydown', function (event) {
      var activeElement = document.activeElement;

      if (
        !activeElement ||
        !activeElement.matches('[data-admin-panel]')
      ) {
        return;
      }

      var key = event.key;

      if (
        key !== 'ArrowDown' &&
        key !== 'ArrowUp' &&
        key !== 'ArrowRight' &&
        key !== 'ArrowLeft' &&
        key !== 'Home' &&
        key !== 'End'
      ) {
        return;
      }

      event.preventDefault();

      var currentIndex = adminPanels.indexOf(
        activeElement
      );

      if (currentIndex === -1) return;

      var nextIndex = currentIndex;

      // RTL:
      // ArrowDown / ArrowLeft -> آیتم بعدی
      // ArrowUp / ArrowRight -> آیتم قبلی
      if (
        key === 'ArrowDown' ||
        key === 'ArrowLeft'
      ) {
        nextIndex =
          (currentIndex + 1) % adminPanels.length;
      }

      if (
        key === 'ArrowUp' ||
        key === 'ArrowRight'
      ) {
        nextIndex =
          (currentIndex - 1 + adminPanels.length) %
          adminPanels.length;
      }

      if (key === 'Home') {
        nextIndex = 0;
      }

      if (key === 'End') {
        nextIndex = adminPanels.length - 1;
      }

      var nextButton = adminPanels[nextIndex];

      if (nextButton) {
        nextButton.focus();
      }
    });
  }

  // ============================================
  // نمایش پنل
  // ============================================
  function showAdminPanel() {
    if (adminLoading) {
      adminLoading.classList.add('admin-hidden');
    }

    if (adminApp) {
      adminApp.classList.remove('admin-hidden');
    }
  }

  // ============================================
  // مخفی کردن پنل
  // ============================================
  function hideAdminPanel() {
    if (adminApp) {
      adminApp.classList.add('admin-hidden');
    }

    if (adminLoading) {
      adminLoading.classList.remove('admin-hidden');
    }
  }

  // ============================================
  // Refresh پنل فعلی
  // ============================================
  function refreshCurrentPanel() {
    runPanelLifecycle(currentPanel);
  }

  // ============================================
  // مقداردهی اولیه
  // ============================================
  function init() {
    // جلوگیری از مقداردهی چندباره
    if (isInitialized) {
      return;
    }

    initElements();

    if (!adminPanels.length || !adminSections.length) {
      console.error(
        '❌ AdminShell: required elements not found.'
      );
      return;
    }

    setupNavigationEvents();
    setupKeyboardNavigation();

    // تشخیص پنل فعال اولیه از HTML
    var activeButton = document.querySelector(
      '[data-admin-panel].is-active'
    );

    if (activeButton) {
      var initialPanel =
        activeButton.getAttribute('data-admin-panel');

      if (isValidPanel(initialPanel)) {
        currentPanel = initialPanel;
      }
    }

    // همگام‌سازی وضعیت اولیه بدون اجرای مجدد loader
    updateTabs(currentPanel);
    updateSections(currentPanel);
    updatePanelMeta(currentPanel);

    isInitialized = true;

    console.log(
      '✅ Admin Shell initialized successfully'
    );
  }

  // ============================================
  // Export عمومی
  // ============================================
  window.openAdminPanel = function (
    panel,
    animate,
    scroll
  ) {
    return openAdminPanel(panel, {
      animate: animate === true,
      scroll: scroll === true,
      reload: true
    });
  };

  window.AdminShell = {
    init: init,
    openAdminPanel: openAdminPanel,
    showAdminPanel: showAdminPanel,
    hideAdminPanel: hideAdminPanel,
    refreshCurrentPanel: refreshCurrentPanel,
    getCurrentPanel: function () {
      return currentPanel;
    },
    panelMeta: panelMeta
  };

  console.log('✅ Admin Shell loaded successfully');

})();

  var adminPanels = null;
  var adminSections = null;
  var adminHeading = null;
  var adminDescription = null;
  var adminLoading = null;
  var adminApp = null;

  // ============================================
  // مقداردهی اولیه المان‌ها
  // ============================================
  function initElements() {
    adminPanels = document.querySelectorAll("[data-admin-panel]");
    adminSections = document.querySelectorAll(".admin-section");
    adminHeading = document.getElementById("admin-panel-heading");
    adminDescription = document.getElementById("admin-panel-description");
    adminLoading = document.getElementById("admin-loading");
    adminApp = document.getElementById("admin-app");
  }

  // ============================================
  // محاسبه افست هدر برای اسکرول
  // ============================================
  function getAdminHeaderOffset() {
    var header = document.querySelector('.site-header');
    if (!header) return 100;
    var height = header.offsetHeight;
    var panelHead = document.querySelector('.admin-panel-head');
    var panelHeadHeight = panelHead ? panelHead.offsetHeight : 0;
    return height + panelHeadHeight + 30;
  }

  // ============================================
  // اسکرول نرم به پنل
  // ============================================
  function smoothScrollToAdminPanel(panelElement) {
    if (!panelElement) return;
    var offset = getAdminHeaderOffset();
    var elementPosition = panelElement.getBoundingClientRect().top;
    var offsetPosition = elementPosition + window.pageYOffset - offset;
    window.scrollTo({
      top: Math.max(0, offsetPosition),
      behavior: 'smooth'
    });
  }

  // ============================================
  // انیمیشن کلیک روی تب
  // ============================================
  function animateAdminTab(tabButton) {
    if (!tabButton) return;
    var ripple = document.createElement('span');
    ripple.style.cssText = 
      'position: absolute; top: 50%; right: 50%; width: 0; height: 0; ' +
      'background: rgba(33, 158, 188, 0.15); border-radius: 50%; ' +
      'transform: translate(50%, -50%); pointer-events: none; ' +
      'transition: width 0.5s ease, height 0.5s ease, opacity 0.5s ease;';
    tabButton.style.position = 'relative';
    tabButton.style.overflow = 'hidden';
    tabButton.appendChild(ripple);
    void ripple.offsetWidth;
    ripple.style.width = '200px';
    ripple.style.height = '200px';
    ripple.style.opacity = '0';
    setTimeout(function() { ripple.remove(); }, 600);
    tabButton.style.transform = 'scale(0.97)';
    setTimeout(function() { tabButton.style.transform = ''; }, 200);
  }

  // ============================================
  // باز کردن پنل
  // ============================================
  function openAdminPanel(panel, animate, scroll) {
    animate = animate || false;
    scroll = scroll || false;

    adminPanels.forEach(function(btn) {
      var isTarget = btn.getAttribute("data-admin-panel") === panel;
      btn.classList.toggle("is-active", isTarget);
      btn.setAttribute("aria-selected", isTarget ? "true" : "false");
    });

    var targetSection = null;
    adminSections.forEach(function(section) {
      var isTarget = section.id === "admin-panel-" + panel;
      section.classList.toggle("is-active", isTarget);
      if (isTarget) targetSection = section;
    });

    if (animate) {
      var activeButton = document.querySelector('.admin-menu-btn[data-admin-panel="' + panel + '"]');
      if (activeButton) animateAdminTab(activeButton);
    }

    var meta = panelMeta[panel] || panelMeta.dashboard;
    if (adminHeading) adminHeading.textContent = meta.title;
    if (adminDescription) adminDescription.textContent = meta.description;

    if (panel === "dashboard") {
      if (typeof window.loadDashboard === "function") {
        window.loadDashboard();
      }
    } else if (panel === "orders") {
      if (typeof window.loadOrders === "function") {
        window.loadOrders();
      }
    } else if (panel === "users") {
      if (typeof window.loadUsers === "function") {
        window.loadUsers();
      }
      if (typeof window.loadRegistrationSetting === "function") {
        window.loadRegistrationSetting();
      }
    } else if (panel === "products") {
      if (typeof window.loadProducts === "function") {
        window.loadProducts();
      }
    } else if (panel === "wallet") {
      var userIdInput = document.getElementById("wallet-user-id");
      if (userIdInput && userIdInput.value) {
        if (typeof window.loadWalletUser === "function") {
          window.loadWalletUser();
        }
      }
    } else if (panel === "invoice") {
      if (typeof window.loadInvoiceSettingsToForm === "function") {
        window.loadInvoiceSettingsToForm();
      }
    } else if (panel === "rates") {
      if (typeof window.loadRates === "function") {
        window.loadRates();
      }
    } else if (panel === "shipping") {
      if (typeof window.ShippingAdmin !== 'undefined' && 
          typeof window.ShippingAdmin.init === "function") {
        setTimeout(function() {
          window.ShippingAdmin.init();
        }, 300);
      }
      setTimeout(function() {
        if (typeof window.setupShippingTabs === "function") {
          window.setupShippingTabs();
        }
      }, 800);
    } else if (panel === "notifications") {
      setTimeout(function() {
        if (typeof window.loadTelegramSettings === "function") {
          window.loadTelegramSettings();
        }
        setTimeout(function() {
          if (typeof window.loadSmsSettings === "function") {
            window.loadSmsSettings();
          }
        }, 500);
      }, 300);
    }

    if (scroll && targetSection) {
      setTimeout(function() {
        smoothScrollToAdminPanel(targetSection);
      }, 150);
    }
  }

  // ============================================
  // Observer برای اسکرول خودکار در موبایل
  // ============================================
  function setupAdminScrollObserver() {
    if (window.innerWidth > 820) return;
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    var sections = document.querySelectorAll('.admin-section');
    var sectionMap = {};
    sections.forEach(function(section) {
      var id = section.id;
      if (id && id.startsWith('admin-panel-')) {
        var target = id.replace('admin-panel-', '');
        sectionMap[target] = section;
      }
    });

    if (Object.keys(sectionMap).length === 0) return;

    observer = new IntersectionObserver(function(entries) {
      if (isScrolling) return;
      var visibleTarget = null;
      var maxRatio = 0;
      entries.forEach(function(entry) {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          var id = entry.target.id;
          if (id && id.startsWith('admin-panel-')) {
            visibleTarget = id.replace('admin-panel-', '');
          }
        }
      });
      if (visibleTarget && maxRatio > 0.3) {
        var currentActive = document.querySelector('.admin-menu-btn.is-active');
        var currentTarget = currentActive ? currentActive.getAttribute('data-admin-panel') : null;
        if (currentTarget !== visibleTarget) {
          openAdminPanel(visibleTarget, false, false);
        }
      }
    }, {
      threshold: [0.1, 0.2, 0.3, 0.4, 0.5],
      rootMargin: '0px 0px -50px 0px'
    });

    Object.values(sectionMap).forEach(function(section) {
      if (section) observer.observe(section);
    });
  }

  // ============================================
  // راه‌اندازی رویدادهای Navigation
  // ============================================
  function setupNavigationEvents() {
    adminPanels.forEach(function(btn) {
      btn.addEventListener("click", function() {
        var panel = this.getAttribute("data-admin-panel");
        isScrolling = true;
        clearTimeout(scrollTimeout);
        openAdminPanel(panel, true, true);
        scrollTimeout = setTimeout(function() {
          isScrolling = false;
        }, 800);
      });
    });
  }

  // ============================================
  // راه‌اندازی Observer در تغییر اندازه پنجره
  // ============================================
  function setupResizeObserver() {
    window.addEventListener('resize', function() {
      if (window.innerWidth > 820) {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      } else {
        setupAdminScrollObserver();
      }
    });
  }

  // ============================================
  // نمایش پنل پس از احراز هویت
  // ============================================
  function showAdminPanel() {
    if (adminLoading) adminLoading.classList.add("admin-hidden");
    if (adminApp) adminApp.classList.remove("admin-hidden");
  }

  // ============================================
  // مقداردهی اولیه
  // ============================================
  function init() {
    initElements();
    setupNavigationEvents();
    setupAdminScrollObserver();
    setupResizeObserver();
  }

  // ============================================
  // صادر کردن توابع
  // ============================================
  window.openAdminPanel = openAdminPanel;
  window.setupShippingTabs = window.setupShippingTabs || function() {};
  window.showAdminPanel = showAdminPanel;

  window.AdminShell = {
    init: init,
    openAdminPanel: openAdminPanel,
    showAdminPanel: showAdminPanel,
    panelMeta: panelMeta
  };

  console.log("✅ Admin Shell loaded successfully");

})();