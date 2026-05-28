from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Float, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ConversationRelationship(Base):
    __tablename__ = "conversation_relationships"

    id: Mapped[str] = mapped_column(String, primary_key=True, server_default=func.uuid_generate_v4())
    source_conversation_id: Mapped[str] = mapped_column(
        String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_conversation_id: Mapped[str] = mapped_column(
        String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    relationship_type: Mapped[str] = mapped_column(String, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    reasoning: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships - Explicitly specify foreign_keys due to multiple relations to the same table
    source_conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        foreign_keys=[source_conversation_id]
    )
    target_conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        foreign_keys=[target_conversation_id]
    )
