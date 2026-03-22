import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ChatConversation, ChatMessage, ChatParticipant, User, UserProfile
from app.schemas import (
    ChatConversationsResponse,
    ChatConversationListItem,
    ChatDmCreate,
    ChatDmOut,
    ChatMemberFace,
    ChatMessageCreate,
    ChatMessagesResponse,
    ChatMessageOut,
)
from app.security import get_current_user

router = APIRouter(prefix="/chats", tags=["chats"])


def _name_from_email(email: str) -> str:
    local = (email or "").split("@")[0]
    parts = [p for p in re.split(r"[._-]+", local) if p]
    if not parts:
        return "Member"
    return " ".join(p.capitalize() for p in parts)


def _find_dm_between(db: Session, a: int, b: int) -> ChatConversation | None:
    if a == b:
        return None
    ids_a = {
        r.conversation_id
        for r in db.scalars(select(ChatParticipant).where(ChatParticipant.user_id == a)).all()
    }
    for cid in ids_a:
        pids = {
            r.user_id
            for r in db.scalars(
                select(ChatParticipant).where(ChatParticipant.conversation_id == cid)
            ).all()
        }
        if pids == {a, b}:
            return db.get(ChatConversation, cid)
    return None


def _create_dm(db: Session, a: int, b: int) -> ChatConversation:
    conv = ChatConversation()
    db.add(conv)
    db.flush()
    db.add(ChatParticipant(conversation_id=conv.id, user_id=a))
    db.add(ChatParticipant(conversation_id=conv.id, user_id=b))
    return conv


def _message_out(db: Session, m: ChatMessage, me_id: int) -> ChatMessageOut:
    sender = db.get(User, m.sender_id)
    sname = _name_from_email(sender.email) if sender else ""
    return ChatMessageOut(
        id=m.id,
        sender_id=m.sender_id,
        body=m.body,
        created_at=m.created_at,
        is_me=m.sender_id == me_id,
        sender_name=sname,
    )


def _participant_ids(db: Session, conversation_id: int) -> set[int]:
    return {
        r.user_id
        for r in db.scalars(
            select(ChatParticipant).where(ChatParticipant.conversation_id == conversation_id)
        ).all()
    }


@router.get("", response_model=ChatConversationsResponse)
def list_conversations(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatConversationsResponse:
    rows = db.execute(
        select(ChatParticipant.conversation_id).where(ChatParticipant.user_id == current.id)
    ).all()
    cids = [row[0] for row in rows]
    convs: list[ChatConversation] = []
    for cid in cids:
        c = db.get(ChatConversation, cid)
        if c is not None:
            convs.append(c)

    items: list[ChatConversationListItem] = []
    for c in convs:
        part_rows = db.scalars(
            select(ChatParticipant).where(ChatParticipant.conversation_id == c.id)
        ).all()
        member_user_ids = [p.user_id for p in part_rows]
        n_total = len(member_user_ids)
        other_ids = [uid for uid in member_user_ids if uid != current.id]
        if not other_ids:
            continue

        # Join users + profiles so members[] is always populated for the inbox avatars.
        pair_rows = db.execute(
            select(User, UserProfile)
            .select_from(ChatParticipant)
            .join(User, User.id == ChatParticipant.user_id)
            .outerjoin(UserProfile, UserProfile.user_id == User.id)
            .where(
                ChatParticipant.conversation_id == c.id,
                ChatParticipant.user_id != current.id,
            )
            .order_by(User.id)
        ).all()

        is_group = n_total > 2
        members_faces: list[ChatMemberFace] = []
        for row in pair_rows[:4]:
            u = row[0]
            prof = row[1]
            if u is None:
                continue
            au = (prof.avatar_url or "").strip() if prof else ""
            members_faces.append(
                ChatMemberFace(
                    user_id=int(u.id),
                    display_name=_name_from_email(u.email),
                    avatar_url=au or None,
                )
            )

        if len(other_ids) == 1 and pair_rows:
            u_one = pair_rows[0][0]
            display_title = _name_from_email(u_one.email) if u_one else "Chat"
        else:
            custom = (c.title or "").strip()
            if custom:
                display_title = custom
            else:
                names: list[str] = []
                for row in pair_rows:
                    u = row[0]
                    if u:
                        names.append(_name_from_email(u.email))
                display_title = ", ".join(names[:3]) + ("…" if len(names) > 3 else "")

        extra_member_count = max(0, len(other_ids) - 4)

        last = db.scalars(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == c.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(1)
        ).first()
        preview = (last.body or "")[:160] if last else ""
        t = last.created_at if last else c.created_at
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        items.append(
            ChatConversationListItem(
                id=c.id,
                title=display_title,
                preview=preview,
                time=t.isoformat(),
                is_group=is_group,
                members=members_faces,
                extra_member_count=extra_member_count,
            )
        )

    items.sort(key=lambda x: x.time, reverse=True)
    return ChatConversationsResponse(conversations=items)


@router.post("/dm", response_model=ChatDmOut)
def open_or_create_dm(
    body: ChatDmCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatDmOut:
    other_id = body.other_user_id
    if other_id == current.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot chat with yourself")

    other = db.get(User, other_id)
    if other is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = _find_dm_between(db, current.id, other_id)
    if existing is not None:
        return ChatDmOut(
            conversation_id=existing.id,
            title=_name_from_email(other.email),
        )

    conv = _create_dm(db, current.id, other_id)
    db.commit()
    db.refresh(conv)
    return ChatDmOut(
        conversation_id=conv.id,
        title=_name_from_email(other.email),
    )


@router.get("/{conversation_id}/messages", response_model=ChatMessagesResponse)
def list_messages(
    conversation_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatMessagesResponse:
    conv = db.get(ChatConversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    if current.id not in _participant_ids(db, conversation_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not in this conversation")

    msgs = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.asc())
    ).all()

    out = [_message_out(db, m, current.id) for m in msgs]
    return ChatMessagesResponse(messages=out)


@router.post("/{conversation_id}/messages", response_model=ChatMessageOut)
def post_message(
    conversation_id: int,
    body: ChatMessageCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatMessageOut:
    conv = db.get(ChatConversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    if current.id not in _participant_ids(db, conversation_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not in this conversation")

    msg = ChatMessage(
        conversation_id=conversation_id,
        sender_id=current.id,
        body=body.body.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _message_out(db, msg, current.id)
