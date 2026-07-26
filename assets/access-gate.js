(function () {
  'use strict';

  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwz64jQW8YH6CEgH-GK4ieTyiJD40h5ro3udAQEr96j7dtqh9dgphwO-FmZyiSCXnUi/exec';
  var STORAGE_KEY = 'joy-portal-access-v1';
  var PRESENCE_DEVICE_KEY = 'joy-live-presence-device-v1';
  var TEACHER_PROFILE_KEY = 'joy-teacher-profile-v1';
  var HEARTBEAT_INTERVAL_MS = 30000;
  var memoryToken = '';
  var presenceTimer = null;
  var resolveReady;
  var ready = new Promise(function (resolve) { resolveReady = resolve; });

  document.documentElement.classList.add('portal-access-pending');
  installStyle();

  window.JoyPortalAccess = {
    ready: ready,
    getToken: function () { return memoryToken || storedToken(); }
  };

  onReady(start);

  function start() {
    var token = storedToken();
    showGate(Boolean(token));
    if (!token) return;
    request('validatePortalAccess', { accessToken: token }, function (data) {
      if (data && data.ok && data.allowed) grant(token);
      else {
        removeStoredToken();
        showGate(false);
      }
    }, function () {
      setMessage('The portal connection is unavailable. Please try again.', true);
      showRetry();
    });
  }

  function showGate(checking) {
    var existing = document.getElementById('portal-access-gate');
    if (existing) existing.remove();
    var gate = document.createElement('section');
    gate.id = 'portal-access-gate';
    gate.className = 'portal-access-gate';
    gate.setAttribute('aria-label', 'Student access');
    gate.innerHTML =
      '<div class="portal-access-card">' +
        '<div class="portal-access-brand">Joy SAT</div>' +
        '<h1>' + (checking ? 'Checking access…' : 'Student access') + '</h1>' +
        '<p class="portal-access-copy">' + (checking ? 'Please wait a moment.' : 'Please type your teacher’s first name. Use lowercase letters only.') + '</p>' +
        (checking ? '' : '<form id="portal-access-form"><label for="portal-access-answer">Teacher’s first name</label><input id="portal-access-answer" type="password" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" required><button type="submit">Continue</button></form>') +
        '<p class="portal-access-message" id="portal-access-message" aria-live="polite"></p>' +
      '</div>';
    document.body.appendChild(gate);
    var form = document.getElementById('portal-access-form');
    if (form) {
      form.addEventListener('submit', submitAnswer);
      window.setTimeout(function () { document.getElementById('portal-access-answer').focus(); }, 0);
    }
  }

  async function submitAnswer(event) {
    event.preventDefault();
    var input = document.getElementById('portal-access-answer');
    var button = event.currentTarget.querySelector('button');
    var answer = input.value.trim();
    if (!answer) return;
    button.disabled = true;
    button.textContent = 'Checking…';
    setMessage('', false);
    try {
      var answerHash = await sha256(answer);
      request('verifyPortalAccess', { answerHash: answerHash }, function (data) {
        if (data && data.ok && data.allowed && data.accessToken) {
          storeToken(data.accessToken);
          grant(data.accessToken);
          return;
        }
        button.disabled = false;
        button.textContent = 'Continue';
        input.select();
        setMessage('That name does not match. Check the spelling and use lowercase letters only.', true);
      }, function () {
        button.disabled = false;
        button.textContent = 'Try again';
        setMessage('The portal connection is unavailable. Please try again.', true);
      });
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Try again';
      setMessage('This browser cannot verify access. Please use an up-to-date browser.', true);
    }
  }

  function grant(token) {
    memoryToken = token;
    var gate = document.getElementById('portal-access-gate');
    if (gate) gate.remove();
    document.documentElement.classList.remove('portal-access-pending');
    document.documentElement.classList.add('portal-access-granted');
    resolveReady(token);
    document.dispatchEvent(new CustomEvent('joyportalaccess', { detail: { granted: true } }));
    startPresence(token);
  }

  function startPresence(token) {
    var parameters = new URLSearchParams(window.location.search);
    if (parameters.get('teacherPresence') === '1' || parameters.has('teacherAnswerToken')) {
      markTeacherProfile(token);
      return;
    }
    if (isTeacherProfile()) return;
    var deviceId = presenceDeviceId();
    if (!deviceId) return;
    stopPresence();
    heartbeatWhenVisible();
    presenceTimer = window.setInterval(heartbeatWhenVisible, HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', heartbeatWhenVisible);

    function heartbeatWhenVisible() {
      if (document.visibilityState === 'hidden') return;
      sendPresence('presenceHeartbeat', { deviceId: deviceId }, token);
    }
  }

  function markTeacherProfile(token) {
    var deviceId = '';
    stopPresence();
    try {
      localStorage.setItem(TEACHER_PROFILE_KEY, 'teacher');
      deviceId = localStorage.getItem(PRESENCE_DEVICE_KEY) || '';
      localStorage.removeItem(PRESENCE_DEVICE_KEY);
    } catch (error) {}
    if (deviceId) sendPresence('clearOwnPresence', { deviceId: deviceId }, token);
  }

  function stopPresence() {
    if (presenceTimer) window.clearInterval(presenceTimer);
    presenceTimer = null;
  }

  function isTeacherProfile() {
    try { return localStorage.getItem(TEACHER_PROFILE_KEY) === 'teacher'; } catch (error) { return false; }
  }

  function presenceDeviceId() {
    try {
      var existing = localStorage.getItem(PRESENCE_DEVICE_KEY) || '';
      if (existing) return existing;
      var created = window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      localStorage.setItem(PRESENCE_DEVICE_KEY, created);
      return created;
    } catch (error) {
      return '';
    }
  }

  function sendPresence(action, parameters, token) {
    var payload = Object.assign({ action: action, accessToken: token }, parameters);
    try {
      window.fetch(ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () {});
    } catch (error) {}
  }

  function showRetry() {
    var card = document.querySelector('.portal-access-card');
    if (!card || document.getElementById('portal-access-retry')) return;
    var button = document.createElement('button');
    button.id = 'portal-access-retry';
    button.type = 'button';
    button.textContent = 'Try again';
    button.addEventListener('click', start);
    card.appendChild(button);
  }

  function setMessage(message, isError) {
    var element = document.getElementById('portal-access-message');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('is-error', Boolean(isError));
  }

  function storedToken() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (error) { return memoryToken; }
  }

  function storeToken(token) {
    memoryToken = token;
    try { localStorage.setItem(STORAGE_KEY, token); } catch (error) {}
  }

  function removeStoredToken() {
    memoryToken = '';
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) {}
  }

  function sha256(value) {
    if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) return Promise.reject(new Error('Hashing unavailable'));
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then(function (buffer) {
      return Array.from(new Uint8Array(buffer)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
    });
  }

  function request(action, parameters, success, failure) {
    var callbackName = '__joyPortalGate' + Date.now() + Math.random().toString(16).slice(2);
    var script = document.createElement('script');
    var timeout = window.setTimeout(function () { cleanup(); failure(); }, 9000);
    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[callbackName] = function (data) { cleanup(); success(data); };
    script.onerror = function () { cleanup(); failure(); };
    var query = Object.keys(parameters).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(parameters[key]);
    });
    query.push('action=' + encodeURIComponent(action));
    query.push('callback=' + encodeURIComponent(callbackName));
    query.push('_=' + Date.now());
    script.src = ENDPOINT + '?' + query.join('&');
    document.head.appendChild(script);
  }

  function onReady(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
    else callback();
  }

  function installStyle() {
    var style = document.createElement('style');
    style.textContent =
      'html.portal-access-pending body>:not(.portal-access-gate){visibility:hidden!important}' +
      '.portal-access-gate{visibility:visible!important;position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:22px;background:#edf2f8;color:#172033;font-family:Arial,Helvetica,sans-serif}' +
      '.portal-access-card{width:min(100%,430px);padding:34px;border:1px solid #cbd5e1;border-radius:18px;background:#fff;box-shadow:0 24px 70px #17203326}' +
      '.portal-access-brand{color:#244a92;font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}' +
      '.portal-access-card h1{margin:10px 0 8px;font-size:30px;line-height:1.15}' +
      '.portal-access-copy{margin:0 0 22px;color:#536176;line-height:1.55}' +
      '.portal-access-card label{display:block;margin-bottom:7px;font-size:14px;font-weight:800}' +
      '.portal-access-card input{width:100%;padding:13px 14px;border:1px solid #94a3b8;border-radius:9px;font:inherit}' +
      '.portal-access-card button{width:100%;margin-top:12px;padding:13px 16px;border:0;border-radius:9px;background:#244a92;color:#fff;font:inherit;font-weight:800;cursor:pointer}' +
      '.portal-access-card button:disabled{opacity:.6;cursor:wait}' +
      '.portal-access-message{min-height:22px;margin:13px 0 0;font-size:14px;color:#536176}' +
      '.portal-access-message.is-error{color:#a42b2b}';
    document.head.appendChild(style);
  }
}());
