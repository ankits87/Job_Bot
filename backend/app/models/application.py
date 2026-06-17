from sqlalchemy import Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id"), index=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    # pending | applying | applied | failed | manual_required
    ats_score_before: Mapped[float | None] = mapped_column(Float, nullable=True)
    ats_score_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    user: Mapped["User"] = relationship(back_populates="applications")
    job: Mapped["Job"] = relationship(back_populates="applications")
    optimized_resume: Mapped["OptimizedResume | None"] = relationship(back_populates="application", uselist=False)
