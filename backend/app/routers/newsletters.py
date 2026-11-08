from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.telegram import require_admin
from app.database import get_db
from app.models.newsletter import Newsletter
from app.models.user import User
from app.schemas.newsletter import AudienceCounts, NewsletterCreate, NewsletterOut
from app.services.newsletters import NewsletterError, NewsletterService

router = APIRouter()


def _to_out(n: Newsletter) -> NewsletterOut:
    return NewsletterOut(
        id=n.id,
        audience=n.audience,
        markup=n.markup,
        html=n.html,
        recipient_count=n.recipient_count,
        delivered_count=n.delivered_count,
        failed_count=n.failed_count,
        created_by_id=n.created_by_id,
        created_by_name=n.created_by.first_name if n.created_by else None,
        created_at=n.created_at,
    )


@router.get("/admin/newsletters/audiences", response_model=AudienceCounts)
def audience_counts(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return NewsletterService.audience_counts(db)


@router.get("/admin/newsletters", response_model=list[NewsletterOut])
def list_newsletters(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return [_to_out(n) for n in NewsletterService.list_recent(db)]


@router.post("/admin/newsletters", response_model=NewsletterOut)
def send_newsletter(
    data: NewsletterCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        newsletter = NewsletterService.send(db, admin, data.audience, data.markup, data.html)
    except NewsletterError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return _to_out(newsletter)
