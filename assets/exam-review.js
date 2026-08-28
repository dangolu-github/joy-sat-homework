(function () {
  'use strict';

  var pageConfig = window.JOY_EXAM_REVIEW_CONFIG || {};
  var portalConfig = window.JOY_HOMEWORK_CONFIG || {};
  var testMode = new URLSearchParams(window.location.search).get('test') === '1';
  var subjectStates = {};
  var saveTimers = {};
  var answerViewCache = null;

  function portalAccessToken() {
    return window.JoyPortalAccess ? window.JoyPortalAccess.getToken() : '';
  }

  installModeTabs();
  installPrintButton();
  renderPracticeSubjects();
  installAnswerView();

  function installModeTabs() {
    var tabs = Array.from(document.querySelectorAll('[data-mode-tab]'));
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var mode = tab.dataset.modeTab;
        tabs.forEach(function (item) {
          var selected = item === tab;
          item.setAttribute('aria-selected', selected ? 'true' : 'false');
          item.tabIndex = selected ? 0 : -1;
        });
        Array.from(document.querySelectorAll('[data-mode-panel]')).forEach(function (panel) {
          panel.hidden = panel.dataset.modePanel !== mode;
        });
      });
    });
  }

  function installPrintButton() {
    var button = document.getElementById('exam-save-pdf');
    if (button) button.addEventListener('click', function () { window.print(); });
  }

  function renderPracticeSubjects() {
    var host = document.getElementById('practice-subjects');
    host.innerHTML = pageConfig.subjects.map(subjectMarkup).join('');
    pageConfig.subjects.forEach(function (subject) {
      var state = loadState(subject);
      subjectStates[subject.key] = state;
      restoreSubject(subject, state);
      bindSubject(subject, state);
      updateProgress(subject, state);
      if (state.result) renderResult(subject, state, state.result);
      else if (state.submittedAt) pollForResult(subject, state, 0);
    });
  }

  function subjectMarkup(subject) {
    return '<section class="subject-practice" id="subject-' + escapeHtml(subject.key) + '">' +
      '<div class="subject-heading"><div><h3>' + escapeHtml(subject.title) + '</h3><p>' +
        escapeHtml(subject.count + ' questions · ' + subject.instructions) +
      '</p></div><span class="subject-progress" id="progress-' + escapeHtml(subject.key) + '">0 of ' + subject.count + ' answered</span></div>' +
      '<div class="subject-body">' +
        '<div class="result-summary" id="result-' + escapeHtml(subject.key) + '" hidden></div>' +
        subject.sessions.map(function (session) { return moduleMarkup(subject, session); }).join('') +
        '<div class="subject-actions"><span class="save-status" id="status-' + escapeHtml(subject.key) + '" aria-live="polite">Saved on this device.</span>' +
          '<button class="finish-button" id="finish-' + escapeHtml(subject.key) + '" type="button">Finish ' + escapeHtml(subject.shortTitle) + '</button></div>' +
      '</div></section>';
  }

  function moduleMarkup(subject, session) {
    var cells = [];
    for (var offset = 0; offset < session.count; offset += 1) {
      var globalNumber = session.start + offset;
      var localNumber = offset + 1;
      var numeric = subject.numericQuestions.indexOf(globalNumber) !== -1;
      cells.push(
        '<div class="answer-cell' + (numeric ? ' numeric' : '') + '" data-answer-cell data-number="' + globalNumber + '">' +
          '<label for="' + escapeHtml(subject.key) + '-answer-' + globalNumber + '">Q' + localNumber + '</label>' +
          '<input id="' + escapeHtml(subject.key) + '-answer-' + globalNumber + '" data-answer-input data-number="' + globalNumber + '" data-kind="' + (numeric ? 'numeric' : 'choice') + '" ' +
            'type="text" inputmode="' + (numeric ? 'text' : 'text') + '" maxlength="' + (numeric ? '20' : '1') + '" autocomplete="off" placeholder="' + (numeric ? 'value' : 'A–D') + '" aria-label="' +
            escapeHtml(subject.title + ', ' + session.label + ', question ' + localNumber + ' answer') + '">' +
        '</div>'
      );
    }
    return '<section class="answer-module"><div class="module-heading"><strong>' + escapeHtml(session.label) + '</strong><span>Questions 1–' + session.count + '</span></div><div class="answer-grid">' + cells.join('') + '</div></section>';
  }

  function freshState(subject) {
    return {
      assignmentId: subject.assignmentId,
      assignmentLabel: subject.assignmentLabel,
      studentName: '',
      environment: testMode ? 'test' : 'production',
      submissionId: createId(subject.key),
      startedAt: new Date().toISOString(),
      updatedAt: null,
      submittedAt: null,
      responses: {},
      result: null
    };
  }

  function storageKey(subject) {
    return 'joy-0822-exam-review-' + subject.key + (testMode ? '-teacher-test' : '-joy');
  }

  function loadState(subject) {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey(subject)));
      if (!saved || !saved.responses || !saved.submissionId) return freshState(subject);
      saved.assignmentId = subject.assignmentId;
      saved.assignmentLabel = subject.assignmentLabel;
      saved.environment = testMode ? 'test' : 'production';
      return saved;
    } catch (error) {
      return freshState(subject);
    }
  }

  function saveLocal(subject, state, message) {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(storageKey(subject), JSON.stringify(state));
      setStatus(subject, message || 'Saved on this device · syncing with Teacher…', '');
    } catch (error) {
      setStatus(subject, 'This browser could not save the latest answer.', 'error');
    }
  }

  function restoreSubject(subject, state) {
    Object.keys(state.responses || {}).forEach(function (number) {
      var input = subjectElement(subject, '[data-answer-input][data-number="' + number + '"]');
      if (input) input.value = state.responses[number].answer || '';
    });
  }

  function bindSubject(subject, state) {
    var root = document.getElementById('subject-' + subject.key);
    root.addEventListener('input', function (event) {
      var input = event.target.closest('[data-answer-input]');
      if (!input || state.result) return;
      cleanInput(input);
      var number = Number(input.dataset.number);
      var answer = input.value.trim();
      if (answer) state.responses[number] = { answer: answer };
      else delete state.responses[number];
      saveLocal(subject, state);
      updateProgress(subject, state);
      scheduleProgressSave(subject, state);
    });
    root.addEventListener('keydown', function (event) {
      var input = event.target.closest('[data-answer-input]');
      if (!input) return;
      if (event.key === 'Enter' || event.key === 'ArrowRight') {
        event.preventDefault();
        focusAnswer(subject, Number(input.dataset.number) + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        focusAnswer(subject, Number(input.dataset.number) - 1);
      }
    });
    document.getElementById('finish-' + subject.key).addEventListener('click', function () {
      finishSubject(subject, state);
    });
  }

  function cleanInput(input) {
    if (input.dataset.kind === 'choice') {
      input.value = input.value.toUpperCase().replace(/[^ABCD]/g, '').slice(-1);
      return;
    }
    input.value = input.value.replace(/[^0-9A-Za-z√+\-./()\s]/g, '').slice(0, 20);
  }

  function focusAnswer(subject, number) {
    var input = subjectElement(subject, '[data-answer-input][data-number="' + number + '"]');
    if (input) input.focus();
  }

  function answeredCount(state) {
    return Object.keys(state.responses || {}).filter(function (number) {
      return String(state.responses[number].answer || '').trim();
    }).length;
  }

  function updateProgress(subject, state) {
    document.getElementById('progress-' + subject.key).textContent = answeredCount(state) + ' of ' + subject.count + ' answered';
  }

  function scheduleProgressSave(subject, state) {
    if (!portalConfig.submissionEndpoint || state.result || !answeredCount(state)) return;
    clearTimeout(saveTimers[subject.key]);
    saveTimers[subject.key] = setTimeout(function () { saveProgress(subject, state); }, 850);
  }

  async function saveProgress(subject, state) {
    if (!portalConfig.submissionEndpoint || state.result) return;
    try {
      await fetch(portalConfig.submissionEndpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({}, state, {
          action: 'saveHomeworkProgress',
          accessToken: portalAccessToken(),
          saveId: state.submissionId
        }))
      });
      setStatus(subject, 'Saved on this device and synced with Teacher.', 'success');
    } catch (error) {
      setStatus(subject, 'Saved on this device. Online sync will retry after another change.', 'error');
    }
  }

  function finishSubject(subject, state) {
    if (state.result) return;
    var button = document.getElementById('finish-' + subject.key);
    button.disabled = true;
    button.textContent = 'Checking status…';
    jsonp('getAssignmentState', {
      assignmentId: subject.assignmentId,
      environment: state.environment,
      saveId: state.submissionId
    }).then(function (data) {
      if (data && data.submissionBlocked) {
        button.textContent = 'Receiving stopped';
        setStatus(subject, 'This practice page is read-only. Existing submitted work is preserved.', 'error');
        return;
      }
      button.disabled = false;
      button.textContent = 'Finish ' + subject.shortTitle;
      finishSubjectNow(subject, state);
    }).catch(function () {
      button.disabled = false;
      button.textContent = 'Try again';
      setStatus(subject, 'Assignment status could not be checked. Try again before finishing.', 'error');
    });
  }

  async function finishSubjectNow(subject, state) {
    var missing = [];
    for (var number = 1; number <= subject.count; number += 1) {
      if (!state.responses[number] || !String(state.responses[number].answer || '').trim()) missing.push(displayQuestionNumber(subject, number));
    }
    if (missing.length) {
      var proceed = window.confirm(
        'There are still ' + missing.length + ' unanswered questions.\n\nFinish anyway? Every blank answer will be counted as incorrect.'
      );
      if (!proceed) {
        setStatus(subject, 'Finish cancelled. Current answers remain saved.', '');
        return;
      }
    }

    var enteredName = window.prompt('Please type your name before finishing:', state.studentName || 'Joy');
    if (enteredName === null) {
      setStatus(subject, 'Finish cancelled. Enter your name when ready.', '');
      return;
    }
    enteredName = enteredName.trim().slice(0, 80);
    if (!enteredName) {
      setStatus(subject, 'Type your name before finishing.', 'error');
      return;
    }
    state.studentName = enteredName;
    saveLocal(subject, state);

    if (!portalConfig.submissionEndpoint) {
      setStatus(subject, 'Answers remain saved locally. Checking service is unavailable.', 'error');
      return;
    }

    var button = document.getElementById('finish-' + subject.key);
    button.disabled = true;
    button.textContent = 'Sending answers…';
    var submittedAt = new Date().toISOString();
    try {
      await fetch(portalConfig.submissionEndpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({}, state, {
          action: 'submitExamReview',
          accessToken: portalAccessToken(),
          submittedAt: submittedAt
        }))
      });
      state.submittedAt = submittedAt;
      saveLocal(subject, state, 'Submission sent · loading corrections…');
      button.textContent = 'Loading corrections…';
      pollForResult(subject, state, 0);
    } catch (error) {
      state.submittedAt = null;
      saveLocal(subject, state);
      button.disabled = false;
      button.textContent = 'Try finishing again';
      setStatus(subject, 'Answers could not be sent. They remain saved on this device.', 'error');
    }
  }

  function pollForResult(subject, state, attempt) {
    if (!portalConfig.submissionEndpoint || !state.submissionId) return;
    jsonp('getGradedResult', {
      submissionId: state.submissionId,
      assignmentId: subject.assignmentId
    }).then(function (data) {
      if (data && data.ok && !data.pending) {
        state.result = data;
        state.submittedAt = data.submittedAt || state.submittedAt;
        saveLocal(subject, state, 'Answers checked and saved in Teacher register.');
        renderResult(subject, state, data);
        return;
      }
      if (attempt < 12) {
        setTimeout(function () { pollForResult(subject, state, attempt + 1); }, Math.min(900 + attempt * 300, 3000));
      } else {
        state.submittedAt = null;
        saveLocal(subject, state);
        var button = document.getElementById('finish-' + subject.key);
        button.disabled = false;
        button.textContent = 'Try finishing again';
        setStatus(subject, 'No checked result was confirmed. Answers remain saved; try again.', 'error');
      }
    }).catch(function () {
      if (attempt < 12) setTimeout(function () { pollForResult(subject, state, attempt + 1); }, 1700);
      else {
        state.submittedAt = null;
        saveLocal(subject, state);
        var button = document.getElementById('finish-' + subject.key);
        button.disabled = false;
        button.textContent = 'Try finishing again';
        setStatus(subject, 'Correction service did not respond. Answers remain saved.', 'error');
      }
    });
  }

  function renderResult(subject, state, result) {
    var button = document.getElementById('finish-' + subject.key);
    var inputs = Array.from(document.querySelectorAll('#subject-' + subject.key + ' [data-answer-input]'));
    inputs.forEach(function (input, index) {
      var cell = input.closest('[data-answer-cell]');
      var previous = cell.querySelector('.answer-feedback');
      if (previous) previous.remove();
      var selected = (result.answers && result.answers[index]) || '';
      var correct = (result.correctAnswers && result.correctAnswers[index]) || '';
      var isCorrect = result.correctness && typeof result.correctness[index] === 'boolean'
        ? result.correctness[index]
        : String(selected) === String(correct);
      input.value = selected;
      input.disabled = true;
      if (result.checkMode && correct) {
        cell.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
        var feedback = document.createElement('span');
        feedback.className = 'answer-feedback';
        feedback.textContent = isCorrect ? 'Correct' : ((selected ? 'Correct: ' : 'Unanswered · Correct: ') + correct);
        cell.appendChild(feedback);
      }
    });
    button.disabled = true;
    button.textContent = result.checkMode ? 'Answers checked' : 'Finished';
    var box = document.getElementById('result-' + subject.key);
    box.hidden = false;
    if (result.checkMode) {
      box.innerHTML = '<strong>' + escapeHtml(result.score) + ' / ' + escapeHtml(result.total) + '</strong><span>' + escapeHtml(result.percent) + '% correct</span><p>Wrong and blank answers are marked in red. Each correct answer is shown beside its answer field.</p>';
    } else {
      box.innerHTML = '<strong>Answers saved</strong><span>Checking is currently unavailable</span>';
    }
    setStatus(subject, testMode ? 'Teacher test result.' : 'Saved in Teacher register.', 'success');
    updateProgress(subject, state);
  }

  function installAnswerView() {
    var button = document.getElementById('show-all-answers');
    var results = document.getElementById('answer-view-results');
    button.addEventListener('click', function () {
      if (!results.hidden) {
        results.hidden = true;
        button.textContent = 'Show all answers';
        button.setAttribute('aria-expanded', 'false');
        return;
      }
      if (answerViewCache) {
        renderAnswerView(answerViewCache);
        results.hidden = false;
        button.textContent = 'Hide answers';
        button.setAttribute('aria-expanded', 'true');
        return;
      }
      button.disabled = true;
      button.textContent = 'Loading answers…';
      setAnswerViewStatus('Loading the verified private keys…', '');
      Promise.all(pageConfig.subjects.map(function (subject) {
        return jsonp('getExamReviewAnswers', { assignmentId: subject.assignmentId });
      })).then(function (data) {
        if (data.some(function (item) { return !item || !item.ok || !Array.isArray(item.answers); })) throw new Error('Answer key unavailable');
        answerViewCache = {};
        pageConfig.subjects.forEach(function (subject, index) { answerViewCache[subject.key] = data[index].answers; });
        renderAnswerView(answerViewCache);
        results.hidden = false;
        button.disabled = false;
        button.textContent = 'Hide answers';
        button.setAttribute('aria-expanded', 'true');
        setAnswerViewStatus('Answers shown. This created no attempt or score.', '');
      }).catch(function () {
        button.disabled = false;
        button.textContent = 'Try loading answers again';
        setAnswerViewStatus('The answer keys could not be loaded. Check portal access and try again.', 'error');
      });
    });
  }

  function renderAnswerView(cache) {
    var host = document.getElementById('answer-view-results');
    host.innerHTML = pageConfig.subjects.map(function (subject) {
      var answers = cache[subject.key] || [];
      return '<section class="answer-view-subject"><h3>' + escapeHtml(subject.title) + '</h3>' +
        subject.sessions.map(function (session) {
          var cells = [];
          for (var offset = 0; offset < session.count; offset += 1) {
            var globalNumber = session.start + offset;
            cells.push('<div class="key-cell"><span>Q' + (offset + 1) + '</span><strong>' + escapeHtml(answers[globalNumber - 1] || '—') + '</strong></div>');
          }
          return '<section class="answer-module"><div class="module-heading"><strong>' + escapeHtml(session.label) + '</strong><span>Questions 1–' + session.count + '</span></div><div class="answer-grid">' + cells.join('') + '</div></section>';
        }).join('') + '</section>';
    }).join('');
  }

  function setAnswerViewStatus(message, type) {
    var status = document.getElementById('answer-view-status');
    status.textContent = message;
    status.classList.toggle('is-error', type === 'error');
  }

  function setStatus(subject, message, type) {
    var status = document.getElementById('status-' + subject.key);
    status.textContent = message;
    status.classList.toggle('is-error', type === 'error');
    status.classList.toggle('is-success', type === 'success');
  }

  function subjectElement(subject, selector) {
    return document.querySelector('#subject-' + subject.key + ' ' + selector);
  }

  function displayQuestionNumber(subject, globalNumber) {
    var session = subject.sessions.filter(function (item) {
      return globalNumber >= item.start && globalNumber < item.start + item.count;
    })[0];
    return session ? session.label + ' Q' + (globalNumber - session.start + 1) : 'Q' + globalNumber;
  }

  function jsonp(action, parameters) {
    return new Promise(function (resolve, reject) {
      if (!portalConfig.submissionEndpoint) {
        reject(new Error('Submission endpoint unavailable'));
        return;
      }
      var args = Object.assign({}, parameters, { accessToken: portalAccessToken() });
      var callbackName = '__joyExamReview' + Date.now() + Math.random().toString(16).slice(2);
      var script = document.createElement('script');
      var timeout = setTimeout(function () { cleanup(); reject(new Error('Timed out')); }, 10000);
      function cleanup() {
        clearTimeout(timeout);
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[callbackName] = function (data) { cleanup(); resolve(data); };
      script.onerror = function () { cleanup(); reject(new Error('Unable to load')); };
      var query = Object.keys(args).map(function (key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(args[key]);
      });
      query.push('action=' + encodeURIComponent(action));
      query.push('callback=' + encodeURIComponent(callbackName));
      query.push('_=' + Date.now());
      script.src = portalConfig.submissionEndpoint + '?' + query.join('&');
      document.head.appendChild(script);
    });
  }

  function createId(key) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'joy-0822-' + key + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
    });
  }
}());
