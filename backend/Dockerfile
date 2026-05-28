# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    HOST=0.0.0.0 \
    HF_HOME=/app/.cache/huggingface

# Set the working directory in the container
WORKDIR /app

# Create a non-root user and group for security compliance
RUN groupadd -g 10001 appuser && \
    useradd -u 10001 -g appuser -d /app -s /sbin/nologin -c "App User" appuser

# Install system dependencies (build-essential is useful for compiling any C extensions)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Ensure the app directory and cache directories exist and are owned by appuser
RUN mkdir -p /app/.cache/huggingface && chown -R appuser:appuser /app

# Copy the requirements file under appuser ownership
COPY --chown=appuser:appuser requirements.txt .

# Install Python dependencies as root to install them globally in system python,
# but using cache cleanups.
RUN pip install --no-cache-dir -r requirements.txt

# Switch to the non-root user
USER appuser

# Pre-download the SentenceTransformer model during the build phase.
# This prevents downloading it during container boot and avoids startup timeouts.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy the rest of the application code under appuser ownership
COPY --chown=appuser:appuser . .

# Expose the port the app runs on
EXPOSE 8000

# Run the application
CMD ["sh", "-c", "uvicorn app.main:app --host $HOST --port $PORT"]
