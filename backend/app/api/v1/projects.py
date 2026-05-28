from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.schemas.context import ResumeContextResponse
from app.services.context_service import ContextService

router = APIRouter()


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all projects owned by the authenticated user.
    """
    result = await db.execute(
        select(Project).where(Project.user_id == current_user_id)
    )
    return result.scalars().all()


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new project workspace.
    """
    project = Project(
        name=project_in.name,
        description=project_in.description,
        user_id=current_user_id
    )
    db.add(project)
    await db.flush() # Flush to get generated UUID
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch a single project's details.
    """
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or you do not have access."
        )
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a project. All nested conversations, chunks, summaries, and tasks will cascade delete.
    """
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or you do not have access."
        )
    await db.delete(project)
    return None


@router.get("/{project_id}/resume", response_model=ResumeContextResponse)
async def get_project_resume(
    project_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate project continuity / resume context for the returning developer.
    """
    # Verify project exists and belongs to the user
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or you do not have access."
        )
    
    return await ContextService.get_project_resume_context(project_id, db)
