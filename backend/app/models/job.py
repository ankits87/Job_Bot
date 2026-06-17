from sqlalchemy import String, Text, Float, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    linkedin_job_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    company: Mapped[str] = mapped_column(String(255))
    location: Mapped[str] = mapped_column(String(255))
    jd_text: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text)
    is_easy_apply: Mapped[bool] = mapped_column(default=False)
    relevance_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    extra: Mapped[dict] = mapped_column(JSON, default=dict)

    applications: Mapped[list["Application"]] = relationship(back_populates="job")
