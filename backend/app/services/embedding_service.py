import logging
from typing import List
import numpy as np

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
        Generates a 384-dimensional vector embedding for the input text.
        """
        if not text.strip():
            # Return zero vector if text is empty
            return [0.0] * 384

        try:
            model = cls._get_model()
            # Encode text and convert numpy array to list of standard python floats
            embedding = model.encode(text, convert_to_numpy=True)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
            # Fallback zero vector to prevent failure in processing pipelines
            return [0.0] * 384

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
