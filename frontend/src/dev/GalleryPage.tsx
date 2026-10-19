import { useState } from 'react';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  ChatRow,
  ContactCard,
  DropdownMenu,
  EmptyState,
  FilterChip,
  FormField,
  IconButton,
  ListRow,
  Modal,
  PasswordField,
  SearchField,
  Skeleton,
  SkeletonText,
  Spinner,
  TextField,
  TextareaField,
  UnreadBadge,
} from '../components';
import { AppShell } from '../layout/AppShell';
import demoAvatar from './avatar-anna.svg';

type Filter = 'all' | 'unread' | 'groups' | 'direct';

const FILTERS: Array<{ id: Filter; label: string; count: number }> = [
  { id: 'all', label: 'Alle', count: 7 },
  { id: 'unread', label: 'Ungelesen', count: 3 },
  { id: 'groups', label: 'Gruppen', count: 2 },
  { id: 'direct', label: 'Direkt', count: 5 },
];

function ChevronIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h9" />
    </svg>
  );
}

export default function GalleryPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuChoice, setMenuChoice] = useState<string | null>(null);

  return (
    <AppShell>
      <header className="page-header">
        <div className="page-header__copy">
          <div className="eyebrow">Entwicklung · nur im Dev-Build</div>
          <h1>UI-Kit</h1>
          <p className="page-subtitle">
            Jede Komponente in jeder Zustandsform der freigegebenen Screens. Farben, Abstände und
            Radien kommen ausschließlich aus den Design-Tokens.
          </p>
        </div>
        <div className="page-actions">
          <Badge variant="outline">/dev/kit</Badge>
        </div>
      </header>

      <div className="kit-stack">
        <section className="card card--pad kit-section" aria-labelledby="kit-buttons">
          <div className="kit-section__head">
            <h2 id="kit-buttons">Buttons</h2>
            <span className="eyebrow">Varianten · Größen · Zustände</span>
          </div>

          <div className="kit-state">
            <span className="eyebrow">Varianten</span>
            <div className="kit-row">
              <Button variant="primary">Primär</Button>
              <Button variant="accent">Akzent</Button>
              <Button variant="soft">Weich</Button>
              <Button variant="outline">Kontur</Button>
              <Button variant="ghost">Geist</Button>
              <Button variant="danger">Gefahr</Button>
            </div>
          </div>

          <div className="kit-state">
            <span className="eyebrow">Größen</span>
            <div className="kit-row">
              <Button size="sm" variant="outline">
                Klein
              </Button>
              <Button size="md" variant="outline">
                Mittel
              </Button>
              <Button size="lg" variant="outline">
                Groß
              </Button>
            </div>
          </div>

          <div className="kit-state">
            <span className="eyebrow">Zustände</span>
            <div className="kit-row">
              <Button variant="primary">Aktiv</Button>
              <Button variant="primary" disabled>
                Deaktiviert
              </Button>
              <Button variant="primary" loading>
                Speichern
              </Button>
              <IconButton variant="outline" label="Mehr Optionen">
                <MenuIcon />
              </IconButton>
              <IconButton variant="ghost" size="sm" label="Nächster Schritt">
                <ChevronIcon />
              </IconButton>
            </div>
          </div>

          <div className="kit-state kit-block-demo">
            <span className="eyebrow">Volle Breite</span>
            <Button variant="accent" block>
              Volle Breite
            </Button>
          </div>
        </section>

        <section className="card card--pad kit-section" aria-labelledby="kit-fields">
          <div className="kit-section__head">
            <h2 id="kit-fields">Formularfelder</h2>
            <span className="eyebrow">Neutral · Hinweis · Fehler</span>
          </div>

          <div className="form-grid">
            <TextField
              label="Anzeigename"
              defaultValue="Anna Weber"
              hint="So erscheinst du im Team."
            />
            <TextField
              label="E-Mail-Adresse"
              defaultValue="anna@"
              error="Bitte gib eine gültige E-Mail-Adresse ein."
            />
            <PasswordField label="Passwort" hint="Mindestens 8 Zeichen." />
            <TextField label="Schreibgeschützt" defaultValue="anna@nordlicht.studio" readOnly />
          </div>

          <TextareaField
            label="Statustext"
            defaultValue="Produktdesign bei Nordlicht Studio."
            hint="Bis zu 160 Zeichen. Erscheint unter deinem Namen im Profil."
          />

          <FormField
            label="Telefonnummer"
            htmlFor="kit-phone"
            hint="Nur für dein Team sichtbar."
          >
            <input className="input" id="kit-phone" type="tel" placeholder="+49 …" />
          </FormField>

          <SearchField
            label="Chats und Kontakte suchen"
            placeholder="Chats und Kontakte suchen …"
          />
        </section>

        <section className="card card--pad kit-section" aria-labelledby="kit-avatars">
          <div className="kit-section__head">
            <h2 id="kit-avatars">Avatare, Badges & Zähler</h2>
            <span className="eyebrow">Größen · Initialen · Varianten</span>
          </div>

          <div className="kit-state">
            <span className="eyebrow">Größen mit Initialen-Fallback</span>
            <div className="kit-row">
              <Avatar name="Anna Weber" size="xs" />
              <Avatar name="Anna Weber" size="sm" />
              <Avatar name="Anna Weber" size="md" />
              <Avatar name="Anna Weber" size="lg" />
              <Avatar name="Anna Weber" size="xl" />
              <Avatar name="Anna Weber" size="xxl" />
              <Avatar name="Anna Weber" size="md" src={demoAvatar} />
              <Avatar name="Jonas Petri" size="md" />
            </div>
          </div>

          <div className="kit-state">
            <span className="eyebrow">Badges</span>
            <div className="kit-row">
              <Badge>Status</Badge>
              <Badge variant="accent">Admin</Badge>
              <Badge variant="warning">Ausstehend</Badge>
              <Badge variant="danger">Gelöscht</Badge>
              <Badge variant="outline">Du</Badge>
              <Badge variant="solid">Neu</Badge>
            </div>
          </div>

          <div className="kit-state">
            <span className="eyebrow">Ungelesen-Zähler</span>
            <div className="kit-row">
              <UnreadBadge count={3} />
              <UnreadBadge count={27} />
              <UnreadBadge count={130} max={99} />
            </div>
          </div>
        </section>

        <section className="card card--pad kit-section" aria-labelledby="kit-filters">
          <div className="kit-section__head">
            <h2 id="kit-filters">Filter-Chips</h2>
            <span className="eyebrow">Ruhe · Hover · Ausgewählt</span>
          </div>
          <div className="filter-bar" role="group" aria-label="Chats nach Art filtern">
            {FILTERS.map((entry) => (
              <FilterChip
                key={entry.id}
                selected={filter === entry.id}
                count={entry.count}
                onClick={() => setFilter(entry.id)}
              >
                {entry.label}
              </FilterChip>
            ))}
          </div>
        </section>

        <section className="card card--pad kit-section" aria-labelledby="kit-rows">
          <div className="kit-section__head">
            <h2 id="kit-rows">Listen & Karten</h2>
            <span className="eyebrow">Chat-Zeile · Kontaktkarte · Listenzeile</span>
          </div>

          <div className="inbox-list">
            <div className="chat-list">
              <ChatRow
                to="/chats/demo-group"
                title="Produkt & Design"
                preview="Clara: Die neuen Screens liegen im Review."
                time="09:42"
                kind="group"
                unreadCount={3}
              />
              <ChatRow
                to="/chats/demo-ben"
                title="Ben Osei"
                preview="Danke, ich schaue nach dem Call drüber."
                time="09:18"
                kind="direct"
                unreadCount={0}
              />
            </div>
          </div>

          <div className="kit-grid">
            <div className="kit-state">
              <span className="eyebrow">Kontaktkarte</span>
              <div className="contact-grid">
                <ContactCard
                  to="/chats/demo-clara"
                  name="Clara Nguyen"
                  info="Brand & Content · Worte, die bleiben."
                />
              </div>
            </div>

            <div className="kit-state">
              <span className="eyebrow">Listenzeilen</span>
              <div className="inbox-list">
                <ListRow
                  to="/kontakte"
                  leading={<Avatar name="Greta Sommer" size="sm" />}
                  title="Greta Sommer"
                  subtitle="People & Culture"
                  trailing={<ChevronIcon />}
                />
                <ListRow
                  leading={<Avatar name="David Klein" size="sm" />}
                  title="David Klein"
                  subtitle="Operations"
                  selected
                  onClick={() => setFilter('all')}
                />
                <ListRow
                  leading={<Avatar name="Jonas Petri" size="sm" />}
                  title="Jonas Petri"
                  subtitle="QA · nicht verfügbar"
                  disabled
                />
              </div>
            </div>
          </div>
        </section>

        <section className="card card--pad kit-section" aria-labelledby="kit-feedback">
          <div className="kit-section__head">
            <h2 id="kit-feedback">Hinweise & Leerzustände</h2>
            <span className="eyebrow">Fehler · Erfolg · Info · Warnung</span>
          </div>

          <div className="form-stack">
            <Banner variant="error">Bitte prüfe deine Angaben und versuche es erneut.</Banner>
            <Banner variant="success">Profil gespeichert. Dein Team sieht die Änderung sofort.</Banner>
            <Banner variant="info">
              Alle ausgewählten Personen sehen den Chatverlauf ab dem Zeitpunkt ihres Beitritts.
            </Banner>
            <Banner variant="warning">
              Du bist die letzte Admin-Person. Mache zuerst jemand anderen zum Admin.
            </Banner>
          </div>

          <div className="kit-grid kit-grid--wide">
            <EmptyState
              title="Nichts gefunden"
              description="Kein Chat und keine Kontaktperson passt zu deiner Suche."
              action={
                <Button variant="soft" size="sm" onClick={() => setFilter('all')}>
                  Filter zurücksetzen
                </Button>
              }
            />
            <div className="panel">
              <div className="stack gap-4">
                <div className="stack gap-2">
                  <span className="eyebrow">Spinner</span>
                  <div className="kit-row">
                    <Spinner size="sm" label="Kleine Ladung" />
                    <Spinner label="Ladung" />
                    <Spinner size="lg" label="Große Ladung" />
                  </div>
                </div>
                <div className="stack gap-2">
                  <span className="eyebrow">Skelett</span>
                  <div className="kit-row">
                    <Skeleton variant="circle" width={40} height={40} />
                    <Skeleton variant="block" width={120} height={40} />
                  </div>
                  <SkeletonText lines={3} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card card--pad kit-section" aria-labelledby="kit-dialog">
          <div className="kit-section__head">
            <h2 id="kit-dialog">Dialog</h2>
            <span className="eyebrow">Geschlossen · Offen</span>
          </div>
          <div className="kit-row">
            <Button variant="danger" onClick={() => setDialogOpen(true)}>
              Dialog öffnen
            </Button>
          </div>
          <Modal
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Konto löschen?"
            description="Diese Aktion kann nicht rückgängig gemacht werden."
            warning="Dein Profil, deine Statusbilder und deine Anmeldung werden gelöscht. Deine Nachrichten bleiben für die anderen Mitglieder sichtbar."
            actions={
              <>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button variant="danger" onClick={() => setDialogOpen(false)}>
                  Konto endgültig löschen
                </Button>
              </>
            }
          />
        </section>

        <section className="card card--pad kit-section" aria-labelledby="kit-menu">
          <div className="kit-section__head">
            <h2 id="kit-menu">Dropdown-Menü</h2>
            <span className="eyebrow">Geschlossen · Offen · Aktion</span>
          </div>
          <div className="kit-row">
            <DropdownMenu
              label="Kit-Menü"
              triggerClassName="kit-menu-trigger"
              trigger={
                <>
                  <MenuIcon />
                  <span>Menü</span>
                </>
              }
              items={[
                { label: 'Profil öffnen', onSelect: () => setMenuChoice('Profil öffnen') },
                { label: 'Einstellungen', onSelect: () => setMenuChoice('Einstellungen') },
                { label: 'Demnächst', disabled: true },
                { label: 'Abmelden', danger: true, onSelect: () => setMenuChoice('Abmelden') },
              ]}
            />
          </div>
          {menuChoice ? (
            <Banner variant="info">Menüaktion ausgelöst: {menuChoice}</Banner>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
