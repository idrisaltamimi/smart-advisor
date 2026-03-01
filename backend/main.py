from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session

from backend.database import engine, Base, get_db

# Create tables (for production, use Alembic instead)
Base.metadata.create_all(bind=engine)

app = FastAPI()


@app.get("/")
def read_users(db: Session = Depends(get_db)):
    # Your database logic here
    return {"message": "app is running!"}


@app.get("/users/")
def read_users(db: Session = Depends(get_db)):
    # Your database logic here
    return {"message": "Database is connected!"}
