import json
import os
import re
from decimal import Decimal
from functools import reduce
from math import gcd

from fastapi import APIRouter, Depends, HTTPException, status
from openai import OpenAI
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_user
from backend.database import get_db
from backend.schema import (
    AlternativeCourse,
    AlternativesRequest,
    AlternativesResponse,
    EnrollRequest,
    EnrollResponse,
    GenerateRequest,
    GenerateResponse,
    SemesterCourseDetail,
    SemesterDetail,
    SemestersResponse,
    SuggestedCourse,
    UpdateSemesterStatusRequest,
    UpdateSemesterStatusResponse,
)

router = APIRouter(prefix="/advisor", tags=["advisor"])


def _get_openai() -> OpenAI:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured.",
        )
    return OpenAI(api_key=key)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _compute_semester_status(semester_courses: list) -> str:
    """Derive semester status from its courses. 'enrolled' wins for mixed states."""
    if not semester_courses:
        return "planned"
    all_course_statuses = {semester_course.status for semester_course in semester_courses}
    if "enrolled" in all_course_statuses:
        return "current"
    if all_course_statuses == {"completed"}:
        return "completed"
    return "planned"


def _gcd_of_list(values: list[int]) -> int:
    if not values:
        return 0
    return reduce(gcd, values)


def _course_level(code: str) -> int:
    """Return the numeric level of a course code (e.g. 'CS301' → 3, 'MATH101' → 1)."""
    match = re.search(r"\d", code)
    return int(match.group()) if match else 0


def compute_credit_cap(cgpa, semester: str) -> int:
    if semester == "Summer":
        return 9
    if cgpa is None:
        return 15
    return 19 if cgpa >= Decimal("3.0") else 15


def build_student_context(student: models.Student) -> dict:
    completed_course_ids: set[str] = set()
    completed_course_codes: set[str] = set()

    for semester in student.semesters:
        for semester_course in semester.semester_courses:
            if semester_course.status in ("completed", "enrolled", "planned"):
                completed_course_ids.add(semester_course.course_id)
                completed_course_codes.add(semester_course.course.code)

    requirement_progress = []
    for requirement in student.major.requirements:
        credits_completed = 0
        completed_codes_in_requirement: list[str] = []
        for requirement_course in requirement.requirement_courses:
            if requirement_course.course_id in completed_course_ids:
                credits_completed += requirement_course.course.credits
                completed_codes_in_requirement.append(requirement_course.course.code)

        credits_remaining = max(0, requirement.credits_required - credits_completed)
        is_satisfied = credits_remaining == 0
        requirement_progress.append(
            {
                "name": requirement.name,
                "credits_required": requirement.credits_required,
                "credits_completed": credits_completed,
                "credits_remaining": credits_remaining,
                "is_satisfied": is_satisfied,
                "completed_codes": completed_codes_in_requirement,
            }
        )

    return {
        "cgpa": float(student.cgpa) if student.cgpa is not None else None,
        "completed_course_ids": completed_course_ids,
        "completed_course_codes": completed_course_codes,
        "requirement_progress": requirement_progress,
    }


def build_available_courses(student: models.Student, student_context: dict) -> list[dict]:
    completed_course_ids = student_context["completed_course_ids"]
    completed_course_codes = student_context["completed_course_codes"]
    satisfied_requirement_names = {
        req["name"] for req in student_context["requirement_progress"] if req["is_satisfied"]
    }

    # 3a — Collect all major course IDs for unlock-scope calculation
    all_major_course_ids: set[str] = set()
    for requirement in student.major.requirements:
        for requirement_course in requirement.requirement_courses:
            all_major_course_ids.add(requirement_course.course_id)
    remaining_major_course_ids = all_major_course_ids - completed_course_ids

    # 3b — Pre-build per-requirement available credit lists (for credit-fit check)
    requirement_available_credits: dict[str, list[int]] = {}
    for requirement in student.major.requirements:
        if requirement.name in satisfied_requirement_names:
            continue
        eligible_credits = []
        for requirement_course in requirement.requirement_courses:
            candidate_course = requirement_course.course
            if candidate_course.id in completed_course_ids or candidate_course.credits == 0:
                continue
            prereq_codes = [p.prerequisite_course.code for p in candidate_course.prerequisites]
            if not all(code in completed_course_codes for code in prereq_codes):
                continue
            eligible_credits.append(candidate_course.credits)
        requirement_available_credits[requirement.name] = eligible_credits

    available_courses: list[dict] = []
    already_added_course_ids: set[str] = set()

    for requirement in student.major.requirements:
        if requirement.name in satisfied_requirement_names:
            continue
        for requirement_course in requirement.requirement_courses:
            course = requirement_course.course
            if course.id in completed_course_ids:
                continue
            if course.id in already_added_course_ids:
                continue
            if course.credits == 0:
                continue
            # Check all prerequisites are completed
            prereq_codes = [p.prerequisite_course.code for p in course.prerequisites]
            if not all(code in completed_course_codes for code in prereq_codes):
                continue

            already_added_course_ids.add(course.id)

            # 3c — Unlock count: how many not-yet-completed major courses does this unlock?
            unlock_count = sum(
                1
                for prereq_link in course.is_prerequisite_for
                if prereq_link.course_id in remaining_major_course_ids
            )

            # 3c — Credit fit: will taking this course leave an exact-fillable gap?
            requirement_progress_entry = next(
                (r for r in student_context["requirement_progress"] if r["name"] == requirement.name),
                None,
            )
            credits_remaining_in_requirement = requirement_progress_entry["credits_remaining"] if requirement_progress_entry else 0
            credits_remaining_after_taking = credits_remaining_in_requirement - course.credits

            if credits_remaining_after_taking < 0:
                credit_fit = "AVOID"
            elif credits_remaining_after_taking == 0:
                credit_fit = "GOOD"
            else:
                other_eligible_credits = list(requirement_available_credits.get(requirement.name, []))
                try:
                    other_eligible_credits.remove(course.credits)  # remove one instance only
                except ValueError:
                    pass
                remaining_credits_gcd = _gcd_of_list(other_eligible_credits)
                credit_fit = (
                    "AVOID"
                    if remaining_credits_gcd == 0 or credits_remaining_after_taking % remaining_credits_gcd != 0
                    else "GOOD"
                )

            available_courses.append(
                {
                    "course_id": course.id,
                    "code": course.code,
                    "name": course.name,
                    "credits": course.credits,
                    "requirement_category": requirement.name,
                    "prerequisites": prereq_codes,
                    "unlock_count": unlock_count,
                    "credit_fit": credit_fit,
                }
            )

    # 3d — Sort: path-openers (unlock_count > 0) always beat zero-unlock courses;
    #           within each unlock tier: Major Requirements first, then Major Electives,
    #           then others; then prefer higher unlock counts within the same category.
    CATEGORY_PRIORITY = {"Major Requirements": 0, "Major Electives": 1}
    available_courses.sort(
        key=lambda course_entry: (
            0 if course_entry["unlock_count"] > 0 else 1,  # path-openers first
            CATEGORY_PRIORITY.get(course_entry["requirement_category"], 2),
            -course_entry["unlock_count"],
        )
    )
    return available_courses


# ── GPT-4o tool schema ────────────────────────────────────────────────────────

SUGGEST_PLAN_TOOL = {
    "type": "function",
    "function": {
        "name": "suggest_semester_plan",
        "description": "Return the suggested semester course plan.",
        "parameters": {
            "type": "object",
            "properties": {
                "courses": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "course_id": {"type": "string"},
                            "course_code": {"type": "string"},
                            "course_name": {"type": "string"},
                            "credits": {"type": "integer"},
                            "requirement_category": {"type": "string"},
                            "reason": {"type": "string"},
                        },
                        "required": [
                            "course_id",
                            "course_code",
                            "course_name",
                            "credits",
                            "requirement_category",
                            "reason",
                        ],
                    },
                }
            },
            "required": ["courses"],
        },
    },
}


def build_system_prompt(
    student_context: dict,
    available_courses: list[dict],
    semester: str,
    max_credits: int,
    description: str | None,
    is_early_semester: bool = False,
) -> str:
    cgpa_str = f"{student_context['cgpa']:.2f}" if student_context["cgpa"] is not None else "N/A"
    total_credits_completed = sum(
        req["credits_completed"] for req in student_context["requirement_progress"]
    )

    # Requirement progress block
    requirement_progress_lines = []
    for req_progress in student_context["requirement_progress"]:
        if req_progress["is_satisfied"]:
            requirement_progress_lines.append(f"  - {req_progress['name']}: SATISFIED")
        else:
            completed_codes_str = (
                ", ".join(req_progress["completed_codes"]) if req_progress["completed_codes"] else "none"
            )
            requirement_progress_lines.append(
                f"  - {req_progress['name']}: {req_progress['credits_remaining']} credits remaining "
                f"(completed: {completed_codes_str})"
            )
    requirement_progress_block = "\n".join(requirement_progress_lines)

    # Available courses grouped by category
    courses_by_category: dict[str, list[dict]] = {}
    for course_entry in available_courses:
        courses_by_category.setdefault(course_entry["requirement_category"], []).append(course_entry)

    available_course_lines = []
    for category, category_courses in courses_by_category.items():
        available_course_lines.append(f"  [{category}]")
        for course_entry in category_courses:
            credit_fit_tag = " [AVOID]" if course_entry["credit_fit"] == "AVOID" else ""
            unlock_count_tag = (
                f" (unlocks {course_entry['unlock_count']})" if course_entry["unlock_count"] > 0 else ""
            )
            available_course_lines.append(
                f"    {course_entry['code']} | {course_entry['name']} | {course_entry['credits']} cr"
                f" | id:{course_entry['course_id']}{unlock_count_tag}{credit_fit_tag}"
            )
    available_courses_block = "\n".join(available_course_lines)

    student_notes_line = f"\nStudent notes: {description}" if description else ""

    summer_rule = (
        "\n- SUMMER RULE: Do NOT suggest Major Requirements or Elective courses unless "
        "the student's notes explicitly request them. Prefer University/General requirements."
        if semester == "Summer"
        else ""
    )

    early_semester_rule = (
        "\n- EARLY SEMESTER RULE: This student is in their first 2 semesters. "
        "Do NOT suggest any 300-level or 400-level course (course codes whose first digit is 3 or 4). "
        "Only 100-level and 200-level courses are allowed."
        if is_early_semester
        else ""
    )

    return f"""You are an academic advisor AI. Build the best semester plan for this student.

Student info:
  CGPA: {cgpa_str}
  Planning semester: {semester}
  Total credits completed: {total_credits_completed}
  Max credits allowed: {max_credits}{student_notes_line}

Requirement progress:
{requirement_progress_block}

Available courses (only these may be suggested):
{available_courses_block}

Rules:
- Total credits of suggested courses MUST NOT exceed {max_credits}.
- Do NOT suggest any course whose name contains the word "project" (case-insensitive) and has 6 credits, unless the student's total credits completed is at least 90. Identify such courses yourself from the list above.
- Use exact course_id values from the list above.
- UNLOCK PRIORITY (highest importance): Courses with unlock_count > 0 open the path to major courses — the primary goal. ALWAYS prefer them over courses with unlock_count = 0, even if the unlocking course belongs to a lower-priority category.
- Courses are listed in priority order: path-openers first, then Major Requirements, then Major Electives, then others.
- Do NOT suggest courses marked [AVOID] unless it is the student's only option in that requirement category — these cause a credit gap that can never be filled exactly.
- Prefer higher-credit courses over lower-credit courses when both satisfy the same requirement.
- Spread courses across different requirement categories when possible (diversity).{summer_rule}{early_semester_rule}
- Call suggest_semester_plan exactly once with your chosen courses. No plain-text response.
"""


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/generate", response_model=GenerateResponse)
def generate_plan(
    body: GenerateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = current_user.student
    if not student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No student profile found"
        )

    # Server-side credit cap
    server_cap = compute_credit_cap(student.cgpa, body.semester)
    warning: str | None = None
    max_credits = body.max_credits
    if max_credits > server_cap:
        warning = (
            f"Credit limit adjusted from {max_credits} to {server_cap} "
            f"based on your CGPA and semester rules."
        )
        max_credits = server_cap

    student_context = build_student_context(student)
    available_courses = build_available_courses(student, student_context)

    if not available_courses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No available courses to suggest. You may have completed all requirements.",
        )

    # True when the student hasn't completed 2 semesters yet
    is_early_semester = len(student.semesters) < 2

    available_course_ids = {course["course_id"] for course in available_courses}
    system_prompt = build_system_prompt(
        student_context, available_courses, body.semester, max_credits, body.description, is_early_semester
    )

    response = _get_openai().chat.completions.create(
        model="gpt-4o",
        temperature=0.3,
        messages=[{"role": "system", "content": system_prompt}],
        tools=[SUGGEST_PLAN_TOOL],
        tool_choice={"type": "function", "function": {"name": "suggest_semester_plan"}},
    )

    tool_call_arguments = json.loads(response.choices[0].message.tool_calls[0].function.arguments)
    ai_suggested_courses: list[dict] = tool_call_arguments.get("courses", [])

    # Safety loop: filter invalid IDs, enforce credit cap, enforce level restriction
    suggested: list[SuggestedCourse] = []
    total_credits = 0
    for ai_course in ai_suggested_courses:
        if ai_course["course_id"] not in available_course_ids:
            continue
        if is_early_semester and _course_level(ai_course.get("course_code", "")) >= 3:
            continue
        if total_credits + ai_course["credits"] > max_credits:
            break
        suggested.append(SuggestedCourse(**ai_course))
        total_credits += ai_course["credits"]

    semester_label = f"{body.semester} {2026}"

    return GenerateResponse(
        suggested_courses=suggested,
        total_credits=total_credits,
        semester_label=semester_label,
        warning=warning,
    )


@router.post("/enroll", response_model=EnrollResponse)
def enroll_plan(
    body: EnrollRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = current_user.student
    if not student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No student profile found"
        )

    # Check for duplicate semester
    existing_semester = (
        db.query(models.Semester)
        .filter(
            models.Semester.student_id == student.id,
            models.Semester.semester_label == body.semester_label,
        )
        .first()
    )
    if existing_semester:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Semester '{body.semester_label}' already exists for this student.",
        )

    # Validate all course IDs
    course_ids_to_enroll = [enrolled_course.course_id for enrolled_course in body.courses]
    for course_id in course_ids_to_enroll:
        if not db.query(models.Course).filter(models.Course.id == course_id).first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Course {course_id} not found.",
            )

    # Create semester + semester courses atomically
    new_semester = models.Semester(
        student_id=student.id,
        semester_label=body.semester_label,
    )
    db.add(new_semester)
    db.flush()  # get new_semester.id before commit

    for course_id in course_ids_to_enroll:
        db.add(
            models.SemesterCourse(
                semester_id=new_semester.id,
                course_id=course_id,
                status="planned",
            )
        )

    db.commit()

    return EnrollResponse(
        semester_id=new_semester.id,
        semester_label=new_semester.semester_label,
        enrolled_count=len(course_ids_to_enroll),
    )


@router.post("/alternatives", response_model=AlternativesResponse)
def get_alternatives(
    body: AlternativesRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = current_user.student
    if not student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No student profile found"
        )

    # Look up the category of the course being swapped
    target_course = db.query(models.Course).filter(models.Course.id == body.course_id).first()
    if not target_course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    # Find its requirement_category via RequirementCourse
    requirement_course = (
        db.query(models.RequirementCourse)
        .filter(models.RequirementCourse.course_id == body.course_id)
        .join(models.Requirement)
        .filter(models.Requirement.major_id == student.major_id)
        .first()
    )
    if not requirement_course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not in student's major"
        )

    target_category = requirement_course.requirement.name

    student_context = build_student_context(student)
    available_courses = build_available_courses(student, student_context)

    excluded_course_ids = set(body.exclude_course_ids)
    alternatives = [
        AlternativeCourse(
            course_id=available_course["course_id"],
            course_code=available_course["code"],
            course_name=available_course["name"],
            credits=available_course["credits"],
            requirement_category=available_course["requirement_category"],
        )
        for available_course in available_courses
        if available_course["requirement_category"] == target_category
        and available_course["credits"] == target_course.credits
        and available_course["credit_fit"] != "AVOID"
        and available_course["course_id"] not in excluded_course_ids
    ]

    return AlternativesResponse(alternatives=alternatives)


@router.get("/semesters", response_model=SemestersResponse)
def get_semesters(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = current_user.student
    if not student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No student profile found"
        )

    student_semesters = (
        db.query(models.Semester)
        .filter(models.Semester.student_id == student.id)
        .all()
    )

    semester_details = []
    for semester in student_semesters:
        computed_status = _compute_semester_status(semester.semester_courses)
        course_details = [
            SemesterCourseDetail(
                course_id=semester_course.course_id,
                course_code=semester_course.course.code,
                course_name=semester_course.course.name,
                credits=semester_course.course.credits,
                status=semester_course.status,
                grade=semester_course.grade,
            )
            for semester_course in semester.semester_courses
        ]
        total_credits = sum(course_detail.credits for course_detail in course_details)
        semester_details.append(
            SemesterDetail(
                id=semester.id,
                semester_label=semester.semester_label,
                semester_gpa=semester.semester_gpa,
                status=computed_status,
                total_credits=total_credits,
                courses=course_details,
            )
        )

    return SemestersResponse(semesters=semester_details)


@router.patch("/semesters/{semester_id}/status", response_model=UpdateSemesterStatusResponse)
def update_semester_status(
    semester_id: str,
    body: UpdateSemesterStatusRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = current_user.student
    if not student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No student profile found"
        )

    semester = (
        db.query(models.Semester)
        .filter(
            models.Semester.id == semester_id,
            models.Semester.student_id == student.id,
        )
        .first()
    )
    if not semester:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found"
        )

    current_status = _compute_semester_status(semester.semester_courses)

    # Validate transition
    if body.status == "enrolled" and current_status != "planned":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot transition semester from '{current_status}' to 'enrolled'.",
        )
    if body.status == "completed" and current_status != "current":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot transition semester from '{current_status}' to 'completed'.",
        )

    # Apply transition atomically
    for semester_course in semester.semester_courses:
        semester_course.status = body.status
    db.commit()

    new_status = "current" if body.status == "enrolled" else "completed"

    return UpdateSemesterStatusResponse(
        semester_id=semester_id,
        new_status=new_status,
        updated_count=len(semester.semester_courses),
    )
