import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.telegram import require_admin
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit import AuditActor, AuditEntryOut, AuditFilters, AuditLogPage

router = APIRouter()


def _to_out(entry: AuditLog) -> AuditEntryOut:
    return AuditEntryOut(
        id=entry.id,
        actor_id=entry.actor_id,
        actor_name=entry.actor_name,
        action=entry.action,
        target_type=entry.target_type,
        target_id=entry.target_id,
        target_label=entry.target_label,
        changes=json.loads(entry.changes) if entry.changes else None,
        note=entry.note,
        created_at=entry.created_at,
    )


@router.get("/admin/audit-log", response_model=AuditLogPage)
def list_audit_log(
    actor_id: int | None = None,
    action: str | None = Query(
        None, description="An exact action (`user.promote`) or a category without a dot (`user`)"
    ),
    before_id: int | None = Query(None, description="Return entries older than this id (next page)"),
    limit: int = Query(50, ge=1, le=200),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin actions, newest first."""
    query = select(AuditLog)
    if actor_id is not None:
        query = query.where(AuditLog.actor_id == actor_id)
    if action:
        if "." in action:
            query = query.where(AuditLog.action == action)
        else:
            query = query.where(AuditLog.action.startswith(f"{action}.", autoescape=True))
    if before_id is not None:
        query = query.where(AuditLog.id < before_id)

    rows = list(db.scalars(query.order_by(AuditLog.id.desc()).limit(limit + 1)))
    return AuditLogPage(entries=[_to_out(r) for r in rows[:limit]], has_more=len(rows) > limit)


@router.get("/admin/audit-log/filters", response_model=AuditFilters)
def audit_log_filters(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """The admins and actions that appear in the log, for the filter menus."""
    actors = db.execute(
        select(AuditLog.actor_id, AuditLog.actor_name)
        .where(AuditLog.actor_id.is_not(None))
        .group_by(AuditLog.actor_id, AuditLog.actor_name)
        .order_by(AuditLog.actor_name)
    ).all()
    seen: dict[int, str] = {}
    for actor_id, name in actors:
        seen.setdefault(actor_id, name)
    actions = db.scalars(select(AuditLog.action).distinct().order_by(AuditLog.action)).all()
    return AuditFilters(
        actors=[AuditActor(id=i, name=n) for i, n in seen.items()],
        actions=list(actions),
    )
