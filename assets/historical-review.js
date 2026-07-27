(function () {
  'use strict';

  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwz64jQW8YH6CEgH-GK4ieTyiJD40h5ro3udAQEr96j7dtqh9dgphwO-FmZyiSCXnUi/exec';
  var assignmentId = document.body.getAttribute('data-historical-assignment') || '';
  var target = document.getElementById('historical-review');
  var title = document.getElementById('historical-title');
  var status = document.getElementById('historical-status');

  if (!assignmentId || !target || !title || !status) return;

  window.JoyPortalAccess.ready.then(function (token) {
    request({ action: 'getHistoricalReview', assignmentId: assignmentId, accessToken: token });
  });

  function request(parameters) {
    var callback = 'joyHistoricalHomework' + Date.now() + Math.floor(Math.random() * 10000);
    var script = document.createElement('script');
    var timer = window.setTimeout(function () {
      cleanup();
      showError('The checked homework is temporarily unavailable.');
    }, 15000);

    window[callback] = function (data) {
      cleanup();
      if (!data || !data.ok) {
        showError((data && data.error) || 'The checked homework is unavailable.');
        return;
      }
      render(data);
    };
    parameters.callback = callback;
    script.src = ENDPOINT + '?' + new URLSearchParams(parameters).toString();
    script.onerror = function () {
      cleanup();
      showError('The checked homework could not connect.');
    };
    document.head.appendChild(script);

    function cleanup() {
      window.clearTimeout(timer);
      if (script.parentNode) script.parentNode.removeChild(script);
      try { delete window[callback]; } catch (error) { window[callback] = undefined; }
    }
  }

  function render(data) {
    title.textContent = data.label;
    status.textContent = data.checkReleased
      ? (data.explainReleased
        ? 'Your archived answers, corrections, and English explanations are shown together below.'
        : 'Your archived answers and corrections are shown below. Explanation is not currently released.')
      : 'Your archived answers are shown below. Corrections remain hidden until the Teacher enables Check.';

    if (!data.checkReleased) {
      target.innerHTML = '<div class="historical-notice">Check is currently off. Your recorded choices remain visible without correctness.</div>';
    } else if (typeof data.correctCount === 'number') {
      target.innerHTML = '<section class="historical-summary"><div class="historical-score">'
        + escapeHtml(data.correctCount + ' / ' + data.questionCount)
        + '</div><div><strong>' + escapeHtml(data.percent + '% correct')
        + '</strong><br>Archived checked homework</div></section>';
    } else {
      target.innerHTML = '';
    }

    if (data.writtenReview && data.writtenReview.length) {
      renderWrittenReview(data);
      return;
    }
    renderQuestionReview(data);
  }

  function renderWrittenReview(data) {
    var cards = data.writtenReview.map(function (item) {
      return '<article class="historical-card"><h3>' + escapeHtml(item.label) + '</h3>'
        + '<dl><dt>Your response</dt><dd>' + escapeHtml(item.studentResponse || 'No response recorded') + '</dd>'
        + (data.checkReleased ? '<dt>Correction</dt><dd>' + escapeHtml(item.check || '') + '</dd>' : '')
        + (data.explainReleased
          ? '<dt>English explanation</dt><dd>' + escapeHtml(item.explanation || '') + '</dd>'
            + '<dt>Next step</dt><dd>' + escapeHtml(item.takeaway || '') + '</dd>'
          : '')
        + '</dl></article>';
    }).join('');
    target.insertAdjacentHTML('beforeend', '<div class="historical-grid historical-written-grid">' + cards + '</div>');
  }

  function renderQuestionReview(data) {
    var questions = questionMap();
    var answers = data.selectedAnswers || [];
    var correctAnswers = data.correctAnswers || [];
    var unmatched = [];

    answers.forEach(function (selected, index) {
      var number = index + 1;
      var question = questions[number];
      var correct = correctAnswers[index] || '';
      var explanation = (data.mistakeExplanations || {})[number]
        || (data.mistakeExplanations || {})[String(number)];

      if (!question) {
        unmatched.push({ number: number, selected: selected, correct: correct, explanation: explanation });
        return;
      }
      decorateQuestion(question, selected, correct, data.checkReleased, data.explainReleased, explanation);
    });

    if (unmatched.length) {
      var cards = unmatched.map(function (item) {
        return fallbackCard(item, data.checkReleased, data.explainReleased);
      }).join('');
      target.insertAdjacentHTML(
        'beforeend',
        '<div class="historical-notice">These archived items could not be matched to a question block, so their feedback is listed here.</div>'
          + '<div class="historical-grid">' + cards + '</div>'
      );
    }
  }

  function questionMap() {
    var result = {};
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.question, .q, article'));
    nodes.forEach(function (node) {
      if (node.closest('#checked-work')) return;
      var heading = node.querySelector('.q-num, .meta, .qhead h2, .qhead .num, h2, h3');
      var headingText = heading ? heading.textContent : '';
      var match = headingText.match(/(?:Question|Q)\s*(\d+)/i) || headingText.match(/^\s*(\d+)\./);
      if (!match) return;
      var number = Number(match[1]);
      if (!result[number] && choicesFor(node).length) result[number] = node;
    });
    return result;
  }

  function choicesFor(question) {
    return Array.prototype.slice.call(
      question.querySelectorAll('.choice, ol.choices > li, ul.choices > li')
    );
  }

  function choiceLetter(choice) {
    var explicit = choice.getAttribute('data-letter');
    if (explicit) return explicit.toUpperCase();
    var match = choice.textContent.match(/^\s*([A-D])[\.\)]/i);
    return match ? match[1].toUpperCase() : '';
  }

  function decorateQuestion(question, selected, correct, checkReleased, explainReleased, explanation) {
    var choices = choicesFor(question);
    var selectedChoice = null;
    var correctChoice = null;

    question.classList.add('historical-reviewed-question');
    choices.forEach(function (choice) {
      var letter = choiceLetter(choice);
      if (letter === selected) selectedChoice = choice;
      if (letter === correct) correctChoice = choice;
    });

    if (selectedChoice) {
      selectedChoice.classList.add('historical-selected-answer');
      addChoiceLabel(selectedChoice, checkReleased && selected === correct ? 'Your answer · Correct' : 'Your answer');
    } else if (!selected) {
      var blank = document.createElement('div');
      blank.className = 'historical-blank-answer';
      blank.textContent = checkReleased ? 'Your answer: blank — counted incorrect' : 'Your answer: blank';
      question.appendChild(blank);
    }

    if (!checkReleased) return;

    if (selected === correct) {
      question.classList.add('historical-question-correct');
      if (selectedChoice) selectedChoice.classList.add('historical-correct-answer');
    } else {
      question.classList.add('historical-question-wrong');
      if (selectedChoice) selectedChoice.classList.add('historical-wrong-answer');
      if (correctChoice) {
        correctChoice.classList.add('historical-correct-answer');
        addChoiceLabel(correctChoice, 'Correct answer');
      }
      if (explainReleased && explanation) {
        question.appendChild(mistakeExplanation(explanation));
      }
    }
  }

  function addChoiceLabel(choice, text) {
    var label = document.createElement('span');
    label.className = 'historical-answer-label';
    label.textContent = text;
    choice.appendChild(label);
  }

  function mistakeExplanation(explanation) {
    var details = document.createElement('details');
    details.className = 'historical-mistake-explanation';
    details.open = true;
    details.innerHTML = '<summary>Wrong-answer correction and explanation</summary>'
      + '<div class="historical-explanation-body">'
      + '<p class="historical-method">' + escapeHtml(explanation.method || 'SAT decision method') + '</p>'
      + '<dl><dt>Why your answer misses</dt><dd>' + escapeHtml(explanation.whySelectedFails || '') + '</dd>'
      + '<dt>Correct path</dt><dd>' + escapeHtml(explanation.correctPath || '') + '</dd>'
      + '<dt>Takeaway</dt><dd>' + escapeHtml(explanation.takeaway || '') + '</dd></dl>'
      + '</div>';
    return details;
  }

  function fallbackCard(item, checkReleased, explainReleased) {
    return '<article class="historical-card"><h3>Question ' + item.number + '</h3>'
      + '<p><strong>Your answer:</strong> ' + escapeHtml(item.selected || 'blank') + '</p>'
      + (checkReleased ? '<p><strong>Correct answer:</strong> ' + escapeHtml(item.correct) + '</p>' : '')
      + (explainReleased && item.explanation
        ? '<dl><dt>Why your answer misses</dt><dd>' + escapeHtml(item.explanation.whySelectedFails || '') + '</dd>'
          + '<dt>Correct path</dt><dd>' + escapeHtml(item.explanation.correctPath || '') + '</dd>'
          + '<dt>Takeaway</dt><dd>' + escapeHtml(item.explanation.takeaway || '') + '</dd></dl>'
        : '')
      + '</article>';
  }

  function showError(message) {
    title.textContent = 'Checked homework unavailable';
    status.textContent = message;
    target.innerHTML = '<div class="historical-notice">' + escapeHtml(message) + '</div>';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }
}());
