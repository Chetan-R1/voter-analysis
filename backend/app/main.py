from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, booths, imports, search, voters

app = FastAPI(title="Voter Analysis API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
