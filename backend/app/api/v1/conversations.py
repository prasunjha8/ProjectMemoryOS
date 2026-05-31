from typing import List, Optional
import logging
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db, SessionLocal
from app.core.security import get_current_user
from sqlalchemy import select, delete, cast, String, or_
from app.models.project import Project
from app.models.conversation import Conversation, ConversationChunk
from app.models.summary import Summary
from app.models.task import Task
from app.models.relationship import ConversationRelationship
from app.schemas.relationship import RelationshipDetailResponse
from app.schemas.conversation import (
    ConversationCreate,
    ConversationResponse,
    ConversationDetailResponse,
    SummaryResponse
)
from app.services.parser_service import ParserService
from app.services.ai_service import AIService
from app.services.embedding_service import EmbeddingService
from app.services.context_service import ContextService
from app.api.middleware import validate_uploaded_file

logger = logging.getLogger(__name__)

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


async def process_conversation_task(conversation_id: str):
    """
    Background worker task to:
    1. Parse and chunk conversation.
    2. Request LLM Analysis (Summary, Insights, Suggested Tasks) from OpenRouter.
    3. Save Summary, Tasks, and update status to completed immediately.
    4. Generate local or API vector embeddings for chunks in a separate block.
    5. Save Chunks and compute relationships.
    """
    # Create a fresh database session for background task
    async with SessionLocal() as db:
        try:
            # Fetch the conversation
            result = await db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            if not conversation:
                logger.error(f"Background task failed: Conversation {conversation_id} not found.")
                return

            logger.info(f"Starting background processing for conversation: {conversation.title} ({conversation_id})")

            # 1. Trigger AI Summarization & Task Extraction
            analysis = await AIService.analyze_conversation(conversation.raw_content)

            # Save summary
            summary = Summary(
                conversation_id=conversation_id,
                summary_text=analysis["summary_text"],
                key_takeaways=analysis["key_takeaways"],
                technical_insights=analysis["technical_insights"],
                conversation_type=analysis["conversation_type"]
            )
            db.add(summary)

            # Insert suggested tasks
            for suggested_task in analysis.get("suggested_tasks", []):
                task = Task(
                    project_id=conversation.project_id,
                    conversation_id=conversation_id,
                    title=suggested_task["title"],
                    description=suggested_task.get("description", ""),
                    priority=suggested_task.get("priority", "medium"),
                    status="todo"
                )
                db.add(task)

            # Set status to completed immediately so the user can see analysis right away
            conversation.processed_status = "completed"
            await db.commit()
            ContextService.clear_project_cache(conversation.project_id)
            logger.info(f"Committed summary, tasks and set status to completed for conversation: {conversation_id}")

            # 2. Chunk text and generate embeddings in a separate try/except and transaction block
            try:
                chunks = EmbeddingService.chunk_text(conversation.raw_content)
                if chunks:
                    logger.info(f"Generating embeddings for {len(chunks)} chunks...")
                    async with SessionLocal() as chunk_db:
                        for idx, chunk_text in enumerate(chunks):
                            # Generate embedding asynchronously (preventing event loop block)
                            embedding = await EmbeddingService.get_embedding_async(chunk_text)
                            
                            chunk_model = ConversationChunk(
                                conversation_id=conversation_id,
                                chunk_index=idx,
                                content_chunk=chunk_text,
                                embedding=embedding
                            )
                            chunk_db.add(chunk_model)
                        await chunk_db.commit()
                        logger.info(f"Successfully generated and saved embeddings for: {conversation_id}")
            except Exception as embed_err:
                logger.exception(f"Non-fatal error generating embeddings for {conversation_id}: {str(embed_err)}")

            # 3. Analyze conceptual relationships to other chats
            try:
                from app.services.relationship_service import RelationshipService
                async with SessionLocal() as rel_db:
                    await RelationshipService.analyze_and_store_relationships(conversation_id, rel_db)
            except Exception as rel_err:
                logger.error(f"Error executing relationship classification in background: {str(rel_err)}")

        except Exception as e:
            logger.exception(f"Error in background conversation processing for {conversation_id}: {str(e)}")
            try:
                # Reload and set status to failed if it hasn't been completed yet
                async with SessionLocal() as fail_db:
                    result = await fail_db.execute(
                        select(Conversation).where(Conversation.id == conversation_id)
                    )
                    conversation_record = result.scalar_one_or_none()
                    if conversation_record and conversation_record.processed_status != "completed":
                        conversation_record.processed_status = "failed"
                        await fail_db.commit()
            except Exception as rollback_err:
                logger.error(f"Failed to set status to failed: {str(rollback_err)}")


@router.get("/projects/{project_id}/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    project_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all conversations in a project.
    """
    await verify_project_ownership(project_id, current_user_id, db)
    
    result = await db.execute(
        select(Conversation)
        .where(Conversation.project_id == project_id)
        .order_by(Conversation.created_at.desc())
    )
    return result.scalars().all()


@router.post("/projects/{project_id}/conversations", response_model=ConversationResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_conversation(
    project_id: str,
    conversation_in: ConversationCreate,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a conversation by copy-pasting conversation logs or markdown notes.
    Processing is triggered asynchronously in the background.
    """
    await verify_project_ownership(project_id, current_user_id, db)

    # If it is JSON, parse and extract title/formatted dialogue
    if conversation_in.source_type == "uploaded_chat" or conversation_in.raw_content.strip().startswith("{"):
        try:
            parsed = ParserService.parse_json_chat(conversation_in.raw_content)
            title = parsed["title"]
            text_content = parsed["text_content"]
        except Exception:
            title = conversation_in.title
            text_content = conversation_in.raw_content
    else:
        title = conversation_in.title
        text_content = conversation_in.raw_content

    conversation = Conversation(
        project_id=project_id,
        title=title,
        source_type=conversation_in.source_type,
        raw_content=text_content,
        processed_status="processing"
    )
    db.add(conversation)
    await db.flush() # Secure the ID for background task
    ContextService.clear_project_cache(project_id)

    # Queue background analysis, extraction, and vector index building
    background_tasks.add_task(process_conversation_task, conversation.id)
    
    return conversation


@router.post("/projects/{project_id}/conversations/upload", response_model=ConversationResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_conversation_file(
    project_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = Depends(validate_uploaded_file),
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a conversation file (PDF, Markdown, JSON, Text).
    The file is parsed and processed asynchronously in the background.
    """
    await verify_project_ownership(project_id, current_user_id, db)

    file_bytes = await file.read()
    
    try:
        parsed = ParserService.parse_file(file.filename, file_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse file: {str(e)}"
        )

    conversation = Conversation(
        project_id=project_id,
        title=parsed["title"],
        source_type="pdf" if file.filename.endswith(".pdf") else "uploaded_chat",
        raw_content=parsed["text_content"],
        processed_status="processing"
    )
    db.add(conversation)
    await db.flush()
    ContextService.clear_project_cache(project_id)

    background_tasks.add_task(process_conversation_task, conversation.id)
    
    return conversation


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch details of a single conversation, including its full text and AI summary.
    """
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.summary))
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found."
        )

    # Verify ownership of the containing project
    await verify_project_ownership(conversation.project_id, current_user_id, db)
    
    return conversation


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a conversation. Associated chunks, summary and deep link tags are cascade deleted.
    """
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found."
        )

    await verify_project_ownership(conversation.project_id, current_user_id, db)
    
    project_id = conversation.project_id
    await db.delete(conversation)
    ContextService.clear_project_cache(project_id)
    return None


@router.post("/conversations/{conversation_id}/analyze", response_model=ConversationResponse, status_code=status.HTTP_202_ACCEPTED)
async def reanalyze_conversation(
    conversation_id: str,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Force re-trigger AI summarization, task extraction, and embedding generation
    for a conversation. Wipes out any previous summaries, extracted tasks, and vector chunks.
    """
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found."
        )

    # Verify project ownership
    await verify_project_ownership(conversation.project_id, current_user_id, db)

    # Clean out old summary, chunks, and task records to prevent duplicates
    await db.execute(delete(Summary).where(Summary.conversation_id == conversation_id))
    await db.execute(delete(ConversationChunk).where(ConversationChunk.conversation_id == conversation_id))
    await db.execute(delete(Task).where(Task.conversation_id == conversation_id))

    # Set status to processing and save
    conversation.processed_status = "processing"
    await db.commit()
    ContextService.clear_project_cache(conversation.project_id)

    # Queue background processor task
    background_tasks.add_task(process_conversation_task, conversation_id)

    return conversation


@router.get("/conversations/{conversation_id}/relationships", response_model=List[RelationshipDetailResponse])
async def get_conversation_relationships(
    conversation_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch all identified relationships for a given conversation (in both directions).
    """
    result = await db.execute(
        select(Conversation).where(cast(Conversation.id, String) == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found."
        )

    await verify_project_ownership(conversation.project_id, current_user_id, db)

    # Fetch relationships where this is source
    stmt_src = (
        select(
            ConversationRelationship,
            Conversation.title.label("related_title"),
            Conversation.id.label("related_id")
        )
        .join(Conversation, Conversation.id == ConversationRelationship.target_conversation_id)
        .where(cast(ConversationRelationship.source_conversation_id, String) == conversation_id)
    )
    
    # Fetch relationships where this is target
    stmt_tgt = (
        select(
            ConversationRelationship,
            Conversation.title.label("related_title"),
            Conversation.id.label("related_id")
        )
        .join(Conversation, Conversation.id == ConversationRelationship.source_conversation_id)
        .where(cast(ConversationRelationship.target_conversation_id, String) == conversation_id)
    )

    db_results_src = await db.execute(stmt_src)
    db_results_tgt = await db.execute(stmt_tgt)
    
    response = []
    seen_ids = set()
    
    for rel, related_title, related_id in db_results_src:
        if rel.id not in seen_ids:
            seen_ids.add(rel.id)
            response.append(
                RelationshipDetailResponse(
                    id=rel.id,
                    source_conversation_id=rel.source_conversation_id,
                    target_conversation_id=related_id,
                    target_conversation_title=related_title,
                    relationship_type=rel.relationship_type,
                    confidence_score=rel.confidence_score,
                    reasoning=rel.reasoning,
                    created_at=rel.created_at
                )
            )

    for rel, related_title, related_id in db_results_tgt:
        if rel.id not in seen_ids:
            seen_ids.add(rel.id)
            response.append(
                RelationshipDetailResponse(
                    id=rel.id,
                    source_conversation_id=conversation_id,
                    target_conversation_id=related_id,
                    target_conversation_title=related_title,
                    relationship_type=rel.relationship_type,
                    confidence_score=rel.confidence_score,
                    reasoning=rel.reasoning,
                    created_at=rel.created_at
                )
            )
            
    return response
