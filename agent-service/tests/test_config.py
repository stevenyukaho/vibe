from src.config import Settings


def test_default_settings_values():
    settings = Settings()
    assert settings.PORT == 5002
    assert settings.HOST == "0.0.0.0"


def test_settings_reads_env_values(monkeypatch):
    monkeypatch.setenv("PORT", "6010")
    monkeypatch.setenv("HOST", "127.0.0.1")
    monkeypatch.setenv("MODEL_PROVIDER_URL", "http://localhost:11434")

    settings = Settings()

    assert settings.PORT == 6010
    assert settings.HOST == "127.0.0.1"
    assert settings.MODEL_PROVIDER_URL == "http://localhost:11434"
