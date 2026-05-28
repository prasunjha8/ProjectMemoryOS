from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Column, Table, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Join table for many-to-many relationship between Conversations and Tags
conversation_tags = Table(
    "conversation_tags",
    Base.metadata,
    Column(
        "conversation_id",
        String,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        String,
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String, primary_key=True, server_default=func.uuid_generate_v4())
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str] = mapped_column(String, default="#3B82F6")  # Tailwind blue-500 default
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="tags")
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation", secondary=conversation_tags, backref="tags"
    )
