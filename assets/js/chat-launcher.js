(function () {
  "use strict";

  const sdkUrl = "https://chat.takdaro.com/embed.js?v=identity-ready-2";

  function loadSdk(done) {
    if (window.TakdaroChat && typeof window.TakdaroChat.open === "function") {
      done();
      return;
    }

    let script = document.querySelector("script[data-takdaro-chat-sdk]");
    if (!script) {
      script = document.createElement("script");
      script.src = sdkUrl;
      script.async = true;
      script.dataset.takdaroChatSdk = "true";
      document.head.appendChild(script);
    }

    script.addEventListener("load", done, { once: true });
  }

  function openChat(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    loadSdk(function () {
      if (typeof window.TakdaroChat?.open === "function") {
        window.TakdaroChat.open();
      }
    });
  }

  function bind() {
    document.querySelectorAll("[data-chat-trigger]").forEach((button) => {
      if (button.dataset.chatFallbackBound === "true") return;
      button.dataset.chatFallbackBound = "true";
      button.addEventListener("click", openChat, true);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})();
