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
  var observer = null;

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