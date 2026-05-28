import json
import re
import logging
from typing import List, Dict, Any, Tuple
import numpy as np
import httpx
from sqlalchemy import select, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.conversation import Conversation, ConversationChunk
from app.models.summary import Summary
from app.models.relationship import ConversationRelationship

logger = logging.getLogger(__name__)


class RelationshipService:
    @staticmethod
    def _clean_json_response(text: str) -> str:
        """Extracts JSON block from the LLM output."""
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return match.group(0)
        return text

    @classmethod
    async def analyze_and_store_relationships(
        cls, new_conversation_id: str, db: AsyncSession
    ) -> List[ConversationRelationship]:
        """
        Executes pgvector nearest-neighbor matching, calls OpenRouter to classify
        relationships between the new conversation and candidate targets,
        and persists them to the database.
        """
        logger.info(f"Analyzing relationships for conversation: {new_conversation_id}")
        
        # 1. Fetch the newly ingested conversation details
        new_conv_result = await db.execute(
            select(Conversation).where(cast(Conversation.id, String) == new_conversation_id)
        )
        new_conv = new_conv_result.scalar_one_or_none()
        if not new_conv:
            logger.error(f"Conversation {new_conversation_id} not found.")
            return []

        project_id = new_conv.project_id

        # 2. Fetch the chunks and embeddings of this conversation
        chunks_result = await db.execute(
            select(ConversationChunk).where(cast(ConversationChunk.conversation_id, String) == new_conversation_id)
        )
        new_chunks = chunks_result.scalars().all()
        if not new_chunks:
            logger.warning(f"No chunks found for conversation {new_conversation_id}. Skipping relationship analysis.")
            return []

        # 3. Calculate mean embedding using numpy (384-dimensions)
        embeddings = [chunk.embedding for chunk in new_chunks]
        mean_embedding = np.mean(embeddings, axis=0).tolist()

        # 4. Query database for nearest chunks from OTHER conversations in the SAME project
        stmt = (
            select(
                ConversationChunk.conversation_id,
                Conversation.title,
                (1.0 - ConversationChunk.embedding.cosine_distance(mean_embedding)).label("similarity")
            )
            .join(Conversation, Conversation.id == ConversationChunk.conversation_id)
            .where(
                cast(Conversation.project_id, String) == project_id,
                cast(Conversation.id, String) != new_conversation_id
            )
            .order_by(ConversationChunk.embedding.cosine_distance(mean_embedding))
            .limit(15)
        )

        db_results = await db.execute(stmt)
        candidates = {}
        for conv_id, title, similarity in db_results:
            # Keep the highest similarity score chunk-match per conversation
            if conv_id not in candidates or similarity > candidates[conv_id]["score"]:
                candidates[conv_id] = {"title": title, "score": float(similarity)}

        # Filter candidates above a minimum similarity threshold (e.g. 0.40) and sort
        valid_candidates = [
            (conv_id, data) 
            for conv_id, data in candidates.items() 
            if data["score"] >= 0.40
        ]
        valid_candidates.sort(key=lambda x: x[1]["score"], reverse=True)
        top_candidates = valid_candidates[:3]

        if not top_candidates:
            logger.info("No related conversations found above similarity threshold.")
            return []

        # 5. Fetch Summary details for the newly ingested conversation
        new_summary_result = await db.execute(
            select(Summary).where(cast(Summary.conversation_id, String) == new_conversation_id)
        )
        new_summary = new_summary_result.scalar_one_or_none()
        new_summary_text = new_summary.summary_text if new_summary else new_conv.raw_content[:500]

        relationships = []

        # 6. Analyze candidates using OpenRouter
        for target_id, target_data in top_candidates:
            target_summary_result = await db.execute(
                select(Summary).where(cast(Summary.conversation_id, String) == target_id)
            )
            target_summary = target_summary_result.scalar_one_or_none()
            target_summary_text = target_summary.summary_text if target_summary else target_data["title"]

            # Query LLM to classify relationship
            rel_type, confidence, reasoning = await cls._classify_relationship_llm(
                new_conv.title, new_summary_text, target_data["title"], target_summary_text
            )

            # Only store if LLM is confident (confidence >= 0.5)
            if confidence >= 0.5:
                # Add relationship to DB
                relationship = ConversationRelationship(
                    source_conversation_id=new_conversation_id,
                    target_conversation_id=target_id,
                    relationship_type=rel_type,
                    confidence_score=confidence,
                    reasoning=reasoning
                )
                db.add(relationship)
                relationships.append(relationship)

        if relationships:
            await db.commit()
            logger.info(f"✅ Generated and stored {len(relationships)} relationships for chat {new_conversation_id}.")
        return relationships

    @classmethod
    async def _classify_relationship_llm(
        cls, src_title: str, src_summary: str, tgt_title: str, tgt_summary: str
    ) -> Tuple[str, float, str]:
        """Queries OpenRouter to classify the relationship type, confidence, and reasoning."""
        if not settings.OPENROUTER_API_KEY:
            # Local fallback rule
            return "same_topic", 0.65, "Mock reasoning: Conversations share similar vector embeddings."

        system_prompt = (
            "You are an expert software engineering intelligence system.\n"
            "Analyze the summaries of two developer discussions from the same project and determine if they are related.\n"
            "If they are related, classify the relationship into EXACTLY ONE of the following types:\n"
            "- 'same_bug': They discuss the exact same error, symptom, or bug.\n"
            "- 'same_topic': They cover the same general feature area or module but aren't follow-ups.\n"
            "- 'follow_up': One conversation is a direct timeline continuation or sequel of the other.\n"
            "- 'blocker_related': One discussion introduces or resolves a blocker discussed in the other.\n"
            "- 'implementation_progress': One discussion shows progress, updates, or code implementation details extending the other.\n"
            "- 'decision_update': A decision made in the target conversation is modified, updated, or finalized in the source conversation.\n"
            "- 'research_extension': Deeper investigation or research on a topic introduced in the other.\n"
            "- 'architecture_change': Design or architectural patterns are revised or built upon.\n\n"
            "Respond ONLY with a single valid JSON object containing these keys:\n"
            "{\n"
            "  \"is_related\": true|false,\n"
            "  \"relationship_type\": \"same_bug|same_topic|follow_up|blocker_related|implementation_progress|decision_update|research_extension|architecture_change\",\n"
            "  \"confidence_score\": float (between 0.0 and 1.0),\n"
            "  \"reasoning\": \"string (1-2 sentences explanation)\"\n"
            "}\n"
            "If they are not related, set is_related to false, confidence_score to 0.0, and relationship_type to 'same_topic'."
        )

        user_content = (
            f"Conversation A (Source):\n"
            f"Title: {src_title}\n"
            f"Summary: {src_summary}\n\n"
            f"Conversation B (Target - Historical):\n"
            f"Title: {tgt_title}\n"
            f"Summary: {tgt_summary}\n"
        )

        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://github.com/gemini-antigravity/project-memory-os",
            "X-Title": "Project Memory OS",
            "Content-Type": "application/json"
        }

        payload = {
            "model": settings.OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.1,
            "max_tokens": 800
        }

        url = "https://openrouter.ai/api/v1/chat/completions"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code != 200:
                    logger.error(f"Relationship LLM check failed: {response.status_code} - {response.text}")
                    return "same_topic", 0.60, "Fallback: Shared vector similarity matching."

                response_data = response.json()
                message_content = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                
                cleaned = cls._clean_json_response(message_content)
                parsed = json.loads(cleaned)

                if not parsed.get("is_related", False):
                    return "same_topic", 0.0, "Conversations are unrelated."

                return (
                    parsed.get("relationship_type", "same_topic"),
                    float(parsed.get("confidence_score", 0.0)),
                    parsed.get("reasoning", "Conversations share conceptual overlap.")
                )
        except Exception as e:
            logger.error(f"Error during relationship classification: {str(e)}")
            return "same_topic", 0.60, "Fallback: Cosine vector distance similarity."
