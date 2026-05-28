from fastapi import APIRouter

from app.api.v1.projects import router as projects_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.search import router as search_router

api_router = APIRouter()

# Register resource sub-routers
api_router.include_router(projects_router, prefix="/projects", tags=["Projects"])
api_router.include_router(conversations_router, tags=["Conversations"])
api_router.include_router(tasks_router, tags=["Tasks"])
api_router.include_router(search_router, tags=["Search"])


@api_router.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "message": "Project Memory OS API is active"}
