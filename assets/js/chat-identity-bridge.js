(function () {
  const origin = 'https://chat.takdaro.com', api = window.TakdaroChat;
  if (!api || api.__identityBridge) return;
  api.__identityBridge = true;

  const originalSetContext = api.setContext;
  const originalSetDraft = api.setDraft;
  let readyFrame = null, pending = false, inFlight = false, pendingContext = api.__pendingContext || null;

  let authGeneration=0;
  function logoutAt(){try{return Number(localStorage.getItem('takdaro:logout-at'))||0;}catch{return 0;}}
  function notifyLogout(){
    authGeneration++;pending=false;
    const frame=document.querySelector('iframe.takdaro-chat-frame');
    if(frame)frame.contentWindow.postMessage({type:'takdaro:logout'},origin);
  }
  window.addEventListener('takdaro:logout',notifyLogout);
  window.addEventListener('storage',event=>{if(event.key==='takdaro:logout-at')notifyLogout();});

  function getVisibleFrame() {
    const frame = document.querySelector('iframe.takdaro-chat-frame');
    if (!frame || frame.style.display === 'none') return null;
    return frame;
  }

  function sendContext() {
    const frame = getVisibleFrame();
    if (!frame || !pendingContext) return;

    frame.contentWindow.postMessage({ type: 'takdaro:context', context: pendingContext }, origin);

    if (pendingContext.draftMessage) {
      frame.contentWindow.postMessage({
        type: 'takdaro:draft',
        draftMessage: pendingContext.draftMessage,
        section: pendingContext.section,
        sectionKey: pendingContext.sectionKey,
        sectionSlug: pendingContext.sectionSlug,
        sectionLabel: pendingContext.sectionLabel,
        department: pendingContext.department,
        category: pendingContext.category,
        topic: pendingContext.topic,
        context: pendingContext
      }, origin);
    }
  }

  api.setContext = function (context) {
    if (typeof originalSetContext === 'function') {
      originalSetContext.call(this, context);
    }

    pendingContext = context || null;
    api.__pendingContext = pendingContext;
    sendContext();
  };

  api.setDraft = function (draftMessage, context) {
    if (typeof originalSetDraft === 'function') {
      originalSetDraft.call(this, draftMessage, context);
    }

    pendingContext = Object.assign({}, context || pendingContext || {}, { draftMessage: draftMessage || '' });
    api.__pendingContext = pendingContext;
    sendContext();
  };

  async function identify() {
    const frame = getVisibleFrame();
    if (!pending || inFlight || !frame || readyFrame !== frame) return;
    pending = false; inFlight = true;
    const generation=authGeneration;

    try {
      const response = await fetch('/api/chat/identity-token', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if(generation!==authGeneration)return;
      if (response.ok && data.success && data.token)
        frame.contentWindow.postMessage({ type: 'takdaro:identity', token: data.token }, origin);
      else frame.contentWindow.postMessage({ type: response.status === 401 ? 'takdaro:guest' : 'takdaro:identity-error', logoutAt: logoutAt() }, origin);
      sendContext();
    } catch (_) { frame.contentWindow.postMessage({ type: 'takdaro:identity-error' }, origin); }
    finally { inFlight = false; if (pending) identify(); }
  }

  window.addEventListener('message', function (event) {
    const frame = document.querySelector('iframe.takdaro-chat-frame');
    if (!frame || event.origin !== origin || event.source !== frame.contentWindow || !['takdaro:ready', 'takdaro:identity-retry'].includes(event.data?.type)) return;
    if (event.data.type === 'takdaro:identity-retry') pending = true;
    readyFrame = frame; identify(); sendContext();
  });

  for (const method of ['open', 'toggle']) {
    const original = api[method];
    if (typeof original !== 'function') continue;

    api[method] = function () {
      const wasOpen = !!document.querySelector('iframe.takdaro-chat-frame[style*="display: block"]');
      const result = original.apply(this, arguments);
      const frame = getVisibleFrame();
      const button = document.querySelector('.takdaro-chat-button');
      if (button) button.style.display = (!wasOpen && method === 'toggle') || method === 'open' ? 'none' : 'block';
      if (frame) {
        pending = true;
        frame.contentWindow.postMessage({ type: 'takdaro:init', context: pendingContext || api.__pendingContext || null }, origin);
        sendContext();
        identify();
      }
      return result;
    };
  }

  function frameInit() {
    const frame = getVisibleFrame();
    if (frame) frame.contentWindow.postMessage({ type: 'takdaro:init' }, origin);
  }

  if (getVisibleFrame()) {
    pending = true;
    frameInit();
  }

  window.addEventListener('focus', () => {
    if (getVisibleFrame()) { pending = true; identify(); }
  });
})();

