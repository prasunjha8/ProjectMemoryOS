from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class RecentActivityItem(BaseModel):
    description: str = Field(..., description="Short summary of a recent discussion, code update, or action.")
    category: str = Field("general", description="Category of the activity (e.g., discussion, debugging, planning).")


class NextStepItem(BaseModel):
    action: str = Field(..., description="Actionable next step recommended for the developer.")
    priority: str = Field("medium", description="Priority level ('low', 'medium', 'high', 'critical').")


class BlockerItem(BaseModel):
    problem: str = Field(..., description="Active blocker, bug, or unresolved dependency.")
    impact: str = Field("medium", description="Impact level ('low', 'medium', 'high').")


class ConversationFlowItem(BaseModel):
    id: str = Field(..., description="The unique identifier of the conversation.")
    title: str = Field(..., description="The title of the conversation.")
    created_at: datetime = Field(..., description="The timestamp when this conversation was created.")
    source_type: str = Field(..., description="The source type of the conversation.")
    processed_status: str = Field(..., description="The processing status of the conversation.")
    summary_text: Optional[str] = Field(None, description="The brief summary of this conversation.")


class ResumeContextResponse(BaseModel):
    project_summary: str = Field(..., description="Concise overview of the current project status and focus.")
    recent_activity: List[RecentActivityItem] = Field(default_factory=list, description="Recent discussions and activities.")
    open_tasks: List[str] = Field(default_factory=list, description="Incomplete tasks that need attention.")
    blockers: List[BlockerItem] = Field(default_factory=list, description="Active blockers or issues.")
    recent_decisions: List[str] = Field(default_factory=list, description="Key design, coding, or architecture decisions made recently.")
    next_steps: List[NextStepItem] = Field(default_factory=list, description="Recommended next actions.")
    important_context: List[str] = Field(default_factory=list, description="Important technical context, variables, or warnings to keep in mind.")
    
    # Progress and flow fields
    completed_tasks_count: int = Field(0, description="Total number of completed tasks in this project.")
    total_tasks_count: int = Field(0, description="Total number of tasks in this project.")
    completion_percentage: float = Field(0.0, description="Percentage of tasks completed.")
    completed_tasks: List[str] = Field(default_factory=list, description="List of completed task titles.")
    incomplete_tasks: List[str] = Field(default_factory=list, description="List of incomplete task titles.")
    conversation_flow: List[ConversationFlowItem] = Field(default_factory=list, description="Chronological flow of conversations.")

