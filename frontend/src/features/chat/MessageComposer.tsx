import { useState, type FormEvent } from 'react';
import type { ChatKind } from '../../lib/types';

interface MessageComposerProps {
  kind: ChatKind;
  title: string;
  memberCount: number;
  onSend: (text: string) => void;
}

export function MessageComposer({ kind, title, memberCount, onSend }: MessageComposerProps) {
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0;
  const isGroup = kind === 'group';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) {
      return;
    }
    onSend(text);
    setText('');
  };

  return (
    <form className="composer" data-composer={kind} onSubmit={handleSubmit}>
      <div className="composer__row">
        <label className="sr-only" htmlFor="chat-message">
          {`Nachricht an ${title}`}
        </label>
        <input
          className="input composer__input"
          id="chat-message"
          type="text"
          placeholder={isGroup ? 'Nachricht an die Gruppe …' : 'Nachricht schreiben …'}
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button
          className="composer__send"
          type="submit"
          aria-label="Nachricht senden"
          disabled={!canSend}
        >
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m4 12 16-7-5 16-3.4-6.6L4 12Z" />
            <path d="m11.6 14.4 4-4.2" />
          </svg>
        </button>
      </div>
      <p className="composer__hint">
        {isGroup
          ? `Gruppenchat · alle ${memberCount} Mitglieder sehen deine Nachricht`
          : 'Direktnachricht · Enter zum Senden'}
      </p>
    </form>
  );
}
