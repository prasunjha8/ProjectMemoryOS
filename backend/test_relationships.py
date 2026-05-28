import asyncio
import sys
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("test_relationships")

# Ensure app is in path
sys.path.append(".")

try:
    from app.core.config import settings
    # Import all models to ensure mapper resolution succeeds
    from app.models.project import Project
    from app.models.conversation import Conversation, ConversationChunk
    from app.models.task import Task
    from app.models.tag import Tag
    from app.models.summary import Summary
    from app.models.relationship import ConversationRelationship
    from app.services.relationship_service import RelationshipService
except ImportError as e:
    logger.error(f"Failed to import app modules: {str(e)}")
    sys.exit(1)


async def main():
    logger.info("--- Starting Conversation Relationship Engine Verification Check ---")
    logger.info(f"Connecting to database pooler: {settings.DATABASE_URL.split('@')[-1]}")
    
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        try:
            # 1. Fetch any conversation from the database
            result = await db.execute(select(Conversation).limit(1))
            conv = result.scalar_one_or_none()
            
            if not conv:
                logger.warning("⚠️ No conversations found in your database. Please ingest some conversation logs first.")
                test_conv_id = "00000000-0000-0000-0000-000000000000"
                logger.info(f"Testing service execution on dummy conversation ID: {test_conv_id}")
            else:
                test_conv_id = conv.id
                logger.info(f"Found conversation '{conv.title}' (ID: {test_conv_id}). Testing relationship classification...")

            # 2. Invoke relationship service
            # This will query vector nearest neighbors and write relations
            relations = await RelationshipService.analyze_and_store_relationships(test_conv_id, db)
            
            logger.info(f"✅ Service execution complete! Generated relationships count: {len(relations)}")
            for rel in relations:
                logger.info(f"Generated Relation:")
                logger.info(f"  Source: {rel.source_conversation_id}")
                logger.info(f"  Target: {rel.target_conversation_id}")
                logger.info(f"  Type:   {rel.relationship_type}")
                logger.info(f"  Score:  {rel.confidence_score}")
                logger.info(f"  Reason: {rel.reasoning}")

        except Exception as e:
            logger.error(f"❌ Conversation Relationship Engine check failed: {str(e)}")
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
