# OfficeMessenger2

OfficeMessenger2 ist ein internes Büro-Messaging als Web-App. Teammitglieder melden sich mit E-Mail und Passwort an, pflegen ein Profil mit Profilbild und Statustext und schreiben miteinander in 1:1- und Gruppenchats. Die Chatliste lässt sich filtern und durchsuchen, ungelesene Nachrichten werden gezählt, und neue Nachrichten erscheinen ohne Neuladen. Dazu gibt es einen Bild-Status im WhatsApp-Stil, der nach 24 Stunden automatisch verschwindet, sowie Gruppen mit Gruppenfoto und Admin-Verwaltung. Alle Daten liegen in PostgreSQL, Bilder werden als Dateien auf dem Server gespeichert und nur mit gültigem Token ausgeliefert.

## Funktionen

- Registrierung und Anmeldung mit E-Mail, Anzeigename und Passwort; die Sitzung bleibt nach einem Seiten-Reload erhalten.
- Profilseite mit Profilbild, Anzeigename, Statustext und E-Mail; Name, Statustext, Passwort und Profilbild lassen sich ändern, das Konto lässt sich löschen.
- Nutzerverzeichnis mit Suchfeld; ein Klick startet den 1:1-Chat.
- Chatliste mit den Filtern „Alle“, „Ungelesen“, „Gruppen“ und „Direkt“, Suchfeld sowie Ungelesen-Zählern.
- Textnachrichten in Echtzeit, Lesebestätigungen mit einem bzw. zwei Haken und Systemhinweisen bei Gruppenänderungen.
- Gruppen mit Name, Foto und Mitgliedern; Admins können umbenennen, das Foto ändern, Mitglieder hinzufügen und entfernen sowie Admin-Rechte vergeben und entziehen.
- Bild-Status mit optionaler Bildunterschrift, Vollbild-Ansicht mit Fortschrittsbalken, Betrachterliste und Ablauf nach 24 Stunden.
- Impressum und Datenschutzerklärung, von jeder Seite aus erreichbar.
- Sicherheit: Argon2-Passwort-Hashes, serverseitig widerrufbare Sitzungen, authentifizierte Datei-Routen, geprüfte Uploads und eine CORS-Konfiguration, die ausschließlich die konfigurierte Frontend-Origin nennt.

## Technik

- **Backend:** Python 3.13, FastAPI, SQLAlchemy, Alembic, WebSockets, Argon2
- **Frontend:** React mit TypeScript und Vite
- **Datenbank:** PostgreSQL 18
- **Dateien:** Bild-Uploads liegen im Backend-Verzeichnis und werden über eine authentifizierte Route ausgeliefert
- **Produktsprache:** Deutsch

## Voraussetzungen

- Python 3.13 oder neuer
- Node.js 22 oder neuer mit npm
- Docker mit Docker Compose (für PostgreSQL)
- Git

## Schnellstart mit einem Kommando

```bash
git clone <repository-url> officemessenger2
cd officemessenger2
./dev.sh
```

Das Skript erledigt alles Nötige:

1. startet PostgreSQL über `docker compose`,
2. wartet, bis die Datenbank erreichbar ist,
3. legt die virtuelle Python-Umgebung `.venv` an und installiert `backend/requirements.txt`,
4. wendet die Alembic-Migrationen an,
5. startet die API auf `http://localhost:8000`,
6. startet das Frontend auf `http://localhost:5173`.

Danach `http://localhost:5173` im Browser öffnen. Mit `Strg+C` werden beide Prozesse beendet; PostgreSQL läuft im Hintergrund weiter und lässt sich mit `docker compose stop db` anhalten.

Unter Windows das Skript in Git Bash oder WSL ausführen oder die manuellen Schritte unten verwenden. `SECRET_KEY` wird beim Start erzeugt, wenn keine Umgebungsvariable gesetzt ist.

## Manueller Start (Entwicklung)

### 1. PostgreSQL starten

```bash
docker compose up -d db
```

Die Datenbank ist danach unter `postgresql://app@localhost:5432/app` erreichbar (Benutzer `app`, Datenbank `app`, keine Passwortabfrage auf dem lokalen Entwicklungsrechner). Das Volume `postgres-data` hält die Daten über Neustarts hinweg.

### 2. API starten

```bash
cd backend
python -m venv ../.venv
source ../.venv/bin/activate        # Windows: ..\.venv\Scripts\activate
pip install -r requirements.txt

export DATABASE_URL="postgresql://app@localhost:5432/app"
export SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
export CORS_ORIGIN="http://localhost:5173"
export UPLOAD_DIR="./uploads"
export MAX_UPLOAD_BYTES="5242880"
export TOKEN_TTL_HOURS="720"

python -m alembic upgrade head
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Die Migrationen laufen zusätzlich bei jedem Start der API automatisch, sodass eine frische Datenbank ohne manuellen Schritt aktuell wird. `GET http://localhost:8000/api/health` antwortet mit `{"status": "ok"}`.

### 3. Frontend starten

```bash
cd frontend
npm install
export VITE_API_BASE_URL="http://localhost:8000"
npm run dev
```

Das Frontend läuft unter `http://localhost:5173` und spricht die API unter `VITE_API_BASE_URL` an.

## Produktions-Build

Frontend:

```bash
cd frontend
npm ci
npm run build
```

Das gebaute Frontend liegt in `frontend/dist` und wird von einem statischen Webserver ausgeliefert. Die API läuft ohne Entwicklungs-Reload:

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Für den produktiven Betrieb `DATABASE_URL`, `CORS_ORIGIN` und `SECRET_KEY` aus der eigenen Konfiguration setzen, das gebaute Frontend hinter denselben Host wie die API legen und `VITE_API_BASE_URL` beim Build auf die öffentliche API-Adresse zeigen lassen.

## Konfiguration

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `DATABASE_URL` | erforderlich | PostgreSQL-Adresse, z. B. `postgresql://app@localhost:5432/app` |
| `CORS_ORIGIN` | `http://localhost:5173` | exakt eine erlaubte Frontend-Origin; ein Wildcard ist nicht zulässig |
| `SECRET_KEY` | erforderlich | geheimer Schlüssel der API; pro Umgebung zufällig erzeugen, niemals einchecken |
| `UPLOAD_DIR` | `./uploads` | Ablageverzeichnis für hochgeladene Bilder |
| `MAX_UPLOAD_BYTES` | `5242880` | maximale Größe eines Uploads in Byte (5 MB) |
| `TOKEN_TTL_HOURS` | `720` | Gültigkeitsdauer einer Sitzung in Stunden (30 Tage) |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Basis-Adresse der API für das Frontend |

`SECRET_KEY` lässt sich zum Beispiel so erzeugen:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

## Demo-Daten

Das Seed-Kommando ist idempotent und kann mehrfach ausgeführt werden:

```bash
cd backend
python -m app.seed
```

Es legt Demo-Benutzer mit Profilbildern, 1:1-Chats, eine Gruppe mit zwei Admins, Nachrichten und einen laufenden Status an. Alle Demo-Konten verwenden dasselbe Passwort.

| E-Mail | Passwort | Rolle |
| --- | --- | --- |
| `anna@demo.local` | `Demo1234!` | Gruppen-Admin |
| `ben@demo.local` | `Demo1234!` | Gruppen-Admin |
| `clara@demo.local` | `Demo1234!` | Gruppenmitglied |
| `david@demo.local` | `Demo1234!` | Gruppenmitglied |
| `emma@demo.local` | `Demo1234!` | Gruppenmitglied |

## Benutzung

### Anmeldung und Registrierung

Auf der Anmeldeseite führen E-Mail und Passwort in die Chatliste. Die Registrierung fragt zusätzlich den Anzeigenamen ab; eine bereits vergebene E-Mail-Adresse wird direkt am Formular gemeldet. Formulare zeigen Fehler erst, nachdem ein Feld berührt oder das Formular abgeschickt wurde. Nach einem Reload bleibt die Sitzung bestehen; „Abmelden“ beendet sie serverseitig und führt zurück zur Anmeldeseite.

### Chatliste

Die Chatliste zeigt alle Unterhaltungen mit letzter Nachricht, Zeitpunkt und Ungelesen-Zähler. Über die Filterchips „Alle“, „Ungelesen“, „Gruppen“ und „Direkt“ lässt sich die Liste einschränken, das Suchfeld filtert nach Namen. Ein Klick auf einen Chat öffnet ihn und setzt den Ungelesen-Zähler auf null. Über das Plus-Menü lassen sich ein neuer 1:1-Chat aus dem Kontaktverzeichnis und eine neue Gruppe anlegen.

### Chat

Im geöffneten Chat stehen Nachrichten mit Absender, Profilbild und Uhrzeit. Texte werden über das Eingabefeld und die Senden-Schaltfläche oder die Eingabetaste verschickt und erscheinen sofort im eigenen Verlauf; bei geöffnetem Chat erreichen sie andere Mitglieder live. Eigene Nachrichten zeigen zunächst einen Haken und nach dem Lesen zwei Haken. Beim Öffnen des Chats werden neue Nachrichten als gelesen markiert.

### Kontakte

Die Kontaktseite listet alle anderen Nutzer mit Profilbild und Namen. Das Suchfeld filtert beim Tippen. Ein Klick auf eine Person öffnet den gemeinsamen 1:1-Chat.

### Gruppen

Beim Anlegen einer Gruppe werden Name, Foto und mindestens ein Mitglied gewählt; die erstellende Person wird Admin. Admins können den Gruppennamen und das Gruppenfoto ändern, Mitglieder hinzufügen und entfernen sowie weitere Admins ernennen und deren Rechte wieder entziehen. Die letzte Admin-Person kann sich nicht selbst degradieren und die Gruppe nicht verlassen; ein einfaches Mitglied kann die Gruppe jederzeit verlassen. Änderungen erscheinen als Systemhinweis im Verlauf.

### Profil

Die Profilseite zeigt Profilbild, Anzeigename, Statustext und E-Mail. Name und Statustext werden gespeichert und sind sofort für andere sichtbar. Ein neues Profilbild (JPEG, PNG oder WebP bis 5 MB) ersetzt das alte; zu große Dateien und andere Dateitypen werden mit einer verständlichen Meldung abgelehnt. Das Passwort lässt sich mit dem aktuellen Passwort ändern, das Konto samt Profilbild und Statusbildern löschen.

### Status

Über den eigenen Status-Eintrag mit „+“ wird ein Bild mit optionaler Bildunterschrift gepostet. Fremde Status erscheinen oben in der Statusleiste und öffnen im Vollbild mit Fortschrittsbalken; ein Tippen wechselt weiter. Angesehene Status sind gekennzeichnet. Der eigene Status zeigt die Betrachterliste mit Namen und Zeitpunkt des Ansehens. Alle Status verschwinden 24 Stunden nach dem Posten.

### Impressum und Datenschutz

Impressum und Datenschutzerklärung sind ohne Anmeldung erreichbar und von jeder Seite der App aus verlinkt.

## API

Basis-Adresse: `http://localhost:8000/api`. Alle geschützten Routen erwarten den Header `Authorization: Bearer <access_token>`. Registrierung, Anmeldung und der Health-Endpunkt benötigen kein Token. Antworten sind JSON; Bilddateien werden als Binärdaten ausgeliefert.

### Fehlerformat

Jede Antwort mit einem Fehlerstatus hat dieselbe Form:

```json
{
  "error": {
    "code": "unauthorized",
    "title_de": "Nicht angemeldet. Bitte melde dich an.",
    "message": "Nicht angemeldet. Bitte melde dich an."
  }
}
```

`title_de` enthält die deutsche Meldung für die Oberfläche, `message` denselben Text als Alias. Häufige Codes sind `unauthorized`, `forbidden`, `not_found`, `validation_error`, `email_taken`, `invalid_upload`, `last_admin` und `rate_limited`.

### Authentifizierung

| Methode | Pfad | Body | Antwort |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | `{email, display_name, password}` | `201 AuthOut` |
| `POST` | `/auth/login` | `{email, password}` | `200 AuthOut` |
| `POST` | `/auth/logout` | – | `204` |
| `GET` | `/auth/me` | – | `200 MeOut` |

### Nutzer, Profil und Dateien

| Methode | Pfad | Body | Antwort |
| --- | --- | --- | --- |
| `GET` | `/users?search=` | – | `200 [UserOut]` |
| `GET` | `/users/{user_id}` | – | `200 UserOut` |
| `PATCH` | `/profile` | `{display_name?, status_text?}` | `200 MeOut` |
| `POST` | `/profile/password` | `{current_password, new_password}` | `204` |
| `POST` | `/profile/avatar` | Multipart-Feld `file` | `200 MeOut` |
| `DELETE` | `/profile` | – | `204` |
| `GET` | `/files/{file_id}` | – | `200` Bilddaten |

### Chats und Nachrichten

| Methode | Pfad | Body | Antwort |
| --- | --- | --- | --- |
| `GET` | `/chats?filter=all\|unread\|groups\|direct&search=` | – | `200 [ChatOut]` |
| `POST` | `/chats/direct` | `{user_id}` | `200 ChatOut` |
| `GET` | `/chats/{chat_id}` | – | `200 ChatOut` |
| `GET` | `/chats/{chat_id}/messages?before=&limit=30` | – | `200 MessagePage` |
| `POST` | `/chats/{chat_id}/messages` | `{text}` | `201 MessageOut` |
| `POST` | `/chats/{chat_id}/read` | `{last_message_id}` | `204` |
| `WS` | `/ws?token=<access_token>` | – | `WsEvent`-Frames |

### Gruppen

| Methode | Pfad | Body | Antwort |
| --- | --- | --- | --- |
| `POST` | `/groups` | `{name, member_ids}` | `201 ChatOut` |
| `PATCH` | `/groups/{chat_id}` | `{name}` | `200 ChatOut` |
| `POST` | `/groups/{chat_id}/photo` | Multipart-Feld `file` | `200 ChatOut` |
| `POST` | `/groups/{chat_id}/members` | `{user_id}` | `200 ChatOut` |
| `DELETE` | `/groups/{chat_id}/members/{user_id}` | – | `200 ChatOut` |
| `POST` | `/groups/{chat_id}/admins` | `{user_id}` | `200 ChatOut` |
| `DELETE` | `/groups/{chat_id}/admins/{user_id}` | – | `200 ChatOut` |
| `POST` | `/groups/{chat_id}/leave` | – | `204` |

### Status

| Methode | Pfad | Body | Antwort |
| --- | --- | --- | --- |
| `GET` | `/status` | – | `200 [StatusGroupOut]` |
| `POST` | `/status` | Multipart-Felder `file`, `caption` (optional) | `201 StatusItemOut` |
| `POST` | `/status/{status_id}/view` | – | `204` |
| `GET` | `/status/{status_id}/viewers` | – | `200 [ViewerOut]` |

### Health

| Methode | Pfad | Body | Antwort |
| --- | --- | --- | --- |
| `GET` | `/health` | – | `200 {"status": "ok"}` |

### Datenformate

`UserOut`

```json
{
  "id": "4f0c7c1e-8f6a-4a8c-9c73-2a1f8fbb1c11",
  "display_name": "Anna Beispiel",
  "status_text": "Im Meeting",
  "avatar_url": "/api/files/9a2b6f4e-1c3d-4e5f-8a7b-0c1d2e3f4a5b"
}
```

`MeOut` ist ein `UserOut` mit zusätzlichem Feld `email`.

`AuthOut`

```json
{
  "access_token": "opaker-sitzungstoken",
  "token_type": "bearer",
  "user": {
    "id": "4f0c7c1e-8f6a-4a8c-9c73-2a1f8fbb1c11",
    "display_name": "Anna Beispiel",
    "status_text": "Im Meeting",
    "avatar_url": "/api/files/9a2b6f4e-1c3d-4e5f-8a7b-0c1d2e3f4a5b",
    "email": "anna@demo.local"
  }
}
```

`ChatOut`

```json
{
  "id": "b3d1a9e2-5c4f-4d6a-9e8b-7f6a5c4d3e2f",
  "kind": "group",
  "title": "Produkt-Team",
  "photo_url": "/api/files/1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d",
  "role": "admin",
  "member_count": 4,
  "unread_count": 2,
  "last_activity_at": "2026-10-19T09:41:00+00:00",
  "last_message": {
    "text": "Bis später!",
    "sender_display_name": "Ben Beispiel",
    "created_at": "2026-10-19T09:41:00+00:00"
  }
}
```

`MessageOut`

```json
{
  "id": 42,
  "chat_id": "b3d1a9e2-5c4f-4d6a-9e8b-7f6a5c4d3e2f",
  "kind": "text",
  "text": "Bis später!",
  "sender": {
    "id": "7e8f9a0b-1c2d-4e3f-8a9b-0c1d2e3f4a5b",
    "display_name": "Ben Beispiel",
    "status_text": null,
    "avatar_url": null
  },
  "created_at": "2026-10-19T09:41:00+00:00",
  "is_read": true
}
```

`MessagePage`

```json
{
  "items": [],
  "has_more": false
}
```

`StatusItemOut`

```json
{
  "id": "d4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f70",
  "image_url": "/api/files/0f1e2d3c-4b5a-4968-8776-655443322110",
  "caption": "Guten Morgen!",
  "created_at": "2026-10-19T07:30:00+00:00",
  "expires_at": "2026-10-20T07:30:00+00:00",
  "seen": false,
  "viewer_count": 0
}
```

`StatusGroupOut`

```json
{
  "user": {
    "id": "4f0c7c1e-8f6a-4a8c-9c73-2a1f8fbb1c11",
    "display_name": "Anna Beispiel",
    "status_text": "Im Meeting",
    "avatar_url": null
  },
  "items": [],
  "has_unseen": false,
  "is_own": true
}
```

`ViewerOut`

```json
{
  "user": {
    "id": "7e8f9a0b-1c2d-4e3f-8a9b-0c1d2e3f4a5b",
    "display_name": "Ben Beispiel",
    "status_text": null,
    "avatar_url": null
  },
  "viewed_at": "2026-10-19T08:05:00+00:00"
}
```

`WsEvent` wird als JSON-Frame über die WebSocket-Verbindung gesendet und hat eine dieser Formen:

```json
{"type": "message:new", "chat_id": "b3d1a9e2-5c4f-4d6a-9e8b-7f6a5c4d3e2f", "message": { }}
```

```json
{
  "type": "message:read",
  "chat_id": "b3d1a9e2-5c4f-4d6a-9e8b-7f6a5c4d3e2f",
  "last_read_message_id": 42,
  "reader_id": "7e8f9a0b-1c2d-4e3f-8a9b-0c1d2e3f4a5b"
}
```

```json
{"type": "chat:updated", "chat_id": "b3d1a9e2-5c4f-4d6a-9e8b-7f6a5c4d3e2f"}
```

## Tests

Die Backend-Tests benötigen eine laufende PostgreSQL-Datenbank und legen ihr eigenes Test-Schema an:

```bash
docker compose up -d db
cd backend
export DATABASE_URL="postgresql://app@localhost:5432/app"
PYTHONPATH=. python -m pytest
```

## Projektstruktur

```text
.
├── backend/
│   ├── alembic/            Migrationen
│   ├── app/
│   │   ├── routers/        API-Routen
│   │   ├── services/       Sicherheit, Uploads und Echtzeit
│   │   ├── config.py       Konfiguration aus der Umgebung
│   │   ├── db.py           Engine, Sitzungen und Datenbank-Abhängigkeit
│   │   ├── deps.py         Token-Prüfung und Chat-Berechtigungen
│   │   ├── errors.py       Einheitliches Fehlerformat
│   │   ├── main.py         App, CORS, Migrationen und Router
│   │   ├── models.py       SQLAlchemy-Modelle
│   │   └── schemas.py      Pydantic-Schemas
│   ├── tests/              pytest-Tests
│   └── requirements.txt
├── frontend/               React-App mit Vite
├── compose.yaml            PostgreSQL für die Entwicklung
├── dev.sh                  startet Datenbank, API und Frontend
└── RUN.json                Startbeschreibung für die Laufzeitumgebung
```
