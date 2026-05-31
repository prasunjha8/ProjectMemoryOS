from datetime import datetime
from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime, func, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, server_default=func.uuid_generate_v4())
    project_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="todo")  # 'todo', 'in_progress', 'completed', 'blocked'
    priority: Mapped[str] = mapped_column(String, default="medium")  # 'low', 'medium', 'high', 'critical'
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="tasks")
    conversation: Mapped[Optional["Conversation"]] = relationship("Conversation", back_populates="tasks")
