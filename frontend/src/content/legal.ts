export type LegalInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'link'; text: string; href: string }
  | { type: 'break' };

export type LegalBlock =
  | { type: 'paragraph'; content: LegalInline[] }
  | { type: 'list'; items: LegalInline[][] };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  eyebrow: string;
  title: string;
  intro: string;
  meta: string[];
  sections: LegalSection[];
}

const paragraph = (...content: LegalInline[]): LegalBlock => ({ type: 'paragraph', content });
const list = (...items: LegalInline[][]): LegalBlock => ({ type: 'list', items });
const text = (value: string): LegalInline => ({ type: 'text', text: value });
const strong = (value: string): LegalInline => ({ type: 'strong', text: value });
const link = (value: string, href: string): LegalInline => ({ type: 'link', text: value, href });
const br: LegalInline = { type: 'break' };

export const imprintDocument: LegalDocument = {
  eyebrow: 'Rechtliches · Impressum',
  title: 'Impressum',
  intro:
    'Angaben gemäß § 5 DDG für den internen Messenger von Nordlicht Studio. Diese Seite ist ohne Anmeldung erreichbar.',
  meta: ['Stand: Oktober 2026', 'OfficeMessenger2'],
  sections: [
    {
      heading: 'Anbieter',
      blocks: [
        paragraph(
          text('Nordlicht Studio GmbH'),
          br,
          text('Hafenstraße 12'),
          br,
          text('20457 Hamburg'),
          br,
          text('Deutschland'),
        ),
      ],
    },
    {
      heading: 'Vertretungsberechtigt',
      blocks: [paragraph(text('Geschäftsführung: Anna Weber, David Klein'))],
    },
    {
      heading: 'Kontakt',
      blocks: [
        paragraph(
          text('Telefon: +49 40 123 456 78'),
          br,
          text('E-Mail: '),
          link('impressum@nordlicht.studio', 'mailto:impressum@nordlicht.studio'),
        ),
      ],
    },
    {
      heading: 'Registereintrag',
      blocks: [
        paragraph(
          text('Handelsregister: Amtsgericht Hamburg'),
          br,
          text('Registernummer: HRB 123456'),
          br,
          text('Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE123456789'),
        ),
      ],
    },
    {
      heading: 'Verantwortlich für den Inhalt',
      blocks: [
        paragraph(
          text('Anna Weber'),
          br,
          text('Nordlicht Studio GmbH'),
          br,
          text('Hafenstraße 12, 20457 Hamburg'),
        ),
      ],
    },
    {
      heading: 'Hinweis zum internen Messenger',
      blocks: [
        paragraph(
          text(
            'OfficeMessenger2 ist ein internes Angebot für Mitarbeitende von Nordlicht Studio. Die Nutzung setzt ein Konto im Unternehmen voraus. Externe Registrierungen sind nicht vorgesehen.',
          ),
        ),
      ],
    },
    {
      heading: 'Streitbeilegung',
      blocks: [
        paragraph(
          text(
            'Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
          ),
        ),
      ],
    },
    {
      heading: 'Datenschutz',
      blocks: [
        paragraph(
          text('Informationen zur Verarbeitung personenbezogener Daten findest du in der '),
          link('Datenschutzerklärung', '/datenschutz'),
          text('.'),
        ),
      ],
    },
  ],
};

export const privacyDocument: LegalDocument = {
  eyebrow: 'Rechtliches · Datenschutz',
  title: 'Datenschutzerklärung',
  intro:
    'Wie Nordlicht Studio personenbezogene Daten im internen Messenger OfficeMessenger2 verarbeitet. Diese Seite ist ohne Anmeldung erreichbar.',
  meta: ['Stand: Oktober 2026', 'Gilt für alle Nutzerkonten'],
  sections: [
    {
      heading: '1. Verantwortliche Stelle',
      blocks: [
        paragraph(
          text('Nordlicht Studio GmbH'),
          br,
          text('Hafenstraße 12'),
          br,
          text('20457 Hamburg'),
          br,
          text('E-Mail: '),
          link('datenschutz@nordlicht.studio', 'mailto:datenschutz@nordlicht.studio'),
        ),
        paragraph(
          text(
            'Fragen zum Datenschutz beantwortet unsere Datenschutzbeauftragte Greta Sommer unter derselben Adresse.',
          ),
        ),
      ],
    },
    {
      heading: '2. Zweck und Rechtsgrundlage',
      blocks: [
        paragraph(
          text(
            'OfficeMessenger2 dient der internen Kommunikation und Zusammenarbeit. Wir verarbeiten Konto- und Nutzungsdaten, um den Messenger bereitzustellen, Nachrichten zuzustellen und die im Produkt beschriebenen Funktionen zu ermöglichen.',
          ),
        ),
        paragraph(
          text(
            'Rechtsgrundlage ist die Erfüllung des Beschäftigungsverhältnisses beziehungsweise die berechtigte betriebliche Notwendigkeit nach Art. 6 Abs. 1 lit. b und f DSGVO. Soweit eine Einwilligung erforderlich ist, erfolgt die Verarbeitung auf Grundlage von Art. 6 Abs. 1 lit. a DSGVO.',
          ),
        ),
      ],
    },
    {
      heading: '3. Welche Daten wir verarbeiten',
      blocks: [
        list(
          [
            strong('Kontodaten:'),
            text(' Anzeigename, E-Mail-Adresse, Profilbild, Statustext und Passwort-Hash.'),
          ],
          [
            strong('Kommunikationsdaten:'),
            text(
              ' Nachrichten in 1:1- und Gruppenchats, Zeitstempel, Lesestatus sowie Gruppenmitgliedschaften und Admin-Rollen.',
            ),
          ],
          [
            strong('Statusdaten:'),
            text(
              ' Statusbilder und optionale Bildunterschriften, die nach 24 Stunden automatisch gelöscht werden.',
            ),
          ],
          [
            strong('Technische Daten:'),
            text(
              ' Anmeldezeitpunkt und Sitzungsinformationen, die für den sicheren Betrieb erforderlich sind.',
            ),
          ],
        ),
      ],
    },
    {
      heading: '4. Speicherdauer',
      blocks: [
        paragraph(
          text(
            'Statusbilder und ihre Unterschriften werden nach Ablauf von 24 Stunden gelöscht. Chatnachrichten bleiben bis zur Löschung des Kontos oder bis zu einer berechtigten betrieblichen Löschung gespeichert. Profildaten bleiben bestehen, solange das Konto aktiv ist.',
          ),
        ),
        paragraph(
          text(
            'Nach einer Kontolöschung werden Profil, Profilbild, Statusdaten und Anmeldedaten entfernt. Bereits versendete Nachrichten bleiben für die übrigen Gesprächsteilnehmenden sichtbar, weil sie Teil des gemeinsamen Verlaufs sind.',
          ),
        ),
      ],
    },
    {
      heading: '5. Empfänger und Auftragsverarbeitung',
      blocks: [
        paragraph(
          text(
            'Nachrichten werden innerhalb des Unternehmens an die ausgewählten Personen und Gruppenmitglieder zugestellt. Dienstleister für Hosting und Betrieb werden nur eingesetzt, wenn sie die Anforderungen der DSGVO erfüllen und vertraglich zur Auftragsverarbeitung verpflichtet sind. Eine Weitergabe an Dritte außerhalb dieses Rahmens erfolgt nicht.',
          ),
        ),
      ],
    },
    {
      heading: '6. Deine Rechte',
      blocks: [
        paragraph(
          text(
            'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen.',
          ),
        ),
        paragraph(
          text('Wende dich dafür an '),
          link('datenschutz@nordlicht.studio', 'mailto:datenschutz@nordlicht.studio'),
          text(
            '. Außerdem kannst du dich bei der zuständigen Aufsichtsbehörde beschweren:',
          ),
        ),
        paragraph(
          text('Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit'),
          br,
          text('Ludwig-Erhard-Straße 22'),
          br,
          text('20459 Hamburg'),
        ),
      ],
    },
    {
      heading: '7. Sicherheit',
      blocks: [
        paragraph(
          text(
            'Wir schützen die Daten durch verschlüsselte Verbindungen, rollenbasierte Zugriffe und regelmäßige Prüfungen. Gruppenchats sind nur für ihre Mitglieder sichtbar. Admin-Rechte können ausschließlich von berechtigten Personen vergeben werden.',
          ),
        ),
      ],
    },
    {
      heading: '8. Änderungen dieser Erklärung',
      blocks: [
        paragraph(
          text(
            'Wenn sich Funktionen oder rechtliche Anforderungen ändern, aktualisieren wir diese Datenschutzerklärung. Es gilt die jeweils auf dieser Seite veröffentlichte Fassung.',
          ),
        ),
      ],
    },
    {
      heading: 'Weitere Informationen',
      blocks: [
        paragraph(
          text('Anbieterangaben findest du im '),
          link('Impressum', '/impressum'),
          text('.'),
        ),
      ],
    },
  ],
};

export const legalDocuments = {
  impressum: imprintDocument,
  datenschutz: privacyDocument,
} as const;
