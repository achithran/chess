# Database migrations (Alembic)

Production schema changes are managed with Alembic.

```bash
# one-time
alembic init alembic            # already scaffolded in this folder structure
# create a migration from model changes
alembic revision --autogenerate -m "create initial tables"
# apply
alembic upgrade head
```

`alembic/env.py` should import `app.db.base.Base.metadata` as the target and
read `DATABASE_URL` from settings. For local dev you can skip migrations and run
`python -m app.db.init_db` to create tables + seed demo data.
