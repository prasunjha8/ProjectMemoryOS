from typing import List, Optional
from pydantic import BaseModel


class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 10
    type: Optional[str] = "hybrid"  # 'semantic', 'lexical', 'hybrid'


class SearchResultItem(BaseModel):
    conversation_id: str
    conversation_title: str
    chunk_index: int
    content_chunk: str
    score: float  # Cosine distance or relevance score


class SearchResponse(BaseModel):
    results: List[SearchResultItem]
