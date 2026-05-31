from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Integer, ForeignKey, DateTime, func, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from app.core.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, server_default=func.uuid_generate_v4())
    project_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    source_type: Mapped[str] = mapped_column(String, nullable=False)  # 'uploaded_chat', 'markdown', 'pdf', 'pasted_text'
    raw_content: Mapped[str] = mapped_column(String, nullable=False)
    processed_status: Mapped[str] = mapped_column(String, default="pending")  # 'pending', 'processing', 'completed', 'failed'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="conversations")
    chunks: Mapped[List["ConversationChunk"]] = relationship(
        "ConversationChunk", back_populates="conversation", cascade="all, delete-orphan"
    )
    summary: Mapped[Optional["Summary"]] = relationship(
        "Summary", back_populates="conversation", uselist=False, cascade="all, delete-orphan"
    )
    tasks: Mapped[List["Task"]] = relationship(
        "Task", back_populates="conversation"
    )


class ConversationChunk(Base):
    __tablename__ = "conversation_chunks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, server_default=func.uuid_generate_v4())
    conversation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content_chunk: Mapped[str] = mapped_column(String, nullable=False)
    # Maps to the 'vector(384)' data type in postgres (for sentence-transformers)
    embedding: Mapped[List[float]] = mapped_column(Vector(384), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="chunks")
