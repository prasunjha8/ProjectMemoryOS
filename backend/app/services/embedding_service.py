import logging
import asyncio
from typing import List, Optional
import numpy as np
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lazy load sentence-transformers to speed up app startup and avoid issues if running in light environments
_model = None


class EmbeddingService:
    @classmethod
    def _get_model(cls):
        """
        Lazy-loads the SentenceTransformer model to memory.
        Uses all-MiniLM-L6-v2 (produces 384-dimensional dense vectors).
        """
        global _model
        if _model is None:
            if settings.DISABLE_LOCAL_EMBEDDINGS:
                raise RuntimeError("Local embeddings are disabled (DISABLE_LOCAL_EMBEDDINGS is True)")
            try:
                from sentence_transformers import SentenceTransformer
                logger.info("Initializing SentenceTransformer all-MiniLM-L6-v2 model...")
                _model = SentenceTransformer("all-MiniLM-L6-v2")
                logger.info("SentenceTransformer model loaded successfully.")
            except Exception as e:
                logger.exception(f"Failed to load SentenceTransformer model: {str(e)}")
                raise RuntimeError(f"Embedding model initialization failed: {str(e)}")
        return _model

    @classmethod
    def get_embedding(cls, text: str) -> List[float]:
        """
        Synchronously generates a 384-dimensional vector embedding for the input text.
        """
        if not text.strip():
            return [0.0] * 384

        try:
            model = cls._get_model()
            embedding = model.encode(text, convert_to_numpy=True)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Error generating synchronous embedding: {str(e)}")
            return [0.0] * 384

    @classmethod
    async def get_embedding_async(cls, text: str) -> List[float]:
        """
        Asynchronously generates a 384-dimensional vector embedding for the input text.
        Tries:
        1. Hugging Face Inference API if DISABLE_LOCAL_EMBEDDINGS is enabled or local model fails.
        2. Local SentenceTransformer (via asyncio.to_thread) if allowed.
        3. Falls back to zero vector [0.0]*384 on any failure.
        """
        if not text.strip():
            return [0.0] * 384

        # Try Hugging Face API first if configured to bypass local model
        if settings.DISABLE_LOCAL_EMBEDDINGS:
            hf_emb = await cls._get_hf_api_embedding(text)
            if hf_emb:
                return hf_emb
            return [0.0] * 384

        # Try local model
        try:
            # Load model (this may raise an exception if disabling or OOM/error)
            model = await asyncio.to_thread(cls._get_model)
            # Encode asynchronously in thread pool
            embedding = await asyncio.to_thread(model.encode, text, convert_to_numpy=True)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Local embedding generation failed, trying Hugging Face API fallback: {str(e)}")
            hf_emb = await cls._get_hf_api_embedding(text)
            if hf_emb:
                return hf_emb
            return [0.0] * 384

    @classmethod
    async def _get_hf_api_embedding(cls, text: str) -> Optional[List[float]]:
        """
        Queries the Hugging Face Inference API to generate embeddings.
        """
        url = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"
        headers = {}
        if settings.HF_API_TOKEN:
            headers["Authorization"] = f"Bearer {settings.HF_API_TOKEN}"
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=headers, json={"inputs": text})
                if response.status_code == 200:
                    vector = response.json()
                    if isinstance(vector, list) and len(vector) > 0:
                        if isinstance(vector[0], list):
                            vector = vector[0]
                        return [float(x) for x in vector]
                else:
                    logger.warning(f"Hugging Face API returned status {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Error querying Hugging Face API: {str(e)}")
        return None

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 1500, chunk_overlap: int = 300) -> List[str]:
        """
        Splits text into chunks of character length 'chunk_size' with an overlap 
        of 'chunk_overlap' characters. Splits on paragraph boundaries where possible.
        """
        if not text:
            return []

        # Split content into paragraphs first
        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk = []
        current_length = 0

        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue

            # If a single paragraph is larger than chunk_size, split by sentences or characters
            if len(paragraph) > chunk_size:
                # If we have accumulated text, commit it first
                if current_chunk:
                    chunks.append("\n\n".join(current_chunk))
                    current_chunk = []
                    current_length = 0
                
                # Split large paragraph into sentences or sub-paragraphs
                sentences = re.split(r'(?<=[.!?]) +', paragraph)
                for sentence in sentences:
                    if len(sentence) > chunk_size:
                        # Character chunking fallback for extremely long blocks (e.g. raw logs)
                        for i in range(0, len(sentence), chunk_size - chunk_overlap):
                            chunks.append(sentence[i:i + chunk_size])
                    else:
                        if current_length + len(sentence) > chunk_size:
                            chunks.append("\n\n".join(current_chunk))
                            # Handle overlap
                            overlap_str = "\n\n".join(current_chunk)[-chunk_overlap:] if chunk_overlap > 0 else ""
                            current_chunk = [overlap_str, sentence] if overlap_str else [sentence]
                            current_length = len(overlap_str) + len(sentence)
                        else:
                            current_chunk.append(sentence)
                            current_length += len(sentence)
            else:
                if current_length + len(paragraph) > chunk_size:
                    chunks.append("\n\n".join(current_chunk))
                    # Handle overlap
                    overlap_str = "\n\n".join(current_chunk)[-chunk_overlap:] if chunk_overlap > 0 else ""
                    current_chunk = [overlap_str, paragraph] if overlap_str else [paragraph]
                    current_length = len(overlap_str) + len(paragraph)
                else:
                    current_chunk.append(paragraph)
                    current_length += len(paragraph)

        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        # Filter empty chunks
        return [c.strip() for c in chunks if c.strip()]


# Import re locally in the helper to avoid polluting namespace
import re
