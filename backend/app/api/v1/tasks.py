from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.project import Project
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate

router = APIRouter()


async def verify_project_ownership(project_id: str, user_id: str, db: AsyncSession) -> Project:
    """Helper to verify that the project exists and belongs to the user."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or you do not have access."
        )
    return project


@router.get("/projects/{project_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(
    project_id: str,
    status: Optional[str] = None,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all tasks under a project.
    Can be filtered by status (e.g. 'todo', 'in_progress', 'completed', 'blocked').
    """
    await verify_project_ownership(project_id, current_user_id, db)
    
    query = select(Task).where(Task.project_id == project_id)
    if status:
        query = query.where(Task.status == status)
        
    query = query.order_by(Task.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/projects/{project_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: str,
    task_in: TaskCreate,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually create a task in a project.
    """
    await verify_project_ownership(project_id, current_user_id, db)

    task = Task(
        project_id=project_id,
        conversation_id=task_in.conversation_id,
        title=task_in.title,
        description=task_in.description,
        status=task_in.status,
        priority=task_in.priority,
        deadline=task_in.deadline
    )
    db.add(task)
    await db.flush()
    return task


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_in: TaskUpdate,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a task (e.g. change status, modify priority, mark completed).
    """
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found."
        )

    # Verify project ownership
    await verify_project_ownership(task.project_id, current_user_id, db)

    # Update attributes
    update_data = task_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a task.
    """
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found."
        )

    # Verify project ownership
    await verify_project_ownership(task.project_id, current_user_id, db)

    await db.delete(task)
    return None
