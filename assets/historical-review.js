(function () {
  'use strict';
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwz64jQW8YH6CEgH-GK4ieTyiJD40h5ro3udAQEr96j7dtqh9dgphwO-FmZyiSCXnUi/exec';
  var assignmentId = new URLSearchParams(window.location.search).get('assignment') || '';
  var target = document.getElementById('historical-review');
  var title = document.getElementById('historical-title');
  var status = document.getElementById('historical-status');

  if (!assignmentId) {
    showError('This checked-work link is incomplete.');
    return;
  }
  window.JoyPortalAccess.ready.then(function (token) {
    request({ action: 'getHistoricalReview', assignmentId: assignmentId, accessToken: token });
  });

  function request(parameters) {
    var callback = 'joyHistoricalReview' + Date.now() + Math.floor(Math.random() * 10000);
    var script = document.createElement('script');
    var timer = window.setTimeout(function () {
      cleanup();
      showError('The checked review is temporarily unavailable.');
    }, 15000);
    window[callback] = function (data) {
      cleanup();
      if (!data || !data.ok) {
        showError((data && data.error) || 'The checked review is unavailable.');
        return;
      }
      render(data);
    };
    parameters.callback = callback;
    script.src = ENDPOINT + '?' + new URLSearchParams(parameters).toString();
    script.onerror = function () {
      cleanup();
      showError('The checked review could not connect.');
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
      ? (data.explainReleased ? 'Check and English explanation released by Tina.' : 'Check released. Explanation is not currently released.')
      : 'Student responses are visible. Check is not currently released.';
    var output = '';
    if (!data.checkReleased) {
      output += '<div class="historical-notice">Your archived responses are listed below. Correctness remains hidden until Tina releases Check.</div>';
    } else if (typeof data.correctCount === 'number') {
      output += '<section class="historical-summary"><div class="historical-score">' + escapeHtml(data.correctCount + ' / ' + data.questionCount) + '</div><div><strong>' + escapeHtml(data.percent + '% correct') + '</strong><br>Checked archived response</div></section>';
    }
    if (data.writtenReview && data.writtenReview.length) {
      output += '<div class="historical-grid">' + data.writtenReview.map(function (item) {
        return '<article class="historical-card"><h2>' + escapeHtml(item.label) + '</h2>'
          + '<dl><dt>Your response</dt><dd>' + escapeHtml(item.studentResponse || 'No response recorded') + '</dd>'
          + (data.checkReleased ? '<dt>Check</dt><dd>' + escapeHtml(item.check || '') + '</dd>' : '')
          + (data.explainReleased ? '<dt>English explanation</dt><dd>' + escapeHtml(item.explanation || '') + '</dd><dt>Next step</dt><dd>' + escapeHtml(item.takeaway || '') + '</dd>' : '')
          + '</dl></article>';
      }).join('') + '</div>';
    } else {
      var answers = data.selectedAnswers || [];
      var cards = answers.map(function (selected, index) {
        var number = index + 1;
        var correct = (data.correctAnswers || [])[index] || '';
        var explanation = (data.mistakeExplanations || {})[number];
        var isCorrect = data.checkReleased && selected && selected === correct;
        var content = '<article class="historical-card"><h2>Question ' + number + '</h2><div class="answer-line">'
          + '<span class="answer-chip selected">Your answer: ' + escapeHtml(selected || 'blank') + '</span>';
        if (data.checkReleased) {
          content += '<span class="answer-chip ' + (isCorrect ? 'correct' : '') + '">Correct answer: ' + escapeHtml(correct) + '</span>';
        }
        content += '</div>';
        if (data.explainReleased && explanation) {
          content += '<dl><dt>Method</dt><dd>' + escapeHtml(explanation.method) + '</dd>'
            + '<dt>Why this answer misses</dt><dd>' + escapeHtml(explanation.whySelectedFails) + '</dd>'
            + '<dt>Correct path</dt><dd>' + escapeHtml(explanation.correctPath) + '</dd>'
            + '<dt>Takeaway</dt><dd>' + escapeHtml(explanation.takeaway) + '</dd></dl>';
        }
        return content + '</article>';
      }).join('');
      output += '<div class="historical-grid">' + cards + '</div>';
    }
    target.innerHTML = output;
  }

  function showError(message) {
    title.textContent = 'Checked review unavailable';
    status.textContent = message;
    target.innerHTML = '<div class="historical-notice">' + escapeHtml(message) + '</div>';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }
}());
