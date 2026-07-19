(function () {
  'use strict';

  var config = window.JOY_HOMEWORK_CONFIG || {};
  function portalAccessToken() { return window.JoyPortalAccess ? window.JoyPortalAccess.getToken() : ''; }
  var TOTAL = 66;
  var testMode = new URLSearchParams(window.location.search).get('test') === '1';
  var STORAGE_KEY = testMode ? 'joy-mock-exam-2-answers-teacher-test' : 'joy-mock-exam-2-answers-joy';
  var container = document.getElementById('answer-sessions');
  var progress = document.getElementById('mock-progress');
  var status = document.getElementById('mock-save-status');
  var saveButton = document.getElementById('save-mock-now');
  var state = loadState();
  var remoteTimer = null;
  var resetCheckPending = false;

  document.body.classList.toggle('mock-test-mode', testMode);
  document.getElementById('mock-mode-label').textContent = testMode ? 'Teacher test page' : 'Student page · Joy';
  installPrintButton();
  renderAnswerSheet();
  restoreAnswers();
  updateProgress();
  setStatus('Saved answers restored on this device.', 'success');
  checkResetState();

  container.addEventListener('input', handleAnswerInput);
  container.addEventListener('keydown', handleAnswerKeydown);
  saveButton.addEventListener('click', function () { saveRemote(true); });
  window.addEventListener('online', function () { saveRemote(false); });
  window.addEventListener('focus', checkResetState);

  function installPrintButton() {
    var printButton = document.createElement('button');
    printButton.type = 'button';
    printButton.id = 'save-mock-pdf';
    printButton.className = 'mock-pdf-button';
    printButton.textContent = 'Save as PDF';
    printButton.addEventListener('click', function () { window.print(); });
    saveButton.parentNode.insertBefore(printButton, saveButton);
  }

  function freshState() {
    return {
      saveId: createId(),
      studentName: testMode ? 'Teacher' : 'Joy',
      environment: testMode ? 'test' : 'production',
      assignmentId: 'joy-mock-exam-2',
      assignmentLabel: 'Homework 3 — Mock Exam 2',
      resetVersion: null,
      updatedAt: null,
      answers: {}
    };
  }

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !saved.answers || !saved.saveId) return freshState();
      saved.studentName = testMode ? 'Teacher' : 'Joy';
      saved.environment = testMode ? 'test' : 'production';
      return saved;
    } catch (error) {
      return freshState();
    }
  }

  function renderAnswerSheet() {
    var labels = [
      ['Session 1', 1, 22],
      ['Session 2', 23, 44],
      ['Session 3', 45, 66]
    ];
    container.innerHTML = labels.map(function (session) {
      var cells = [];
      for (var number = session[1]; number <= session[2]; number += 1) {
        cells.push(
          '<label class="answer-cell" for="mock-answer-' + number + '">' +
            '<span>Q' + number + '</span>' +
            '<input id="mock-answer-' + number + '" data-question="' + number + '" type="text" inputmode="text" maxlength="1" autocomplete="off" placeholder="—" aria-label="Question ' + number + ' answer">' +
          '</label>'
        );
      }
      return '<section class="answer-session"><div class="session-heading"><h3>' + session[0] + '</h3><span>Questions ' + session[1] + '–' + session[2] + '</span></div><div class="answer-grid">' + cells.join('') + '</div></section>';
    }).join('');
  }

  function restoreAnswers() {
    Object.keys(state.answers).forEach(function (number) {
      var input = document.querySelector('[data-question="' + number + '"]');
      if (input) input.value = state.answers[number];
    });
  }

  function handleAnswerInput(event) {
    var input = event.target.closest('input[data-question]');
    if (!input) return;
    var answer = input.value.toUpperCase().replace(/[^ABCD]/g, '').slice(-1);
    input.value = answer;
    if (answer) state.answers[input.dataset.question] = answer;
    else delete state.answers[input.dataset.question];
    saveLocal();
    updateProgress();
    scheduleRemoteSave();
  }

  function handleAnswerKeydown(event) {
    var input = event.target.closest('input[data-question]');
    if (!input) return;
    if (event.key === 'ArrowRight' || event.key === 'Enter') focusQuestion(Number(input.dataset.question) + 1);
    if (event.key === 'ArrowLeft') focusQuestion(Number(input.dataset.question) - 1);
  }

  function focusQuestion(number) {
    var next = document.querySelector('[data-question="' + number + '"]');
    if (next) next.focus();
  }

  function saveLocal() {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStatus('Saved on this device · sending the latest changes to Teacher…', 'saving');
    } catch (error) {
      setStatus('This browser could not save the latest change. Keep this page open and try again.', 'error');
    }
  }

  function scheduleRemoteSave() {
    clearTimeout(remoteTimer);
    remoteTimer = setTimeout(function () { saveRemote(false); }, 650);
  }

  async function saveRemote(fromButton) {
    clearTimeout(remoteTimer);
    saveLocal();
    if (!config.submissionEndpoint) {
      setStatus('Saved on this device. The Teacher online answer record is not connected yet.', 'error');
      return;
    }

    if (fromButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Saving…';
    }

    try {
      var response = await fetch(config.submissionEndpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveMockAnswers',
          accessToken: portalAccessToken(),
          saveId: state.saveId,
          studentName: state.studentName,
          environment: state.environment,
          assignmentId: state.assignmentId,
          assignmentLabel: state.assignmentLabel,
          updatedAt: state.updatedAt,
          answers: state.answers
        })
      });
      if (response.type !== 'opaque' && !response.ok) throw new Error('Save failed');
      setStatus('Saved for Teacher · ' + answeredCount() + ' of ' + TOTAL + ' answers recorded.', 'success');
      if (fromButton) saveButton.textContent = 'Saved';
    } catch (error) {
      setStatus('Saved on this device. The online copy could not update, so it will retry when you make another change.', 'error');
      if (fromButton) saveButton.textContent = 'Try save again';
    } finally {
      if (fromButton) saveButton.disabled = false;
    }
  }

  function answeredCount() {
    return Object.keys(state.answers).filter(function (number) {
      return /^[ABCD]$/.test(state.answers[number]);
    }).length;
  }

  function updateProgress() {
    progress.textContent = answeredCount() + ' of ' + TOTAL + ' recorded';
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.classList.toggle('is-saving', type === 'saving');
    status.classList.toggle('is-error', type === 'error');
    status.classList.toggle('is-success', type === 'success');
  }

  function checkResetState() {
    if (!config.submissionEndpoint || resetCheckPending) return;
    resetCheckPending = true;
    jsonp('getResetState', {
      assignmentId: state.assignmentId,
      environment: state.environment
    }, function (data) {
      resetCheckPending = false;
      if (!data || !data.ok) return;
      var remoteVersion = Number(data.resetVersion) || 0;
      var hasRecordedAnswers = answeredCount() > 0;
      var needsReset = state.resetVersion === null || typeof state.resetVersion === 'undefined'
        ? hasRecordedAnswers && remoteVersion > 0
        : remoteVersion > Number(state.resetVersion || 0);
      if (needsReset) {
        state = freshState();
        state.resetVersion = remoteVersion;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        window.location.reload();
        return;
      }
      if (state.resetVersion === null || typeof state.resetVersion === 'undefined') {
        state.resetVersion = remoteVersion;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    }, function () {
      resetCheckPending = false;
    });
  }

  function jsonp(action, parameters, success, failure) {
    parameters.accessToken = portalAccessToken();
    var callbackName = '__joyMockPortal' + Date.now() + Math.random().toString(16).slice(2);
    var script = document.createElement('script');
    var timeout = setTimeout(function () { cleanup(); if (failure) failure(new Error('Timed out')); }, 9000);
    function cleanup() { clearTimeout(timeout); delete window[callbackName]; if (script.parentNode) script.parentNode.removeChild(script); }
    window[callbackName] = function (data) { cleanup(); success(data); };
    script.onerror = function () { cleanup(); if (failure) failure(new Error('Unable to load')); };
    var query = Object.keys(parameters).map(function (key) { return encodeURIComponent(key) + '=' + encodeURIComponent(parameters[key]); });
    query.push('action=' + encodeURIComponent(action));
    query.push('callback=' + encodeURIComponent(callbackName));
    query.push('_=' + Date.now());
    script.src = config.submissionEndpoint + '?' + query.join('&');
    document.head.appendChild(script);
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return (testMode ? 'mock-exam-2-teacher-test-' : 'mock-exam-2-joy-') + Date.now() + '-' + Math.random().toString(16).slice(2);
  }
}());
