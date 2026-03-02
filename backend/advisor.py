import json
import os
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
    EnrollRequest,
    EnrollResponse,
    GenerateRequest,
    GenerateResponse,
    SuggestedCourse,
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


def _gcd_of_list(values: list[int]) -> int:
    if not values:
        return 0
    return reduce(gcd, values)


def compute_credit_cap(cgpa, semester: str) -> int:
    if semester == "Summer":
        return 9
    if cgpa is None:
        return 15
    return 19 if cgpa >= Decimal("3.0") else 15


def build_student_context(student: models.Student) -> dict:
    completed_ids: set[str] = set()
    completed_codes: set[str] = set()

    for sem in student.semesters:
        for sc in sem.semester_courses:
            if sc.status in ("completed", "enrolled", "planned"):
                completed_ids.add(sc.course_id)
                completed_codes.add(sc.course.code)

    requirement_progress = []
    for req in student.major.requirements:
        credits_completed = 0
        completed_in_req: list[str] = []
        for rc in req.requirement_courses:
            if rc.course_id in completed_ids:
                credits_completed += rc.course.credits
                completed_in_req.append(rc.course.code)

        credits_remaining = max(0, req.credits_required - credits_completed)
        is_satisfied = credits_remaining == 0
        requirement_progress.append(
            {
                "name": req.name,
                "credits_required": req.credits_required,
                "credits_completed": credits_completed,
                "credits_remaining": credits_remaining,
                "is_satisfied": is_satisfied,
                "completed_codes": completed_in_req,
            }
        )

    return {
        "cgpa": float(student.cgpa) if student.cgpa is not None else None,
        "completed_course_ids": completed_ids,
        "completed_course_codes": completed_codes,
        "requirement_progress": requirement_progress,
    }


def build_available_courses(student: models.Student, ctx: dict) -> list[dict]:
    completed_ids = ctx["completed_course_ids"]
    completed_codes = ctx["completed_course_codes"]
    satisfied_reqs = {
        r["name"] for r in ctx["requirement_progress"] if r["is_satisfied"]
    }

    # 3a — Collect all major course IDs for unlock-scope calculation
    all_major_course_ids: set[str] = set()
    for req in student.major.requirements:
        for rc in req.requirement_courses:
            all_major_course_ids.add(rc.course_id)
    remaining_major_ids = all_major_course_ids - completed_ids

    # 3b — Pre-build per-requirement available credit lists (for credit-fit check)
    req_to_credits: dict[str, list[int]] = {}
    for req in student.major.requirements:
        if req.name in satisfied_reqs:
            continue
        credits_list = []
        for rc in req.requirement_courses:
            c = rc.course
            if c.id in completed_ids or c.credits == 0:
                continue
            prereq_codes = [p.prerequisite_course.code for p in c.prerequisites]
            if not all(code in completed_codes for code in prereq_codes):
                continue
            credits_list.append(c.credits)
        req_to_credits[req.name] = credits_list

    available: list[dict] = []
    seen_ids: set[str] = set()

    for req in student.major.requirements:
        if req.name in satisfied_reqs:
            continue
        for rc in req.requirement_courses:
            course = rc.course
            if course.id in completed_ids:
                continue
            if course.id in seen_ids:
                continue
            if course.credits == 0:
                continue
            # Check all prerequisites are completed
            prereq_codes = [p.prerequisite_course.code for p in course.prerequisites]
            if not all(code in completed_codes for code in prereq_codes):
                continue

            seen_ids.add(course.id)

            # 3c — Unlock count: how many not-yet-completed major courses does this unlock?
            unlock_count = sum(
                1
                for p in course.is_prerequisite_for
                if p.course_id in remaining_major_ids
            )

            # 3c — Credit fit: will taking this course leave an exact-fillable gap?
            req_info = next(
                (r for r in ctx["requirement_progress"] if r["name"] == req.name), None
            )
            credits_remaining = req_info["credits_remaining"] if req_info else 0
            after_taking = credits_remaining - course.credits

            if after_taking < 0:
                credit_fit = "AVOID"
            elif after_taking == 0:
                credit_fit = "GOOD"
            else:
                other_credits = list(req_to_credits.get(req.name, []))
                try:
                    other_credits.remove(course.credits)  # remove one instance only
                except ValueError:
                    pass
                g = _gcd_of_list(other_credits)
                credit_fit = "AVOID" if g == 0 or after_taking % g != 0 else "GOOD"

            available.append(
                {
                    "course_id": course.id,
                    "code": course.code,
                    "name": course.name,
                    "credits": course.credits,
                    "requirement_category": req.name,
                    "prerequisites": prereq_codes,
                    "unlock_count": unlock_count,
                    "credit_fit": credit_fit,
                }
            )

    # 3d — Sort: Major Requirements first, then Major Electives, then others;
    #           within each tier prefer higher unlock counts.
    CATEGORY_PRIORITY = {"Major Requirements": 0, "Major Electives": 1}
    available.sort(
        key=lambda c: (
            CATEGORY_PRIORITY.get(c["requirement_category"], 2),
            -c["unlock_count"],
        )
    )
    return available


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
    ctx: dict,
    available: list[dict],
    semester: str,
    max_credits: int,
    description: str | None,
) -> str:
    cgpa_str = f"{ctx['cgpa']:.2f}" if ctx["cgpa"] is not None else "N/A"
    total_credits_completed = sum(
        r["credits_completed"] for r in ctx["requirement_progress"]
    )

    # Requirement progress block
    req_lines = []
    for r in ctx["requirement_progress"]:
        if r["is_satisfied"]:
            req_lines.append(f"  - {r['name']}: SATISFIED")
        else:
            codes = ", ".join(r["completed_codes"]) if r["completed_codes"] else "none"
            req_lines.append(
                f"  - {r['name']}: {r['credits_remaining']} credits remaining "
                f"(completed: {codes})"
            )
    req_block = "\n".join(req_lines)

    # Available courses grouped by category
    by_cat: dict[str, list[dict]] = {}
    for c in available:
        by_cat.setdefault(c["requirement_category"], []).append(c)

    course_lines = []
    for cat, courses in by_cat.items():
        course_lines.append(f"  [{cat}]")
        for c in courses:
            fit_tag = " [AVOID]" if c["credit_fit"] == "AVOID" else ""
            unlock_tag = (
                f" (unlocks {c['unlock_count']})" if c["unlock_count"] > 0 else ""
            )
            course_lines.append(
                f"    {c['code']} | {c['name']} | {c['credits']} cr"
                f" | id:{c['course_id']}{unlock_tag}{fit_tag}"
            )
    course_block = "\n".join(course_lines)

    desc_line = f"\nStudent notes: {description}" if description else ""

    summer_rule = (
        "\n- SUMMER RULE: Do NOT suggest Major Requirements or Elective courses unless "
        "the student's notes explicitly request them. Prefer University/General requirements."
        if semester == "Summer"
        else ""
    )

    return f"""You are an academic advisor AI. Build the best semester plan for this student.

Student info:
  CGPA: {cgpa_str}
  Planning semester: {semester}
  Total credits completed: {total_credits_completed}
  Max credits allowed: {max_credits}{desc_line}

Requirement progress:
{req_block}

Available courses (only these may be suggested):
{course_block}

Rules:
- Total credits of suggested courses MUST NOT exceed {max_credits}.
- Do NOT suggest any course whose name contains the word "project" (case-insensitive) and has 6 credits, unless the student's total credits completed is at least 90. Identify such courses yourself from the list above.
- Use exact course_id values from the list above.
- Courses are listed in priority order: Major Requirements first, then Major Electives, then others. Prefer courses from higher-priority categories.
- Prefer courses with higher unlock counts — they unblock more of the student's future curriculum.
- Do NOT suggest courses marked [AVOID] unless it is the student's only option in that requirement category — these cause a credit gap that can never be filled exactly.
- Prefer higher-credit courses over lower-credit courses when both satisfy the same requirement.
- Spread courses across different requirement categories when possible (diversity).{summer_rule}
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

    ctx = build_student_context(student)
    available = build_available_courses(student, ctx)

    if not available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No available courses to suggest. You may have completed all requirements.",
        )

    available_ids = {c["course_id"] for c in available}
    system_prompt = build_system_prompt(
        ctx, available, body.semester, max_credits, body.description
    )

    response = _get_openai().chat.completions.create(
        model="gpt-4o",
        temperature=0.3,
        messages=[{"role": "system", "content": system_prompt}],
        tools=[SUGGEST_PLAN_TOOL],
        tool_choice={"type": "function", "function": {"name": "suggest_semester_plan"}},
    )

    args = json.loads(response.choices[0].message.tool_calls[0].function.arguments)
    raw_courses: list[dict] = args.get("courses", [])

    # Safety loop: filter invalid IDs, enforce credit cap
    suggested: list[SuggestedCourse] = []
    total = 0
    for c in raw_courses:
        if c["course_id"] not in available_ids:
            continue
        if total + c["credits"] > max_credits:
            break
        suggested.append(SuggestedCourse(**c))
        total += c["credits"]

    semester_label = f"{body.semester} {2026}"

    return GenerateResponse(
        suggested_courses=suggested,
        total_credits=total,
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
    existing = (
        db.query(models.Semester)
        .filter(
            models.Semester.student_id == student.id,
            models.Semester.semester_label == body.semester_label,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Semester '{body.semester_label}' already exists for this student.",
        )

    # Validate all course IDs
    course_ids = [ec.course_id for ec in body.courses]
    for cid in course_ids:
        if not db.query(models.Course).filter(models.Course.id == cid).first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Course {cid} not found.",
            )

    # Create semester + semester courses atomically
    semester = models.Semester(
        student_id=student.id,
        semester_label=body.semester_label,
    )
    db.add(semester)
    db.flush()  # get semester.id before commit

    for cid in course_ids:
        db.add(
            models.SemesterCourse(
                semester_id=semester.id,
                course_id=cid,
                status="planned",
            )
        )

    db.commit()

    return EnrollResponse(
        semester_id=semester.id,
        semester_label=semester.semester_label,
        enrolled_count=len(course_ids),
    )
