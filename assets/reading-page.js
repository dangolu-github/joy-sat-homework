(function () {
  'use strict';
  document.body.classList.add('resource-page');
  var nav = document.createElement('nav');
  nav.className = 'resource-topbar';
  nav.setAttribute('aria-label', 'Resource navigation');
  nav.innerHTML = '<a href="./">← July 15 class page</a><span class="resource-context">Joy SAT · Class 12</span>';
  document.body.insertBefore(nav, document.body.firstChild);
}());
