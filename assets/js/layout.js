(function () {
  function getBasePath() {
    const path = window.location.pathname;

    if (path.includes("/products/")) {
      return "../";
    }

    return "./";
  }

  async function loadPartial(targetId, filePath) {
    const target = document.getElementById(targetId);
    if (!target) return;

    try {
      const response = await fetch(filePath);
      const html = await response.text();
      const base = getBasePath();
      target.innerHTML = html.replaceAll("{{BASE}}", base);
    } catch (error) {
      console.error(`خطا در بارگذاری ${filePath}`, error);
    }
  }

  document.addEventListener("DOMContentLoaded", async function () {
    const base = getBasePath();

    await loadPartial("site-header", `${base}components/header.html`);
    await loadPartial("site-footer", `${base}components/footer.html`);
    await loadPartial("site-cart", `${base}components/cart-drawer.html`);

    document.dispatchEvent(new CustomEvent("layout:loaded"));
  });
})();