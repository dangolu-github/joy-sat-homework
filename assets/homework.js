(function () {
  'use strict';

  var config = window.JOY_HOMEWORK_CONFIG || {};
  var assignmentId = config.assignmentId || 'joy-homework';
  var storageKey = 'joy-homework:' + assignmentId;
  var questions = Array.from(document.querySelectorAll('.question'));
  var state = loadState();
  var saveTimer = null;
  var submitted = Boolean(state.submittedAt);

  if (!questions.length) return;

  installHeader();
  enhanceQuestions();
  installSubmitZone();
  restoreState();
  updateProgress();
  document.body.classList.add('portal-ready');

  function freshState() {
    return {
      assignmentId: assignmentId,
      assignmentLabel: config.assignmentLabel || document.title,
      studentName: config.studentName || 'Joy',
      submissionId: createSubmissionId(),
      startedAt: new Date().toISOString(),
      updatedAt: null,
      submittedAt: null,
      responses: {}
    };
  }

  function createSubmissionId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return assignmentId + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
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
      '<a class="portal-brand" href="../">Joy SAT</a>' +
      '<div class="portal-progress" aria-label="Homework progress">' +
        '<div class="portal-progress-row"><span>Class 12 progress</span><strong id="portal-count">0 of ' + questions.length + ' answered</strong></div>' +
        '<div class="portal-track"><div class="portal-fill" id="portal-fill"></div></div>' +
      '</div>' +
      '<div class="portal-save" id="portal-save" aria-live="polite">Saved on this device</div>';
    document.body.insertBefore(header, document.body.firstChild);
  }

  function enhanceQuestions() {
    questions.forEach(function (question, index) {
      var questionNumber = index + 1;
      question.dataset.question = String(questionNumber);

      Array.from(question.querySelectorAll('.choice')).forEach(function (choice, choiceIndex) {
        var letter = String.fromCharCode(65 + choiceIndex);
        var original = choice.innerHTML;
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
          if (event.target.tagName !== 'INPUT') {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
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
    return '<div class="reasoning-field">' +
      '<label for="q' + number + '-' + field + '">' + label + '</label>' +
      '<textarea id="q' + number + '-' + field + '" data-field="' + field + '" placeholder="' + placeholder + '"></textarea>' +
    '</div>';
  }

  function installSubmitZone() {
    var zone = document.createElement('section');
    zone.className = 'portal-submit-zone';
    zone.innerHTML =
      '<h2>Ready to finish?</h2>' +
      '<p>Review any unanswered questions before sending your final responses.</p>' +
      '<div class="portal-submit-row">' +
        '<span class="portal-unanswered" id="portal-unanswered"></span>' +
        '<button class="portal-submit" id="portal-submit" type="button">Send completed homework</button>' +
      '</div>';
    document.body.appendChild(zone);

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
        if (input) {
          input.checked = true;
          input.closest('.choice').classList.add('is-selected');
        }
      }
      Array.from(question.querySelectorAll('textarea[data-field]')).forEach(function (field) {
        field.value = response[field.dataset.field] || '';
      });
    });

    if (submitted) {
      document.body.classList.add('portal-submitted');
      var button = document.getElementById('portal-submit');
      button.disabled = true;
      button.textContent = 'Homework submitted';
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    var saveLabel = document.getElementById('portal-save');
    saveLabel.textContent = 'Saving…';
    saveTimer = setTimeout(saveState, 180);
  }

  function saveState() {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      document.getElementById('portal-save').textContent = 'Saved on this device';
    } catch (error) {
      document.getElementById('portal-save').textContent = 'Unable to save';
    }
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
    if (submitted) return;
    questions.forEach(function (_, index) { captureQuestion(index + 1); });
    saveState();

    var missing = questions.map(function (_, index) { return index + 1; }).filter(function (number) {
      return !state.responses[number] || !state.responses[number].answer;
    });
    if (missing.length) {
      showMessage('Please answer every question before submitting. Missing: ' + missing.join(', ') + '.');
      questions[missing[0] - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!config.submissionEndpoint) {
      showMessage('Your answers are complete and saved. The teacher submission connection is being activated; please keep this page open on this device.');
      return;
    }

    var button = document.getElementById('portal-submit');
    button.disabled = true;
    button.textContent = 'Sending…';
    state.submittedAt = new Date().toISOString();

    try {
      var response = await fetch(config.submissionEndpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(state)
      });
      if (response.type !== 'opaque' && !response.ok) throw new Error('Submission failed');
      submitted = true;
      saveState();
      document.body.classList.add('portal-submitted');
      button.textContent = 'Homework submitted';
      showMessage('Homework sent successfully. You may close this page.');
    } catch (error) {
      state.submittedAt = null;
      button.disabled = false;
      button.textContent = 'Try sending again';
      saveState();
      showMessage('The homework could not be sent. Your answers are still safely saved on this device.');
    }
  }

  function showMessage(text) {
    var message = document.getElementById('portal-message');
    message.textContent = text;
    message.hidden = false;
    clearTimeout(showMessage.timer);
    showMessage.timer = setTimeout(function () { message.hidden = true; }, 6500);
  }
}());
