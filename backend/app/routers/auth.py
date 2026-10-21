from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import create_token, get_current_user, get_db, verify_password
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: str
    password: str


class RegisterBody(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginBody, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=body.email, is_active=True).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_token(user.email)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="none",
        secure=True,
        max_age=60 * 60 * 8,
    )
    return {"ok": True}


@router.post("/register", status_code=201)
def register(body: RegisterBody, db: Session = Depends(get_db), _admin: User = Depends(get_current_user)):
    if db.query(User).filter_by(email=body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    from app.auth import hash_password
    from app.models.rbac import RbacRole, RbacRoleUserJn
    jn = (
        db.query(RbacRoleUserJn)
        .join(RbacRole, RbacRoleUserJn.role_id == RbacRole.id)
        .filter(RbacRoleUserJn.user_id == _admin.id, RbacRole.org_id == _admin.org_id)
        .first()
    )
    caller_role = jn.role.code if jn else None
    if caller_role not in ("admin", "leader"):
        raise HTTPException(status_code=403, detail="Only admins and leaders can create users")
    user = User(email=body.email, password_hash=hash_password(body.password), is_active=True, org_id=_admin.org_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"ok": True}


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {"email": user.email}
