import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { legalDocuments, type LegalBlock, type LegalInline } from '../content/legal';
import { AppShell } from '../layout/AppShell';
import './LegalPage.css';

export interface LegalPageProps {
  kind: 'impressum' | 'datenschutz';
}

function renderInline(parts: LegalInline[]): ReactNode {
  return parts.map((part, index) => {
    if (part.type === 'break') {
      return <br key={index} />;
    }

    if (part.type === 'strong') {
      return <strong key={index}>{part.text}</strong>;
    }

    if (part.type === 'link') {
      return part.href.startsWith('/') ? (
        <Link key={index} to={part.href}>
          {part.text}
        </Link>
      ) : (
        <a key={index} href={part.href}>
          {part.text}
        </a>
      );
    }

    return <Fragment key={index}>{part.text}</Fragment>;
  });
}

function renderBlock(block: LegalBlock, index: number): ReactNode {
  if (block.type === 'list') {
    return (
      <ul key={index}>
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  }

  return <p key={index}>{renderInline(block.content)}</p>;
}

export default function LegalPage({ kind }: LegalPageProps) {
  const document = legalDocuments[kind];

  return (
    <AppShell>
      <article className="legal-doc">
        <header className="legal-doc__title">
          <div className="eyebrow">{document.eyebrow}</div>
          <h1>{document.title}</h1>
          <p className="legal-doc__intro">{document.intro}</p>
          <div className="legal-doc__meta">
            {document.meta.map((entry) => (
              <span key={entry}>{entry}</span>
            ))}
          </div>
        </header>
        <div className="legal-doc__content">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.blocks.map(renderBlock)}
            </section>
          ))}
        </div>
      </article>
    </AppShell>
  );
}
