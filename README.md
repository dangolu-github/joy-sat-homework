# Joy SAT Homework Portal

Interactive, mobile-friendly homework pages for Joy's SAT Reading and Writing programme.

Role boundary: **Joy is the student** and **Tina is the teacher**. Mock Exam 2 uses the normal URL for Joy's real work and `?test=1` for Tina's isolated testing copy.

- `index.html` is the date-based student portal.
- `2026-07-15/` contains the student handout, class-answer note, feedback space, optional PDF submission, Inferences preview, and Mock Exam 2 answer saver.
- `class-12/` contains Homework 1, the 20-question Command of Evidence assignment.
- `assets/` contains the reusable interface, autosave, progress, PDF-print controls, incomplete-submission confirmation, required submitted names, server-confirmed correction display, difficult-question flags, mock-exam answer grid, and submission behavior.
- Teacher versions, answer keys, and the private saving service are intentionally excluded from the hosted repository.

The private dashboard never displays Tina's configured email address. Mock Exam 2 offers `Erase record` and a mode-specific `Reset progress`; PDF submissions offer `Delete record + file`, which verifies the private upload folder before moving the file to the Drive bin and removing its tracker row.
