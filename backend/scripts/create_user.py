"""Create a login account.

Usage: python -m scripts.create_user --email admin@example.com --password secret123
"""

import argparse

from sqlalchemy import select

from app.auth import hash_password
from app.db import SessionLocal
from app.models import User


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    with SessionLocal() as session:
        if session.scalar(select(User).where(User.email == args.email)):
            print(f"User {args.email} already exists.")
            return
        session.add(User(email=args.email, password_hash=hash_password(args.password)))
        session.commit()
        print(f"User {args.email} created.")


if __name__ == "__main__":
    main()
