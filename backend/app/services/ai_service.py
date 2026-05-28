import json
import re
import logging
from typing import Dict, Any, List, Optional
import httpx
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)


class TaskSuggestion(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: str = "medium"  # low, medium, high, critical


class AIAnalysisResult(BaseModel):
    summary_text: str
    key_takeaways: List[str] = Field(default_factory=list)
    technical_insights: List[str] = Field(default_factory=list)
    conversation_type: str = "general"  # debugging, architecture, planning, research, retro, general
    suggested_tasks: List[TaskSuggestion] = Field(default_factory=list)


class AIService:
    @staticmethod
    def _clean_json_response(text: str) -> str:
        """
        Extracts JSON block from the LLM output in case it wrapped it in 
        markdown codeblocks or returned conversational text before/after.
        """
        # Find JSON object pattern
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return match.group(0)
        return text

    @classmethod
    async def analyze_conversation(cls, raw_content: str) -> Dict[str, Any]:
        """
        Sends the conversation text to OpenRouter to summarize, classify, 
        extract insights, and suggest actionable tasks.
        """
        if not settings.OPENROUTER_API_KEY:
            logger.warning("OPENROUTER_API_KEY is not set. Using mock analysis fallback.")
            return cls._get_mock_analysis(raw_content)

        system_prompt = (
            "You are an expert technical program manager and AI architect.\n"
            "Analyze the conversation or document provided by the user. You must extract:\n"
            "1. A concise summary of the discussion/note (summary_text).\n"
            "2. Key takeaways (key_takeaways - list of bullet points).\n"
            "3. Deep technical insights, architectural decisions, code patterns discussed, or bugs solved (technical_insights - list of points).\n"
            "4. Classification of the conversation type (conversation_type - choose exactly one of: 'debugging', 'architecture', 'planning', 'research', 'retro', 'general').\n"
            "5. Actionable next steps / task list (suggested_tasks - list of tasks containing 'title', 'description', and 'priority' which must be one of: 'low', 'medium', 'high', 'critical').\n\n"
            "You MUST respond ONLY with a single valid JSON object following this JSON schema:\n"
            "{\n"
            "  \"summary_text\": \"string\",\n"
            "  \"key_takeaways\": [\"string\"],\n"
            "  \"technical_insights\": [\"string\"],\n"
            "  \"conversation_type\": \"debugging|architecture|planning|research|retro|general\",\n"
            "  \"suggested_tasks\": [\n"
            "    {\"title\": \"string\", \"description\": \"string\", \"priority\": \"low|medium|high|critical\"}\n"
            "  ]\n"
            "}\n"
            "Do not include any conversational explanation before or after the JSON."
        )

        # Truncate content if it exceeds token length limits (e.g. roughly 100k chars for safety in V1)
        truncated_content = raw_content[:120000]

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
                {"role": "user", "content": f"Analyze the following conversation logs:\n\n{truncated_content}"}
            ],
            "temperature": 0.2, # Low temperature for consistent JSON formatting
            "max_tokens": 1500
        }

        url = "https://openrouter.ai/api/v1/chat/completions"

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                
                if response.status_code != 200:
                    logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                    return cls._get_fallback_analysis("API Error", f"OpenRouter returned status code {response.status_code}.")

                response_data = response.json()
                choice = response_data.get("choices", [{}])[0]
                message_content = choice.get("message", {}).get("content", "")

                if not message_content:
                    logger.error("OpenRouter returned an empty message content.")
                    return cls._get_fallback_analysis("Empty Response", "Model returned an empty content payload.")

                # Extract and clean JSON response
                json_str = cls._clean_json_response(message_content)
                parsed_data = json.loads(json_str)

                # Validate with Pydantic
                validated_result = AIAnalysisResult(**parsed_data)
                return validated_result.model_dump()

        except Exception as e:
            logger.exception(f"Exception during LLM analysis orchestrations: {str(e)}")
            return cls._get_fallback_analysis("Error processing conversation", f"An exception occurred: {str(e)}")

    @classmethod
    def _get_fallback_analysis(cls, error_type: str, detail: str) -> Dict[str, Any]:
        """
        Creates a clean fallback structure in case the API call or parsing fails, 
        ensuring the application never crashes on processing.
        """
        return {
            "summary_text": f"Analysis failed: {error_type}. {detail}",
            "key_takeaways": ["Analysis could not be generated due to an error."],
            "technical_insights": ["Review original upload content for information."],
            "conversation_type": "general",
            "suggested_tasks": []
        }

    @classmethod
    def _get_mock_analysis(cls, raw_content: str) -> Dict[str, Any]:
        """
        Provides mock data for local development if OpenRouter API Key is missing.
        """
        # Create a simple mock summary based on text length
        snippet = raw_content[:150].strip().replace("\n", " ")
        return {
            "summary_text": f"Mock Summary: This is a placeholder summary generated locally because the OpenRouter API key is not configured. Original log starts with: '{snippet}...'",
            "key_takeaways": [
                "Local development mode active.",
                "Ensure OPENROUTER_API_KEY is configured in your .env file to enable live summaries.",
                "Original content parsed successfully."
            ],
            "technical_insights": [
                "Local environment uses mock analyzer service fallback.",
                "FastAPI is running successfully on Python 3.14."
            ],
            "conversation_type": "general",
            "suggested_tasks": [
                {
                    "title": "Configure OpenRouter API Key",
                    "description": "Add OPENROUTER_API_KEY to your backend/.env file to test full AI summarization and task extraction capabilities.",
                    "priority": "high"
                },
                {
                    "title": "Verify Supabase migrations",
                    "description": "Execute database/schema.sql script on Supabase to align table definitions.",
                    "priority": "medium"
                }
            ]
        }
