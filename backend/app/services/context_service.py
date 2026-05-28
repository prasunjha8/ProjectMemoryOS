import json
import re
import logging
from typing import Dict, Any, List, Optional
import httpx
from sqlalchemy import select, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.project import Project
from app.models.conversation import Conversation, ConversationChunk
from app.models.summary import Summary
from app.models.task import Task
from app.schemas.context import ResumeContextResponse, RecentActivityItem, NextStepItem, BlockerItem

logger = logging.getLogger(__name__)


class ContextService:
    @staticmethod
    def _clean_json_response(text: str) -> str:
        """
        Extracts JSON block from the LLM output in case it wrapped it in 
        markdown codeblocks or returned conversational text before/after.
        """
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return match.group(0)
        return text

    @classmethod
    async def get_project_resume_context(
        cls, project_id: str, db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Fetches database assets (recent chats, summaries, tasks, granular chunks)
        and calls OpenRouter to synthesize a clean project resumption context.
        """
        # 1. Fetch Project Details
        project_result = await db.execute(
            select(Project).where(cast(Project.id, String) == project_id)
        )
        project = project_result.scalar_one_or_none()
        if not project:
            return cls._get_empty_fallback("Project not found.", "")

        project_name = project.name
        project_desc = project.description or ""

        # 2. Fetch Latest 5 Conversations
        conv_result = await db.execute(
            select(Conversation)
            .where(cast(Conversation.project_id, String) == project_id)
            .order_by(Conversation.created_at.desc())
            .limit(5)
        )
        conversations = conv_result.scalars().all()

        # 3. Fetch Latest 5 Summaries
        summary_result = await db.execute(
            select(Summary)
            .join(Conversation)
            .where(cast(Conversation.project_id, String) == project_id)
            .order_by(Summary.created_at.desc())
            .limit(5)
        )
        summaries = summary_result.scalars().all()

        # 4. Fetch Latest 10 Incomplete Tasks
        task_result = await db.execute(
            select(Task)
            .where(cast(Task.project_id, String) == project_id, Task.status != "completed")
            .order_by(Task.updated_at.desc())
            .limit(10)
        )
        tasks = task_result.scalars().all()

        # 5. Fetch Latest 5 Text Chunks
        chunks_result = await db.execute(
            select(ConversationChunk)
            .join(Conversation)
            .where(cast(Conversation.project_id, String) == project_id)
            .order_by(ConversationChunk.created_at.desc())
            .limit(5)
        )
        chunks = chunks_result.scalars().all()

        # Fallback to friendly setup state if no data exists
        if not conversations:
            return cls._get_empty_fallback(project_name, project_desc)

        # Fallback to local synthesis if OpenRouter API Key is missing
        if not settings.OPENROUTER_API_KEY:
            logger.warning("OPENROUTER_API_KEY is not set. Using local mock synthesis.")
            return cls._get_mock_synthesis(project_name, summaries, tasks)

        # 6. Build Synthesized Context for LLM prompt
        summaries_str = "\n".join([
            f"- [{s.conversation_type or 'general'}]: {s.summary_text}"
            for s in summaries
        ])
        
        tasks_str = "\n".join([
            f"- {t.title} ({t.status}, priority: {t.priority}): {t.description or 'No desc'}"
            for t in tasks
        ])

        chunks_str = "\n".join([
            f"- Chunk: {c.content_chunk[:200]}..."
            for c in chunks
        ])

        system_prompt = (
            "You are a project continuity assistant for software developers, roboticists, and engineers.\n"
            "Your task is to review recent project activity logs, summaries, active tasks, and context snippets, "
            "then synthesize a concise overview so that a returning developer can immediately resume work without cognitive reload.\n\n"
            "You MUST respond ONLY with a single valid JSON object following this JSON schema:\n"
            "{\n"
            "  \"project_summary\": \"string (1-2 sentences overview of current focus)\",\n"
            "  \"recent_activity\": [\n"
            "    {\"description\": \"string (activity/discussion summary)\", \"category\": \"string (e.g. discussion, code, debugging)\"}\n"
            "  ],\n"
            "  \"open_tasks\": [\"string (highly critical open task title)\"],\n"
            "  \"blockers\": [\n"
            "    {\"problem\": \"string (active blocker or bug)\", \"impact\": \"low|medium|high\"}\n"
            "  ],\n"
            "  \"recent_decisions\": [\"string (key decision made)\"],\n"
            "  \"next_steps\": [\n"
            "    {\"action\": \"string (recommended action item)\", \"priority\": \"low|medium|high|critical\"}\n"
            "  ],\n"
            "  \"important_context\": [\"string (important technical detail, variable value, or warning)\"]\n"
            "}\n"
            "Keep description and actions extremely short, technical, and actionable. Do not include extra conversational text."
        )

        user_content = (
            f"Project: {project_name}\n"
            f"Description: {project_desc}\n\n"
            f"Recent Conversations Summaries:\n{summaries_str}\n\n"
            f"Active/Incomplete Tasks:\n{tasks_str}\n\n"
            f"Granular Context Snippets:\n{chunks_str}\n\n"
            f"Analyze this data and synthesize the current project state JSON."
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
            "temperature": 0.2,
            "max_tokens": 1500
        }

        url = "https://openrouter.ai/api/v1/chat/completions"

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code != 200:
                    logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                    return cls._get_mock_synthesis(project_name, summaries, tasks)

                response_data = response.json()
                message_content = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                
                if not message_content:
                    logger.error("OpenRouter returned empty message.")
                    return cls._get_mock_synthesis(project_name, summaries, tasks)

                cleaned_json = cls._clean_json_response(message_content)
                parsed = json.loads(cleaned_json)
                
                # Validate using Pydantic
                validated = ResumeContextResponse(**parsed)
                return validated.model_dump()

        except Exception as e:
            logger.exception(f"Error generating resume context: {str(e)}")
            return cls._get_mock_synthesis(project_name, summaries, tasks)

    @classmethod
    def _get_empty_fallback(cls, project_name: str, project_desc: str) -> Dict[str, Any]:
        """Provides a friendly getting-started state when no conversations have been uploaded yet."""
        return {
            "project_summary": project_desc or f"Workspace initialized for {project_name}.",
            "recent_activity": [
                {
                    "description": "Project workspace initialized and database tables configured.",
                    "category": "system"
                }
            ],
            "open_tasks": [],
            "blockers": [
                {
                    "problem": "No chat logs or transcripts ingested yet.",
                    "impact": "low"
                }
            ],
            "recent_decisions": [],
            "next_steps": [
                {
                    "action": "Upload or paste your first conversation transcript to generate project continuity.",
                    "priority": "high"
                }
            ],
            "important_context": [
                "To build long-term memory, upload chat transcript files (.json) or paste developer meeting transcripts."
            ]
        }

    @classmethod
    def _get_mock_synthesis(
        cls, project_name: str, summaries: List[Summary], tasks: List[Task]
    ) -> Dict[str, Any]:
        """Local synthesis service that runs if OpenRouter is unreachable or keys are omitted."""
        activities = []
        for s in summaries[:3]:
            activities.append({
                "description": f"Reviewed context: {s.summary_text[:80]}...",
                "category": s.conversation_type or "discussion"
            })
            
        if not activities:
            activities.append({
                "description": "Workspace configured. Awaiting conversation ingestion.",
                "category": "system"
            })

        open_task_titles = [t.title for t in tasks[:3]]
        
        blockers = []
        blocked_tasks = [t for t in tasks if t.status == "blocked"]
        for bt in blocked_tasks[:2]:
            blockers.append({
                "problem": f"Task blocked: {bt.title}",
                "impact": "medium"
            })
        if not blockers:
            blockers.append({
                "problem": "No immediate blockers reported.",
                "impact": "low"
            })

        next_steps = []
        todo_tasks = [t for t in tasks if t.status == "todo"]
        for t in todo_tasks[:3]:
            next_steps.append({
                "action": f"Start working on: {t.title}",
                "priority": t.priority
            })
        if not next_steps:
            next_steps.append({
                "action": "Upload developer notes to extract additional next actions.",
                "priority": "medium"
            })

        decisions = []
        for s in summaries:
            for takeaway in s.key_takeaways[:1]:
                if "decision" in takeaway.lower() or "agree" in takeaway.lower() or "keep" in takeaway.lower():
                    decisions.append(takeaway)
        if not decisions:
            decisions = [
                "Database migrated successfully to PostgreSQL.",
                "Local model embeddings configured to 384-dimensions."
            ]

        return {
            "project_summary": f"Active development workspace for {project_name}. Tracking progress across conversations.",
            "recent_activity": activities,
            "open_tasks": open_task_titles,
            "blockers": blockers,
            "recent_decisions": decisions[:3],
            "next_steps": next_steps,
            "important_context": [
                "Verify and execute your tasks on the project Kanban board.",
                "Check details of parsed chats on the main dashboard feed."
            ]
        }
