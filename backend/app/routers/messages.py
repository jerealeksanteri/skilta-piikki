from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.telegram import require_admin
from app.database import get_db
from app.models.message_template import MessageTemplate
from app.models.user import User
from app.schemas.message import MessageTemplateOut, MessageTemplateUpdate
from app.services.audit import diff, record, snapshot

router = APIRouter()


@router.get("/message-templates", response_model=list[MessageTemplateOut])
def list_templates(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.query(MessageTemplate).order_by(MessageTemplate.event_type).all()


@router.put("/message-templates/{template_id}", response_model=MessageTemplateOut)
def update_template(
    template_id: int,
    data: MessageTemplateUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    template = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    before = snapshot(template, "template", "is_active")
    if data.template is not None:
        template.template = data.template
    if data.is_active is not None:
        template.is_active = data.is_active
    changes = diff(before, snapshot(template, "template", "is_active"))
    if changes:
        record(db, admin, "message_template.update", template, label=template.event_type, changes=changes)

    db.commit()
    db.refresh(template)
    return template
