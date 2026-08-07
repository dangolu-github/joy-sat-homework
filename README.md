# Joy SAT Homework Portal

Interactive, mobile-friendly homework pages for Joy's SAT Reading and Writing programme.

Role boundary: **Joy is the student** and **Teacher** is the generic private staff role. Mock Exam 2 uses the normal URL for Joy's real work and `?test=1` for the isolated Teacher testing copy.

- `index.html` is the student portal. Its large course-round switch opens the current Round 2 systematic-review space on a new device and preserves all Classes 1–19 under Round 1 Knowledge Foundations.
- `2026-07-15/` contains the student handout, Class 12 summary/reflection, optional PDF submission, Inferences preview, and Mock Exam 2 answer saver.
- `2026-07-17/` contains the taught portion of the Class 13 Inferences handout through Question 1, the guided 30-question Class 13 homework, and the English class summary/reflection.
- `2026-07-24/` contains the released Class 16 Text Structure and Purpose learning handout and a guided 30-question direct official practice page. Public files remain answer-free; homework keys, explanations, and release controls remain in the private Teacher Dashboard service.
- `2026-07-29/` contains the taught Class 18 Cross-Text Connections handout for the Two-Column Claim Map and Relationship Sentence, the assigned 30-question guided practice, and a link to the unfinished Class 17 Homework 2. The third prepared lesson skill remains private and unpublished.
- `2026-08-05/` is the Class 20 Sentence Boundaries entry. It owns the published learner-safe review handout, the English class review, and the direct assigned route to Intensive Practice > Standard English Conventions > Boundaries. The paired complete teacher handout remains private.
- `2026-07-20/` contains the full Inferences handout completed across Classes 13-14, the assigned original full 20-question Inferences practice, and the assigned 10-question annotated Words in Context preview for Class 15. No Class 14 summary or reflection is published yet.
- `class-12/` contains Homework 1, the 20-question Command of Evidence assignment.
- `boosters/skill-booster/` contains four SAT domains, ten leaf skills, and thirty homework-style practice pages. All 640 retained questions are embedded directly in HTML cards with native answer controls; the public pages and asset paths contain no source question IDs.
- `mistake-logbook/` is Joy's learner-only review space. Historical mistakes remain in Round 1; production mistakes recorded from the 2026-08-05 Round 2 boundary onward—including new Intensive Skill Booster work—enter Round 2. The same question can remain independently reviewable in both rounds. Joy may remove an exact round-specific item from future review and redo selections; this stores a dismissal only and never changes the original homework result, score, or evidence. The page renders each retained mistake directly, shows at most 20 questions per page, and builds round-scoped mixed or filtered auto-checked redo sets of at most 40 unique questions.
- `assets/` contains the reusable interface, autosave, progress, PDF-print controls, incomplete-submission confirmation, required submitted names, Teacher-controlled Check and Explain modes, Teacher-controlled handout answer/annotation reveal, difficult-question flags, mock-exam answer grid, and submission behavior.
- Teacher versions, answer keys, and the private saving service are intentionally excluded from the hosted repository.

The private dashboard never displays the configured Teacher email address. Check mode controls scores and corrections; Explain mode controls English mistake explanations and is effective only while Check mode is on. Each published student handout has a separate Answers & Annotations reveal control, with locked content stored only in the private backend. Mock Exam 2 offers `Erase record` and a mode-specific `Reset progress`; PDF submissions offer `Delete record + file`, which verifies the private upload folder before moving the file to the Drive bin and removing its tracker row.

Mistake-practice attempts are stored separately from homework submissions and are intentionally omitted from the Teacher Dashboard. The original wrong answer is retained. A latest correct redo is labelled `Recovered once`; a wrong or blank redo remains `Needs review`. Neither label changes assignment, teaching, checking, transfer, or mastery evidence.

Mistake Logbook removals are stored in a separate additive dismissal sheet. Production and Teacher-test dismissals are isolated; a dismissal affects only the exact round-specific logbook key and never deletes a graded result or answer event.
