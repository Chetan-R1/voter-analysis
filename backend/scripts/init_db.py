"""Create all tables. Usage: python -m scripts.init_db"""

from app.db import engine
from app.models import Base

if __name__ == "__main__":
    Base.metadata.create_all(engine)
    print("Tables:", ", ".join(Base.metadata.tables))
