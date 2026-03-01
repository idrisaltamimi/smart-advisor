from sqlalchemy import Column, String, Integer, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base
import uuid


def gen_uuid():
    return str(uuid.uuid4())


# ── Accounts ──────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "user"

    id            = Column(String, primary_key=True, default=gen_uuid)
    email         = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    full_name     = Column(String, nullable=False)

    student = relationship("Student", back_populates="user", uselist=False)


class Student(Base):
    __tablename__ = "student"

    id       = Column(String, primary_key=True, default=gen_uuid)
    user_id  = Column(String, ForeignKey("user.id"), nullable=False)
    major_id = Column(String, ForeignKey("major.id"), nullable=False)
    cgpa     = Column(Numeric(3, 2))

    user      = relationship("User", back_populates="student")
    major     = relationship("Major", back_populates="students")
    semesters = relationship("Semester", back_populates="student")


# ── Programs ──────────────────────────────────────────────────────────────────

class Major(Base):
    __tablename__ = "major"

    id                     = Column(String, primary_key=True, default=gen_uuid)
    name                   = Column(String, nullable=False)
    total_credits_required = Column(Integer, nullable=False)

    requirements = relationship("Requirement", back_populates="major")
    students     = relationship("Student", back_populates="major")


class Requirement(Base):
    __tablename__ = "requirement"

    id               = Column(String, primary_key=True, default=gen_uuid)
    major_id         = Column(String, ForeignKey("major.id"), nullable=False)
    name             = Column(String, nullable=False)
    credits_required = Column(Integer, nullable=False)

    major               = relationship("Major", back_populates="requirements")
    requirement_courses = relationship("RequirementCourse", back_populates="requirement")


class RequirementCourse(Base):
    __tablename__ = "requirement_course"

    requirement_id = Column(String, ForeignKey("requirement.id"), primary_key=True)
    course_id      = Column(String, ForeignKey("course.id"), primary_key=True)

    requirement = relationship("Requirement", back_populates="requirement_courses")
    course      = relationship("Course", back_populates="requirement_courses")


# ── Academics ─────────────────────────────────────────────────────────────────

class Course(Base):
    __tablename__ = "course"

    id      = Column(String, primary_key=True, default=gen_uuid)
    code    = Column(String, nullable=False, unique=True)
    name    = Column(String, nullable=False)
    credits = Column(Integer, nullable=False)

    requirement_courses = relationship("RequirementCourse", back_populates="course")
    semester_courses    = relationship("SemesterCourse", back_populates="course")
    prerequisites       = relationship("Prerequisite", back_populates="course",
                                       foreign_keys="Prerequisite.course_id")
    is_prerequisite_for = relationship("Prerequisite", back_populates="prerequisite_course",
                                       foreign_keys="Prerequisite.prerequisite_course_id")
    feedbacks           = relationship("CourseFeedback", back_populates="course")


class Semester(Base):
    __tablename__ = "semester"

    id             = Column(String, primary_key=True, default=gen_uuid)
    student_id     = Column(String, ForeignKey("student.id"), nullable=False)
    semester_label = Column(String, nullable=False)
    semester_gpa   = Column(Numeric(3, 2))

    student         = relationship("Student", back_populates="semesters")
    semester_courses = relationship("SemesterCourse", back_populates="semester")


class SemesterCourse(Base):
    __tablename__ = "semester_course"

    semester_id = Column(String, ForeignKey("semester.id"), primary_key=True)
    course_id   = Column(String, ForeignKey("course.id"), primary_key=True)
    status      = Column(String, nullable=False)
    grade       = Column(String)

    semester = relationship("Semester", back_populates="semester_courses")
    course   = relationship("Course", back_populates="semester_courses")


class Prerequisite(Base):
    __tablename__ = "prerequisite"

    course_id              = Column(String, ForeignKey("course.id"), primary_key=True)
    prerequisite_course_id = Column(String, ForeignKey("course.id"), primary_key=True)

    course             = relationship("Course", back_populates="prerequisites",
                                      foreign_keys=[course_id])
    prerequisite_course = relationship("Course", back_populates="is_prerequisite_for",
                                       foreign_keys=[prerequisite_course_id])


class CourseFeedback(Base):
    __tablename__ = "course_feedback"

    id                = Column(String, primary_key=True, default=gen_uuid)
    course_id         = Column(String, ForeignKey("course.id"), nullable=False)
    difficulty_rating = Column(Integer, nullable=False)

    course = relationship("Course", back_populates="feedbacks")
