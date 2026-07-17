(function () {
  'use strict';

  var config = window.JOY_HOMEWORK_CONFIG || {};
  var assignmentId = config.assignmentId || 'joy-homework';
  var query = new URLSearchParams(window.location.search);
  var testMode = query.get('test') === '1';
  var reviewSubmissionId = cleanReference(query.get('reviewSubmissionId'));
  var progressSaveId = cleanReference(query.get('progressSaveId'));
  var submittedReviewMode = Boolean(reviewSubmissionId);
  var progressReviewMode = Boolean(progressSaveId);
  var teacherReviewMode = submittedReviewMode || progressReviewMode;
  var storageKey = 'joy-homework:' + assignmentId + (testMode ? ':teacher-test' : '');
  var questions = Array.from(document.querySelectorAll('.question'));
  var state = teacherReviewMode ? freshState() : loadState();
  var saveTimer = null;
  var flagTimer = null;
  var progressSyncTimer = null;
  var progressPollTimer = null;
  var submitted = teacherReviewMode || Boolean(state.submittedAt);

  if (submittedReviewMode) state.submissionId = reviewSubmissionId;
  if (progressReviewMode) state.submissionId = progressSaveId;

  if (!questions.length) return;

  installHeader();
  enhanceQuestions();
  installSubmitZone();
  restoreState();
  updateProgress();
  document.body.classList.add('portal-ready');
  if (submittedReviewMode) pollForResult(0);
  else if (progressReviewMode) pollForProgressReview(0);
  else {
    checkResetState();
    if (submitted && !state.result) pollForResult(0);
    else if (!submitted && hasProgress()) scheduleProgressSync(true);
  }
  window.addEventListener('online', function () {
    if (!teacherReviewMode && !submitted && hasProgress()) scheduleProgressSync(true);
  });

  function freshState() {
    return {
      assignmentId: assignmentId,
      assignmentLabel: config.assignmentLabel || document.title,
      studentName: '',
      environment: testMode ? 'test' : 'production',
      submissionId: createSubmissionId(),
      startedAt: new Date().toISOString(),
      updatedAt: null,
      submittedAt: null,
      resetVersion: null,
      responses: {},
      difficultyFlags: {},
      result: null
    };
  }

  function createSubmissionId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return assignmentId + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function cleanReference(value) {
    return String(value || '').replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 160);
  }

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey));
      return saved && saved.responses ? saved : freshState();
    } catch (error) {
      return freshState();
    }
  }

  function installHeader() {
    var header = document.createElement('header');
    header.className = 'portal-bar';
    header.innerHTML =
      '<a class="portal-brand" href="' + escapeHtml(config.returnUrl || '../') + '">Joy SAT</a>' +
      '<div class="portal-progress" aria-label="Homework progress">' +
        '<div class="portal-progress-row"><span>' + escapeHtml(testMode ? 'Tina test copy' : (config.progressLabel || 'Homework progress')) + '</span><strong id="portal-count">0 of ' + questions.length + ' answered</strong></div>' +
        '<div class="portal-track"><div class="portal-fill" id="portal-fill"></div></div>' +
      '</div>' +
      '<div class="portal-actions">' +
        '<div class="portal-save" id="portal-save" aria-live="polite">' +
          (teacherReviewMode ? (submittedReviewMode ? 'Submitted result' : 'Live synced progress') : 'Saved on this device') +
        '</div>' +
        '<button class="portal-pdf" id="portal-save-pdf" type="button">Save as PDF</button>' +
      '</div>';
    document.body.insertBefore(header, document.body.firstChild);
    document.getElementById('portal-save-pdf').addEventListener('click', function () { window.print(); });
  }

  function enhanceQuestions() {
    questions.forEach(function (question, index) {
      var questionNumber = index + 1;
      question.dataset.question = String(questionNumber);
      Array.from(question.querySelectorAll('.choice')).forEach(function (choice, choiceIndex) {
        var letter = String.fromCharCode(65 + choiceIndex);
        var original = choice.innerHTML;
        choice.dataset.letter = letter;
        choice.innerHTML =
          '<input type="radio" name="question-' + questionNumber + '" value="' + letter + '" aria-label="Question ' + questionNumber + ', answer ' + letter + '">' +
          '<span class="choice-body">' + original + '</span>';
        var input = choice.querySelector('input');
        input.addEventListener('change', function () {
          Array.from(question.querySelectorAll('.choice')).forEach(function (item) {
            item.classList.toggle('is-selected', item.querySelector('input').checked);
          });
          captureQuestion(questionNumber);
        });
        choice.addEventListener('click', function (event) {
          if (submitted || event.target.tagName === 'INPUT') return;
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });

      var work = question.querySelector('.work');
      if (work) {
        var details = document.createElement('details');
        details.className = 'reasoning';
        details.innerHTML =
          '<summary>Optional reasoning notes</summary>' +
          '<div class="reasoning-grid">' +
            reasoningField(questionNumber, 'claim', 'Claim / task', 'What exactly must the correct answer do?') +
            reasoningField(questionNumber, 'evidence', 'Required evidence', 'What evidence would directly fit?') +
            reasoningField(questionNumber, 'trap', 'Closest trap and failure', 'Why is the most tempting wrong answer wrong?') +
          '</div>';
        work.replaceWith(details);
        Array.from(details.querySelectorAll('textarea')).forEach(function (field) {
          field.addEventListener('input', function () { captureQuestion(questionNumber); });
        });
      }
    });
  }

  function reasoningField(number, field, label, placeholder) {
    return '<div class="reasoning-field"><label for="q' + number + '-' + field + '">' + label + '</label><textarea id="q' + number + '-' + field + '" data-field="' + field + '" placeholder="' + placeholder + '"></textarea></div>';
  }

  function installSubmitZone() {
    var zone = document.createElement('section');
    zone.className = 'portal-submit-zone';
    zone.innerHTML =
      '<div id="portal-result" hidden></div>' +
      '<div id="portal-submit-copy"><h2>Ready to submit?</h2><p>You may submit with blank answers, but every unanswered question will be counted as incorrect.</p></div>' +
      '<div class="portal-submit-row"><span class="portal-unanswered" id="portal-unanswered"></span><button class="portal-submit" id="portal-submit" type="button">Submit homework</button></div>';
    document.body.appendChild(zone);

    var difficulty = document.createElement('section');
    difficulty.className = 'difficulty-panel';
    difficulty.id = 'difficulty-panel';
    difficulty.hidden = true;
    difficulty.innerHTML =
      '<div><span class="result-kicker">Your review list</span><h2>Which questions felt particularly difficult?</h2><p>Tick any question you want Tina to explain or train again. You can change this list later on this device.</p></div>' +
      '<div class="difficulty-grid" id="difficulty-grid"></div><div class="difficulty-status" id="difficulty-status">Changes save automatically.</div>';
    document.body.appendChild(difficulty);

    var message = document.createElement('div');
    message.className = 'portal-message';
    message.id = 'portal-message';
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    message.hidden = true;
    document.body.appendChild(message);
    document.getElementById('portal-submit').addEventListener('click', submitHomework);
  }

  function captureQuestion(number) {
    if (submitted) return;
    var question = questions[number - 1];
    var selected = question.querySelector('input[type="radio"]:checked');
    var response = state.responses[number] || {};
    response.answer = selected ? selected.value : '';
    Array.from(question.querySelectorAll('textarea[data-field]')).forEach(function (field) {
      response[field.dataset.field] = field.value.trim();
    });
    state.responses[number] = response;
    scheduleSave();
    updateProgress();
  }

  function restoreState() {
    questions.forEach(function (question, index) {
      var response = state.responses[index + 1];
      if (!response) return;
      if (response.answer) {
        var input = question.querySelector('input[value="' + response.answer + '"]');
        if (input) { input.checked = true; input.closest('.choice').classList.add('is-selected'); }
      }
      Array.from(question.querySelectorAll('textarea[data-field]')).forEach(function (field) {
        field.value = response[field.dataset.field] || '';
      });
    });
    if (submitted) lockSubmittedPage();
    if (state.result) renderResult(state.result);
  }

  function scheduleSave() {
    if (teacherReviewMode) return;
    clearTimeout(saveTimer);
    document.getElementById('portal-save').textContent = 'Saving…';
    saveTimer = setTimeout(saveState, 180);
  }

  function saveState() {
    if (teacherReviewMode) return;
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      document.getElementById('portal-save').textContent = submitted ? 'Saved on this device' : 'Saved on this device · syncing with Tina…';
      if (!submitted && hasProgress()) scheduleProgressSync(false);
    } catch (error) {
      document.getElementById('portal-save').textContent = 'Unable to save';
    }
  }

  function hasProgress() {
    return Object.keys(state.responses || {}).some(function (number) {
      var response = state.responses[number] || {};
      return Boolean(response.answer || response.claim || response.evidence || response.trap);
    });
  }

  function scheduleProgressSync(immediate) {
    if (teacherReviewMode || submitted || !config.submissionEndpoint || !hasProgress()) return;
    clearTimeout(progressSyncTimer);
    progressSyncTimer = setTimeout(saveProgressRemote, immediate ? 80 : 900);
  }

  async function saveProgressRemote() {
    if (teacherReviewMode || submitted || !config.submissionEndpoint || !hasProgress()) return;
    var clientUpdatedAt = state.updatedAt || new Date().toISOString();
    try {
      var response = await fetch(config.submissionEndpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveHomeworkProgress',
          assignmentId: assignmentId,
          assignmentLabel: state.assignmentLabel,
          submissionId: state.submissionId,
          environment: state.environment,
          startedAt: state.startedAt,
          updatedAt: clientUpdatedAt,
          responses: state.responses
        })
      });
      if (response.type !== 'opaque' && !response.ok) throw new Error('Progress sync failed');
      verifyProgressSync(clientUpdatedAt, 0);
    } catch (error) {
      document.getElementById('portal-save').textContent = 'Saved on this device · online sync will retry';
    }
  }

  function verifyProgressSync(clientUpdatedAt, attempt) {
    jsonp('getHomeworkProgress', { saveId: state.submissionId, assignmentId: assignmentId }, function (data) {
      if (data && data.ok && !data.pending && data.clientUpdatedAt === clientUpdatedAt) {
        document.getElementById('portal-save').textContent = 'Saved on this device and with Tina';
        return;
      }
      if (attempt < 3) setTimeout(function () { verifyProgressSync(clientUpdatedAt, attempt + 1); }, 800 + attempt * 500);
      else document.getElementById('portal-save').textContent = 'Saved on this device · online sync pending';
    }, function () {
      if (attempt < 3) setTimeout(function () { verifyProgressSync(clientUpdatedAt, attempt + 1); }, 1200);
      else document.getElementById('portal-save').textContent = 'Saved on this device · online sync pending';
    });
  }

  function answeredNumbers() {
    return questions.map(function (_, index) { return index + 1; }).filter(function (number) {
      return state.responses[number] && state.responses[number].answer;
    });
  }

  function updateProgress() {
    var answered = answeredNumbers().length;
    var percent = answered / questions.length;
    document.getElementById('portal-count').textContent = answered + ' of ' + questions.length + ' answered';
    document.getElementById('portal-fill').style.transform = 'scaleX(' + percent + ')';
    var missing = questions.length - answered;
    var gapLabel = document.getElementById('portal-unanswered');
    gapLabel.textContent = missing ? missing + ' question' + (missing === 1 ? '' : 's') + ' unanswered' : 'All questions answered';
    gapLabel.classList.toggle('has-gaps', missing > 0);
  }

  async function submitHomework() {
    if (submitted || teacherReviewMode) return;
    questions.forEach(function (_, index) { captureQuestion(index + 1); });
    saveState();
    var missing = questions.map(function (_, index) { return index + 1; }).filter(function (number) {
      return !state.responses[number] || !state.responses[number].answer;
    });
    if (missing.length) {
      var proceed = window.confirm(
        'There are still ' + missing.length + ' unanswered question' + (missing.length === 1 ? '' : 's') +
        ': ' + missing.join(', ') + '.\n\nSubmit anyway? Every unanswered question will be marked incorrect.'
      );
      if (!proceed) {
        showMessage('Submission cancelled. Your current answers are still saved on this device.');
        questions[missing[0] - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    var enteredName = window.prompt('Please type your name before submitting:', '');
    if (enteredName === null) {
      showMessage('Submission cancelled. Please enter your name when you are ready to submit.');
      return;
    }
    enteredName = enteredName.trim().slice(0, 80);
    if (!enteredName) {
      showMessage('Please type your name before submitting.');
      return;
    }
    state.studentName = enteredName;
    saveState();

    if (!config.submissionEndpoint) {
      showMessage('Your answers and name are saved. Tina’s submission connection is being activated; please keep this page open on this device.');
      return;
    }

    var button = document.getElementById('portal-submit');
    button.disabled = true;
    button.textContent = 'Checking answers…';
    state.submittedAt = new Date().toISOString();
    state.environment = testMode ? 'test' : 'production';
    try {
      var response = await fetch(config.submissionEndpoint, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(state)
      });
      if (response.type !== 'opaque' && !response.ok) throw new Error('Submission failed');
      submitted = true;
      saveState();
      lockSubmittedPage();
      pollForResult(0);
    } catch (error) {
      state.submittedAt = null;
      button.disabled = false;
      button.textContent = 'Try sending again';
      saveState();
      showMessage('The homework could not be sent. Your answers are still safely saved on this device.');
    }
  }

  function lockSubmittedPage() {
    submitted = true;
    document.body.classList.add('portal-submitted');
    questions.forEach(function (question) {
      Array.from(question.querySelectorAll('input, textarea')).forEach(function (field) { field.disabled = true; });
    });
    var button = document.getElementById('portal-submit');
    button.disabled = true;
    button.textContent = submittedReviewMode ? 'Loading submitted review…' : (progressReviewMode ? 'Read-only live view' : (state.result ? 'Answers checked' : 'Checking answers…'));
  }

  function pollForResult(attempt) {
    if (!config.submissionEndpoint || !state.submissionId) return;
    jsonp('getGradedResult', { submissionId: state.submissionId, assignmentId: assignmentId }, function (data) {
      if (data && data.ok && !data.pending) {
        state.result = data;
        saveState();
        renderResult(data);
        return;
      }
      if (attempt < 12) setTimeout(function () { pollForResult(attempt + 1); }, Math.min(900 + attempt * 350, 3200));
      else {
        document.getElementById('portal-submit').textContent = submittedReviewMode ? 'Submitted review unavailable' : 'Submitted — refresh to see corrections';
        showMessage(submittedReviewMode ? 'This submitted review could not be loaded.' : 'Your homework is safely submitted. Refresh this page in a moment to see the corrections.');
      }
    }, function () {
      if (attempt < 12) setTimeout(function () { pollForResult(attempt + 1); }, 1800);
      else showMessage(submittedReviewMode ? 'This submitted review could not be loaded.' : 'Your homework is submitted. Refresh shortly to load the corrections.');
    });
  }

  function pollForProgressReview(attempt) {
    clearTimeout(progressPollTimer);
    jsonp('getHomeworkProgress', { saveId: progressSaveId, assignmentId: assignmentId }, function (data) {
      if (data && data.ok && !data.pending) {
        renderProgressReview(data);
        progressPollTimer = setTimeout(function () { pollForProgressReview(0); }, 5000);
        return;
      }
      if (attempt < 8) progressPollTimer = setTimeout(function () { pollForProgressReview(attempt + 1); }, 1500);
      else {
        document.getElementById('portal-submit').textContent = 'Live progress unavailable';
        showMessage('No synced progress was found for this link.');
      }
    }, function () {
      if (attempt < 8) progressPollTimer = setTimeout(function () { pollForProgressReview(attempt + 1); }, 1800);
      else showMessage('The live progress view could not refresh.');
    });
  }

  function renderProgressReview(data) {
    state.responses = data.responses || {};
    state.studentName = data.studentName || 'Joy';
    applyResponsesToForm();
    updateProgress();
    lockSubmittedPage();
    var resultBox = document.getElementById('portal-result');
    resultBox.hidden = false;
    resultBox.innerHTML = '<span class="result-kicker">Live student progress</span><div class="result-score"><strong>' +
      escapeHtml(data.answeredCount) + ' / ' + escapeHtml(data.questionCount) +
      '</strong><span>answers currently synced</span></div><p>Read-only view of Joy’s latest saved work. This page refreshes automatically every five seconds. Last server update: <strong>' +
      escapeHtml(formatReviewTime(data.updatedAt)) + '</strong>.</p>';
    document.getElementById('portal-submit-copy').hidden = true;
    document.getElementById('portal-unanswered').textContent = data.status === 'submitted' ? 'Final submission received' : 'Work still in progress';
    document.getElementById('portal-submit').textContent = 'Read-only live view';
    document.getElementById('difficulty-panel').hidden = true;
  }

  function applyResponsesToForm() {
    questions.forEach(function (question, index) {
      Array.from(question.querySelectorAll('.choice')).forEach(function (choice) {
        var input = choice.querySelector('input');
        input.checked = false;
        choice.classList.remove('is-selected');
      });
      var response = state.responses[index + 1] || state.responses[String(index + 1)] || {};
      if (response.answer) {
        var input = question.querySelector('input[value="' + response.answer + '"]');
        if (input) { input.checked = true; input.closest('.choice').classList.add('is-selected'); }
      }
      Array.from(question.querySelectorAll('textarea[data-field]')).forEach(function (field) {
        field.value = response[field.dataset.field] || '';
      });
      Array.from(question.querySelectorAll('input, textarea')).forEach(function (field) { field.disabled = true; });
    });
  }

  function formatReviewTime(value) {
    var date = new Date(value);
    return isNaN(date.getTime()) ? 'unknown' : date.toLocaleString();
  }

  function renderResult(result) {
    if (!result || !Array.isArray(result.correctAnswers)) return;
    questions.forEach(function (question, index) {
      var selected = result.answers[index];
      var correct = result.correctAnswers[index];
      var selectedChoice = question.querySelector('.choice[data-letter="' + selected + '"]');
      var correctChoice = question.querySelector('.choice[data-letter="' + correct + '"]');
      if (submittedReviewMode) {
        Array.from(question.querySelectorAll('input[type="radio"]')).forEach(function (input) { input.checked = false; });
        if (selectedChoice) selectedChoice.querySelector('input').checked = true;
        var reviewNote = (result.notes && (result.notes[index + 1] || result.notes[String(index + 1)])) || {};
        Array.from(question.querySelectorAll('textarea[data-field]')).forEach(function (field) {
          field.value = reviewNote[field.dataset.field] || '';
          field.disabled = true;
        });
      }
      question.classList.toggle('question-correct', selected === correct);
      question.classList.toggle('question-wrong', selected !== correct);
      if (selectedChoice) selectedChoice.classList.add(selected === correct ? 'is-correct' : 'is-wrong');
      if (correctChoice) {
        correctChoice.classList.add('is-correct-answer');
        if (!correctChoice.querySelector('.answer-label')) {
          var label = document.createElement('span');
          label.className = 'answer-label';
          label.textContent = selected === correct ? 'Correct' : 'Correct answer';
          correctChoice.appendChild(label);
        }
      }
      if (selected !== correct && selectedChoice && !selectedChoice.querySelector('.answer-label')) {
        var wrong = document.createElement('span');
        wrong.className = 'answer-label wrong-label';
        wrong.textContent = 'Your answer';
        selectedChoice.appendChild(wrong);
      }
      if (!selected && !question.querySelector('.question-result-label')) {
        var unanswered = document.createElement('div');
        unanswered.className = 'question-result-label';
        unanswered.textContent = 'Unanswered — counted incorrect';
        question.insertBefore(unanswered, question.firstChild);
      }
    });
    var resultBox = document.getElementById('portal-result');
    resultBox.hidden = false;
    resultBox.innerHTML = '<span class="result-kicker">Checked instantly</span><div class="result-score"><strong>' + result.score + ' / ' + result.total + '</strong><span>' + result.percent + '% correct</span></div><p>Submitted as <strong>' + escapeHtml(result.studentName || state.studentName) + '</strong>. The correct choice is highlighted for every question. Mark anything you want to review with Tina below.</p>';
    document.getElementById('portal-submit-copy').hidden = true;
    document.getElementById('portal-unanswered').textContent = submittedReviewMode ? 'Read-only submitted review' : (testMode ? 'Tina test record' : 'Saved in Tina’s register');
    document.getElementById('portal-submit').textContent = submittedReviewMode ? 'Read-only submitted review' : 'Answers checked';
    if (submittedReviewMode) document.getElementById('difficulty-panel').hidden = true;
    else {
      installDifficultyChoices();
      document.getElementById('difficulty-panel').hidden = false;
    }
  }

  function installDifficultyChoices() {
    var grid = document.getElementById('difficulty-grid');
    if (grid.children.length) return;
    grid.innerHTML = questions.map(function (_, index) {
      var number = index + 1;
      var checked = state.difficultyFlags && state.difficultyFlags[number] ? ' checked' : '';
      return '<label class="difficulty-choice"><input type="checkbox" value="' + number + '"' + checked + '><span>Question ' + number + '</span></label>';
    }).join('');
    Array.from(grid.querySelectorAll('input')).forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        state.difficultyFlags = state.difficultyFlags || {};
        state.difficultyFlags[checkbox.value] = checkbox.checked;
        saveState();
        scheduleFlagSave();
      });
    });
  }

  function scheduleFlagSave() {
    clearTimeout(flagTimer);
    document.getElementById('difficulty-status').textContent = 'Saving your review list…';
    flagTimer = setTimeout(saveDifficultyFlags, 500);
  }

  async function saveDifficultyFlags() {
    if (teacherReviewMode || !config.submissionEndpoint) return;
    try {
      await fetch(config.submissionEndpoint, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveDifficultyFlags', assignmentId: assignmentId, submissionId: state.submissionId, studentName: state.studentName, environment: state.environment, flags: state.difficultyFlags || {} })
      });
      document.getElementById('difficulty-status').textContent = 'Review list saved for Tina.';
    } catch (error) {
      document.getElementById('difficulty-status').textContent = 'Saved on this device; online sync will retry after your next change.';
    }
  }

  function checkResetState() {
    if (teacherReviewMode || !config.submissionEndpoint) return;
    jsonp('getResetState', { assignmentId: assignmentId }, function (data) {
      if (!data || !data.ok) return;
      var remoteVersion = Number(data.resetVersion) || 0;
      var needsReset = state.resetVersion === null || typeof state.resetVersion === 'undefined'
        ? Boolean(state.submittedAt && remoteVersion > 0)
        : remoteVersion > Number(state.resetVersion || 0);
      if (needsReset) {
        state = freshState();
        state.resetVersion = remoteVersion;
        localStorage.setItem(storageKey, JSON.stringify(state));
        window.location.reload();
        return;
      }
      if (state.resetVersion === null || typeof state.resetVersion === 'undefined') {
        state.resetVersion = remoteVersion;
        saveState();
      }
    });
  }

  function jsonp(action, parameters, success, failure) {
    var callbackName = '__joyPortal' + Date.now() + Math.random().toString(16).slice(2);
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

  function showMessage(text) {
    var message = document.getElementById('portal-message');
    message.textContent = text;
    message.hidden = false;
    clearTimeout(showMessage.timer);
    showMessage.timer = setTimeout(function () { message.hidden = true; }, 6500);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
    });
  }
}());
