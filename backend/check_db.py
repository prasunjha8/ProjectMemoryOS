import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    # Use the active database url from .env
    url = "postgresql+asyncpg://postgres.jyuacvrwxqnozduipwlg:mypasswordismummy12@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            # Query conversations
            res = await conn.execute(text("SELECT id, title, source_type, processed_status, created_at FROM conversations ORDER BY created_at DESC;"))
            rows = res.fetchall()
            print("--- Conversations ---")
            for r in rows:
                print(r)
            
            # Query summaries
            res_sum = await conn.execute(text("SELECT conversation_id, summary_text FROM summaries;"))
            rows_sum = res_sum.fetchall()
            print("--- Summaries ---")
            for r in rows_sum:
                print(r[0], r[1][:50])

    except Exception as e:
        print(f"Error querying: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
