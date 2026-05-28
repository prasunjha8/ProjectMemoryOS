from datetime import datetime
from typing import List
from sqlalchemy import String, ForeignKey, DateTime, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Summary(Base):
    __tablename__ = "summaries"

    id: Mapped[str] = mapped_column(String, primary_key=True, server_default=func.uuid_generate_v4())
    conversation_id: Mapped[str] = mapped_column(
        String, ForeignKey("conversations.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    summary_text: Mapped[str] = mapped_column(String, nullable=False)
    key_takeaways: Mapped[List[str]] = mapped_column(JSON, default=list)  # Stored as JSONB in PostgreSQL
    technical_insights: Mapped[List[str]] = mapped_column(JSON, default=list)  # Stored as JSONB in PostgreSQL
    conversation_type: Mapped[str] = mapped_column(String, nullable=True)  # 'debugging', 'architecture', etc.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="summary")
