import asyncio
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("test_new_chats")

sys.path.append(".")

from app.api.v1.conversations import process_conversation_task

async def main():
    chat_ids = [
        "e1a29531-ec53-4bcf-bc24-2407e0a9f2fb"
    ]
    for cid in chat_ids:
        print(f"\n--- Processing conversation {cid} locally ---")
        try:
            await process_conversation_task(cid)
            print(f"✅ Finished processing {cid} successfully!")
        except Exception as e:
            print(f"❌ Failed processing {cid}: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
