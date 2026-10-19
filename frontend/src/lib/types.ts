export type ChatKind = 'direct' | 'group';

export type MemberRole = 'admin' | 'member';

export type MessageKind = 'text' | 'system';

export interface UserOut {
  id: string;
  display_name: string;
  status_text: string | null;
  avatar_url: string | null;
}

export interface MeOut extends UserOut {
  email: string;
}

export interface AuthOut {
  access_token: string;
  token_type: 'bearer';
  user: MeOut;
}

export interface ChatMemberOut {
  user: UserOut;
  role: MemberRole;
}

export interface ChatLastMessage {
  text: string;
  sender_display_name: string | null;
  created_at: string;
}

export interface ChatOut {
  id: string;
  kind: ChatKind;
  title: string;
  photo_url: string | null;
  role: MemberRole | null;
  member_count: number;
  members: ChatMemberOut[];
  unread_count: number;
  last_activity_at: string | null;
  last_message: ChatLastMessage | null;
}

export interface MessageOut {
  id: number;
  chat_id: string;
  kind: MessageKind;
  text: string;
  sender: UserOut | null;
  created_at: string;
  is_read: boolean;
}

export interface MessagePage {
  items: MessageOut[];
  has_more: boolean;
}

export interface StatusItemOut {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  seen: boolean;
  viewer_count: number;
}

export interface StatusGroupOut {
  user: UserOut;
  items: StatusItemOut[];
  has_unseen: boolean;
  is_own: boolean;
}

export interface ViewerOut {
  user: UserOut;
  viewed_at: string;
}

export type WsEvent =
  | {
      type: 'message:new';
      chat_id: string;
      message: MessageOut;
    }
  | {
      type: 'message:read';
      chat_id: string;
      last_read_message_id: number;
      reader_id: string;
    }
  | {
      type: 'chat:updated';
      chat_id: string;
    };
