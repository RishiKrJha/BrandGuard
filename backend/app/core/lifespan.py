import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
import chromadb
from backend.app.core.config import settings
from backend.app.services.vector_store import VectorStoreService

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan context manager for FastAPI application.
    Initializes ChromaDB persistent client and manages resources lifecycle.
    """
    logger.info("Initializing %s v%s...", settings.APP_NAME, settings.APP_VERSION)

    # Ensure persistence directory exists
    os.makedirs(settings.CHROMA_PERSIST_DIRECTORY, exist_ok=True)

    # Initialize ChromaDB client and VectorStoreService
    try:
        chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIRECTORY)
        chroma_client.heartbeat()
        app.state.chroma_client = chroma_client
        app.state.vector_store = VectorStoreService(client=chroma_client)
        logger.info("ChromaDB client initialized successfully at: %s", settings.CHROMA_PERSIST_DIRECTORY)
    except Exception as exc:
        logger.error("Failed to initialize ChromaDB client: %s", exc)
        app.state.chroma_client = None
        app.state.vector_store = VectorStoreService()

    yield

    # Teardown / shutdown phase
    logger.info("Shutting down %s...", settings.APP_NAME)
    app.state.chroma_client = None
    app.state.vector_store = None
