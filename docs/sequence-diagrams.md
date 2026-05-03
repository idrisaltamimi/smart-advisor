# Smart Course Advisor – Sequence Diagrams

The following sequence diagrams show how the system's components communicate during the two most complex workflows. They complement the activity diagrams by revealing which component is responsible for each step and how data flows between the frontend, backend, AI service, and database.

| Diagram | Why it needs a sequence diagram |
|---------|-------------------------------|
| Semester Plan Generation | The only flow involving five participants — the AI service interaction and server-side validation are not visible in other diagrams |
| Semester Completion | Multiple cascading database operations and conditional side effects that the activity diagram shows as flat steps |

---

## 1. Semester Plan Generation

This diagram traces how a course plan moves from student input to AI recommendation to validated output. The server enriches the request with academic context before consulting the AI, then validates and filters the AI's response before returning it to the student.

```plantuml
@startuml
skinparam shadowing false
skinparam dpi 160
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam ParticipantBackgroundColor #F7FBFF
skinparam ParticipantBorderColor #1F2D3D
skinparam ParticipantFontColor #0B1220
skinparam ArrowColor #1F2D3D
skinparam SequenceLifeLineBorderColor #1F2D3D
skinparam SequenceGroupBackgroundColor #F0F4FA
skinparam SequenceGroupBorderColor #1F2D3D

actor Student
participant App
participant Server
database Database
participant "AI Service" as AI

Student -> App : Set preferences and\ntap "Generate Advice"
App -> Server : Send generation request

Server -> Database : Load student progress
Database --> Server : Completed courses and requirements

Server -> Server : Compute credit cap\nand filter eligible courses

alt No eligible courses
  Server --> App : Return error
  App --> Student : Show error message
else Eligible courses found
  Server -> AI : Send student context\nand available courses
  AI --> Server : Return suggested courses

  Server -> Server : Validate and filter\nAI suggestions

  Server --> App : Return validated plan
  App --> Student : Display recommended courses
end

@enduml
```

---

## 2. Semester Completion

This diagram shows the chain of operations triggered when a student submits grades. The server saves grades, recalculates GPAs, and then checks whether any failed courses create downstream conflicts with future planned semesters.

```plantuml
@startuml
skinparam shadowing false
skinparam dpi 160
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam ParticipantBackgroundColor #F7FBFF
skinparam ParticipantBorderColor #1F2D3D
skinparam ParticipantFontColor #0B1220
skinparam ArrowColor #1F2D3D
skinparam SequenceLifeLineBorderColor #1F2D3D
skinparam SequenceGroupBackgroundColor #F0F4FA
skinparam SequenceGroupBorderColor #1F2D3D

actor Student
participant App
participant Server
database Database

Student -> App : Submit grades
App -> Server : Send grades

Server -> Database : Save grades for each course
Server -> Database : Calculate and store semester GPA
Server -> Database : Recalculate and store cumulative GPA

alt Any courses failed
  Server -> Database : Check if failures\nblock planned courses

  alt Failures block planned courses
    Server -> Database : Cancel affected\nplanned semesters
    Server --> App : Notify to re-plan
  else No planned courses blocked
    Server --> App : Notify to retake\nfailed courses
  end
else No failures
  Server --> App : Return results
end

App --> Student : Display grades and GPA

@enduml
```

---

## Diagrams Not Included

The remaining workflows (Entry & Setup, Plan Review & Enrollment) follow simple request-response patterns between the App and Server with no multi-component orchestration. Their interactions are fully captured by the activity diagrams and use case descriptions.
