from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import engine, Base, get_db
from backend import models
from backend.auth import hash_password, verify_password, create_access_token, get_current_user
from backend.schema import UserCreate, UserOut, LoginRequest, AuthResponse, MajorOut, SetMajorRequest

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def user_to_out(user: models.User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        major_id=user.student.major_id if user.student else None,
    )


@app.get("/")
def root():
    return {"message": "app is running!"}


@app.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(body: UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = models.User(
        email=body.email,
        full_name=body.full_name,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id})
    return AuthResponse(access_token=token, user=user_to_out(user))


@app.post("/auth/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token({"sub": user.id})
    return AuthResponse(access_token=token, user=user_to_out(user))


@app.get("/users/me", response_model=UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return user_to_out(current_user)


@app.get("/majors", response_model=list[MajorOut])
def list_majors(db: Session = Depends(get_db)):
    return db.query(models.Major).all()


@app.post("/users/me/major", response_model=UserOut)
def set_major(
    body: SetMajorRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    major = db.query(models.Major).filter(models.Major.id == body.major_id).first()
    if not major:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Major not found")

    if current_user.student:
        current_user.student.major_id = body.major_id
    else:
        student = models.Student(user_id=current_user.id, major_id=body.major_id)
        db.add(student)

    db.commit()
    db.refresh(current_user)
    return user_to_out(current_user)
