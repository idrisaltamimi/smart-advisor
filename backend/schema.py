from pydantic import BaseModel
from typing import Literal, Optional
from decimal import Decimal


# ── User ──────────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    email: str
    full_name: str

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: str
    major_id: Optional[str] = None

    class Config:
        from_attributes = True


# ── Major ─────────────────────────────────────────────────────────────────────

class MajorBase(BaseModel):
    name: str
    total_credits_required: int

class MajorCreate(MajorBase):
    pass

class MajorOut(MajorBase):
    id: str

    class Config:
        from_attributes = True


# ── Requirement ───────────────────────────────────────────────────────────────

class RequirementBase(BaseModel):
    major_id: str
    name: str
    credits_required: int

class RequirementCreate(RequirementBase):
    pass

class RequirementOut(RequirementBase):
    id: str

    class Config:
        from_attributes = True


# ── Course ────────────────────────────────────────────────────────────────────

class CourseBase(BaseModel):
    code: str
    name: str
    credits: int

class CourseCreate(CourseBase):
    pass

class CourseOut(CourseBase):
    id: str

    class Config:
        from_attributes = True


# ── RequirementCourse ─────────────────────────────────────────────────────────

class RequirementCourseCreate(BaseModel):
    requirement_id: str
    course_id: str

class RequirementCourseOut(RequirementCourseCreate):
    class Config:
        from_attributes = True


# ── Student ───────────────────────────────────────────────────────────────────

class StudentBase(BaseModel):
    user_id: str
    major_id: str
    cgpa: Optional[Decimal] = None

class StudentCreate(StudentBase):
    pass

class StudentOut(StudentBase):
    id: str

    class Config:
        from_attributes = True


# ── Semester ──────────────────────────────────────────────────────────────────

class SemesterBase(BaseModel):
    student_id: str
    semester_label: str
    semester_gpa: Optional[Decimal] = None

class SemesterCreate(SemesterBase):
    pass

class SemesterOut(SemesterBase):
    id: str

    class Config:
        from_attributes = True


# ── SemesterCourse ────────────────────────────────────────────────────────────

class SemesterCourseBase(BaseModel):
    semester_id: str
    course_id: str
    status: str
    grade: Optional[str] = None

class SemesterCourseCreate(SemesterCourseBase):
    pass

class SemesterCourseOut(SemesterCourseBase):
    class Config:
        from_attributes = True


# ── Prerequisite ──────────────────────────────────────────────────────────────

class PrerequisiteCreate(BaseModel):
    course_id: str
    prerequisite_course_id: str

class PrerequisiteOut(PrerequisiteCreate):
    class Config:
        from_attributes = True


# ── Auth ──────────────────────────────────────────────────────────────────────

class SetMajorRequest(BaseModel):
    major_id: str


class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── CourseFeedback ────────────────────────────────────────────────────────────

class CourseFeedbackBase(BaseModel):
    course_id: str
    difficulty_rating: int

class CourseFeedbackCreate(CourseFeedbackBase):
    pass

class CourseFeedbackOut(CourseFeedbackBase):
    id: str

    class Config:
        from_attributes = True


# ── Advisor ───────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    semester: Literal["Fall", "Spring", "Summer"]
    max_credits: int
    description: Optional[str] = None
    exclude_course_ids: list[str] = []

class SuggestedCourse(BaseModel):
    course_id: str
    course_code: str
    course_name: str
    credits: int
    requirement_category: str
    reason: str
    swappable: bool = False

class GenerateResponse(BaseModel):
    suggested_courses: list[SuggestedCourse]
    total_credits: int
    semester_label: str
    warning: Optional[str] = None

class EnrollCourse(BaseModel):
    course_id: str

class EnrollRequest(BaseModel):
    semester_label: str
    courses: list[EnrollCourse]

class EnrollResponse(BaseModel):
    semester_id: str
    semester_label: str
    enrolled_count: int


class AlternativesRequest(BaseModel):
    course_id: str
    exclude_course_ids: list[str]

class AlternativeCourse(BaseModel):
    course_id: str
    course_code: str
    course_name: str
    credits: int
    requirement_category: str

class AlternativesResponse(BaseModel):
    alternatives: list[AlternativeCourse]


# ── Semester History ──────────────────────────────────────────────────────────

class SemesterCourseDetail(BaseModel):
    course_id: str
    course_code: str
    course_name: str
    credits: int
    status: str
    grade: Optional[str] = None

    class Config:
        from_attributes = True


class SemesterDetail(BaseModel):
    id: str
    semester_label: str
    semester_gpa: Optional[Decimal] = None
    status: str          # computed: "planned" | "current" | "completed"
    total_credits: int
    courses: list[SemesterCourseDetail]

    class Config:
        from_attributes = True


class SemestersResponse(BaseModel):
    semesters: list[SemesterDetail]


class UpdateSemesterStatusRequest(BaseModel):
    status: Literal["enrolled", "completed"]   # enforces one-directional transitions


class UpdateSemesterStatusResponse(BaseModel):
    semester_id: str
    new_status: str
    updated_count: int


class CancelSemesterResponse(BaseModel):
    cancelled: bool = True
