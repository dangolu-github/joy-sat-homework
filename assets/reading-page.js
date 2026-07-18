(function () {
  'use strict';
  document.body.classList.add('resource-page');
  var backHref = document.body.dataset.resourceBack || './';
  var backLabel = document.body.dataset.resourceBackLabel || '← July 15 class page';
  var contextLabel = document.body.dataset.resourceContext || 'Joy SAT · Class 12';
  var nav = document.createElement('nav');
  nav.className = 'resource-topbar';
  nav.setAttribute('aria-label', 'Resource navigation');
  nav.innerHTML = '<a></a><div class="resource-actions"><span class="resource-context"></span><button type="button" id="save-resource-pdf">Save as PDF</button></div>';
  nav.querySelector('a').href = backHref;
  nav.querySelector('a').textContent = backLabel;
  nav.querySelector('.resource-context').textContent = contextLabel;
  document.body.insertBefore(nav, document.body.firstChild);
  document.getElementById('save-resource-pdf').addEventListener('click', function () {
    window.print();
  });
}());
