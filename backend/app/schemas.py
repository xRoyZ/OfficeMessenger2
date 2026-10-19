"""Pydantic schemas for every shape exchanged over the API.

The wire contract between backend and frontend is complete here; feature
tickets only fill the behaviour behind it.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

ChatKind = Literal["direct", "group"]
ChatRole = Literal["admin", "member"]
MessageKind = Literal["text", "system"]
WsEventType = Literal["message:new", "message:read", "chat:updated"]


class _FromAttributes(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(_FromAttributes):
    id: uuid.UUID
    display_name: str
    status_text: str | None = None
    avatar_url: str | None = None


class MeOut(UserOut):
    email: EmailStr


class AuthOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: MeOut


class FileOut(_FromAttributes):
    id: uuid.UUID
    url: str
    content_type: str
    size: int
    kind: str
    created_at: datetime


class LastMessageOut(BaseModel):
    text: str
    sender_display_name: str | None = None
    created_at: datetime


class ChatMemberOut(BaseModel):
    user: UserOut
    role: ChatRole


class ChatOut(BaseModel):
    id: uuid.UUID
    kind: ChatKind
    title: str
    photo_url: str | None = None
    role: ChatRole | None = None
    member_count: int
    members: list[ChatMemberOut]
    unread_count: int
    last_activity_at: datetime | None = None
    last_message: LastMessageOut | None = None


class MessageOut(BaseModel):
    id: int
    chat_id: uuid.UUID
    kind: MessageKind
    text: str
    sender: UserOut | None = None
    created_at: datetime
    is_read: bool


class MessagePage(BaseModel):
    items: list[MessageOut]
    has_more: bool


class StatusItemOut(BaseModel):
    id: uuid.UUID
    image_url: str
    caption: str | None = None
    created_at: datetime
    expires_at: datetime
    seen: bool
    viewer_count: int


class StatusGroupOut(BaseModel):
    user: UserOut
    items: list[StatusItemOut]
    has_unseen: bool
    is_own: bool


class ViewerOut(BaseModel):
    user: UserOut
    viewed_at: datetime


class WsEvent(BaseModel):
    type: WsEventType
    chat_id: uuid.UUID
    message: MessageOut | None = None
    last_read_message_id: int | None = None
    reader_id: uuid.UUID | None = None


class RegisterIn(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdateIn(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    status_text: str | None = Field(default=None, max_length=280)


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class DirectChatIn(BaseModel):
    user_id: uuid.UUID


class MessageCreateIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class ReadReceiptIn(BaseModel):
    last_message_id: int = Field(ge=1)


class GroupCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    member_ids: list[uuid.UUID] = Field(min_length=1)


class GroupUpdateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class GroupMemberIn(BaseModel):
    user_id: uuid.UUID
