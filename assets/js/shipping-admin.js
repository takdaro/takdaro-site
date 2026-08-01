// ============================================
// مدیریت حمل‌ونقل - نسخه نهایی با هزینه مازاد، افزودن و حذف شهر
// ============================================

(function() {
  console.log("✅ Shipping Admin loaded");

  // ============================================
  // توابع کمکی
  // ============================================
  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatToman(value) {
    const num = Number(value || 0);
    return num.toLocaleString("fa-IR");
  }

  function toEnglishDigits(value) {
    const map = {
      "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
      "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"
    };
    return String(value ?? "").replace(/[۰-۹]/g, (d) => map[d]);
  }

  function parseToman(value) {
    const raw = toEnglishDigits(String(value || "0")).replace(/,/g, "").replace(/[^\d]/g, "");
    return Number(raw) || 0;
  }

  async function api(url, options = {}) {
    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        ...options
      });
      let data = null;
      try {
        data = await response.json();
      } catch (_) {
        data = { success: false, error: "پاسخ سرور نامعتبر است." };
      }
      return { ok: response.ok, data };
    } catch (e) {
      return { ok: false, data: { success: false, error: e.message } };
    }
  }

  // ============================================
  // بارگذاری داده‌ها
  // ============================================
  let PROVINCES_DATA = {};
  let SHIPPING_METHODS = [];
  let currentProvince = "";

  const TEHRAN_GROUP = ["تهران", "کرج", "فردیس", "رودهن", "بومهن"];

  async function loadProvinces() {
    try {
      const result = await api("/api/shipping/provinces");
      if (result.ok && result.data?.success) {
        PROVINCES_DATA = result.data.provinces || {};
        console.log("✅ Provinces loaded:", Object.keys(PROVINCES_DATA).length);
        return true;
      }
    } catch (e) {
      console.error("Error loading provinces:", e);
    }
    return false;
  }

  async function loadShippingMethods() {
    try {
      const result = await api("/api/admin/shipping?action=methods");
      if (result.ok && result.data?.success) {
        SHIPPING_METHODS = result.data.methods || [];
        console.log("✅ Shipping methods loaded:", SHIPPING_METHODS.length);
        return true;
      }
    } catch (e) {
      console.error("Error loading shipping methods:", e);
    }
    return false;
  }

  async function loadShippingCosts(province, city) {
    try {
      const result = await api(`/api/admin/shipping?action=costs&province=${encodeURIComponent(province)}&city=${encodeURIComponent(city)}`);
      if (result.ok && result.data?.success) {
        return result.data.costs || [];
      }
    } catch (e) {
      console.error("Error loading shipping costs:", e);
    }
    return [];
  }

  function getDefaultShippingMethodForCity(city) {
    if (TEHRAN_GROUP.includes(city)) {
      return "اسنپ‌باکس";
    } else {
      return "ارسال با باربری";
    }
  }

  // ============================================
  // رندر تب روش‌های حمل‌ونقل
  // ============================================
  function renderMethods(container) {
    if (!container) {
      console.warn("renderMethods: container not found");
      return;
    }

    console.log("renderMethods: rendering...");

    container.innerHTML = `
      <div class="detail-card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <h4 style="margin:0;color:#0f172a;">🚛 روش‌های حمل‌ونقل</h4>
          <button class="btn btn-primary" type="button" id="add-method-btn">➕ افزودن روش جدید</button>
        </div>
        <p class="admin-help">هزینه ثابت و زمان تحویل هر روش به عنوان پایه برای همه شهرها استفاده می‌شود.</p>
        <div id="methods-loading" style="padding:20px;text-align:center;color:#64748b;">در حال بارگذاری...</div>
        <div id="methods-table" style="display:none;"></div>
        <div id="method-form-container" style="display:none;margin-top:16px;"></div>
      </div>
    `;

    loadShippingMethods().then(() => {
      const loading = document.getElementById("methods-loading");
      const table = document.getElementById("methods-table");
      
      if (loading) loading.style.display = "none";
      if (table) table.style.display = "block";

      renderMethodsTable(table);
    });

    document.getElementById("add-method-btn")?.addEventListener("click", function() {
      showMethodForm();
    });
  }

  // ============================================
  // رندر جدول روش‌ها
  // ============================================
  function renderMethodsTable(table) {
    if (!table) return;

    let html = `
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>نام</th>
              <th>شناسه</th>
              <th>هزینه ثابت (تومان)</th>
              <th>زمان تحویل</th>
              <th>وضعیت</th>
              <th>ترتیب</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (!SHIPPING_METHODS.length) {
      html += `<tr><td colspan="7" style="text-align:center;color:#64748b;">هیچ روش حمل‌ونقلی تعریف نشده است.</td></tr>`;
    } else {
      for (const method of SHIPPING_METHODS) {
        const statusBadge = method.is_active
          ? `<span class="status-badge status-badge--success">فعال</span>`
          : `<span class="status-badge status-badge--danger">غیرفعال</span>`;
        
        html += `
          <tr data-method-id="${esc(method.id)}">
            <td><strong>${esc(method.name)}</strong></td>
            <td><code>${esc(method.slug)}</code></td>
            <td class="table-number">${formatToman(method.default_cost)}</td>
            <td>${esc(method.delivery_time || "-")}</td>
            <td>${statusBadge}</td>
            <td>${method.sort_order || 0}</td>
            <td>
              <div class="panel-actions" style="margin-top:0;">
                <button class="btn btn-secondary btn-sm edit-method-btn" data-id="${esc(method.id)}">✏️ ویرایش</button>
                <button class="btn btn-secondary btn-sm delete-method-btn" data-id="${esc(method.id)}">🗑️ حذف</button>
              </div>
            </td>
          </tr>
        `;
      }
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    table.innerHTML = html;

    table.querySelectorAll(".edit-method-btn").forEach(btn => {
      btn.addEventListener("click", function() {
        const id = Number(this.dataset.id);
        const method = SHIPPING_METHODS.find(m => m.id === id);
        if (method) showMethodForm(method);
      });
    });

    table.querySelectorAll(".delete-method-btn").forEach(btn => {
      btn.addEventListener("click", async function() {
        const id = Number(this.dataset.id);
        const method = SHIPPING_METHODS.find(m => m.id === id);
        if (!method) return;
        
        if (confirm(`آیا از حذف روش "${method.name}" مطمئن هستید؟`)) {
          const result = await api("/api/admin/shipping", {
            method: "POST",
            body: JSON.stringify({
              action: "delete_method",
              id: id
            })
          });

          if (result.ok && result.data?.success) {
            alert("روش با موفقیت حذف شد.");
            await loadShippingMethods();
            const container = document.getElementById("shipping-tab-methods");
            renderMethods(container);
          } else {
            alert(result.data?.error || "حذف انجام نشد.");
          }
        }
      });
    });
  }

  // ============================================
  // فرم ایجاد/ویرایش روش
  // ============================================
  function showMethodForm(method = null) {
    const container = document.getElementById("method-form-container");
    if (!container) return;

    const isEdit = !!method;

    container.style.display = "block";
    container.innerHTML = `
      <div class="detail-card" style="background:#f8fafc;border:2px solid #a7f3d0;">
        <h4>${isEdit ? "✏️ ویرایش روش حمل‌ونقل" : "➕ افزودن روش حمل‌ونقل جدید"}</h4>
        <div class="filters-grid filters-grid-2">
          <div class="form-field">
            <label>نام روش *</label>
            <input id="method-name" type="text" value="${esc(method?.name || "")}" placeholder="مثلاً اسنپ‌باکس" />
          </div>
          <div class="form-field">
            <label>شناسه (Slug) *</label>
            <input id="method-slug" type="text" value="${esc(method?.slug || "")}" placeholder="مثلاً snap-box" />
            <small class="admin-help">فقط حروف انگلیسی، اعداد و خط تیره</small>
          </div>
          <div class="form-field">
            <label>هزینه ثابت (تومان) *</label>
            <input id="method-cost" type="text" value="${method?.default_cost ? formatToman(method.default_cost) : '۰'}" placeholder="مثلاً ۵۰۰,۰۰۰" />
            <small class="admin-help">هزینه پایه برای همه شهرها</small>
          </div>
          <div class="form-field">
            <label>زمان تقریبی تحویل *</label>
            <input id="method-delivery" type="text" value="${esc(method?.delivery_time || "")}" placeholder="مثلاً ۱ تا ۲ روز کاری" />
            <small class="admin-help">این زمان تحویل برای همه شهرهای این روش استفاده می‌شود.</small>
          </div>
          <div class="form-field">
            <label>ترتیب نمایش</label>
            <input id="method-sort" type="number" min="0" value="${method?.sort_order || 0}" />
          </div>
          <div class="form-field" style="grid-column:1/-1;">
            <label>توضیحات</label>
            <textarea id="method-description" rows="2" placeholder="توضیحات روش حمل‌ونقل">${esc(method?.description || "")}</textarea>
          </div>
          <div class="form-field">
            <label>
              <input type="checkbox" id="method-active" ${method?.is_active ? "checked" : "checked"} />
              فعال
            </label>
          </div>
        </div>
        <div class="panel-actions">
          <button class="btn btn-primary" type="button" id="save-method-btn">${isEdit ? "💾 ذخیره تغییرات" : "➕ ایجاد روش"}</button>
          <button class="btn btn-secondary" type="button" id="cancel-method-btn">لغو</button>
        </div>
      </div>
    `;

    const costInput = document.getElementById("method-cost");
    
    costInput?.addEventListener("input", function() {
      const raw = toEnglishDigits(this.value).replace(/,/g, "");
      const num = Number(raw);
      if (!isNaN(num) && num >= 0 && raw !== "") {
        this.value = formatToman(num);
      }
    });

    costInput?.addEventListener("blur", function() {
      if (this.value.trim() === "" || this.value === "۰") {
        this.value = "۰";
      }
    });

    document.getElementById("save-method-btn").addEventListener("click", async function() {
      const name = document.getElementById("method-name").value.trim();
      const slug = document.getElementById("method-slug").value.trim().toLowerCase().replace(/\s+/g, "-");
      
      const costRaw = toEnglishDigits(document.getElementById("method-cost").value).replace(/,/g, "").replace(/[^\d]/g, "");
      const default_cost = costRaw ? Number(costRaw) : 0;
      
      const description = document.getElementById("method-description").value.trim();
      const delivery_time = document.getElementById("method-delivery").value.trim();
      const sort_order = Number(document.getElementById("method-sort").value || 0);
      const is_active = document.getElementById("method-active").checked;

      if (!name || !slug) {
        alert("نام و شناسه روش الزامی است.");
        return;
      }

      if (!delivery_time) {
        alert("زمان تحویل الزامی است.");
        return;
      }

      if (default_cost < 0) {
        alert("هزینه ثابت نمی‌تواند منفی باشد.");
        return;
      }

      if (!/^[a-z0-9\-]+$/.test(slug)) {
        alert("شناسه فقط می‌تواند شامل حروف کوچک انگلیسی، اعداد و خط تیره باشد.");
        return;
      }

      const payload = {
        action: isEdit ? "update_method" : "create_method",
        id: method?.id || null,
        name,
        slug,
        default_cost: default_cost,
        description,
        delivery_time,
        sort_order,
        is_active
      };

      const result = await api("/api/admin/shipping", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (result.ok && result.data?.success) {
        alert(result.data.message);
        container.style.display = "none";
        await loadShippingMethods();
        const methodsContainer = document.getElementById("shipping-tab-methods");
        renderMethods(methodsContainer);
      } else {
        alert(result.data?.error || "عملیات انجام نشد.");
      }
    });

    document.getElementById("cancel-method-btn").addEventListener("click", function() {
      container.style.display = "none";
    });
  }

  // ============================================
  // ✅ رندر تب هزینه ارسال
  // ============================================
  function renderCosts(container) {
    if (!container) {
      console.warn("renderCosts: container not found");
      return;
    }

    console.log("renderCosts: rendering...");

    container.innerHTML = `
      <div class="detail-card">
        <h4>💰 مدیریت هزینه مازاد ارسال</h4>
        <p class="admin-help">استان را انتخاب کنید. برای هر شهر هزینه مازاد (اضافی) بر اساس هزینه ثابت روش تعیین کنید.</p>
        <p class="admin-help" style="color:#94a3b8;">
          💡 هزینه نهایی = هزینه ثابت روش + هزینه مازاد شهر
        </p>
        
        <div class="filters-grid filters-grid-2">
          <div class="form-field">
            <label for="cost-province-simple">استان</label>
            <select id="cost-province-simple">
              <option value="">انتخاب استان</option>
            </select>
          </div>
          <div class="form-field" style="justify-content:flex-end;">
            <button class="btn btn-primary" type="button" id="load-costs-btn">📊 نمایش شهرها</button>
          </div>
        </div>
        
        <div id="cost-result" style="margin-top:16px;"></div>
        <div id="cost-save-message" style="margin-top:12px;"></div>
      </div>
    `;

    const provinceSelect = document.getElementById("cost-province-simple");
    const loadBtn = document.getElementById("load-costs-btn");
    const resultDiv = document.getElementById("cost-result");

    // پر کردن استان‌ها
    const provinceList = Object.keys(PROVINCES_DATA);
    if (provinceList.length === 0) {
      loadProvinces().then(() => {
        populateProvinceSelect(provinceSelect);
      });
    } else {
      populateProvinceSelect(provinceSelect);
    }

    function populateProvinceSelect(select) {
      const list = Object.keys(PROVINCES_DATA);
      select.innerHTML = '<option value="">انتخاب استان</option>';
      for (const province of list) {
        select.innerHTML += `<option value="${esc(province)}">${esc(province)}</option>`;
      }
    }

    loadBtn.addEventListener("click", async function() {
      const province = provinceSelect.value;

      if (!province) {
        resultDiv.innerHTML = `<p style="color:#b91c1c;">لطفاً یک استان را انتخاب کنید.</p>`;
        return;
      }

      currentProvince = province;
      resultDiv.innerHTML = `<p style="color:#64748b;">در حال بارگذاری شهرهای ${esc(province)}...</p>`;

      const cities = PROVINCES_DATA[province] || [];
      
      if (cities.length === 0) {
        resultDiv.innerHTML = `<p style="color:#b91c1c;">هیچ شهری برای این استان تعریف نشده است.</p>`;
        return;
      }

      await loadShippingMethods();

      let allCosts = {};
      for (const city of cities) {
        const costs = await loadShippingCosts(province, city);
        allCosts[city] = costs;
      }

      let html = `
        <div class="detail-card" style="margin-top:8px;background:#f8fafc;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
            <h5 style="margin:0;">مدیریت هزینه مازاد - استان <strong>${esc(province)}</strong></h5>
            <button class="btn btn-primary" type="button" id="add-city-btn" data-province="${esc(province)}">➕ افزودن شهر جدید</button>
          </div>
          <div id="add-city-form" style="display:none;margin-bottom:12px;padding:12px;background:#f1f5f9;border-radius:12px;">
            <div class="filters-grid filters-grid-2">
              <div class="form-field">
                <label>نام شهر جدید *</label>
                <input id="new-city-name" type="text" placeholder="مثلاً شهر جدید" />
              </div>
              <div class="form-field" style="justify-content:flex-end;">
                <button class="btn btn-primary" type="button" id="save-new-city-btn" data-province="${esc(province)}">💾 ذخیره شهر</button>
                <button class="btn btn-secondary" type="button" id="cancel-new-city-btn">لغو</button>
              </div>
            </div>
          </div>
          <p style="color:#64748b;font-size:0.9rem;margin-bottom:12px;">
            💡 هزینه نهایی = هزینه ثابت روش (از تب روش‌ها) + هزینه مازاد شهر
          </p>
          <div class="table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th style="min-width:100px;">شهر</th>
                  <th style="min-width:160px;">روش ارسال</th>
                  <th style="min-width:120px;">هزینه ثابت روش</th>
                  <th style="min-width:140px;">هزینه مازاد (تومان)</th>
                  <th style="min-width:150px;">هزینه نهایی</th>
                  <th style="min-width:90px;">وضعیت</th>
                  <th style="min-width:110px;">عملیات</th>
                </tr>
              </thead>
              <tbody>
      `;

      for (const city of cities) {
        const cityCosts = allCosts[city] || [];
        
        let existingCost = cityCosts.length > 0 ? cityCosts[0] : null;
        let existingMethodId = existingCost ? existingCost.shipping_method_id : null;
        
        let currentMethodId = existingMethodId;
        
        if (!currentMethodId) {
          const defaultName = getDefaultShippingMethodForCity(city);
          const defaultMethod = SHIPPING_METHODS.find(m => m.name === defaultName);
          if (defaultMethod) {
            currentMethodId = defaultMethod.id;
          }
        }

        const method = SHIPPING_METHODS.find(m => m.id === currentMethodId);
        const baseCost = method ? method.default_cost || 0 : 0;
        
        const cost = existingCost || null;
        const exists = !!cost;
        const extraCost = exists ? (cost.extra_cost || 0) : 0;
        const totalCost = baseCost + extraCost;
        const isActive = exists ? cost.is_active : 1;
        
        const isTehran = TEHRAN_GROUP.includes(city);
        const groupLabel = isTehran ? "🔵" : "🟢";
        const defaultMethod = isTehran ? "اسنپ‌باکس" : "ارسال با باربری";
        
        html += `
          <tr data-city="${esc(city)}" data-province="${esc(province)}">
            <td>
              <strong>${esc(city)}</strong>
              <br><small style="color:#94a3b8;font-size:0.75rem;">${groupLabel} پیش‌فرض: ${defaultMethod}</small>
              <br><small style="color:#94a3b8;font-size:0.7rem;">⏱️ تحویل: ${esc(method?.delivery_time || "نامشخص")}</small>
            </td>
            <td>
              <select class="shipping-method-select" data-city="${esc(city)}" style="width:100%;padding:8px 12px;border:1px solid #dbe2ea;border-radius:12px;">
        `;
        
        for (const m of SHIPPING_METHODS) {
          const selected = m.id === currentMethodId ? "selected" : "";
          html += `<option value="${esc(m.id)}" ${selected}>${esc(m.name)}</option>`;
        }
        
        html += `
              </select>
              <div style="font-size:0.75rem;color:#94a3b8;margin-top:4px;">
                ⏱️ ${esc(method?.delivery_time || "زمان تحویل از روش انتخاب شده خوانده می‌شود")}
              </div>
            </td>
            <td class="table-number">
              ${formatToman(baseCost)}
            </td>
            <td>
              <input class="cost-extra-input" type="text" 
                value="${formatToman(extraCost)}" 
                data-city="${esc(city)}" 
                style="width:100%;padding:8px 12px;border:1px solid #dbe2ea;border-radius:12px;text-align:left;direction:ltr;" />
              <small style="color:#94a3b8;font-size:0.7rem;">مبلغ اضافی بر اساس شهر</small>
            </td>
            <td class="table-number" style="font-weight:bold;color:#047857;">
              ${formatToman(totalCost)}
            </td>
            <td>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                <input type="checkbox" class="cost-active-checkbox" 
                  data-city="${esc(city)}" 
                  ${isActive ? "checked" : ""} />
                ${isActive ? '🟢 فعال' : '🔴 غیرفعال'}
              </label>
            </td>
            <td>
              <div style="display:flex;gap:4px;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm save-single-cost-btn" 
                  type="button" data-city="${esc(city)}" data-province="${esc(province)}"
                  style="padding:4px 10px;font-size:0.8rem;">
                  💾 ذخیره
                </button>
                <button class="btn btn-secondary btn-sm delete-city-btn" 
                  type="button" data-city="${esc(city)}" data-province="${esc(province)}"
                  style="padding:4px 10px;font-size:0.8rem;background:#fef2f2;color:#b91c1c;border-color:#fecaca;">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      }

      html += `
              </tbody>
            </table>
          </div>
          <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <button class="btn btn-primary" type="button" id="save-all-costs-btn-bottom" data-province="${esc(province)}">💾 ذخیره همه تغییرات</button>
            <span style="color:#64748b;font-size:0.9rem;">تغییرات را می‌توانید تک‌تک یا یکجا ذخیره کنید.</span>
            <span style="color:#94a3b8;font-size:0.85rem;margin-right:auto;">
              🔵 تهران و اطراف → اسنپ‌باکس | 🟢 سایر شهرها → ارسال با باربری
            </span>
          </div>
        </div>
      `;

      resultDiv.innerHTML = html;

      attachCostEvents(province);

      // رویداد افزودن شهر جدید
      document.getElementById("add-city-btn")?.addEventListener("click", function() {
        const form = document.getElementById("add-city-form");
        if (form) form.style.display = "block";
        document.getElementById("new-city-name")?.focus();
      });

      document.getElementById("cancel-new-city-btn")?.addEventListener("click", function() {
        document.getElementById("add-city-form").style.display = "none";
        document.getElementById("new-city-name").value = "";
      });

      document.getElementById("save-new-city-btn")?.addEventListener("click", async function() {
        const province = this.getAttribute("data-province");
        const cityName = document.getElementById("new-city-name").value.trim();
        
        if (!cityName) {
          alert("لطفاً نام شهر را وارد کنید.");
          return;
        }

        const cities = PROVINCES_DATA[province] || [];
        if (cities.includes(cityName)) {
          alert(`شهر "${cityName}" قبلاً در این استان وجود دارد.`);
          return;
        }

        cities.push(cityName);
        PROVINCES_DATA[province] = cities;

        const result = await api("/api/admin/shipping", {
          method: "POST",
          body: JSON.stringify({
            action: "add_city",
            province: province,
            city: cityName
          })
        });

        if (result.ok && result.data?.success) {
          alert(`شهر "${cityName}" با موفقیت اضافه شد.`);
          document.getElementById("add-city-form").style.display = "none";
          document.getElementById("new-city-name").value = "";
          await refreshCurrentCosts(province);
        } else {
          alert(result.data?.error || "افزودن شهر انجام نشد.");
        }
      });
    });
  }

  // ============================================
  // ✅ تابع به‌روزرسانی خودکار جدول هزینه‌ها
  // ============================================
  async function refreshCurrentCosts(province) {
    if (!province) return;
    
    const resultDiv = document.getElementById("cost-result");
    if (!resultDiv) return;

    resultDiv.innerHTML = `<p style="color:#64748b;">🔄 در حال به‌روزرسانی...</p>`;

    const cities = PROVINCES_DATA[province] || [];
    
    if (cities.length === 0) {
      resultDiv.innerHTML = `<p style="color:#b91c1c;">هیچ شهری برای این استان تعریف نشده است.</p>`;
      return;
    }

    await loadShippingMethods();

    let allCosts = {};
    for (const city of cities) {
      const costs = await loadShippingCosts(province, city);
      allCosts[city] = costs;
    }

    let html = `
      <div class="detail-card" style="margin-top:8px;background:#f8fafc;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
          <h5 style="margin:0;">مدیریت هزینه مازاد - استان <strong>${esc(province)}</strong></h5>
          <button class="btn btn-primary" type="button" id="add-city-btn" data-province="${esc(province)}">➕ افزودن شهر جدید</button>
        </div>
        <div id="add-city-form" style="display:none;margin-bottom:12px;padding:12px;background:#f1f5f9;border-radius:12px;">
          <div class="filters-grid filters-grid-2">
            <div class="form-field">
              <label>نام شهر جدید *</label>
              <input id="new-city-name" type="text" placeholder="مثلاً شهر جدید" />
            </div>
            <div class="form-field" style="justify-content:flex-end;">
              <button class="btn btn-primary" type="button" id="save-new-city-btn" data-province="${esc(province)}">💾 ذخیره شهر</button>
              <button class="btn btn-secondary" type="button" id="cancel-new-city-btn">لغو</button>
            </div>
          </div>
        </div>
        <p style="color:#64748b;font-size:0.9rem;margin-bottom:12px;">
          💡 هزینه نهایی = هزینه ثابت روش (از تب روش‌ها) + هزینه مازاد شهر
        </p>
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th style="min-width:100px;">شهر</th>
                <th style="min-width:160px;">روش ارسال</th>
                <th style="min-width:120px;">هزینه ثابت روش</th>
                <th style="min-width:140px;">هزینه مازاد (تومان)</th>
                <th style="min-width:150px;">هزینه نهایی</th>
                <th style="min-width:90px;">وضعیت</th>
                <th style="min-width:110px;">عملیات</th>
              </tr>
            </thead>
            <tbody>
    `;

    for (const city of cities) {
      const cityCosts = allCosts[city] || [];
      
      let existingCost = cityCosts.length > 0 ? cityCosts[0] : null;
      let existingMethodId = existingCost ? existingCost.shipping_method_id : null;
      
      let currentMethodId = existingMethodId;
      
      if (!currentMethodId) {
        const defaultName = getDefaultShippingMethodForCity(city);
        const defaultMethod = SHIPPING_METHODS.find(m => m.name === defaultName);
        if (defaultMethod) {
          currentMethodId = defaultMethod.id;
        }
      }

      const method = SHIPPING_METHODS.find(m => m.id === currentMethodId);
      const baseCost = method ? method.default_cost || 0 : 0;
      
      const cost = existingCost || null;
      const exists = !!cost;
      const extraCost = exists ? (cost.extra_cost || 0) : 0;
      const totalCost = baseCost + extraCost;
      const isActive = exists ? cost.is_active : 1;
      
      const isTehran = TEHRAN_GROUP.includes(city);
      const groupLabel = isTehran ? "🔵" : "🟢";
      const defaultMethod = isTehran ? "اسنپ‌باکس" : "ارسال با باربری";
      
      html += `
        <tr data-city="${esc(city)}" data-province="${esc(province)}">
          <td>
            <strong>${esc(city)}</strong>
            <br><small style="color:#94a3b8;font-size:0.75rem;">${groupLabel} پیش‌فرض: ${defaultMethod}</small>
            <br><small style="color:#94a3b8;font-size:0.7rem;">⏱️ تحویل: ${esc(method?.delivery_time || "نامشخص")}</small>
          </td>
          <td>
            <select class="shipping-method-select" data-city="${esc(city)}" style="width:100%;padding:8px 12px;border:1px solid #dbe2ea;border-radius:12px;">
      `;
      
      for (const m of SHIPPING_METHODS) {
        const selected = m.id === currentMethodId ? "selected" : "";
        html += `<option value="${esc(m.id)}" ${selected}>${esc(m.name)}</option>`;
      }
      
      html += `
            </select>
            <div style="font-size:0.75rem;color:#94a3b8;margin-top:4px;">
              ⏱️ ${esc(method?.delivery_time || "زمان تحویل از روش انتخاب شده خوانده می‌شود")}
            </div>
          </td>
          <td class="table-number">
            ${formatToman(baseCost)}
          </td>
          <td>
            <input class="cost-extra-input" type="text" 
              value="${formatToman(extraCost)}" 
              data-city="${esc(city)}" 
              style="width:100%;padding:8px 12px;border:1px solid #dbe2ea;border-radius:12px;text-align:left;direction:ltr;" />
            <small style="color:#94a3b8;font-size:0.7rem;">مبلغ اضافی بر اساس شهر</small>
          </td>
          <td class="table-number" style="font-weight:bold;color:#047857;">
            ${formatToman(totalCost)}
          </td>
          <td>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="checkbox" class="cost-active-checkbox" 
                data-city="${esc(city)}" 
                ${isActive ? "checked" : ""} />
              ${isActive ? '🟢 فعال' : '🔴 غیرفعال'}
            </label>
          </td>
          <td>
            <div style="display:flex;gap:4px;flex-wrap:wrap;">
              <button class="btn btn-primary btn-sm save-single-cost-btn" 
                type="button" data-city="${esc(city)}" data-province="${esc(province)}"
                style="padding:4px 10px;font-size:0.8rem;">
                💾 ذخیره
              </button>
              <button class="btn btn-secondary btn-sm delete-city-btn" 
                type="button" data-city="${esc(city)}" data-province="${esc(province)}"
                style="padding:4px 10px;font-size:0.8rem;background:#fef2f2;color:#b91c1c;border-color:#fecaca;">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }

    html += `
            </tbody>
          </table>
        </div>
        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <button class="btn btn-primary" type="button" id="save-all-costs-btn-bottom" data-province="${esc(province)}">💾 ذخیره همه تغییرات</button>
          <span style="color:#64748b;font-size:0.9rem;">تغییرات را می‌توانید تک‌تک یا یکجا ذخیره کنید.</span>
          <span style="color:#94a3b8;font-size:0.85rem;margin-right:auto;">
            🔵 تهران و اطراف → اسنپ‌باکس | 🟢 سایر شهرها → ارسال با باربری
          </span>
        </div>
      </div>
    `;

    resultDiv.innerHTML = html;

    attachCostEvents(province);

    document.getElementById("add-city-btn")?.addEventListener("click", function() {
      const form = document.getElementById("add-city-form");
      if (form) form.style.display = "block";
      document.getElementById("new-city-name")?.focus();
    });

    document.getElementById("cancel-new-city-btn")?.addEventListener("click", function() {
      document.getElementById("add-city-form").style.display = "none";
      document.getElementById("new-city-name").value = "";
    });

    document.getElementById("save-new-city-btn")?.addEventListener("click", async function() {
      const province = this.getAttribute("data-province");
      const cityName = document.getElementById("new-city-name").value.trim();
      
      if (!cityName) {
        alert("لطفاً نام شهر را وارد کنید.");
        return;
      }

      const cities = PROVINCES_DATA[province] || [];
      if (cities.includes(cityName)) {
        alert(`شهر "${cityName}" قبلاً در این استان وجود دارد.`);
        return;
      }

      cities.push(cityName);
      PROVINCES_DATA[province] = cities;

      const result = await api("/api/admin/shipping", {
        method: "POST",
        body: JSON.stringify({
          action: "add_city",
          province: province,
          city: cityName
        })
      });

      if (result.ok && result.data?.success) {
        alert(`شهر "${cityName}" با موفقیت اضافه شد.`);
        document.getElementById("add-city-form").style.display = "none";
        document.getElementById("new-city-name").value = "";
        await refreshCurrentCosts(province);
      } else {
        alert(result.data?.error || "افزودن شهر انجام نشد.");
      }
    });
  }

  // ============================================
  // ✅ اتصال رویدادها به المان‌های هزینه
  // ============================================
  function attachCostEvents(province) {
    function updateTotalCost(row) {
      const baseCostEl = row.querySelector("td:nth-child(3)");
      const extraInput = row.querySelector(".cost-extra-input");
      const totalEl = row.querySelector("td:nth-child(5)");
      
      if (baseCostEl && extraInput && totalEl) {
        const baseCost = parseToman(baseCostEl.textContent);
        const extraCost = parseToman(extraInput.value);
        const totalCost = baseCost + extraCost;
        totalEl.textContent = formatToman(totalCost);
      }
    }

    document.querySelectorAll(".cost-extra-input").forEach(input => {
      input.addEventListener("input", function() {
        const raw = toEnglishDigits(this.value).replace(/,/g, "");
        const num = Number(raw);
        if (!isNaN(num) && num >= 0 && raw !== "") {
          this.value = formatToman(num);
        }
        const row = this.closest("tr");
        updateTotalCost(row);
      });
    });

    document.querySelectorAll(".shipping-method-select").forEach(select => {
      select.addEventListener("change", function() {
        const methodId = Number(this.value);
        const method = SHIPPING_METHODS.find(m => m.id === methodId);
        const row = this.closest("tr");
        
        const baseCostEl = row.querySelector("td:nth-child(3)");
        if (baseCostEl && method) {
          baseCostEl.textContent = formatToman(method.default_cost || 0);
        }
        
        const deliveryDiv = this.nextElementSibling;
        if (deliveryDiv && method) {
          deliveryDiv.textContent = `⏱️ ${method.delivery_time || "زمان تحویل از روش انتخاب شده خوانده می‌شود"}`;
        }
        
        const cityCell = row.querySelector("td:first-child");
        if (cityCell && method) {
          const smalls = cityCell.querySelectorAll("small");
          if (smalls.length >= 2) {
            smalls[1].textContent = `⏱️ تحویل: ${method.delivery_time || "نامشخص"}`;
          }
        }
        
        updateTotalCost(row);
      });
    });

    document.querySelectorAll(".cost-active-checkbox").forEach(cb => {
      cb.addEventListener("change", function() {
        const label = this.closest("label");
        if (this.checked) {
          label.innerHTML = '🟢 فعال';
        } else {
          label.innerHTML = '🔴 غیرفعال';
        }
        label.prepend(this);
      });
    });

    document.querySelectorAll(".save-single-cost-btn").forEach(btn => {
      btn.addEventListener("click", async function() {
        const city = this.getAttribute("data-city");
        const province = this.getAttribute("data-province");
        const row = this.closest("tr");
        await saveSingleCityCost(row, city, province);
      });
    });

    document.querySelectorAll(".delete-city-btn").forEach(btn => {
      btn.addEventListener("click", async function() {
        const city = this.getAttribute("data-city");
        const province = this.getAttribute("data-province");
        
        if (!city || !province) return;
        
        if (confirm(`آیا از حذف شهر "${city}" از استان "${province}" مطمئن هستید؟`)) {
          const result = await api("/api/admin/shipping", {
            method: "POST",
            body: JSON.stringify({
              action: "delete_city",
              province: province,
              city: city
            })
          });

          if (result.ok && result.data?.success) {
            alert(`شهر "${city}" با موفقیت حذف شد.`);
            const cities = PROVINCES_DATA[province] || [];
            const index = cities.indexOf(city);
            if (index > -1) {
              cities.splice(index, 1);
              PROVINCES_DATA[province] = cities;
            }
            await refreshCurrentCosts(province);
          } else {
            alert(result.data?.error || "حذف شهر انجام نشد.");
          }
        }
      });
    });

    document.querySelectorAll("#save-all-costs-btn-bottom").forEach(btn => {
      btn.addEventListener("click", async function() {
        const province = this.getAttribute("data-province");
        await saveAllCityCosts(province);
      });
    });
  }

  // ============================================
  // ✅ تابع ذخیره هزینه یک شهر
  // ============================================
  async function saveSingleCityCost(row, city, province) {
    const methodSelect = row.querySelector(".shipping-method-select");
    const methodId = Number(methodSelect.value);
    const methodName = methodSelect.options[methodSelect.selectedIndex].text;
    
    const extraCost = parseToman(row.querySelector(".cost-extra-input").value);
    const isActive = row.querySelector(".cost-active-checkbox").checked;

    const method = SHIPPING_METHODS.find(m => m.id === methodId);
    const defaultCost = method ? method.default_cost || 0 : 0;

    if (!methodId) {
      alert("روش ارسال برای این شهر مشخص نیست.");
      return;
    }

    const existingCosts = await loadShippingCosts(province, city);
    for (const cost of existingCosts) {
      if (cost.shipping_method_id !== methodId) {
        await api("/api/admin/shipping", {
          method: "POST",
          body: JSON.stringify({
            action: "delete_cost",
            cost_id: cost.id
          })
        });
      }
    }

    const result = await api("/api/admin/shipping", {
      method: "POST",
      body: JSON.stringify({
        action: "save_cost",
        province: province,
        city: city,
        shipping_method_id: methodId,
        cost_type: "extra",
        extra_cost: extraCost,
        delivery_time: "",
        is_active: isActive
      })
    });

    const msgDiv = document.getElementById("cost-save-message");
    if (result.ok && result.data?.success) {
      const finalCost = defaultCost + extraCost;
      msgDiv.innerHTML = `<p style="color:#047857;">✅ هزینه نهایی شهر ${esc(city)}: ${formatToman(finalCost)} تومان (ثابت: ${formatToman(defaultCost)} + مازاد: ${formatToman(extraCost)})</p>`;
      await refreshCurrentCosts(province);
      setTimeout(() => { msgDiv.innerHTML = ""; }, 3000);
    } else {
      msgDiv.innerHTML = `<p style="color:#b91c1c;">❌ ${result.data?.error || "ذخیره انجام نشد."}</p>`;
    }
  }

  // ============================================
  // تابع ذخیره همه هزینه‌ها
  // ============================================
  async function saveAllCityCosts(province) {
    const rows = document.querySelectorAll("#cost-result tbody tr");
    const msgDiv = document.getElementById("cost-save-message");
    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      const city = row.getAttribute("data-city");
      const methodSelect = row.querySelector(".shipping-method-select");
      const methodId = Number(methodSelect.value);
      
      const extraCost = parseToman(row.querySelector(".cost-extra-input").value);
      const isActive = row.querySelector(".cost-active-checkbox").checked;

      if (!methodId) continue;

      const method = SHIPPING_METHODS.find(m => m.id === methodId);
      const defaultCost = method ? method.default_cost || 0 : 0;

      const existingCosts = await loadShippingCosts(province, city);
      for (const cost of existingCosts) {
        if (cost.shipping_method_id !== methodId) {
          await api("/api/admin/shipping", {
            method: "POST",
            body: JSON.stringify({
              action: "delete_cost",
              cost_id: cost.id
            })
          });
        }
      }

      const result = await api("/api/admin/shipping", {
        method: "POST",
        body: JSON.stringify({
          action: "save_cost",
          province: province,
          city: city,
          shipping_method_id: methodId,
          cost_type: "extra",
          extra_cost: extraCost,
          delivery_time: "",
          is_active: isActive
        })
      });

      if (result.ok && result.data?.success) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    if (errorCount === 0) {
      msgDiv.innerHTML = `<p style="color:#047857;">✅ همه ${successCount} شهر با موفقیت ذخیره شدند.</p>`;
    } else {
      msgDiv.innerHTML = `<p style="color:#b91c1c;">⚠️ ${successCount} مورد ذخیره شد، ${errorCount} مورد خطا داشت.</p>`;
    }
    
    await refreshCurrentCosts(province);
    setTimeout(() => { msgDiv.innerHTML = ""; }, 4000);
  }

  // ============================================
  // رندر تب ارسال رایگان
  // ============================================
  function renderFree(container) {
    if (!container) {
      console.warn("renderFree: container not found");
      return;
    }

    container.innerHTML = `
      <div class="detail-card">
        <h4>🎁 تنظیمات ارسال رایگان</h4>
        <p class="admin-help">اگر مبلغ سفارش بیشتر از مقدار تعیین شده باشد، هزینه ارسال رایگان محاسبه می‌شود.</p>
        
        <div class="filters-grid filters-grid-2">
          <div class="form-field">
            <label>حداقل مبلغ سفارش برای ارسال رایگان (تومان)</label>
            <input id="free-threshold-simple" type="text" value="۳,۰۰۰,۰۰۰" style="width:100%;padding:14px 16px;border:1px solid #dbe2ea;border-radius:16px;" />
          </div>
          <div class="form-field" style="justify-content:flex-end;">
            <button class="btn btn-primary" type="button" onclick="alert('ذخیره تنظیمات در حال توسعه...')">ذخیره تنظیمات</button>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================
  // رندر اصلی - اصلاح شده با تاخیر بیشتر
  // ============================================
  function render() {
    console.log("🎨 Rendering shipping panel...");
    
    try {
      const methodsContainer = document.getElementById("shipping-tab-methods");
      const costsContainer = document.getElementById("shipping-tab-costs");
      const freeContainer = document.getElementById("shipping-tab-free");

      console.log("📦 Containers found:", {
        methods: !!methodsContainer,
        costs: !!costsContainer,
        free: !!freeContainer
      });

      if (methodsContainer) {
        console.log("📦 Rendering methods...");
        renderMethods(methodsContainer);
      } else {
        console.warn("⚠️ methodsContainer not found!");
      }
      
      if (costsContainer) {
        console.log("💰 Rendering costs...");
        renderCosts(costsContainer);
      } else {
        console.warn("⚠️ costsContainer not found!");
      }
      
      if (freeContainer) {
        console.log("🎁 Rendering free...");
        renderFree(freeContainer);
      } else {
        console.warn("⚠️ freeContainer not found!");
      }
      
      console.log("✅ Shipping panel rendered successfully");
    } catch (error) {
      console.error("❌ Error in render:", error);
    }
  }

  // ============================================
  // مقداردهی اولیه - اصلاح شده با تاخیر بیشتر
  // ============================================
  function init() {
    console.log("🔄 Shipping Admin initializing...");
    
    loadProvinces().then(() => {
      console.log("✅ Provinces loaded");
      return loadShippingMethods();
    }).then(() => {
      console.log("✅ Shipping methods loaded");
      // ✅ تاخیر 500 میلی‌ثانیه برای اطمینان از کامل شدن DOM
      setTimeout(function() {
        render();
      }, 500);
    }).catch((err) => {
      console.error("❌ Error in init:", err);
    });
  }

  // ============================================
  // صادر کردن توابع
  // ============================================
  window.ShippingAdmin = {
    init: init,
    render: render,
    renderMethods: renderMethods,
    renderCosts: renderCosts,
    renderFree: renderFree,
    loadMethods: loadShippingMethods,
    loadProvinces: loadProvinces
  };

  console.log("ShippingAdmin available:", !!window.ShippingAdmin);
})(); 