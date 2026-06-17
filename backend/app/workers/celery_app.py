from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "linkedin_jobs",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.apply_worker"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    # Fallback: if broker is unreachable, tasks run eagerly (synchronously) in the same process
    task_always_eager=settings.environment == "development",
)
