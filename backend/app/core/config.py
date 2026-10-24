from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application runtime settings loaded from environment or .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "BrandGuard"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"

    # Gemini LLM configuration
    GEMINI_API_KEY: str = Field(
        default="",
        description="Google Gemini API key for multimodal brand analysis",
    )
    GEMINI_MODEL: str = "gemini-1.5-pro"

    # ChromaDB Vector Store configuration
    CHROMA_PERSIST_DIRECTORY: str = "backend/chroma_data"
    CHROMA_COLLECTION_NAME: str = "brand_guidelines"

    # CORS configuration (comma-separated origins)
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        description="Comma-separated allowed origins for CORS",
    )


settings = Settings()

