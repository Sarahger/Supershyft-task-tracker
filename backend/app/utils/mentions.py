import re

from sqlalchemy.orm import Session

from app.models import User

MENTION_PATTERN = re.compile(r"@([\w]+(?:\s[\w]+)?)")


def resolve_mentioned_user_ids(
    content: str,
    db: Session,
    explicit_ids: list[int] | None = None,
) -> set[int]:
    """Resolve @mentions in comment text to user IDs."""
    result = set(explicit_ids or [])
    users = db.query(User).filter(User.status != "inactive").all()
    if not users:
        return result

    lookup: dict[str, int] = {}
    for user in users:
        full = user.full_name.lower()
        lookup[full] = user.id
        lookup[user.first_name.lower()] = user.id
        lookup[user.email.split("@")[0].lower()] = user.id

    for match in MENTION_PATTERN.finditer(content):
        token = match.group(1).strip().lower()
        if token in lookup:
            result.add(lookup[token])
            continue
        for full_name, user_id in lookup.items():
            if " " in full_name and (full_name == token or full_name.startswith(f"{token} ")):
                result.add(user_id)
                break

    return result
