(function () {
  'use strict';

  Array.from(document.querySelectorAll('main > article')).forEach(function (question) {
    question.classList.add('question');
    Array.from(question.querySelectorAll('.choices > li')).forEach(function (choice) {
      choice.classList.add('choice');
    });

    var work = document.createElement('p');
    work.className = 'work';
    work.textContent = 'Optional reasoning notes';
    question.appendChild(work);
  });
}());
