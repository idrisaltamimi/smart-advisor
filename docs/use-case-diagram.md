# Smart Course Advisor – Use Case Diagram

## Analysis of Current vs Improved Diagram

### Missing Use Cases Identified

Based on the codebase analysis, the following use cases were missing or could be more explicit:

| Missing Use Case | Why It Matters |
|------------------|----------------|
| **Register** | Separate from Sign In within Authenticate |
| **Sign In** | Explicit login action |
| **Select Major (Onboarding)** | Required step after registration, different from Change Major |
| **Generate Semester Plan** | Core AI feature - more specific than "Request Next-Semester Advice" |
| **Swap Course in Plan** | Distinct from requesting alternatives - actually swapping |
| **Remove Course from Plan** | Exclude courses and regenerate |
| **Activate Semester** | Transition planned → enrolled |
| **Mark Semester Complete** | Submit grades, calculate GPA |
| **Enter Course Grades** | Sub-action of completing semester |
| **Cancel Semester** | Delete a planned semester |
| **View Profile** | Separate from dashboard |
| **Sign Out** | End session |

### Include/Extend Relationships

| Relationship | Type | Rationale |
|--------------|------|-----------|
| Authenticate → Register | extends | Optional path for new users |
| Authenticate → Sign In | extends | Default path for returning users |
| Register → Select Major | include | Required step after registration |
| Generate Semester Plan → Validate Prerequisites | include | System always checks prerequisites |
| Generate Semester Plan → Apply Credit Limit | include | System always enforces credit limits |
| Generate Semester Plan → Swap Course | extends | Optional user action |
| Generate Semester Plan → Remove Course | extends | Optional user action |
| Enroll in Plan → Generate Semester Plan | depends | Must generate before enrolling |
| Mark Semester Complete → Enter Course Grades | include | Required to complete |
| Mark Semester Complete → Submit Difficulty Rating | extends | Optional feedback |
| View Semester History → Activate Semester | extends | Optional action from history |
| View Semester History → Cancel Semester | extends | Optional action from history |

---

## Improved Use Case Diagram

```plantuml
@startuml
left to right direction
skinparam linetype ortho
skinparam Shadowing false

skinparam rectangle {
  BackgroundColor #F7F7F7
  BorderColor Black
  RoundCorner 15
}
skinparam usecase {
  BackgroundColor White
  BorderColor Black
}
skinparam actor {
  BorderColor Black
}

title Smart Course Advisor – Use Case Diagram (Improved)

actor Student
actor "AI Advisor" as AI

rectangle "Smart Course Advisor System" {
  ' === Authentication ===
  (Authenticate)
  (Register) .> (Authenticate) : extends
  (Sign In) .> (Authenticate) : extends
  (Select Major) as SelectMajor
  (Register) ..> (SelectMajor) : <<include>>
  (Sign Out)

  ' === Profile & Settings ===
  (View Profile)
  (Change Major)

  ' === Semester Planning ===
  (Generate Semester Plan) as GenPlan
  (Validate Prerequisites) as ValidatePrereq
  (Apply Credit Limit) as ApplyCredit
  GenPlan ..> (ValidatePrereq) : <<include>>
  GenPlan ..> (ApplyCredit) : <<include>>

  (Swap Course in Plan) .> (GenPlan) : extends
  (Remove Course from Plan) .> (GenPlan) : extends
  (Enroll in Suggested Plan) as Enroll

  ' === Semester Management ===
  (View Semester History)
  (Activate Semester) .> (View Semester History) : extends
  (Cancel Semester) .> (View Semester History) : extends
  (Mark Semester Complete) as Complete
  (Enter Course Grades) as EnterGrades
  Complete ..> (EnterGrades) : <<include>>
  (Submit Difficulty Rating) .> (Complete) : extends

  ' === Progress Tracking ===
  (View Academic Dashboard)
  (View Requirement Progress)
}

' === Student Associations ===
Student --> (Authenticate)
Student --> (Sign Out)
Student --> (View Profile)
Student --> (Change Major)
Student --> (GenPlan)
Student --> (Enroll)
Student --> (View Semester History)
Student --> (Complete)
Student --> (View Academic Dashboard)
Student --> (View Requirement Progress)

' === AI Advisor Associations ===
AI --> (GenPlan)
AI --> (ValidatePrereq)
AI --> (ApplyCredit)

@enduml
```

---

## Alternative Simplified Diagram

If include/extend relationships make the diagram too complex, here's a cleaner version with all use cases but fewer relationships:

```plantuml
@startuml
left to right direction
skinparam linetype ortho
skinparam Shadowing false

skinparam rectangle {
  BackgroundColor #F7F7F7
  BorderColor Black
  RoundCorner 15
}
skinparam usecase {
  BackgroundColor White
  BorderColor Black
}
skinparam actor {
  BorderColor Black
}

title Smart Course Advisor – Use Case Diagram

actor Student
actor "AI Advisor" as AI

rectangle "Smart Course Advisor System" {
  ' === Authentication & Onboarding ===
  package "Authentication" {
    (Register)
    (Sign In)
    (Sign Out)
    (Select Major)
  }

  ' === Profile ===
  package "Profile Management" {
    (View Profile)
    (Change Major)
  }

  ' === Semester Planning ===
  package "Semester Planning" {
    (Generate Semester Plan) as GenPlan
    (Swap Course in Plan)
    (Remove Course from Plan)
    (Enroll in Suggested Plan)
  }

  ' === Semester Management ===
  package "Semester Management" {
    (View Semester History)
    (Activate Semester)
    (Cancel Semester)
    (Mark Semester Complete)
    (Enter Course Grades)
    (Submit Difficulty Rating)
  }

  ' === Progress Tracking ===
  package "Progress Tracking" {
    (View Academic Dashboard)
    (View Requirement Progress)
  }
}

' === Student Associations ===
Student --> (Register)
Student --> (Sign In)
Student --> (Sign Out)
Student --> (Select Major)
Student --> (View Profile)
Student --> (Change Major)
Student --> (GenPlan)
Student --> (Swap Course in Plan)
Student --> (Remove Course from Plan)
Student --> (Enroll in Suggested Plan)
Student --> (View Semester History)
Student --> (Activate Semester)
Student --> (Cancel Semester)
Student --> (Mark Semester Complete)
Student --> (Enter Course Grades)
Student --> (Submit Difficulty Rating)
Student --> (View Academic Dashboard)
Student --> (View Requirement Progress)

' === AI Advisor Associations ===
AI --> (GenPlan)

@enduml
```

---

## Use Case Descriptions

### Authentication & Onboarding

| Use Case | Description | Precondition | Postcondition |
|----------|-------------|--------------|---------------|
| Register | Student creates new account with name, email, password | None | Account created, must select major |
| Sign In | Student logs in with credentials | Account exists | Session started |
| Sign Out | Student ends session | Logged in | Session terminated |
| Select Major | Student chooses academic major | Just registered | Major assigned |

### Profile Management

| Use Case | Description | Precondition | Postcondition |
|----------|-------------|--------------|---------------|
| View Profile | View name, email, major, CGPA | Logged in | Profile displayed |
| Change Major | Update academic major | Logged in | Major updated |

### Semester Planning

| Use Case | Description | Precondition | Postcondition |
|----------|-------------|--------------|---------------|
| Generate Semester Plan | AI generates personalized course plan based on prerequisites, credits, CGPA | Logged in, major selected | Plan displayed |
| Swap Course in Plan | Replace suggested course with alternative | Plan generated | Course swapped |
| Remove Course from Plan | Exclude course and regenerate | Plan generated | Plan updated |
| Enroll in Suggested Plan | Save plan to academic record | Plan generated | Semester created (planned status) |

### Semester Management

| Use Case | Description | Precondition | Postcondition |
|----------|-------------|--------------|---------------|
| View Semester History | See all past, current, planned semesters | Logged in | History displayed |
| Activate Semester | Move planned semester to current | Has planned semester | Semester is now "enrolled" |
| Cancel Semester | Delete planned semester | Has planned semester | Semester deleted |
| Mark Semester Complete | Finish current semester with grades | Has current semester | Semester completed, GPA calculated |
| Enter Course Grades | Input grade for each course | Completing semester | Grades recorded |
| Submit Difficulty Rating | Rate course difficulty (1-5) | Course completed | Rating saved for future AI advice |

### Progress Tracking

| Use Case | Description | Precondition | Postcondition |
|----------|-------------|--------------|---------------|
| View Academic Dashboard | See CGPA, progress %, current semester | Logged in | Dashboard displayed |
| View Requirement Progress | Track completion by requirement category | Logged in | Progress bars shown |

---

## Actors

| Actor | Description |
|-------|-------------|
| **Student** | Primary user who plans courses, tracks progress, and manages semesters |
| **AI Advisor** | System actor (GPT-4o) that generates personalized course recommendations |

---

## Notes

- The AI Advisor is a **system actor** that participates in use cases involving course generation
- Include relationships (`<<include>>`) indicate mandatory sub-behaviors
- Extend relationships indicate optional or conditional behaviors
- The Student must authenticate before accessing any other functionality
