from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import literal

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.project import Project
from app.models.conversation import Conversation, ConversationChunk
from app.schemas.search import SearchRequest, SearchResponse, SearchResultItem
from app.services.embedding_service import EmbeddingService

router = APIRouter()


async def verify_project_ownership(project_id: str, user_id: str, db: AsyncSession) -> Project:
    """Helper to verify project access ownership."""
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


@router.post("/projects/{project_id}/search", response_model=SearchResponse)
async def search_project_data(
    project_id: str,
    search_req: SearchRequest,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Search through conversations in a project.
    Supports:
    - 'semantic': Vector-based pgvector cosine distance search.
    - 'lexical': Simple SQL keyword matching.
    - 'hybrid': Combines vector distance matching with fallback keyword matches.
    """
    await verify_project_ownership(project_id, current_user_id, db)

    query_text = search_req.query.strip()
    if not query_text:
        return {"results": []}

    limit = search_req.limit or 10
    search_type = search_req.type or "hybrid"

    results = []

    # --- 1. SEMANTIC SEARCH PIPELINE ---
    if search_type in ["semantic", "hybrid"]:
        # Generate embedding for search query locally using sentence-transformers (384d)
        query_vector = EmbeddingService.get_embedding(query_text)
        
        # Calculate cosine similarity: (1 - cosine_distance)
        # Cosine distance in pgvector is mapped using the '<=>' operator (cosine_distance in sqlalchemy)
        stmt = (
            select(
                ConversationChunk,
                Conversation.title,
                (1.0 - ConversationChunk.embedding.cosine_distance(query_vector)).label("similarity")
            )
            .join(Conversation, Conversation.id == ConversationChunk.conversation_id)
            .where(Conversation.project_id == project_id)
            .order_by(ConversationChunk.embedding.cosine_distance(query_vector))
            .limit(limit)
        )
        
        db_results = await db.execute(stmt)
        for chunk, conv_title, similarity in db_results:
            results.append(
                SearchResultItem(
                    conversation_id=chunk.conversation_id,
                    conversation_title=conv_title,
                    chunk_index=chunk.chunk_index,
                    content_chunk=chunk.content_chunk,
                    score=float(similarity)
                )
            )

    # --- 2. LEXICAL SEARCH PIPELINE (KEYWORD MATCH) ---
    if search_type == "lexical" or (search_type == "hybrid" and len(results) < limit):
        # Fetch remaining matching slots via standard text query
        needed = limit - len(results)
        existing_ids = {r.conversation_id for r in results}
        
        stmt = (
            select(
                ConversationChunk,
                Conversation.title
            )
            .join(Conversation, Conversation.id == ConversationChunk.conversation_id)
            .where(
                Conversation.project_id == project_id,
                ConversationChunk.content_chunk.ilike(f"%{query_text}%")
            )
        )
        
        # If hybrid, exclude already fetched items
        if search_type == "hybrid" and existing_ids:
            stmt = stmt.where(ConversationChunk.conversation_id.not_in(list(existing_ids)))
            
        stmt = stmt.limit(needed)
        db_results = await db.execute(stmt)
        
        for chunk, conv_title in db_results:
            results.append(
                SearchResultItem(
                    conversation_id=chunk.conversation_id,
                    conversation_title=conv_title,
                    chunk_index=chunk.chunk_index,
                    content_chunk=chunk.content_chunk,
                    score=0.5  # Fixed moderate score for lexical keyword match fallback
                )
            )

    # If it is semantic/hybrid search, ensure we sort the aggregated results by similarity score descending
    if search_type in ["semantic", "hybrid"]:
        results.sort(key=lambda x: x.score, reverse=True)

    return {"results": results[:limit]}
