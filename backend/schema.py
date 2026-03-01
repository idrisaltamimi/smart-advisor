from pydantic import BaseModel
from typing import Optional
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
