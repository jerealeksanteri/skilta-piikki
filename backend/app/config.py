from pydantic import computed_field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    BOT_TOKEN: str = ""
    DATABASE_URL: str = "postgresql://piikki:piikki@db:5432/piikki"
    ADMIN_TELEGRAM_IDS: str = ""
    AUTO_APPROVE_PURCHASES: bool = True
    CORS_ORIGINS: str = "*"
    DEV_MODE: bool = False

    model_config = {"env_file": ".env", "secrets_dir": "/run/secrets"}

    @computed_field
    @property
    def admin_ids(self) -> list[int]:
        if not self.ADMIN_TELEGRAM_IDS:
            return []
        return [int(x.strip()) for x in self.ADMIN_TELEGRAM_IDS.split(",") if x.strip()]

    @computed_field
    @property
    def cors_origins_list(self) -> list[str]:
        return [x.strip() for x in self.CORS_ORIGINS.split(",") if x.strip()]


settings = Settings()
