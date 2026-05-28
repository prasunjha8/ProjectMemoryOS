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


class ResumeContextResponse(BaseModel):
    project_summary: str = Field(..., description="Concise overview of the current project status and focus.")
    recent_activity: List[RecentActivityItem] = Field(default_factory=list, description="Recent discussions and activities.")
    open_tasks: List[str] = Field(default_factory=list, description="Incomplete tasks that need attention.")
    blockers: List[BlockerItem] = Field(default_factory=list, description="Active blockers or issues.")
    recent_decisions: List[str] = Field(default_factory=list, description="Key design, coding, or architecture decisions made recently.")
    next_steps: List[NextStepItem] = Field(default_factory=list, description="Recommended next actions.")
    important_context: List[str] = Field(default_factory=list, description="Important technical context, variables, or warnings to keep in mind.")
