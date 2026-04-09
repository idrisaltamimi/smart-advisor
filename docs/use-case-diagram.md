# Smart Course Advisor – Use Case Diagram

## PlantUML Diagram

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

rectangle "Smart Course Advisor System" {
  ' === Authentication ===
  (Register)
  (Sign In)
  (Select Major)
  (Register) ...> (Select Major) : <<include>>

  ' === Semester Planning ===
  (Generate Semester Plan) as GenPlan
  (Modify Course Selection) as ModifyCourse
  (Enroll in Suggested Plan) as Enroll
  GenPlan <... ModifyCourse : <<extend>>
  GenPlan <... Enroll : <<extend>>

  ' === Semester Management ===
  (View All Semesters)
  (Update Semester Status) as ManageSem
  (Submit Semester Grades) as Complete
  (Submit Course Feedback)
  (View All Semesters) <... ManageSem : <<extend>>
  Complete <... (Submit Course Feedback) : <<extend>>

  ' === Progress & Profile ===
  (View Academic Dashboard)
  (Change Major)
}

' === Student Associations ===
Student --> (Register)
Student --> (Sign In)
Student --> (GenPlan)
Student --> (View All Semesters)
Student --> (Complete)
Student --> (View Academic Dashboard)
Student --> (Change Major)

@enduml
```

---

## Use Cases Summary

| Use Case | Description |
|----------|-------------|
| **Register** | Create account (includes Select Major) |
| **Sign In** | Log in with credentials |
| **Select Major** | Choose academic major during onboarding |
| **Generate Semester Plan** | AI creates personalized course plan based on prerequisites, credits, and CGPA |
| **Modify Course Selection** | Swap or remove courses from generated plan |
| **Enroll in Suggested Plan** | Save plan to academic record |
| **View All Semesters** | See all past, current, and planned semesters |
| **Update Semester Status** | Activate or cancel a planned semester |
| **Submit Semester Grades** | Submit grades for current semester and calculate GPA |
| **Submit Course Feedback** | Rate course difficulty after completion |
| **View Academic Dashboard** | See CGPA, progress, and current semester |
| **Change Major** | Update academic major |

## Actors

| Actor | Description |
|-------|-------------|
| **Student** | Primary user who plans courses, tracks progress, and manages semesters |

## Relationships

| Relationship | Type | Description |
|--------------|------|-------------|
| Register → Select Major | include | Registration always requires major selection |
| Modify Course Selection → Generate Semester Plan | extend | Optionally modify after generating plan |
| Enroll in Suggested Plan → Generate Semester Plan | extend | Optionally enroll after generating plan |
| Update Semester Status → View All Semesters | extend | Optionally activate/cancel from semester view |
| Submit Course Feedback → Submit Semester Grades | extend | Optionally rate difficulty after submitting grades |
