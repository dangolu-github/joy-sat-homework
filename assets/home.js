(function () {
  'use strict';

  var storagePrefix = 'joy-class-logbook:';
  var periods = Array.from(document.querySelectorAll('[data-logbook-period]'));

  periods.forEach(function (period) {
    var key = storagePrefix + period.dataset.logbookPeriod;
    try {
      var saved = window.localStorage.getItem(key);
      if (saved === 'open') period.open = true;
      if (saved === 'closed') period.open = false;
    } catch (error) {
      // Native details still works when browser storage is unavailable.
    }
    period.addEventListener('toggle', function () {
      try {
        window.localStorage.setItem(key, period.open ? 'open' : 'closed');
      } catch (error) {
        // Open state is optional; never block the logbook.
      }
      updateScrollWindows();
    });
  });

  function updateScrollWindows() {
    document.querySelectorAll('.class-logbook-window').forEach(function (windowElement) {
      var isScrollable = windowElement.scrollHeight > windowElement.clientHeight + 1;
      windowElement.tabIndex = isScrollable ? 0 : -1;
    });
  }

  window.addEventListener('load', updateScrollWindows);
  window.addEventListener('resize', updateScrollWindows);
  updateScrollWindows();
}());
