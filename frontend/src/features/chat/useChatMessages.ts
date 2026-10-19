import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiError, api, getAccessToken } from '../../lib/api';
import { connectRealtime, subscribe } from '../../lib/realtime';
import type { ChatOut, MessageOut, MessagePage } from '../../lib/types';

const PAGE_SIZE = 30;

export type DeliveryState = 'sending' | 'failed';

export interface ChatMessage extends MessageOut {
  localId?: string;
  delivery?: DeliveryState;
}

let localSequence = 0;

function nextLocalId(): string {
  localSequence += 1;
  return `local-${Date.now()}-${localSequence}`;
}

function nextTemporaryId(): number {
  localSequence += 1;
  return -localSequence;
}

export interface ChatMessagesState {
  chat: ChatOut | null;
  messages: ChatMessage[];
  hasMore: boolean;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  olderError: string | null;
  loadingOlder: boolean;
  loadOlder: () => Promise<void>;
  send: (text: string) => void;
  retry: (localId: string) => void;
}

export function useChatMessages(chatId: string | undefined): ChatMessagesState {
  const { user } = useAuth();
  const [chat, setChat] = useState<ChatOut | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  const loadingOlderRef = useRef(loadingOlder);
  loadingOlderRef.current = loadingOlder;

  const lastReadRef = useRef(0);

  useEffect(() => {
    if (!chatId) {
      setStatus('error');
      setError('Chat nicht gefunden.');
      return;
    }

    let active = true;
    lastReadRef.current = 0;
    setStatus('loading');
    setChat(null);
    setMessages([]);
    setHasMore(false);
    setError(null);
    setOlderError(null);

    Promise.all([
      api.get<ChatOut>(`/api/chats/${chatId}`),
      api.get<MessagePage>(`/api/chats/${chatId}/messages?limit=${PAGE_SIZE}`),
    ])
      .then(([chatResult, page]) => {
        if (!active) {
          return;
        }
        setChat(chatResult);
        setMessages(page.items);
        setHasMore(page.has_more);
        setStatus('ready');
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }
        const message =
          loadError instanceof ApiError
            ? loadError.message
            : 'Der Chat konnte nicht geladen werden.';
        setError(message);
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [chatId]);

  useEffect(() => {
    if (!chatId) {
      return;
    }

    const token = getAccessToken();
    if (token) {
      connectRealtime(token);
    }

    return subscribe((event) => {
      if (event.type === 'message:new') {
        if (event.chat_id !== chatId) {
          return;
        }
        setMessages((current) => {
          if (current.some((message) => message.id === event.message.id)) {
            return current;
          }
          return [...current, event.message];
        });
        return;
      }

      if (event.type === 'message:read') {
        if (event.chat_id !== chatId) {
          return;
        }
        setMessages((current) =>
          current.map((message) =>
            message.sender?.id === user?.id &&
            message.id > 0 &&
            message.id <= event.last_read_message_id
              ? { ...message, is_read: true }
              : message,
          ),
        );
        return;
      }

      if (event.type === 'chat:updated' && event.chat_id === chatId) {
        api
          .get<ChatOut>(`/api/chats/${chatId}`)
          .then((updatedChat) => setChat(updatedChat))
          .catch(() => undefined);
      }
    });
  }, [chatId, user?.id]);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    const newest = [...messages].reverse().find((message) => message.id > 0);
    if (!newest || newest.id <= lastReadRef.current) {
      return;
    }

    lastReadRef.current = newest.id;
    api
      .post<void>(`/api/chats/${chatId}/read`, { last_message_id: newest.id })
      .catch(() => undefined);
  }, [chatId, messages, status]);

  const loadOlder = useCallback(async () => {
    if (!chatId || loadingOlderRef.current || !hasMoreRef.current) {
      return;
    }

    const oldest = messagesRef.current.find((message) => message.id > 0);
    if (!oldest) {
      return;
    }

    setLoadingOlder(true);
    setOlderError(null);
    try {
      const page = await api.get<MessagePage>(
        `/api/chats/${chatId}/messages?before=${oldest.id}&limit=${PAGE_SIZE}`,
      );
      setMessages((current) => {
        const knownIds = new Set(current.map((message) => message.id));
        const older = page.items.filter((message) => !knownIds.has(message.id));
        return [...older, ...current];
      });
      setHasMore(page.has_more);
    } catch (loadError: unknown) {
      setOlderError(
        loadError instanceof ApiError
          ? loadError.message
          : 'Ältere Nachrichten konnten nicht geladen werden.',
      );
    } finally {
      setLoadingOlder(false);
    }
  }, [chatId]);

  const deliver = useCallback(
    async (pending: ChatMessage) => {
      if (!chatId) {
        return;
      }
      try {
        const saved = await api.post<MessageOut>(`/api/chats/${chatId}/messages`, {
          text: pending.text,
        });
        setMessages((current) =>
          current.map((message) =>
            message.localId === pending.localId ? { ...saved } : message,
          ),
        );
      } catch {
        setMessages((current) =>
          current.map((message) =>
            message.localId === pending.localId
              ? { ...message, delivery: 'failed' as const }
              : message,
          ),
        );
      }
    },
    [chatId],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !chatId) {
        return;
      }

      const localId = nextLocalId();
      const pending: ChatMessage = {
        id: nextTemporaryId(),
        chat_id: chatId,
        kind: 'text',
        text: trimmed,
        sender: user
          ? {
              id: user.id,
              display_name: user.display_name,
              status_text: user.status_text,
              avatar_url: user.avatar_url,
            }
          : null,
        created_at: new Date().toISOString(),
        is_read: false,
        localId,
        delivery: 'sending',
      };

      setMessages((current) => [...current, pending]);
      void deliver(pending);
    },
    [chatId, deliver, user],
  );

  const retry = useCallback(
    (localId: string) => {
      const failed = messagesRef.current.find((message) => message.localId === localId);
      if (!failed) {
        return;
      }
      const pending: ChatMessage = { ...failed, delivery: 'sending' };
      setMessages((current) =>
        current.map((message) => (message.localId === localId ? pending : message)),
      );
      void deliver(pending);
    },
    [deliver],
  );

  return {
    chat,
    messages,
    hasMore,
    status,
    error,
    olderError,
    loadingOlder,
    loadOlder,
    send,
    retry,
  };
}
