from sqlalchemy import Integer, Text, ForeignKey, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    original_text: Mapped[str] = mapped_column(Text)
    parsed_json: Mapped[dict] = mapped_column(JSON, default=dict)
    file_path: Mapped[str] = mapped_column(Text)
    file_type: Mapped[str] = mapped_column(Text)  # pdf or docx

    user: Mapped["User"] = relationship(back_populates="resumes")
    optimized: Mapped[list["OptimizedResume"]] = relationship(back_populates="resume")


class OptimizedResume(Base):
    __tablename__ = "optimized_resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(Integer, ForeignKey("applications.id"), index=True)
    resume_id: Mapped[int] = mapped_column(Integer, ForeignKey("resumes.id"))
    rewritten_text: Mapped[str] = mapped_column(Text)
    pdf_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    keywords_injected: Mapped[list] = mapped_column(JSON, default=list)

    application: Mapped["Application"] = relationship(back_populates="optimized_resume")
    resume: Mapped["Resume"] = relationship(back_populates="optimized")
