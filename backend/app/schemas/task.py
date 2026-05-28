from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "todo"  # 'todo', 'in_progress', 'completed', 'blocked'
    priority: str = "medium"  # 'low', 'medium', 'high', 'critical'
    deadline: Optional[datetime] = None


class TaskCreate(TaskBase):
    conversation_id: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[datetime] = None


class TaskResponse(TaskBase):
    id: str
    project_id: str
    conversation_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
