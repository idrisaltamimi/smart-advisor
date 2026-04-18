# Smart Course Advisor – Activity Diagrams

The following activity diagrams illustrate the four core workflows of the Smart Advisor system. Together, they trace the complete student journey: entering the system, receiving AI-powered advice, acting on it, and recording outcomes. Each diagram maps directly to use cases defined in the Use Case Diagram and exercises entities from the Entity Relationship Diagram.

| Diagram | Story Role | Use Cases Covered | ERD Entities Touched |
|---------|-----------|-------------------|---------------------|
| Registration & Onboarding | Beginning | Register, Select Major | user, student, major |
| AI Semester Plan Generation | Climax | Generate Semester Plan | student, course, prerequisite, requirement, requirement_course, course_feedback |
| Plan Review & Enrollment | Resolution | Modify Course Selection, Enroll in Suggested Plan | semester, semester_course, course |
| Semester Completion | Consequence | Submit Semester Grades, Submit Course Feedback | semester, semester_course, course_feedback, student (CGPA) |

---

## 1. Registration & Onboarding

This diagram covers the student's entry into the system. It maps to the **Register** and **Select Major** use cases, where registration always includes major selection (the `<<include>>` relationship from the Use Case Diagram). The flow touches the `user`, `student`, and `major` entities from the ERD.

```plantuml
@startuml
skinparam shadowing false
skinparam dpi 160
skinparam ActivityBackgroundColor #F7FBFF
skinparam ActivityBorderColor #1F2D3D
skinparam ActivityFontColor #0B1220
skinparam ArrowColor #1F2D3D
skinparam ActivityDiamondBackgroundColor #F7FBFF
skinparam ActivityDiamondBorderColor #1F2D3D

title Activity Diagram – Registration & Onboarding

start

:Student opens the app;

:Student taps "Register";

:Student enters full name,
email, and password;

:Student submits the registration form;

if (Are all fields valid?) then (yes)

  if (Is email already registered?) then (yes)
    :Display "Email already in use" error;
    stop
  else (no)
    :Create user account;
    :Generate JWT authentication token;

    :Fetch list of available majors;

    :Student selects a major;

    :Create student profile
    linked to the selected major;

    :Redirect to Home screen;
    stop
  endif

else (no)
  :Display validation errors;
  stop
endif

@enduml
```

---

## 2. AI-Powered Semester Plan Generation

This diagram covers the system's core feature: AI-driven course planning. It maps to the **Generate Semester Plan** use case and exercises the largest number of ERD entities: `student`, `course`, `prerequisite`, `requirement`, `requirement_course`, and `course_feedback`. The flow illustrates how the system builds a rich academic context, applies business rules (credit caps, prerequisite checks, unlock priority), and delegates final course selection to GPT-4o via function calling.

```plantuml
@startuml
skinparam shadowing false
skinparam dpi 160
skinparam ActivityBackgroundColor #F7FBFF
skinparam ActivityBorderColor #1F2D3D
skinparam ActivityFontColor #0B1220
skinparam ArrowColor #1F2D3D
skinparam ActivityDiamondBackgroundColor #F7FBFF
skinparam ActivityDiamondBorderColor #1F2D3D

title Activity Diagram – AI Semester Plan Generation

|Student|
start
:Select semester type
(Fall, Spring, or Summer);

:Set maximum credit limit;

:Optionally add notes
or preferences;

:Tap "Generate Advice";

|System|
:Validate student profile
and major selection;

:Compute server-side credit cap
based on CGPA and semester type;

if (Requested credits > server cap?) then (yes)
  :Adjust credit limit to server cap;
  :Set credit adjustment warning;
else (no)
endif

:Build student context:
- Identify completed courses
- Calculate requirement progress
- Determine satisfied requirements;

:Build available courses list:
- Filter out completed courses
- Check prerequisite satisfaction
- Compute unlock priority counts
- Calculate credit-fit scores
- Retrieve average difficulty ratings;

:Sort available courses by:
1. Unlock tier (requirements > electives > none)
2. Category priority
3. Unlock count (descending);

if (Are there available courses?) then (yes)

  :Construct GPT-4o system prompt with:
  - Student CGPA and completed credits
  - Requirement progress breakdown
  - Available courses with tags
  - Planning rules and constraints;

  |AI (GPT-4o)|
  :Analyze student context
  and available courses;

  :Select optimal courses via
  suggest_semester_plan function call;

  |System|
  :Parse AI response;

  :Validate AI suggestions:
  - Remove invalid course IDs
  - Enforce credit cap
  - Enforce level restrictions
  (100/200-level only for early semesters);

  :Compute semester label
  (e.g., "Fall 2026");

  |Student|
  :View suggested course plan
  with reasons for each course;
  stop

else (no)
  :Display "No available courses" error;
  stop
endif

@enduml
```

---

## 3. Plan Review & Enrollment

This diagram covers the student's interaction with the generated plan before committing to it. It maps to the **Modify Course Selection** and **Enroll in Suggested Plan** use cases (both `<<extend>>` from Generate Semester Plan in the Use Case Diagram). The flow shows the decision loop where a student can swap courses, remove courses, re-advise, or enroll — touching the `semester`, `semester_course`, and `course` entities from the ERD.

```plantuml
@startuml
skinparam shadowing false
skinparam dpi 160
skinparam ActivityBackgroundColor #F7FBFF
skinparam ActivityBorderColor #1F2D3D
skinparam ActivityFontColor #0B1220
skinparam ArrowColor #1F2D3D
skinparam ActivityDiamondBackgroundColor #F7FBFF
skinparam ActivityDiamondBorderColor #1F2D3D

title Activity Diagram – Plan Review & Enrollment

|Student|
start
:View generated semester plan;

repeat

  if (Satisfied with the plan?) then (yes)
  else (no)

    switch (Action?)
    case (Swap)
      :Tap "Swap" on a course;

      |System|
      :Find alternative courses in
      the same requirement category
      with matching credits;

      :Filter out courses already
      in the plan;

      |Student|
      :Select an alternative course;

      |System|
      :Replace the course in the plan;

    case (Remove)
      |Student|
      :Tap "Remove" on a course;

      |System|
      :Remove the course from the plan;

    case (Re-advise)
      |Student|
      :Optionally update notes;
      :Tap "Re-advise";

      |System|
      :Regenerate plan with removed
      courses excluded from suggestions;

    endswitch

    |Student|

  endif

repeat while (Continue modifying?) is (yes)
-> no;

:Tap "Enroll";

|System|
if (Semester already exists?) then (yes)
  :Display "Semester already exists" error;
  stop
else (no)
  :Validate all course IDs;

  :Create new semester record;

  :Create semester_course records
  for each course (status: "planned");

  |Student|
  :View confirmation;
  :Semester appears on
  Home and History screens;
  stop
endif

@enduml
```

---

## 4. Semester Completion & Grade Submission

This diagram covers the end-of-semester workflow, mapping to the **Submit Semester Grades** and **Submit Course Feedback** use cases (linked by an `<<extend>>` relationship in the Use Case Diagram). It contains the richest branching logic in the system: GPA calculation, failure detection, and conditional cancellation of future planned semesters. The flow exercises the `semester`, `semester_course`, `course_feedback`, and `student` (CGPA) entities from the ERD.

```plantuml
@startuml
skinparam shadowing false
skinparam dpi 160
skinparam ActivityBackgroundColor #F7FBFF
skinparam ActivityBorderColor #1F2D3D
skinparam ActivityFontColor #0B1220
skinparam ArrowColor #1F2D3D
skinparam ActivityDiamondBackgroundColor #F7FBFF
skinparam ActivityDiamondBorderColor #1F2D3D

title Activity Diagram – Semester Completion & Grade Submission

|Student|
start

:Select current (enrolled) semester;

:Tap "Complete Semester";

:Enter a grade for each course;

:Submit grades;

|System|
:Validate that grades are provided
for all courses in the semester;

:Record grades and mark all
courses as "completed";

:Calculate semester GPA using
grade points and credit hours;

:Recalculate cumulative GPA (CGPA)
from all completed semesters;

:Update student CGPA;

if (Any courses graded "F"?) then (yes)

  :Identify courses that require
  the failed course(s) as prerequisites;

  if (Failed courses block\nplanned semester courses?) then (yes)
    :Cancel all planned semesters;
    :Warn student: "Planned semesters
    cancelled due to prerequisite conflicts.
    Please re-plan using the Advisor.";
  else (no)
    :Warn student: "Failed courses
    will be prioritized in your
    next semester plan.";
  endif

else (no)
endif

:Display semester GPA
and updated CGPA;

|Student|
:View results;

if (Submit course feedback?) then (yes)
  :Rate each course's difficulty
  on a scale of 1-5;

  :Submit feedback;

  |System|
  :Save difficulty ratings
  to course_feedback;

  |Student|
else (no)
endif

stop

@enduml
```

---

## Diagrams Not Included

The following use cases were intentionally excluded from the activity diagrams as they involve straightforward read or update operations without meaningful decision logic. Their behavior is fully described by the textual use case descriptions:

- **Sign In** — Simple credential validation and JWT token generation.
- **View All Semesters** — A read-only query that groups semesters by status.
- **View Academic Dashboard** — A read-only aggregation of CGPA, progress, and active semester.
- **Update Semester Status** — A single status transition (planned to enrolled) with prerequisite validation.
- **Change Major** — A single-field update on the student profile.
