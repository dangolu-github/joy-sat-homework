(function () {
  'use strict';

  var storagePrefix = 'joy-class-logbook:';
  var periods = Array.from(document.querySelectorAll('[data-logbook-period]'));
  var roundStorageKey = 'joy-course-round';
  var roundTabs = Array.from(document.querySelectorAll('[data-course-round]'));
  var roundPanels = Array.from(document.querySelectorAll('[data-course-round-panel]'));

  function selectRound(round) {
    var selected = round === 'round1' ? 'round1' : 'round2';
    roundTabs.forEach(function (tab) {
      var active = tab.dataset.courseRound === selected;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    });
    roundPanels.forEach(function (panel) {
      panel.hidden = panel.dataset.courseRoundPanel !== selected;
    });
    try {
      window.localStorage.setItem(roundStorageKey, selected);
    } catch (error) {
      // Round choice remains usable without browser storage.
    }
    updateScrollWindows();
  }

  var initialRound = 'round2';
  try {
    if (window.localStorage.getItem(roundStorageKey) === 'round1') initialRound = 'round1';
  } catch (error) {
    // Round 2 remains the default current phase.
  }
  roundTabs.forEach(function (tab) {
    tab.addEventListener('click', function () { selectRound(tab.dataset.courseRound); });
    tab.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      var nextRound = tab.dataset.courseRound === 'round1' ? 'round2' : 'round1';
      selectRound(nextRound);
      var nextTab = roundTabs.filter(function (candidate) { return candidate.dataset.courseRound === nextRound; })[0];
      if (nextTab) nextTab.focus();
    });
  });
  selectRound(initialRound);

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
