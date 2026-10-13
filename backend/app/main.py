import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, booths, imports, search, voters


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.models import Base
    from app.db import engine
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Voter Analysis API", version="0.1.0", lifespan=lifespan)

_frontend = os.getenv("FRONTEND_URL", "")
_origins = ["http://localhost:3000"]
if _frontend:
    _origins.append(_frontend.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(search.router)   # search before voters — /voters/search must not be caught by /voters/{epic}
app.include_router(voters.router)
app.include_router(booths.router)
app.include_router(imports.router)


@app.get("/health")
def health():
    return {"ok": True}
