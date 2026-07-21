# Joy SAT Homework Portal

Interactive, mobile-friendly homework pages for Joy's SAT Reading and Writing programme.

Role boundary: **Joy is the student** and **Teacher** is the generic private staff role. Mock Exam 2 uses the normal URL for Joy's real work and `?test=1` for the isolated Teacher testing copy.

- `index.html` is the date-based student portal.
- `2026-07-15/` contains the student handout, Class 12 summary/reflection, optional PDF submission, Inferences preview, and Mock Exam 2 answer saver.
- `2026-07-17/` contains the taught portion of the Class 13 Inferences handout through Question 1, the guided 30-question Class 13 homework, and the English class summary/reflection.
- `2026-07-20/` contains the full Inferences handout completed across Classes 13-14, the assigned original full 20-question Inferences practice, and the assigned 10-question annotated Words in Context preview for Class 15. No Class 14 summary or reflection is published yet.
- `class-12/` contains Homework 1, the 20-question Command of Evidence assignment.
- `assets/` contains the reusable interface, autosave, progress, PDF-print controls, incomplete-submission confirmation, required submitted names, Teacher-controlled Check and Explain modes, Teacher-controlled handout answer/annotation reveal, difficult-question flags, mock-exam answer grid, and submission behavior.
- Teacher versions, answer keys, and the private saving service are intentionally excluded from the hosted repository.

The private dashboard never displays the configured Teacher email address. Check mode controls scores and corrections; Explain mode controls English mistake explanations and is effective only while Check mode is on. Each published student handout has a separate Answers & Annotations reveal control, with locked content stored only in the private backend. Mock Exam 2 offers `Erase record` and a mode-specific `Reset progress`; PDF submissions offer `Delete record + file`, which verifies the private upload folder before moving the file to the Drive bin and removing its tracker row.
