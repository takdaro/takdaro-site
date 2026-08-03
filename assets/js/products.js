window.PRODUCTS = [];
window.PRODUCTS_READY = false;
window.PRODUCTS_LOADING = null;

// ============================================
// بارگذاری محصولات از API
// ============================================
async function loadProductsFromApi() {
  try {
    const response = await fetch('/api/products');
    const data = await response.json();
    
    if (data.success && Array.isArray(data.products)) {
      window.PRODUCTS = data.products;
      window.PRODUCTS_READY = true;
      
      // ارسال رویداد
      document.dispatchEvent(new CustomEvent("products:ready", {
        detail: { products: window.PRODUCTS }
      }));
      
      return window.PRODUCTS;
    } else {
      console.warn('محصولی از API دریافت نشد:', data.error);
      window.PRODUCTS = [];
      window.PRODUCTS_READY = true;
      return [];
    }
  } catch (error) {
    console.error('خطا در دریافت محصولات:', error);
    window.PRODUCTS = [];
    window.PRODUCTS_READY = true;
    return [];
  }
}

// ============================================
// تابع برای استفاده در صفحات دیگر
// ============================================
function getProducts() {
  return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
}

function getProductBySlug(slug) {
  return getProducts().find(p => p.slug === slug) || null;
}

function getProductById(id) {
  return getProducts().find(p => p.id === Number(id)) || null;
}

// ============================================
// بارگذاری اولیه
// ============================================
window.PRODUCTS_LOADING = loadProductsFromApi();

// اگر صفحه قبل از بارگذاری کامل نیاز به محصولات داشت
document.addEventListener('DOMContentLoaded', function() {
  // اگر محصولات قبلاً بارگذاری نشده بودند
  if (!window.PRODUCTS_READY) {
    window.PRODUCTS_LOADING.then(() => {
      // رویداد قبلاً ارسال شده، اما برای اطمینان دوباره ارسال می‌کنیم
      document.dispatchEvent(new CustomEvent("products:ready", {
        detail: { products: window.PRODUCTS }
      }));
    });
  }
});