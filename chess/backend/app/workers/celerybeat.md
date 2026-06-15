# Celery beat

Run the scheduler alongside the worker for periodic jobs:

```bash
celery -A app.workers.celery_app.celery_app beat --loglevel=info
```
