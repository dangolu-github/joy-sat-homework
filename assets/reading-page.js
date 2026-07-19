(function () {
  'use strict';
  function portalAccessToken() { return window.JoyPortalAccess ? window.JoyPortalAccess.getToken() : ''; }
  document.body.classList.add('resource-page');
  var backHref = document.body.dataset.resourceBack || './';
  var backLabel = document.body.dataset.resourceBackLabel || '← July 15 class page';
  var contextLabel = document.body.dataset.resourceContext || 'Joy SAT · Class 12';
  var resourceId = document.body.dataset.resourceId || '';
  var endpoint = document.body.dataset.resourceEndpoint || '';
  var nav = document.createElement('nav');
  nav.className = 'resource-topbar';
  nav.setAttribute('aria-label', 'Resource navigation');
  nav.innerHTML = '<a></a><div class="resource-actions"><span class="resource-reveal-status" id="resource-reveal-status" hidden></span><span class="resource-context"></span><button type="button" id="save-resource-pdf">Save as PDF</button></div>';
  nav.querySelector('a').href = backHref;
  nav.querySelector('a').textContent = backLabel;
  nav.querySelector('.resource-context').textContent = contextLabel;
  document.body.insertBefore(nav, document.body.firstChild);
  document.getElementById('save-resource-pdf').addEventListener('click', function () {
    window.print();
  });
  if (resourceId && endpoint) {
    loadLearningResource();
    window.setInterval(loadLearningResource, 15000);
  }

  function loadLearningResource() {
    jsonp('getLearningResource', { resourceId: resourceId }, function (data) {
      if (!data || !data.ok) return;
      renderReveal(Boolean(data.revealMode), data.annotations || []);
    });
  }

  function renderReveal(enabled, annotations) {
    var status = document.getElementById('resource-reveal-status');
    status.hidden = false;
    status.textContent = enabled ? 'Answers & annotations available' : 'Answers & annotations locked';
    status.classList.toggle('is-released', enabled);
    Array.from(document.querySelectorAll('.resource-answer-annotation')).forEach(function (element) { element.remove(); });
    if (!enabled) return;
    var questions = Array.from(document.querySelectorAll('.question'));
    annotations.forEach(function (annotation, index) {
      var question = questions[index];
      if (!question) return;
      var details = document.createElement('details');
      details.className = 'resource-answer-annotation';
      var summary = document.createElement('summary');
      summary.textContent = 'Show answer & annotation';
      details.appendChild(summary);
      var body = document.createElement('div');
      body.className = 'resource-answer-body';
      body.appendChild(annotationLine('Answer', annotation.answer));
      body.appendChild(annotationLine('Method', annotation.method));
      body.appendChild(annotationLine('Why it works', annotation.explanation));
      body.appendChild(annotationLine('Trap check', annotation.trap));
      details.appendChild(body);
      question.appendChild(details);
    });
  }

  function annotationLine(label, value) {
    var line = document.createElement('p');
    var strong = document.createElement('strong');
    strong.textContent = label + ': ';
    line.appendChild(strong);
    line.appendChild(document.createTextNode(value || ''));
    return line;
  }

  function jsonp(action, parameters, success) {
    parameters.accessToken = portalAccessToken();
    var callbackName = '__joyResource' + Date.now() + Math.random().toString(16).slice(2);
    var script = document.createElement('script');
    var timeout = window.setTimeout(cleanup, 9000);
    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[callbackName] = function (data) { cleanup(); success(data); };
    script.onerror = cleanup;
    var query = Object.keys(parameters).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(parameters[key]);
    });
    query.push('action=' + encodeURIComponent(action));
    query.push('callback=' + encodeURIComponent(callbackName));
    query.push('_=' + Date.now());
    script.src = endpoint + '?' + query.join('&');
    document.head.appendChild(script);
  }
}());
