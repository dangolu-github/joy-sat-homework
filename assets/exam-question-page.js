(function () {
  'use strict';

  var config = window.JOY_EXAM_QUESTION_CONFIG || {};
  var portalConfig = window.JOY_HOMEWORK_CONFIG || {};
  var imageVersion = '?v=20260828d';
  var testMode = new URLSearchParams(window.location.search).get('test') === '1';
  var isReview = config.mode === 'review';
  var state = isReview ? null : loadState();
  var saveTimer = null;

  document.body.dataset.examMode = isReview ? 'review' : 'practice';
  renderQuestionPage();
  installPrint();

  if (isReview) loadReviewAnswersWhenReady();
  else {
    restorePracticeState();
    bindPractice();
    updateProgress();
    if (state.result) renderPracticeResult(state.result, false);
    else if (state.submittedAt) pollForResult(0);
  }

  function portalAccessToken() {
    return window.JoyPortalAccess ? window.JoyPortalAccess.getToken() : '';
  }

  function renderQuestionPage() {
    var host = document.getElementById('exam-question-host');
    host.innerHTML = config.sessions.map(function (session) {
      var questions = [];
      for (var offset = 0; offset < session.count; offset += 1) {
        questions.push(questionMarkup(session.start + offset, offset + 1, session.label));
      }
      return '<section class="exam-module" aria-labelledby="module-' + session.start + '">' +
        '<div class="exam-module-heading"><h2 id="module-' + session.start + '">' + escapeHtml(session.label) + '</h2><span>' + session.count + ' questions</span></div>' +
        questions.join('') + '</section>';
    }).join('');

    document.getElementById('question-nav').innerHTML = Array.from({ length: config.count }, function (_, index) {
      var number = index + 1;
      return '<a href="#question-' + number + '" data-nav-question="' + number + '" aria-label="Go to ' + escapeHtml(displayQuestionNumber(number)) + '">' + number + '</a>';
    }).join('');
  }

  function questionMarkup(number, localNumber, moduleLabel) {
    var folder = config.imageBase + '/q' + String(number).padStart(2, '0');
    var prompt = config.key === 'rw'
      ? '<div class="prompt-grid rw-prompt"><a class="prompt-zoom" href="' + folder + '/prompt-left.webp' + imageVersion + '" target="_blank" rel="noopener" aria-label="Open passage full size"><img class="prompt-image" src="' + folder + '/prompt-left.webp' + imageVersion + '" alt="' + escapeHtml(moduleLabel + ' question ' + localNumber + ' passage') + '" loading="lazy"></a><a class="prompt-zoom" href="' + folder + '/prompt-right.webp' + imageVersion + '" target="_blank" rel="noopener" aria-label="Open question stem full size"><img class="prompt-image" src="' + folder + '/prompt-right.webp' + imageVersion + '" alt="' + escapeHtml(moduleLabel + ' question ' + localNumber + ' stem') + '" loading="lazy"></a></div>'
      : '<div class="prompt-grid single"><a class="prompt-zoom" href="' + folder + '/prompt.webp' + imageVersion + '" target="_blank" rel="noopener" aria-label="Open question prompt full size"><img class="prompt-image" src="' + folder + '/prompt.webp' + imageVersion + '" alt="' + escapeHtml(moduleLabel + ' question ' + localNumber + ' prompt') + '" loading="lazy"></a></div>';
    var numeric = config.numericQuestions.indexOf(number) !== -1;
    var response = numeric ? numericMarkup(number, moduleLabel, localNumber) : optionsMarkup(number, folder, moduleLabel, localNumber);
    return '<article class="exam-question" id="question-' + number + '" data-question="' + number + '" data-kind="' + (numeric ? 'numeric' : 'choice') + '">' +
      '<div class="question-label"><strong>' + escapeHtml(moduleLabel + ' · Question ' + localNumber) + '</strong><span>Question ' + number + ' of ' + config.count + '</span></div>' +
      prompt + response + '</article>';
  }

  function optionsMarkup(number, folder, moduleLabel, localNumber) {
    return '<div class="option-list" role="radiogroup" aria-label="' + escapeHtml(moduleLabel + ' question ' + localNumber + ' options') + '">' +
      ['A', 'B', 'C', 'D'].map(function (answer) {
        var inputId = 'answer-' + number + '-' + answer;
        return '<label class="exam-option" data-option data-number="' + number + '" data-answer="' + answer + '" for="' + inputId + '">' +
          '<input id="' + inputId + '" type="radio" name="answer-' + number + '" value="' + answer + '" data-answer-input data-number="' + number + '"' + (isReview ? ' disabled' : '') + '>' +
          '<span class="visually-hidden">Select option ' + answer + '</span>' +
          '<span class="option-letter" aria-hidden="true">' + answer + '.</span>' +
          '<img class="option-image" src="' + folder + '/option-' + answer + '.webp' + imageVersion + '" alt="Option ' + answer + ' from the source question" loading="lazy">' +
        '</label>';
      }).join('') + '</div>';
  }

  function numericMarkup(number, moduleLabel, localNumber) {
    return '<div class="numeric-response-shell" data-numeric-shell>' +
      '<label for="answer-' + number + '">' + (isReview ? 'Verified response' : 'Enter your response') + '</label>' +
      '<input id="answer-' + number + '" type="text" inputmode="text" maxlength="30" autocomplete="off" data-answer-input data-number="' + number + '" aria-label="' + escapeHtml(moduleLabel + ' question ' + localNumber + ' response') + '"' + (isReview ? ' disabled' : '') + '>' +
    '</div>';
  }

  function installPrint() {
    var button = document.getElementById('save-exam-pdf');
    if (button) button.addEventListener('click', function () { window.print(); });
  }

  function freshState() {
    return {
      assignmentId: config.assignmentId,
      assignmentLabel: config.assignmentLabel,
      studentName: '',
      environment: testMode ? 'test' : 'production',
      submissionId: createId(config.key),
      startedAt: new Date().toISOString(),
      updatedAt: null,
      submittedAt: null,
      responses: {},
      result: null
    };
  }

  function storageKey() {
    return 'joy-0822-exam-review-' + config.key + (testMode ? '-teacher-test' : '-joy');
  }

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey()));
      if (!saved || !saved.responses || !saved.submissionId) return freshState();
      saved.assignmentId = config.assignmentId;
      saved.assignmentLabel = config.assignmentLabel;
      saved.environment = testMode ? 'test' : 'production';
      return saved;
    } catch (error) {
      return freshState();
    }
  }

  function restorePracticeState() {
    Object.keys(state.responses || {}).forEach(function (number) {
      var answer = String(state.responses[number].answer || '');
      var input = document.querySelector('[data-answer-input][data-number="' + number + '"][value="' + cssEscape(answer) + '"]') ||
        document.querySelector('[data-question="' + number + '"][data-kind="numeric"] [data-answer-input]');
      if (!input) return;
      if (input.type === 'radio') input.checked = true;
      else input.value = answer;
      updateSelectedOption(Number(number));
    });
  }

  function bindPractice() {
    var host = document.getElementById('exam-question-host');
    host.addEventListener('change', function (event) {
      var input = event.target.closest('[data-answer-input]');
      if (!input || state.result) return;
      recordAnswer(input);
    });
    host.addEventListener('input', function (event) {
      var input = event.target.closest('[data-question][data-kind="numeric"] [data-answer-input]');
      if (!input || state.result) return;
      input.value = input.value.replace(/[^0-9A-Za-z√+\-./()\s]/g, '').slice(0, 30);
      recordAnswer(input);
    });
    document.getElementById('submit-exam').addEventListener('click', finishPractice);
  }

  function recordAnswer(input) {
    var number = Number(input.dataset.number);
    var answer = String(input.value || '').trim();
    if (answer) state.responses[number] = { answer: answer };
    else delete state.responses[number];
    updateSelectedOption(number);
    saveLocal('Saved on this device · syncing with Teacher…', '');
    updateProgress();
    scheduleProgressSave();
  }

  function updateSelectedOption(number) {
    var question = document.querySelector('[data-question="' + number + '"]');
    if (!question) return;
    Array.from(question.querySelectorAll('[data-option]')).forEach(function (option) {
      var input = option.querySelector('input');
      option.classList.toggle('is-selected', Boolean(input && input.checked));
    });
  }

  function answeredCount() {
    return Object.keys(state.responses || {}).filter(function (number) {
      return String(state.responses[number].answer || '').trim();
    }).length;
  }

  function updateProgress() {
    var count = answeredCount();
    document.getElementById('progress-count').textContent = count + ' of ' + config.count + ' answered';
    Array.from(document.querySelectorAll('[data-nav-question]')).forEach(function (link) {
      link.classList.toggle('is-answered', Boolean(state.responses[link.dataset.navQuestion] && String(state.responses[link.dataset.navQuestion].answer || '').trim()));
    });
  }

  function saveLocal(message, type) {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(storageKey(), JSON.stringify(state));
      setStatus(message || 'Saved on this device.', type || '');
    } catch (error) {
      setStatus('This browser could not save the latest answer.', 'error');
    }
  }

  function scheduleProgressSave() {
    if (!portalConfig.submissionEndpoint || state.result || !answeredCount()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProgress, 850);
  }

  async function saveProgress() {
    if (!portalConfig.submissionEndpoint || state.result) return;
    try {
      await fetch(portalConfig.submissionEndpoint, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({}, state, { action: 'saveHomeworkProgress', accessToken: portalAccessToken(), saveId: state.submissionId }))
      });
      setStatus('Saved on this device and synced with Teacher.', 'success');
    } catch (error) {
      setStatus('Saved on this device. Online sync will retry after another change.', 'error');
    }
  }

  function finishPractice() {
    if (state.result) return;
    var button = document.getElementById('submit-exam');
    button.disabled = true;
    button.textContent = 'Checking status…';
    jsonp('getAssignmentState', { assignmentId: config.assignmentId, environment: state.environment, saveId: state.submissionId })
      .then(function (data) {
        if (data && data.submissionBlocked) {
          button.textContent = 'Receiving stopped';
          setStatus('This practice page is read-only. Existing submitted work is preserved.', 'error');
          return;
        }
        button.disabled = false;
        button.textContent = 'Submit ' + config.shortTitle;
        finishPracticeNow();
      })
      .catch(function () {
        button.disabled = false;
        button.textContent = 'Try again';
        setStatus('Assignment status could not be checked. Try again before submitting.', 'error');
      });
  }

  async function finishPracticeNow() {
    var missing = [];
    for (var number = 1; number <= config.count; number += 1) {
      if (!state.responses[number] || !String(state.responses[number].answer || '').trim()) missing.push(displayQuestionNumber(number));
    }
    if (missing.length && !window.confirm('There are still ' + missing.length + ' unanswered questions.\n\nSubmit anyway? Every blank answer will be counted as incorrect.')) {
      setStatus('Submission cancelled. Current answers remain saved.', '');
      return;
    }
    var enteredName = window.prompt('Please type your name before submitting:', state.studentName || 'Joy');
    if (enteredName === null) {
      setStatus('Submission cancelled. Enter your name when ready.', '');
      return;
    }
    enteredName = enteredName.trim().slice(0, 80);
    if (!enteredName) {
      setStatus('Type your name before submitting.', 'error');
      return;
    }
    state.studentName = enteredName;
    saveLocal('Ready to send.', '');
    if (!portalConfig.submissionEndpoint) {
      setStatus('Answers remain saved locally. Checking service is unavailable.', 'error');
      return;
    }
    var button = document.getElementById('submit-exam');
    button.disabled = true;
    button.textContent = 'Sending answers…';
    var submittedAt = new Date().toISOString();
    try {
      await fetch(portalConfig.submissionEndpoint, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({}, state, { action: 'submitExamReview', accessToken: portalAccessToken(), submittedAt: submittedAt }))
      });
      state.submittedAt = submittedAt;
      saveLocal('Submission sent · loading corrections…', '');
      button.textContent = 'Loading corrections…';
      pollForResult(0);
    } catch (error) {
      state.submittedAt = null;
      saveLocal('Answers could not be sent. They remain saved on this device.', 'error');
      button.disabled = false;
      button.textContent = 'Try submitting again';
    }
  }

  function pollForResult(attempt) {
    if (!portalConfig.submissionEndpoint || !state.submissionId) return;
    jsonp('getGradedResult', { submissionId: state.submissionId, assignmentId: config.assignmentId })
      .then(function (data) {
        if (data && data.ok && !data.pending) {
          state.result = data;
          state.submittedAt = data.submittedAt || state.submittedAt;
          saveLocal('Answers checked and saved in Teacher register.', 'success');
          renderPracticeResult(data, true);
          return;
        }
        if (attempt < 12) setTimeout(function () { pollForResult(attempt + 1); }, Math.min(900 + attempt * 300, 3000));
        else resetAfterPollingFailure('No checked result was confirmed. Answers remain saved; try again.');
      })
      .catch(function () {
        if (attempt < 12) setTimeout(function () { pollForResult(attempt + 1); }, 1700);
        else resetAfterPollingFailure('Correction service did not respond. Answers remain saved.');
      });
  }

  function resetAfterPollingFailure(message) {
    state.submittedAt = null;
    saveLocal(message, 'error');
    var button = document.getElementById('submit-exam');
    button.disabled = false;
    button.textContent = 'Try submitting again';
  }

  function renderPracticeResult(result, shouldFocus) {
    for (var number = 1; number <= config.count; number += 1) {
      renderQuestionCorrection(number, String((result.answers && result.answers[number - 1]) || ''), String((result.correctAnswers && result.correctAnswers[number - 1]) || ''), result.correctness && result.correctness[number - 1]);
    }
    var button = document.getElementById('submit-exam');
    button.disabled = true;
    button.textContent = result.checkMode ? 'Answers checked' : 'Submitted';
    var box = document.getElementById('result-summary');
    box.hidden = false;
    if (result.checkMode) {
      box.innerHTML = '<strong>' + escapeHtml(result.score) + ' / ' + escapeHtml(result.total) + '</strong><span>' + escapeHtml(result.percent) + '% correct</span><p>Correct answers are highlighted in green. Your incorrect selections are marked in red.</p>';
    } else box.innerHTML = '<strong>Answers saved</strong><span>Checking is currently unavailable</span>';
    setStatus(testMode ? 'Teacher test result.' : 'Saved in Teacher register.', 'success');
    updateProgress();
    if (shouldFocus) {
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      box.setAttribute('tabindex', '-1');
      box.focus({ preventScroll: true });
    }
  }

  function renderQuestionCorrection(number, selected, correct, knownCorrect) {
    var question = document.querySelector('[data-question="' + number + '"]');
    var isCorrectAnswer = typeof knownCorrect === 'boolean' ? knownCorrect : selected === correct;
    Array.from(question.querySelectorAll('[data-answer-input]')).forEach(function (input) { input.disabled = true; });
    if (question.dataset.kind === 'numeric') {
      var input = question.querySelector('[data-answer-input]');
      var shell = question.querySelector('[data-numeric-shell]');
      input.value = selected;
      shell.classList.add(isCorrectAnswer ? 'is-correct' : 'is-wrong');
      appendNumericResult(shell, isCorrectAnswer ? 'Correct' : ((selected ? 'Your response: ' + selected + ' · ' : 'Unanswered · ') + 'Correct response: ' + correct));
      return;
    }
    Array.from(question.querySelectorAll('[data-option]')).forEach(function (option) {
      var answer = option.dataset.answer;
      var input = option.querySelector('input');
      if (answer === selected) {
        input.checked = true;
        option.classList.add('is-selected');
      }
      if (answer === correct) {
        option.classList.add('is-correct');
        appendOptionResult(option, isCorrectAnswer ? 'Correct' : 'Correct answer', '');
      }
      if (answer === selected && selected !== correct) {
        option.classList.add('is-wrong');
        appendOptionResult(option, 'Your answer', 'wrong');
      }
    });
  }

  function loadReviewAnswersWhenReady() {
    var ready = window.JoyPortalAccess && window.JoyPortalAccess.ready ? window.JoyPortalAccess.ready : Promise.resolve();
    ready.then(function () {
      return jsonp('getExamReviewAnswers', { assignmentId: config.assignmentId });
    }).then(function (data) {
      if (!data || !data.ok || !Array.isArray(data.answers) || data.answers.length !== config.count) throw new Error('Answer key unavailable');
      data.answers.forEach(function (answer, index) { renderReviewAnswer(index + 1, String(answer || '')); });
      setReviewStatus('All verified answers are shown inside the original option sets. Review Mode created no attempt or score.', 'success');
    }).catch(function () {
      setReviewStatus('The verified answers could not be loaded. Check portal access and try reloading this page.', 'error');
    });
  }

  function renderReviewAnswer(number, correct) {
    var question = document.querySelector('[data-question="' + number + '"]');
    if (question.dataset.kind === 'numeric') {
      var input = question.querySelector('[data-answer-input]');
      var shell = question.querySelector('[data-numeric-shell]');
      input.value = correct;
      shell.classList.add('is-correct');
      appendNumericResult(shell, 'Correct response: ' + correct);
      return;
    }
    var option = question.querySelector('[data-option][data-answer="' + cssEscape(correct) + '"]');
    if (!option) return;
    option.classList.add('is-correct', 'is-selected');
    option.querySelector('input').checked = true;
    appendOptionResult(option, 'Correct answer', '');
  }

  function appendOptionResult(option, label, kind) {
    var existing = option.querySelector('.option-result');
    if (existing) existing.remove();
    var badge = document.createElement('span');
    badge.className = 'option-result' + (kind ? ' ' + kind : '');
    badge.textContent = label;
    option.appendChild(badge);
  }

  function appendNumericResult(shell, label) {
    var existing = shell.querySelector('.numeric-result');
    if (existing) existing.remove();
    var result = document.createElement('span');
    result.className = 'numeric-result';
    result.textContent = label;
    shell.appendChild(result);
  }

  function setReviewStatus(message, type) {
    var status = document.getElementById('review-status');
    status.textContent = message;
    status.classList.toggle('is-success', type === 'success');
    status.classList.toggle('is-error', type === 'error');
  }

  function setStatus(message, type) {
    var status = document.getElementById('save-status');
    status.textContent = message;
    status.classList.toggle('is-success', type === 'success');
    status.classList.toggle('is-error', type === 'error');
  }

  function displayQuestionNumber(globalNumber) {
    var session = config.sessions.filter(function (item) { return globalNumber >= item.start && globalNumber < item.start + item.count; })[0];
    return session ? session.label + ' Q' + (globalNumber - session.start + 1) : 'Q' + globalNumber;
  }

  function jsonp(action, parameters) {
    return new Promise(function (resolve, reject) {
      if (!portalConfig.submissionEndpoint) { reject(new Error('Submission endpoint unavailable')); return; }
      var args = Object.assign({}, parameters, { accessToken: portalAccessToken() });
      var callbackName = '__joyExamQuestion' + Date.now() + Math.random().toString(16).slice(2);
      var script = document.createElement('script');
      var timeout = setTimeout(function () { cleanup(); reject(new Error('Timed out')); }, 10000);
      function cleanup() { clearTimeout(timeout); delete window[callbackName]; if (script.parentNode) script.parentNode.removeChild(script); }
      window[callbackName] = function (data) { cleanup(); resolve(data); };
      script.onerror = function () { cleanup(); reject(new Error('Unable to load')); };
      var query = Object.keys(args).map(function (key) { return encodeURIComponent(key) + '=' + encodeURIComponent(args[key]); });
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

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(String(value));
    return String(value).replace(/(["\\])/g, '\\$1');
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
    });
  }
}());
