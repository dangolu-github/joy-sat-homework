(function () {
  'use strict';
  document.body.classList.add('resource-page');
  var nav = document.createElement('nav');
  nav.className = 'resource-topbar';
  nav.setAttribute('aria-label', 'Resource navigation');
  nav.innerHTML = '<a href="./">← July 15 class page</a><div class="resource-actions"><span class="resource-context">Joy SAT · Class 12</span><button type="button" id="save-resource-pdf">Save as PDF</button></div>';
  document.body.insertBefore(nav, document.body.firstChild);
  document.getElementById('save-resource-pdf').addEventListener('click', function () {
    window.print();
  });
}());
