import asyncio
import sys
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("test_pipeline")

# Ensure app is in path
sys.path.append(".")

try:
    from app.core.config import settings
    from app.services.ai_service import AIService
    from app.services.embedding_service import EmbeddingService
except ImportError as e:
    logger.error(f"Failed to import app services. Make sure to run this script from the backend/ directory: {str(e)}")
    sys.exit(1)


async def test_database_connection():
    logger.info("--- Testing Database Connection ---")
    logger.info(f"Connecting to: {settings.DATABASE_URL.split('@')[-1]}") # Hide credentials in log
    
    engine = create_async_engine(settings.DATABASE_URL)
    try:
        async with engine.connect() as conn:
            # Query pg_extension to check if pgvector is active
            result = await conn.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector';"))
            row = result.fetchone()
            if row:
                logger.info("✅ Database connection successful! pgvector extension is enabled.")
            else:
                logger.warning("⚠️ Database connection successful, but 'vector' extension was NOT found in pg_extension. Please run schema.sql first.")
            
            # Check if tables exist
            tables_to_check = ["profiles", "projects", "conversations", "conversation_chunks", "summaries", "tasks"]
            for table in tables_to_check:
                res = await conn.execute(text(f"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '{table}');"))
                exists = res.scalar()
                if exists:
                    logger.info(f"✅ Table '{table}' exists.")
                else:
                    logger.warning(f"❌ Table '{table}' does NOT exist. Run schema.sql.")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {str(e)}")
        return False
    finally:
        await engine.dispose()
    return True


async def test_embeddings_generation():
    logger.info("\n--- Testing Embeddings Generation ---")
    test_text = "Project Memory OS utilizes pgvector to handle semantic vector search indices."
    
    try:
        logger.info(f"Chunking test content: '{test_text}'")
        chunks = EmbeddingService.chunk_text(test_text)
        logger.info(f"Generated chunks: {chunks}")
        
        logger.info("Generating embedding vector (SentenceTransformers)...")
        embedding = EmbeddingService.get_embedding(test_text)
        
        vector_length = len(embedding)
        logger.info(f"✅ Embedding vector generated! Length: {vector_length} dimensions.")
        logger.info(f"Vector preview (first 5 dimensions): {embedding[:5]}")
        
        if vector_length != 384:
            logger.error(f"❌ Expected 384-dimensional vector for all-MiniLM-L6-v2, but got {vector_length}")
            return False
    except Exception as e:
        logger.error(f"❌ Embeddings generation failed: {str(e)}")
        return False
    return True


async def test_openrouter_llm_analysis():
    logger.info("\n--- Testing OpenRouter LLM Analysis ---")
    if not settings.OPENROUTER_API_KEY:
        logger.error("❌ OPENROUTER_API_KEY is missing from environment variables.")
        return False
        
    logger.info(f"Model configured: {settings.OPENROUTER_MODEL}")
    logger.info("OpenRouter API key configured. Dispatching analysis completions request...")
    
    sample_dialogue = (
        "[User]: We are planning the migration from SQLite to Supabase PostgreSQL. We need to store embeddings for chatbot history.\n"
        "[Assistant]: Understood. You should execute migrations enabling pgvector, create an index for quick cosine query distance lookups, and chunk the text on paragraph breaks.\n"
        "[User]: Great, let's create a ticket to configure the schema migrations."
    )
    
    try:
        result = await AIService.analyze_conversation(sample_dialogue)
        logger.info("✅ OpenRouter response received and validated successfully!")
        logger.info(f"Analysis Summary:\n{result.get('summary_text')}\n")
        logger.info(f"Conversation Type: {result.get('conversation_type')}")
        logger.info(f"Key Takeaways: {result.get('key_takeaways')}")
        logger.info(f"Technical Insights: {result.get('technical_insights')}")
        logger.info(f"Suggested Tasks: {result.get('suggested_tasks')}")
    except Exception as e:
        logger.error(f"❌ OpenRouter analysis failed: {str(e)}")
        return False
    return True


async def main():
    logger.info("Starting Project Memory OS AI Pipeline End-to-End Test")
    
    db_ok = await test_database_connection()
    embeds_ok = await test_embeddings_generation()
    llm_ok = await test_openrouter_llm_analysis()
    
    print("\n================ TEST SUMMARY ================")
    print(f"Database Connection Check:  {'PASS' if db_ok else 'FAIL'}")
    print(f"Embeddings Generation Check: {'PASS' if embeds_ok else 'FAIL'}")
    print(f"OpenRouter LLM Check:        {'PASS' if llm_ok else 'FAIL'}")
    print("==============================================")
    
    if db_ok and embeds_ok and llm_ok:
        logger.info("🎉 All V1 AI Pipeline systems operational! Ready for Phase 3 integration.")
    else:
        logger.error("❌ One or more systems failed checks. Review logs above to fix connection settings.")

if __name__ == "__main__":
    asyncio.run(main())
