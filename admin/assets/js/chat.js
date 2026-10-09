(function () {
  'use strict';
  window.loadChatAdmin = async function () {
    const body = document.querySelector('#chat-admin-body'), search = document.querySelector('#chat-admin-search'), refresh = document.querySelector('#chat-admin-refresh'), pane = document.querySelector('#chat-main-body');
    if (!body || !search || !refresh || !pane || refresh.dataset.ready === '1') return;
    refresh.dataset.ready = '1';
    let rooms = [], activeRoomId = null, view = null, polling = false;
    const drafts = new Map();
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const endpoint = id => '/api/admin/chat/rooms/' + encodeURIComponent(id);
    const isAdminMessage = message => message.role === 'admin' || (!message.role && message.sender === 'ادمین');
    const lightbox = document.querySelector('#chat-image-lightbox');
    if (lightbox) document.body.appendChild(lightbox);
    function closeImage() { if (lightbox) { lightbox.hidden = true; lightbox.querySelector('img').removeAttribute('src'); } }
    lightbox?.addEventListener('click', e => { if (e.target === lightbox || e.target.closest('button')) closeImage(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeImage(); });
    pane.addEventListener('click', async e => {
      const img = e.target.closest('.chat-history img');
      if (img && lightbox) {
        const id = activeRoomId;
        if (img.refreshChatImage) await img.refreshChatImage(true);
        if (id !== activeRoomId || !img.isConnected) return;
        lightbox.querySelector('img').src = img.src;
        const link = lightbox.querySelector('a'); if (link) link.href = img.src;
        lightbox.hidden = false;
      }
    });
    function attachImageRefresh(img, message, current) {
      let path = message.path, busy = false, attempted = false;
      if (!path) {
        try {
          const address = new URL(message.url);
          if (address.hostname === 'jodfggzgazbaxymxptwy.supabase.co') {
            const match = address.pathname.match(/^\/storage\/v1\/object\/(?:sign|public)\/chat-images\/(.+)$/);
            if (match) path = decodeURIComponent(match[1]);
          }
        } catch {}
      }
      img.refreshChatImage = async manual => {
        if (!path || busy || (!manual && attempted)) return;
        busy = true; attempted = true;
        try {
          const response = await fetch('/api/admin/chat/image-url?path=' + encodeURIComponent(path), { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error();
          const image = await response.json();
          if (view !== current || !img.isConnected || !String(image.url || '').startsWith('https://')) return;
          img.src = image.url;
          img.title = '';
        } catch { img.title = 'تصویر دریافت نشد؛ برای تلاش دوباره کلیک کنید.'; }
        finally { busy = false; }
      };
      img.addEventListener('error', () => void img.refreshChatImage(false));
      if (img.complete && !img.naturalWidth) void img.refreshChatImage(false);
    }
    pane.addEventListener('click', async e => {
      const button = e.target.closest('[data-message-action]'), current = view, id = activeRoomId;
      if (!button || !current || !id) return;
      const message = current.messages?.[Number(button.dataset.index)];
      if (!message) return;
      if (button.dataset.messageAction === 'copy') {
        try { await navigator.clipboard.writeText(message.text || ''); button.title = 'کپی شد'; }
        catch { alert('کپی انجام نشد؛ متن را انتخاب و کپی کنید.'); }
        return;
      }
      if (!isAdminMessage(message) || !message.id || !current.capabilities?.edit) return;
      const text = prompt('ویرایش پیام مدیریتی', message.text || '');
      if (text === null || !text.trim() || text === message.text) return;
      if (text.length > 4000) { alert('حداکثر طول پیام ۴۰۰۰ نویسه است.'); return; }
      button.disabled = true;
      try {
        const response = await fetch(endpoint(id), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'edit', messageId: message.id, expectedText: message.text || '', text }), signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(response.status === 409 ? 'پیام هم‌زمان تغییر کرده؛ تاریخچه را تازه کنید.' : 'ویرایش انجام نشد.');
        if (view === current && activeRoomId === id) await loadHistory();
      } catch (error) { alert(error.message || 'ویرایش انجام نشد.'); }
      finally { button.disabled = false; }
    });
    function draft(id) {
      if (!drafts.has(id)) drafts.set(id, {text:'', file:null, preview:null, saved:null, uploading:false, sending:false, progress:0, error:'', notice:'', xhr:null, version:0});
      return drafts.get(id);
    }
    function renderRooms() {
      const q = search.value.trim().toLowerCase();
      const list = rooms.filter(r => !q || String(r.sender || '').toLowerCase().includes(q) || String(r.phone || '').includes(q) || String(r.email || '').toLowerCase().includes(q)).sort((a,b)=>Number(b.sentAt||0)-Number(a.sentAt||0));
      body.innerHTML = list.length ? list.map(r => '<button type="button" class="chat-list-item' + (r.roomId === activeRoomId ? ' active' : '') + '" data-room="' + esc(r.roomId) + '"><span><strong>' + esc(r.sender || 'نامشخص') + '</strong><small>' + esc(r.phone || 'ثبت نشده') + '</small>' + (Number(r.unread || 0) > 0 && r.roomId !== activeRoomId ? '<i class="chat-unread-dot"></i>' : '') + '</span></button>').join('') : '<div class="admin-loading">گفتگویی پیدا نشد.</div>';
    }
    body.addEventListener('click', e => { const button = e.target.closest('[data-room]'); if (button) selectRoom(button.dataset.room); });
    function updateComposer(id) {
      if (activeRoomId !== id || !view) return;
      const d = draft(id);
      view.preview.hidden = !d.file;
      if (d.preview) view.image.src = d.preview; else view.image.removeAttribute('src');
      view.name.textContent = d.file ? d.file.name : '';
      view.status.textContent = d.error || (d.uploading ? (d.progress < 100 ? 'در حال بارگذاری عکس… ' + d.progress + '٪' : 'در حال آماده‌سازی تصویر…') : d.sending ? 'در حال ارسال…' : d.saved ? 'عکس بارگذاری شد؛ برای ارسال دکمه سبز را بزنید.' : d.notice);
      view.status.classList.toggle('is-error', Boolean(d.error));
      view.progress.hidden = !d.uploading; view.progress.value = d.progress;
      view.retry.hidden = !d.file || d.uploading || Boolean(d.saved) || d.sending;
      view.send.disabled = d.uploading || d.sending || Boolean(d.file && !d.saved);
      view.file.disabled = d.sending; view.input.disabled = d.sending; view.remove.disabled = d.sending;
    }
    function clearAttachment(d) {
      d.version++;
      if (d.xhr) d.xhr.abort();
      if (d.preview) URL.revokeObjectURL(d.preview);
      Object.assign(d, {file:null, preview:null, saved:null, uploading:false, xhr:null, progress:0, error:'', notice:''});
    }
    function upload(id) {
      const d = draft(id);
      if (!d.file || d.uploading || d.sending) return;
      const version = ++d.version, xhr = new XMLHttpRequest();
      Object.assign(d, {xhr, uploading:true, error:'', saved:null, progress:0, notice:''});
      const fail = text => {
        if (d.version !== version) return;
        d.uploading = false; d.xhr = null; d.error = text; updateComposer(id);
      };
      xhr.open('POST', '/api/admin/chat/upload'); xhr.timeout = 180000;
      xhr.setRequestHeader('content-type', d.file.type);
      // HTTP header values must be ASCII; keep the original name in the chat message.
      xhr.setRequestHeader('x-file-name', encodeURIComponent(d.file.name));
      xhr.upload.onprogress = e => {
        if (d.version !== version) return;
        if (e.lengthComputable) d.progress = Math.round(e.loaded * 100 / e.total);
        updateComposer(id);
      };
      xhr.onerror = () => fail('ارتباط هنگام بارگذاری قطع شد؛ دوباره تلاش کنید.');
      xhr.ontimeout = () => fail('زمان بارگذاری تمام شد؛ دوباره تلاش کنید.');
      xhr.onload = () => {
        if (d.version !== version) return;
        let data;
        try { data = JSON.parse(xhr.responseText); } catch { return fail('پاسخ بارگذاری معتبر نبود؛ دوباره تلاش کنید.'); }
        if (xhr.status < 200 || xhr.status >= 300 || !data.path || !String(data.url || '').startsWith('https://')) {
          return fail(xhr.status === 413 ? 'حداکثر حجم عکس ۲۰ مگابایت است.' : xhr.status === 401 || xhr.status === 403 ? 'نشست مدیریت معتبر نیست؛ دوباره وارد پنل شوید.' : 'بارگذاری انجام نشد (کد ' + xhr.status + ')؛ دوباره تلاش کنید.');
        }
        d.saved = {type:'image', url:data.url, path:data.path, name:d.file.name};
        d.uploading = false; d.xhr = null; updateComposer(id);
      };
      updateComposer(id);
      try { xhr.send(d.file); } catch { fail('شروع بارگذاری ناموفق بود؛ دوباره تلاش کنید.'); }
    }
    async function send(id) {
      const d = draft(id);
      if (d.uploading || d.sending || (d.file && !d.saved)) return;
      const text = d.text.trim(); if (!text && !d.saved) return;
      const payload = d.saved ? {...d.saved, text} : {type:'message', text};
      d.sending = true; d.error = ''; updateComposer(id);
      try {
        const response = await fetch(endpoint(id), {method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'}, body:JSON.stringify(payload), signal:AbortSignal.timeout(30000)});
        if (!response.ok) throw new Error('ارسال انجام نشد (کد ' + response.status + ').');
        clearAttachment(d); d.text = ''; d.notice = 'پیام ارسال شد.';
        if (activeRoomId === id) { view.input.value = ''; view.file.value = ''; await loadHistory(true); }
      } catch (e) {
        d.error = e.name === 'TimeoutError' ? 'پاسخ ارسال دریافت نشد؛ قبل از تلاش مجدد تاریخچه را بررسی کنید.' : e.message || 'ارسال انجام نشد؛ دوباره تلاش کنید.';
      } finally { d.sending = false; updateComposer(id); }
    }
    const deleteButton = document.querySelector('#chat-admin-delete');
    async function deleteRoom() {
      if (!activeRoomId || !deleteButton || deleteButton.disabled) return;
      const room = rooms.find(r => r.roomId === activeRoomId);
      const name = room?.sender || 'این مشتری';
      if (!confirm(`تمام پیام‌ها و تصاویر مکالمه ${name} برای همیشه حذف شود؟\nاین عملیات قابل بازگشت نیست.`)) return;
      deleteButton.disabled = true;
      deleteButton.textContent = 'در حال حذف…';
      try {
        const response = await fetch(endpoint(activeRoomId), { method:'DELETE', credentials:'same-origin', signal:AbortSignal.timeout(120000) });
        if (!response.ok) throw new Error(`حذف انجام نشد (کد ${response.status}).`);
        drafts.delete(activeRoomId); rooms = rooms.filter(r => r.roomId !== activeRoomId); activeRoomId = null; view = null;
        pane.innerHTML = '<div class="chat-main-empty"><h3>یک گفتگو را انتخاب کنید</h3><p>مکالمه حذف شد.</p></div>';
        document.querySelector('#chat-selected-title').textContent = 'مدیریت چت آنلاین'; renderRooms();
      } catch (error) {
        alert(error.message || 'حذف مکالمه انجام نشد.');
      } finally {
        deleteButton.textContent = '🗑 حذف مکالمه'; deleteButton.disabled = !activeRoomId;
      }
    }
    deleteButton?.addEventListener('click', deleteRoom);
    function selectRoom(id) {
      if (activeRoomId === id) return;
      activeRoomId = id; renderRooms(); if (deleteButton) deleteButton.disabled = false;
      const selectedRoom = rooms.find(r => r.roomId === id);
      document.querySelector('#chat-selected-title').textContent = selectedRoom ? (selectedRoom.sender || 'مشتری') + (selectedRoom.department ? ' · ' + selectedRoom.department : '') : 'مشتری';
      const d = draft(id);
      pane.innerHTML = '<div class="chat-history"></div><div class="chat-attachment-preview" hidden><img alt="پیش‌نمایش عکس"><span class="chat-attachment-name"></span><button type="button" data-remove>حذف عکس</button><button type="button" data-retry>تلاش دوباره</button></div><div class="chat-upload-status" role="status" aria-live="polite"></div><progress class="chat-upload-progress" max="100" hidden></progress><form class="chat-reply-form"><button type="submit" aria-label="ارسال">➤</button><label class="chat-admin-attach" title="انتخاب عکس تا ۲۰ مگابایت"><svg viewBox="0 0 64 48" aria-hidden="true"><path d="M8 13h12l3-7h18l3 7h12c4 0 7 3 7 7v19c0 4-3 7-7 7H8c-4 0-7-3-7-7V20c0-4 3-7 7-7Z" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="32" cy="29" r="10" fill="none" stroke="currentColor" stroke-width="4"/></svg><input type="file" accept="image/*" aria-label="انتخاب عکس" hidden></label><input type="text" placeholder="پیام خود را بنویسید" aria-label="متن پیام"></form>';
      view = {history:pane.querySelector('.chat-history'), preview:pane.querySelector('.chat-attachment-preview'), image:pane.querySelector('.chat-attachment-preview img'), name:pane.querySelector('.chat-attachment-name'), remove:pane.querySelector('[data-remove]'), retry:pane.querySelector('[data-retry]'), status:pane.querySelector('.chat-upload-status'), progress:pane.querySelector('progress'), form:pane.querySelector('form'), file:pane.querySelector('input[type=file]'), input:pane.querySelector('input[type=text]'), send:pane.querySelector('button[type=submit]'), sequence:0, fingerprint:null};
      const current = view;
      current.input.value = d.text;
      current.input.addEventListener('input', () => { d.text = current.input.value; });
      current.file.addEventListener('change', () => {
        const file = current.file.files[0]; if (!file) return;
        if (!file.type.startsWith('image/') || !file.size || file.size > 20 * 1024 * 1024) {
          d.error = 'یک تصویر با حجم حداکثر ۲۰ مگابایت انتخاب کنید.'; current.file.value = ''; updateComposer(id); return;
        }
        clearAttachment(d); d.file = file; d.preview = URL.createObjectURL(file); upload(id);
      });
      current.remove.addEventListener('click', () => { clearAttachment(d); current.file.value = ''; updateComposer(id); });
      current.retry.addEventListener('click', () => upload(id));
      current.form.addEventListener('submit', e => { e.preventDefault(); send(id); });
      updateComposer(id); loadHistory(true);
    }
    async function loadHistory(forceScroll = false) {
      const id = activeRoomId, current = view; if (!id || !current) return;
      if (document.visibilityState !== 'visible' || !pane.getClientRects().length) return;
      const sequence = ++current.sequence;
      try {
        const response = await fetch(endpoint(id), {credentials:'same-origin', cache:'no-store', signal:AbortSignal.timeout(15000)});
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (view !== current || sequence !== current.sequence) return;
        const messages = Array.isArray(data.messages) ? data.messages : [], fingerprint = JSON.stringify(messages);
        current.messages = messages;
        current.capabilities = data.capabilities || {};
        const unread = current.capabilities.readReceipts ? messages.filter(message => message.id && !message.readAt && !isAdminMessage(message)) : [];
        if (unread.length) {
          requestAnimationFrame(() => {
            if (view !== current || activeRoomId !== id || document.visibilityState !== 'visible' || !pane.getClientRects().length) return;
            void fetch(endpoint(id), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'read', messages: unread.map(message => ({ id: message.id, revision: Number(message.editedAt || message.sentAt || 0) })) }), signal: AbortSignal.timeout(15000) }).catch(() => {});
          });
        }
        if (fingerprint === current.fingerprint) return;
        const history = current.history, nearBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 80;
        current.fingerprint = fingerprint;
        history.innerHTML = messages.length ? messages.map((m, index) => '<div class="chat-history-msg ' + (isAdminMessage(m) ? 'is-admin' : 'is-customer') + '"><small>' + esc(m.sender || 'پیام') + ' · ' + (m.sentAt ? esc(new Date(m.sentAt).toLocaleString('fa-IR')) : '') + '</small>' + (m.type === 'image' && String(m.url || '').startsWith('https://') ? '<img src="' + esc(m.url) + '" alt="' + esc(m.name || 'عکس ارسالی') + '" style="max-width:min(220px,100%);max-height:260px;border-radius:8px;display:block">' : '') + '<div style="user-select:text">' + esc(m.text || '') + '</div><small>' + (m.editedAt ? 'ویرایش‌شده · ' : '') + '<span style="color:' + (m.readAt ? '#087ea4' : '#667781') + '" title="' + (m.readAt ? 'خوانده‌شده توسط طرف مقابل' : 'ثبت‌شده؛ خواندن تأیید نشده') + '">' + (m.readAt ? '✓✓' : '✓') + '</span></small>' + (m.text ? '<button type="button" data-message-action="copy" data-index="' + index + '" title="کپی متن" aria-label="کپی متن">⧉</button>' : '') + (isAdminMessage(m) && m.id && current.capabilities.edit ? '<button type="button" data-message-action="edit" data-index="' + index + '" title="ویرایش پیام مدیریتی" aria-label="ویرایش پیام مدیریتی">✎</button>' : '') + '</div>').join('') : '<p>پیامی ثبت نشده است.</p>';
        history.querySelectorAll('.chat-history-msg').forEach((box, index) => {
          const img = box.querySelector('img');
          if (img) attachImageRefresh(img, messages[index], current);
        });
        if (forceScroll || nearBottom) {
          history.scrollTop = history.scrollHeight;
          history.querySelectorAll('img').forEach(img => img.addEventListener('load', () => { if (view === current) history.scrollTop = history.scrollHeight; }, {once:true}));
        }
      } catch { if (view === current && current.fingerprint === null) current.history.textContent = 'دریافت تاریخچه انجام نشد؛ در حال تلاش مجدد…'; }
    }
    async function loadRooms() {
      try {
        const response = await fetch('/api/admin/chat/rooms', {credentials:'same-origin', cache:'no-store', signal:AbortSignal.timeout(15000)});
        if (!response.ok) throw new Error();
        const data = await response.json(); rooms = Array.isArray(data.rooms) ? data.rooms : []; renderRooms();
      } catch { if (!rooms.length) body.textContent = 'دریافت گفتگوها انجام نشد.'; }
    }
    async function poll() {
      if (polling) return; polling = true;
      try { await Promise.all([loadRooms(), loadHistory()]); } finally { polling = false; }
    }
    search.addEventListener('input', renderRooms); refresh.addEventListener('click', poll);
    await loadRooms(); setInterval(poll, 4000);
  };
})();
