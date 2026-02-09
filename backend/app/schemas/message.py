from pydantic import BaseModel


class MessageTemplateOut(BaseModel):
    id: int
    event_type: str
    template: str
    is_active: bool

    model_config = {"from_attributes": True}


class MessageTemplateUpdate(BaseModel):
    template: str | None = None
    is_active: bool | None = None
