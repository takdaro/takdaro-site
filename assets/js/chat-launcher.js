(function () {
  "use strict";

  function openChat(event) {
    if (typeof window.openTakdaroChat !== "function") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.openTakdaroChat();
  }

  function bind() {
    document.querySelectorAll("[data-chat-trigger]").forEach((button) => {
      if (button.dataset.chatFallbackBound === "true") return;
      button.dataset.chatFallbackBound = "true";
      button.addEventListener("click", openChat, true);
    });
  }

  window.addEventListener("layout:loaded", bind);

  if (document.body) {
    new MutationObserver(bind).observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})();
