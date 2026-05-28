from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class ConversationCreate(BaseModel):
    title: str
    source_type: str  # 'uploaded_chat', 'markdown', 'pdf', 'pasted_text'
    raw_content: str


class ConversationResponse(BaseModel):
    id: str
    project_id: str
    title: str
    source_type: str
    processed_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SummaryResponse(BaseModel):
    id: str
    conversation_id: str
    summary_text: str
    key_takeaways: List[str]
    technical_insights: List[str]
    conversation_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationDetailResponse(ConversationResponse):
    raw_content: str
    summary: Optional[SummaryResponse] = None

    model_config = ConfigDict(from_attributes=True)
