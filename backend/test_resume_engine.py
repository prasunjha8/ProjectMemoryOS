import asyncio
import sys
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("test_resume")

# Ensure app is in path
sys.path.append(".")

try:
    from app.core.config import settings
    from app.models.project import Project
    from app.models.conversation import Conversation, ConversationChunk
    from app.models.task import Task
    from app.models.tag import Tag
    from app.models.summary import Summary
    from app.services.context_service import ContextService
except ImportError as e:
    logger.error(f"Failed to import app modules: {str(e)}")
    sys.exit(1)


async def main():
    logger.info("--- Starting Resume Context Engine Verification Check ---")
    logger.info(f"Connecting to pooler: {settings.DATABASE_URL.split('@')[-1]}")
    
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        try:
            # 1. Fetch any project from the database
            result = await db.execute(select(Project).limit(1))
            project = result.scalar_one_or_none()
            
            if not project:
                logger.warning("⚠️ No projects found in your database. Please log in to the UI and create a project first.")
                # We can still test the empty fallback mode by generating a dummy UUID
                test_project_id = "00000000-0000-0000-0000-000000000000"
                logger.info(f"Testing service empty fallback on dummy project ID: {test_project_id}")
            else:
                test_project_id = project.id
                logger.info(f"Found project '{project.name}' (ID: {test_project_id}). Testing synthesis...")

            # 2. Invoke context service
            context = await ContextService.get_project_resume_context(test_project_id, db)
            
            logger.info("✅ Context Service executed successfully!")
            logger.info(f"\nProject Summary:\n{context.get('project_summary')}\n")
            logger.info(f"Recent Activity:\n{context.get('recent_activity')}\n")
            logger.info(f"Open Tasks:\n{context.get('open_tasks')}\n")
            logger.info(f"Blockers:\n{context.get('blockers')}\n")
            logger.info(f"Recent Decisions:\n{context.get('recent_decisions')}\n")
            logger.info(f"Next Steps:\n{context.get('next_steps')}\n")
            logger.info(f"Important Context:\n{context.get('important_context')}\n")
            
            # Basic key checks
            keys_to_check = [
                "project_summary", "recent_activity", "open_tasks", 
                "blockers", "recent_decisions", "next_steps", "important_context"
            ]
            all_keys_exist = all(k in context for k in keys_to_check)
            if all_keys_exist:
                logger.info("🎉 All JSON schema keys are present and valid!")
            else:
                logger.error(f"❌ Missing keys in response. Response keys found: {list(context.keys())}")

        except Exception as e:
            logger.error(f"❌ Resume Context Engine check failed: {str(e)}")
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
