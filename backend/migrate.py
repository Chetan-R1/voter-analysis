"""Run once to migrate DB to new schema."""
from app.db import engine
from sqlalchemy import text

def run():
    with engine.begin() as conn:
        # 1. Drop old tables
        conn.execute(text("DROP TABLE IF EXISTS relationships CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS family CASCADE"))

        # 2. Booth — add voter count columns
        for col, typ in [
            ("total_voter_count", "INTEGER"),
            ("total_male_voters", "INTEGER"),
            ("total_female_voters", "INTEGER"),
            ("total_third_gender_voters", "INTEGER"),
        ]:
            conn.execute(text(f"""
                ALTER TABLE booths
                ADD COLUMN IF NOT EXISTS {col} {typ}
            """))

        # 3. Voter — add data JSON column
        conn.execute(text("""
            ALTER TABLE voters
            ADD COLUMN IF NOT EXISTS data JSONB
        """))

        # 4. Create family table (new structure)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS family (
                id          SERIAL PRIMARY KEY,
                booth_id    INTEGER NOT NULL REFERENCES booths(id) ON DELETE CASCADE,
                house_no    VARCHAR(20) NOT NULL,
                member_count INTEGER NOT NULL DEFAULT 0,
                member_list JSONB,
                confidence  FLOAT NOT NULL DEFAULT 0.0,
                accuracy    FLOAT NOT NULL DEFAULT 0.0,
                CONSTRAINT uq_family_booth_house UNIQUE (booth_id, house_no)
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_family_booth_id ON family(booth_id)"))

        # 5. Create voters_family table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS voters_family (
                id           SERIAL PRIMARY KEY,
                family_id    INTEGER NOT NULL REFERENCES family(id) ON DELETE CASCADE,
                voter_id     INTEGER NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
                voter_id2    INTEGER NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
                relationship VARCHAR(20) NOT NULL,
                voter1_identity TEXT,
                voter2_identity TEXT,
                CONSTRAINT uq_voters_family UNIQUE (family_id, voter_id, voter_id2)
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_voters_family_family_id ON voters_family(family_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_voters_family_voter_id ON voters_family(voter_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_voters_family_voter_id2 ON voters_family(voter_id2)"))

        # 6. Create booth_voter_jn table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS booth_voter_jn (
                id       SERIAL PRIMARY KEY,
                booth_id INTEGER NOT NULL REFERENCES booths(id) ON DELETE CASCADE,
                voter_id INTEGER NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
                CONSTRAINT uq_booth_voter UNIQUE (booth_id, voter_id)
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_booth_voter_jn_booth_id ON booth_voter_jn(booth_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_booth_voter_jn_voter_id ON booth_voter_jn(voter_id)"))

        print("Migration complete.")

if __name__ == "__main__":
    run()
