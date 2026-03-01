"""
Seed script: loads uon_cs_seed.json into the database.
Zero-credit courses are skipped, as are any requirement_courses that reference them.

Run from the project root:
    python3 -m backend.data.seed
"""

import json
import sys
from pathlib import Path

# Allow running from the project root as a module
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.database import SessionLocal, engine, Base
from backend.models import (
    Major, Requirement, Course, RequirementCourse,
    Prerequisite, CourseFeedback
)

DATA_FILE = Path(__file__).parent / "uon_cs_seed.json"


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        data = json.loads(DATA_FILE.read_text())

        # ── Major ──────────────────────────────────────────────────────────
        major_data = data["major"]
        major = db.query(Major).filter_by(name=major_data["name"]).first()
        if not major:
            major = Major(**major_data)
            db.add(major)
            db.flush()
            print(f"  [+] Major: {major.name}")
        else:
            print(f"  [=] Major already exists: {major.name}")

        # ── Requirements ───────────────────────────────────────────────────
        req_map: dict[str, Requirement] = {}
        for req_data in data["requirements"]:
            req = db.query(Requirement).filter_by(
                major_id=major.id, name=req_data["name"]
            ).first()
            if not req:
                req = Requirement(major_id=major.id, **req_data)
                db.add(req)
                db.flush()
                print(f"  [+] Requirement: {req.name}")
            else:
                print(f"  [=] Requirement already exists: {req.name}")
            req_map[req.name] = req

        # ── Courses (skip zero-credit) ─────────────────────────────────────
        course_map: dict[str, Course] = {}
        skipped: set[str] = set()
        for c in data["courses"]:
            if (c["credits"] or 0) < 1:
                skipped.add(c["code"])
                print(f"  [-] Skipping zero-credit course: {c['code']} ({c['name']})")
                continue
            course = db.query(Course).filter_by(code=c["code"]).first()
            if not course:
                course = Course(**c)
                db.add(course)
                db.flush()
                print(f"  [+] Course: {c['code']} — {c['name']}")
            else:
                print(f"  [=] Course already exists: {c['code']}")
            course_map[c["code"]] = course

        # ── RequirementCourses ─────────────────────────────────────────────
        for rc in data["requirement_courses"]:
            req_name  = rc["requirement_name"]
            code      = rc["course_code"]

            if code in skipped:
                print(f"  [-] Skipping requirement_course for zero-credit: {code}")
                continue

            req    = req_map.get(req_name)
            course = course_map.get(code)
            if not req:
                print(f"  [!] Unknown requirement '{req_name}', skipping {code}")
                continue
            if not course:
                print(f"  [!] Unknown course code '{code}', skipping")
                continue

            exists = db.query(RequirementCourse).filter_by(
                requirement_id=req.id, course_id=course.id
            ).first()
            if not exists:
                db.add(RequirementCourse(requirement_id=req.id, course_id=course.id))
                print(f"  [+] RequirementCourse: {req_name} ← {code}")

        # ── Prerequisites ──────────────────────────────────────────────────
        for pre in data.get("prerequisites", []):
            c_code   = pre["course_code"]
            pre_code = pre["prerequisite_code"]
            if c_code in skipped or pre_code in skipped:
                continue
            course   = course_map.get(c_code)
            pre_course = course_map.get(pre_code)
            if not course or not pre_course:
                print(f"  [!] Prerequisite references unknown course, skipping")
                continue
            exists = db.query(Prerequisite).filter_by(
                course_id=course.id,
                prerequisite_course_id=pre_course.id
            ).first()
            if not exists:
                db.add(Prerequisite(
                    course_id=course.id,
                    prerequisite_course_id=pre_course.id
                ))
                print(f"  [+] Prerequisite: {c_code} requires {pre_code}")

        db.commit()
        print("\nSeed completed successfully.")

    except Exception as exc:
        db.rollback()
        print(f"\nSeed failed: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print(f"Seeding database from {DATA_FILE}\n")
    seed()
