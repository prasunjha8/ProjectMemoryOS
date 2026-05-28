from datetime import datetime
from pydantic import BaseModel, Field


class RelationshipDetailResponse(BaseModel):
    id: str = Field(..., description="Unique UUID of the conversation relationship record.")
    source_conversation_id: str = Field(..., description="UUID of the newly ingested conversation.")
    target_conversation_id: str = Field(..., description="UUID of the related historical conversation.")
    target_conversation_title: str = Field(..., description="Title of the related historical conversation.")
    relationship_type: str = Field(..., description="Type of the relationship (e.g., same_bug, follow_up).")
    confidence_score: float = Field(..., description="Confidence score from 0.0 to 1.0.")
    reasoning: str = Field(..., description="Explanation of why these conversations are connected.")
    created_at: datetime = Field(..., description="Timestamp of when the relationship was identified.")

    class Config:
        from_attributes = True
