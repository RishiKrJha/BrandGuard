from fastapi.testclient import TestClient
from backend.app.main import app


def test_health_endpoint():
    """Verify GET /health returns 200 with operational application and ChromaDB status."""
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["app_name"] == "BrandGuard"
        assert "version" in data
        assert data["chroma_status"] == "connected"

