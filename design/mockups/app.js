(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const store = {
    get(key, fallback = null) {
      try {
        const value = sessionStorage.getItem(key);
        return value === null ? fallback : value;
      } catch (error) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        sessionStorage.setItem(key, value);
      } catch (error) {
        return;
      }
    },
    remove(key) {
      try {
        sessionStorage.removeItem(key);
      } catch (error) {
        return;
      }
    }
  };

  const showToast = (message, icon = "check") => {
    const old = $(".toast");
    if (old) old.remove();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `<svg class="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span></span>`;
    toast.querySelector("span").textContent = message;
    if (icon === "info") {
      const svg = toast.querySelector("svg");
      svg.outerHTML = `<svg class="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>`;
    }
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => toast.remove(), 240);
    }, 3600);
  };

  const takeStoredToast = () => {
    const message = store.get("om_toast");
    if (!message) return;
    store.remove("om_toast");
    window.setTimeout(() => showToast(message), 260);
  };

  const formatTime = (date = new Date()) => {
    return new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  };

  const setFieldError = (field, message = "") => {
    if (!field) return;
    const holder = field.closest(".field");
    if (!holder) return;
    holder.classList.toggle("has-error", Boolean(message));
    const output = $(".field__error span", holder);
    if (output && message) output.textContent = message;
    field.setAttribute("aria-invalid", message ? "true" : "false");
  };

  const setFormMessage = (holder, text, kind = "error") => {
    if (!holder) return;
    holder.classList.add("is-visible");
    holder.classList.toggle("form-message--error", kind === "error");
    holder.classList.toggle("form-message--success", kind === "success");
    const copy = $("span", holder);
    if (copy) copy.textContent = text;
  };

  const clearFormMessage = (holder) => {
    if (holder) holder.classList.remove("is-visible");
  };

  const validImage = (file) => {
    if (!file) return { ok: false, message: "Bitte wähle eine Bilddatei aus." };
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      return { ok: false, message: "Bitte wähle eine Datei im Format JPEG, PNG oder WebP." };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { ok: false, message: "Das Bild ist größer als 5 MB. Bitte wähle eine kleinere Datei." };
    }
    return { ok: true };
  };

  const previewFile = (file, image, fallback) => {
    if (!file) {
      if (fallback) image.src = fallback;
      return;
    }
    const url = URL.createObjectURL(file);
    image.src = url;
    image.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
  };

  const closeDialog = (dialog) => {
    if (dialog && typeof dialog.close === "function") dialog.close();
  };

  $$('[data-action="logout"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      store.remove("om_logged_in");
      window.location.href = "login.html";
    });
  });

  document.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-open-dialog]");
    if (opener) {
      event.preventDefault();
      const dialog = document.getElementById(opener.dataset.openDialog);
      if (dialog) dialog.showModal();
    }

    const closer = event.target.closest("[data-close-dialog]");
    if (closer) {
      event.preventDefault();
      closeDialog(closer.closest("dialog"));
    }
  });

  $$("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  const initLogin = () => {
    const form = $("#login-form");
    if (!form) return;
    const email = $("#login-email");
    const password = $("#login-password");
    const error = $("#login-error");

    if (new URLSearchParams(window.location.search).get("konto") === "geloescht") {
      setFormMessage($("#login-success"), "Dein Konto wurde gelöscht. Deine Daten sind nicht mehr abrufbar.", "success");
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      clearFormMessage(error);
      [email, password].forEach((field) => setFieldError(field));
      if (!email.value.trim() || !password.value) {
        if (!email.value.trim()) setFieldError(email, "Bitte gib deine E-Mail-Adresse ein.");
        if (!password.value) setFieldError(password, "Bitte gib dein Passwort ein.");
        return;
      }
      const known = email.value.trim().toLowerCase() === "anna@nordlicht.studio" && password.value === "office2";
      if (!known) {
        setFormMessage(error, "E-Mail-Adresse oder Passwort ist nicht korrekt. Bitte versuche es erneut.");
        return;
      }
      store.set("om_logged_in", "1");
      store.set("om_toast", "Willkommen zurück, Anna.");
      window.location.href = "chats.html";
    });

    [email, password].forEach((field) => {
      field.addEventListener("input", () => setFieldError(field));
    });
  };

  const initRegister = () => {
    const form = $("#register-form");
    if (!form) return;
    const name = $("#register-name");
    const email = $("#register-email");
    const password = $("#register-password");
    const emailError = $("#register-email-error");
    const error = $("#register-error");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      clearFormMessage(error);
      [name, email, password].forEach((field) => setFieldError(field));

      let valid = true;
      if (!name.value.trim()) {
        setFieldError(name, "Bitte gib deinen Anzeigenamen ein.");
        valid = false;
      }
      if (!email.value.trim() || !email.value.includes("@")) {
        setFieldError(email, "Bitte gib eine gültige E-Mail-Adresse ein.");
        valid = false;
      }
      if (password.value.length < 8) {
        setFieldError(password, "Das Passwort muss mindestens 8 Zeichen lang sein.");
        valid = false;
      }
      if (!valid) return;

      if (email.value.trim().toLowerCase() === "anna@nordlicht.studio") {
        setFieldError(email, "");
        emailError.classList.add("is-visible");
        emailError.querySelector("span").textContent = "Diese E-Mail-Adresse ist bereits registriert.";
        return;
      }

      store.set("om_logged_in", "1");
      store.set("om_toast", "Dein Konto ist bereit. Willkommen im Team!");
      window.location.href = "chats.html";
    });

    [name, email, password].forEach((field) => {
      field.addEventListener("input", () => setFieldError(field));
    });

    email.addEventListener("input", () => {
      if (emailError.classList.contains("is-visible")) emailError.classList.remove("is-visible");
    });
  };

  const initChatFilters = () => {
    const list = $("#chat-list");
    if (!list && !$("#contact-results")) return;
    const chips = $$("[data-filter]");
    const search = $("#chat-search");

    let createdGroup = null;
    try {
      createdGroup = JSON.parse(store.get("om_created_group"));
    } catch (error) {
      store.remove("om_created_group");
    }

    if (list && createdGroup && createdGroup.name) {
      const row = document.createElement("a");
      row.className = "chat-row";
      row.href = "group-chat.html?group=neu";
      row.dataset.chatItem = "";
      row.dataset.chatId = "neu";
      row.dataset.kind = "group";
      row.dataset.unread = "0";
      row.dataset.name = createdGroup.name;
      row.dataset.preview = "Du hast die Gruppe erstellt";
      row.innerHTML = `<img class="avatar avatar--md" src="assets/group-generic.svg" alt=""><div class="chat-row__body"><div class="chat-row__top"><span class="chat-row__name"></span><span class="chat-row__time">Jetzt</span></div><div class="chat-row__preview"><span>Du hast die Gruppe erstellt</span></div></div><div class="chat-row__meta"><span class="chat-row__kind">Gruppe</span></div>`;
      $(".chat-row__name", row).textContent = createdGroup.name;
      list.prepend(row);
    }

    const rows = $$("[data-chat-item]", list || document);
    const contacts = $$("[data-contact-result]");
    const contactResults = $("#contact-results");
    const empty = $("#chat-empty");
    const total = $("#unread-total");
    let activeFilter = "all";

    rows.forEach((row) => {
      if (store.get(`om_read_${row.dataset.chatId}`) === "1") {
        row.dataset.unread = "0";
        const count = $(".count", row);
        if (count) count.remove();
        row.classList.remove("is-unread");
      }
    });

    const updateTotal = () => {
      if (total) {
        const sum = rows.reduce((value, row) => value + Number(row.dataset.unread || 0), 0);
        total.textContent = String(sum);
        total.hidden = sum === 0;
      }
      chips.forEach((chip) => {
        const filter = chip.dataset.filter;
        const count = filter === "all"
          ? rows.length
          : filter === "unread"
            ? rows.filter((row) => Number(row.dataset.unread || 0) > 0).length
            : rows.filter((row) => row.dataset.kind === (filter === "groups" ? "group" : filter)).length;
        const node = $(".filter-chip__count", chip);
        if (node) node.textContent = String(count);
      });
    };

    const apply = () => {
      const query = (search ? search.value : "").trim().toLocaleLowerCase("de-DE");
      let visibleChats = 0;
      let visibleContacts = 0;

      rows.forEach((row) => {
        const kind = row.dataset.kind;
        const unread = Number(row.dataset.unread || 0);
        const matchesFilter =
          activeFilter === "all" ||
          (activeFilter === "unread" && unread > 0) ||
          (activeFilter === "groups" && kind === "group") ||
          (activeFilter === "direct" && kind === "direct");
        const matchesSearch = !query || (row.dataset.name || "").toLocaleLowerCase("de-DE").includes(query) || (row.dataset.preview || "").toLocaleLowerCase("de-DE").includes(query);
        const show = matchesFilter && matchesSearch;
        row.hidden = !show;
        if (show) visibleChats += 1;
      });

      contacts.forEach((row) => {
        const matchesSearch = query && (row.dataset.contactName || "").toLocaleLowerCase("de-DE").includes(query);
        row.hidden = !matchesSearch;
        if (matchesSearch) visibleContacts += 1;
      });

      if (contactResults) contactResults.hidden = visibleContacts === 0;

      if (empty) {
        const hasAny = visibleChats > 0 || visibleContacts > 0;
        empty.hidden = hasAny;
        const title = $("h3", empty);
        const copy = $("p", empty);
        if (title && copy) {
          if (query) {
            title.textContent = "Nichts gefunden";
            copy.textContent = "Kein Chat und keine Kontaktperson passt zu deiner Suche.";
          } else if (activeFilter === "unread") {
            title.textContent = "Alles gelesen";
            copy.textContent = "Momentan gibt es keine ungelesenen Chats.";
          } else {
            title.textContent = "Noch keine Chats";
            copy.textContent = "Starte eine Unterhaltung über deine Kontakte.";
          }
        }
      }
      updateTotal();
    };

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((item) => {
          item.classList.toggle("is-active", item === chip);
          item.setAttribute("aria-pressed", item === chip ? "true" : "false");
        });
        activeFilter = chip.dataset.filter;
        apply();
      });
    });

    if (search) search.addEventListener("input", apply);
    updateTotal();
    apply();

    $$("a[data-chat-item]").forEach((link) => {
      link.addEventListener("click", () => {
        if (link.dataset.chatId) store.set(`om_read_${link.dataset.chatId}`, "1");
      });
    });
  };

  const initContactSearch = () => {
    const search = $("#contact-search");
    if (!search) return;
    const cards = $$("[data-contact-card]");
    const empty = $("#contacts-empty");
    const count = $("#contact-count");

    const apply = () => {
      const query = search.value.trim().toLocaleLowerCase("de-DE");
      let visible = 0;
      cards.forEach((card) => {
        const match = !query || (card.dataset.contactName || "").toLocaleLowerCase("de-DE").includes(query);
        card.hidden = !match;
        if (match) visible += 1;
      });
      if (empty) empty.hidden = visible > 0;
      if (count) count.textContent = query ? `${visible} Treffer` : "7 Kolleg:innen";
    };

    search.addEventListener("input", apply);
    apply();
  };

  const initChatThread = () => {
    const directPeople = {
      clara: {
        name: "Clara Nguyen",
        role: "Brand & Content",
        lastActive: "zuletzt aktiv um 08:47",
        avatar: "assets/avatar-clara.svg",
        messages: [
          { from: "them", text: "Hier ist die finale Copy für den Status.", time: "08:41" },
          { from: "me", text: "Danke, ich baue sie direkt in die Vorschau ein.", time: "08:44" },
          { from: "them", text: "Perfekt. Melde dich, wenn etwas fehlt.", time: "08:47" }
        ]
      },
      elif: {
        name: "Elif Yilmaz",
        role: "Produktmanagement",
        lastActive: "zuletzt aktiv um 08:22",
        avatar: "assets/avatar-elif.svg",
        messages: [
          { from: "them", text: "Können wir den Termin auf 14:30 schieben?", time: "08:20" },
          { from: "me", text: "Ja, passt mir gut. Ich schicke eine neue Einladung.", time: "08:22" }
        ]
      },
      farid: {
        name: "Farid Haddad",
        role: "Data",
        lastActive: "zuletzt aktiv um 08:03",
        avatar: "assets/avatar-farid.svg",
        messages: [
          { from: "them", text: "Die Auswertung ist fertig.", time: "07:58" },
          { from: "me", text: "Danke, ich schaue sie mir nach dem Standup an.", time: "08:03" }
        ]
      },
      greta: {
        name: "Greta Sommer",
        role: "People & Culture",
        lastActive: "zuletzt aktiv um 07:40",
        avatar: "assets/avatar-greta.svg",
        messages: [
          { from: "them", text: "Willkommen im Team, Jonas!", time: "07:35" },
          { from: "me", text: "Er startet nächste Woche. Ich habe schon alles vorbereitet.", time: "07:40" }
        ]
      },
      david: {
        name: "David Klein",
        role: "Operations",
        lastActive: "zuletzt aktiv um 09:04",
        avatar: "assets/avatar-david.svg",
        messages: [
          { from: "them", text: "Die Getränke fürs Offsite sind bestellt.", time: "09:01" },
          { from: "me", text: "Super, danke dir. Ich kümmere mich um den Raum.", time: "09:04" }
        ]
      },
      jonas: {
        name: "Jonas Petri",
        role: "QA",
        lastActive: "zuletzt aktiv um 08:16",
        avatar: "assets/avatar-jonas.svg",
        messages: [
          { from: "them", text: "Ich habe die Checkout-Flows einmal durchgeklickt. Zwei kleine Punkte gefunden.", time: "08:12" },
          { from: "me", text: "Danke, schick sie mir gern als Nachricht.", time: "08:16" }
        ]
      }
    };

    const groups = {
      orga: {
        name: "Orga-Team",
        avatar: "assets/group-ops.svg",
        members: "3 Mitglieder · Anna, David, Greta",
        hint: "Gruppenchat · alle 3 Mitglieder sehen deine Nachricht",
        messages: [
          { from: "them", name: "Greta Sommer", avatar: "assets/avatar-greta.svg", text: "Die Teilnehmerliste fürs Offsite ist aktualisiert.", time: "16:48" },
          { from: "me", text: "Danke. Der Raum ist gebucht, Getränke kommen am Donnerstag.", time: "16:55" },
          { from: "them", name: "David Klein", avatar: "assets/avatar-david.svg", text: "Super, ich kümmere mich noch um die Technik.", time: "17:02" },
          { from: "me", text: "Kurzer Check fürs Offsite?", time: "17:12" }
        ]
      }
    };

    const personKey = new URLSearchParams(window.location.search).get("person");
    const groupKey = new URLSearchParams(window.location.search).get("group");

    if (groupKey === "neu") {
      try {
        const created = JSON.parse(store.get("om_created_group"));
        if (created && created.name && Array.isArray(created.members)) {
          const total = created.members.length + 1;
          const firstNames = ["Anna", ...created.members.map((member) => member.name.split(" ")[0])];
          groups.neu = {
            name: created.name,
            avatar: "assets/group-generic.svg",
            members: `${total} Mitglieder · ${firstNames.join(", ")}`,
            hint: `Gruppenchat · alle ${total} Mitglieder sehen deine Nachricht`,
            messages: []
          };
        }
      } catch (error) {
        store.remove("om_created_group");
      }
    }

    if (document.body.dataset.page === "direct-chat" && personKey && directPeople[personKey]) {
      const person = directPeople[personKey];
      document.body.dataset.chatId = personKey;
      document.title = `Chat mit ${person.name} — OfficeMessenger2`;
      const frame = $("[data-od-id='direct-chat-frame']");
      if (frame) frame.setAttribute("aria-label", `Unterhaltung mit ${person.name}`);
      const avatar = $("#chat-person-avatar");
      if (avatar) {
        avatar.src = person.avatar;
        avatar.alt = person.name;
      }
      const name = $("#chat-person-name");
      if (name) name.textContent = person.name;
      const sub = $("#chat-person-sub");
      if (sub) sub.textContent = `${person.role} · ${person.lastActive}`;
      const composerLabel = $("label[for='direct-message']");
      if (composerLabel) composerLabel.textContent = `Nachricht an ${person.name}`;
      const thread = $("#thread");
      if (thread) {
        const messages = person.messages.map((message) => {
          if (message.from === "me") {
            return `<article class="message message--out"><div class="message__content"><div class="message__bubble">${message.text}</div><div class="message__meta"><span>${message.time}</span><span class="receipt" title="Gelesen"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 12 4 4L15 7"/><path d="m10 16 1 1L22 6"/></svg></span></div></div></article>`;
          }
          return `<article class="message"><img class="avatar avatar--sm message__avatar" src="${person.avatar}" alt=""><div class="message__content"><div class="message__sender">${person.name}</div><div class="message__bubble">${message.text}</div><div class="message__meta"><span>${message.time}</span></div></div></article>`;
        }).join("");
        thread.innerHTML = `
          <div class="thread__loader"><button class="btn btn--sm btn--ghost" type="button" disabled>Alle Nachrichten geladen</button></div>
          <div class="day-divider"><span>Heute</span></div>
          ${messages}`;
      }
    }

    if (document.body.dataset.page === "group-chat" && groupKey && groups[groupKey]) {
      const group = groups[groupKey];
      document.body.dataset.chatId = groupKey;
      document.title = `${group.name} — OfficeMessenger2`;
      const frame = $("[data-od-id='group-chat-frame']");
      if (frame) frame.setAttribute("aria-label", `Gruppenchat ${group.name}`);
      $$("[data-group-name]").forEach((node) => { node.textContent = group.name; });
      $$("[data-group-photo]").forEach((image) => {
        image.src = group.avatar;
        image.alt = group.name;
      });
      const sub = $("#group-chat-sub");
      if (sub) sub.textContent = group.members;
      const composerLabel = $("#group-message-label");
      if (composerLabel) composerLabel.textContent = `Nachricht an ${group.name}`;
      const hint = $("#group-composer-hint");
      if (hint) hint.textContent = group.hint;
      const info = $("#group-info-link");
      if (info) info.hidden = true;
      const thread = $("#thread");
      if (thread) {
        const messages = group.messages.map((message) => {
          if (message.from === "me") {
            return `<article class="message message--out"><div class="message__content"><div class="message__bubble">${message.text}</div><div class="message__meta"><span>${message.time}</span><span class="receipt" title="Gelesen"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 12 4 4L15 7"/><path d="m10 16 1 1L22 6"/></svg></span></div></div></article>`;
          }
          return `<article class="message"><img class="avatar avatar--sm message__avatar" src="${message.avatar}" alt=""><div class="message__content"><div class="message__sender">${message.name}</div><div class="message__bubble">${message.text}</div><div class="message__meta"><span>${message.time}</span></div></div></article>`;
        }).join("");
        const empty = `
          <div class="empty-state">
            <div class="empty-state__mark">
              <svg class="icon icon--lg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.4a7.4 7.4 0 0 1-7.4 7.4H8.2L4 22v-5.4a7.4 7.4 0 0 1 4.2-13.2h4.4A7.4 7.4 0 0 1 20 11.4Z"/><path d="M8 9.5h7M8 13h4.5"/></svg>
            </div>
            <h3>Noch keine Nachrichten</h3>
            <p></p>
          </div>`;
        thread.innerHTML = group.messages.length
          ? `<div class="thread__loader"><button class="btn btn--sm btn--ghost" type="button" disabled>Alle Nachrichten geladen</button></div><div class="day-divider"><span>Gestern</span></div>${messages}`
          : empty;
        const emptyText = $(".empty-state p", thread);
        if (emptyText) emptyText.textContent = `Schreib die erste Nachricht an ${group.name}.`;
      }
    }

    const form = $("[data-composer]");
    if (form) {
      const thread = $("#thread");
      const input = $(".composer__input", form);
      const isDirect = form.dataset.composer === "direct";

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (!text || !thread) return;

        const article = document.createElement("article");
        article.className = "message message--out";
        article.innerHTML = `
          <div class="message__content">
            <div class="message__bubble"></div>
            <div class="message__meta">
              <span>${formatTime()}</span>
              ${isDirect ? '<span class="receipt" title="Zugestellt"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 4 4L16 8"/></svg></span>' : ""}
            </div>
          </div>`;
        $(".message__bubble", article).textContent = text;
        thread.appendChild(article);
        input.value = "";
        thread.scrollTop = thread.scrollHeight;
        input.focus();

        if (isDirect) {
          const receipt = $(".receipt", article);
          window.setTimeout(() => {
            receipt.title = "Gelesen";
            receipt.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 12 4 4L15 7"/><path d="m10 16 1 1L22 6"/></svg>';
          }, 1800);
        }
      });
    }

    const loadOlder = $("[data-load-older]");
    if (loadOlder) {
      loadOlder.addEventListener("click", () => {
        const thread = $("#thread");
        if (!thread) return;
        const previous = thread.scrollHeight;
        const older = document.createElement("div");
        older.innerHTML = `
          <div class="day-divider"><span>Gestern</span></div>
          <article class="message">
            <img class="avatar avatar--sm message__avatar" src="assets/avatar-ben.svg" alt="">
            <div class="message__content">
              <div class="message__sender">Ben Osei</div>
              <div class="message__bubble">Die alten Notizen liegen im Projektordner. Ich habe die wichtigsten Punkte markiert.</div>
              <div class="message__meta"><span>17:42</span></div>
            </div>
          </article>
          <article class="message message--out">
            <div class="message__content">
              <div class="message__bubble">Danke, ich nehme sie morgen in den Review mit.</div>
              <div class="message__meta"><span>17:48</span><span class="receipt" title="Gelesen"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 12 4 4L15 7"/><path d="m10 16 1 1L22 6"/></svg></span></div>
            </div>
          </article>`;
        const loader = $(".thread__loader", thread);
        while (older.firstChild) thread.insertBefore(older.firstChild, loader.nextSibling);
        loadOlder.disabled = true;
        loadOlder.textContent = "Alle Nachrichten geladen";
        thread.scrollTop = thread.scrollHeight - previous;
      });
    }

    const chatId = document.body.dataset.chatId;
    if (chatId) store.set(`om_read_${chatId}`, "1");
  };

  const initStatusViewer = () => {
    const stage = $("[data-viewer-stage]");
    if (!stage) return;
    const image = $("#viewer-image");
    const caption = $("#viewer-caption");
    const progress = $(".viewer-progress");
    const statusPeople = {
      clara: {
        name: "Clara Nguyen",
        role: "Brand & Content",
        avatar: "assets/avatar-clara.svg",
        time: "vor 45 Min.",
        panelSub: "2 Bilder · vor 45 Minuten geteilt",
        expiry: "Verschwindet in 23 Stunden",
        slides: [
          { src: "assets/status-focus.svg", alt: "Statusbild von Clara Nguyen: Schreibtisch im Morgenlicht", caption: "Fokusmodus — bitte nicht stören." },
          { src: "assets/status-window.svg", alt: "Statusbild von Clara Nguyen: Morgenlicht im Studio", caption: "Das Morgenlicht im Studio ist einfach unschlagbar." }
        ]
      },
      ben: {
        name: "Ben Osei",
        role: "Engineering",
        avatar: "assets/avatar-ben.svg",
        time: "vor 3 Std.",
        panelSub: "1 Bild · vor 3 Stunden geteilt",
        expiry: "Verschwindet in 21 Stunden",
        slides: [
          { src: "assets/status-window.svg", alt: "Statusbild von Ben Osei: Morgenlicht im Studio", caption: "Erst ein Kaffee, dann die Welt." }
        ]
      },
      elif: {
        name: "Elif Yilmaz",
        role: "Produktmanagement",
        avatar: "assets/avatar-elif.svg",
        time: "vor 5 Std.",
        panelSub: "1 Bild · vor 5 Stunden geteilt",
        expiry: "Verschwindet in 19 Stunden",
        slides: [
          { src: "assets/status-coffee.svg", alt: "Statusbild von Elif Yilmaz: Kaffee am Arbeitsplatz", caption: "Kurze Pause, langer Gedanke." }
        ]
      },
      farid: {
        name: "Farid Haddad",
        role: "Data",
        avatar: "assets/avatar-farid.svg",
        time: "vor 7 Std.",
        panelSub: "1 Bild · vor 7 Stunden geteilt",
        expiry: "Verschwindet in 17 Stunden",
        slides: [
          { src: "assets/status-evening.svg", alt: "Statusbild von Farid Haddad: Abendlicht über der Stadt", caption: "Feierabendlicht über der Stadt." }
        ]
      }
    };

    const requested = new URLSearchParams(window.location.search).get("person") || stage.dataset.person || "clara";
    const key = statusPeople[requested] ? requested : "clara";
    const person = statusPeople[key];
    const slides = person.slides;
    let index = 0;
    let segments = [];

    stage.dataset.person = key;
    if (progress) {
      progress.innerHTML = slides.map((_, slideIndex) => `<div class="viewer-progress__seg${slideIndex === 0 ? " is-active" : ""}" data-viewer-segment><span class="viewer-progress__fill"></span></div>`).join("");
      segments = $$("[data-viewer-segment]", progress);
    }

    document.title = `Status von ${person.name} — OfficeMessenger2`;
    $$("[data-viewer-name]").forEach((node) => { node.textContent = person.name; });
    $$("[data-viewer-sub]").forEach((node) => { node.textContent = `${person.time} · ${person.role}`; });
    $$("[data-viewer-panel-name]").forEach((node) => { node.textContent = person.name; });
    $$("[data-viewer-panel-sub]").forEach((node) => { node.textContent = person.panelSub; });
    $$("[data-viewer-expiry]").forEach((node) => { node.textContent = person.expiry; });
    const personAvatar = $("[data-viewer-avatar]");
    if (personAvatar) {
      personAvatar.src = person.avatar;
      personAvatar.alt = "";
    }
    const stageLabel = $(".viewer-stage");
    if (stageLabel) stageLabel.setAttribute("aria-label", `Status von ${person.name}`);

    $$("[data-viewer-status-item]").forEach((item) => {
      const isCurrent = item.dataset.person === key;
      item.classList.toggle("is-active", isCurrent);
      if (isCurrent) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
      const check = $("[data-viewer-current]", item);
      if (check) check.hidden = !isCurrent;
    });

    const update = () => {
      const slide = slides[index];
      if (!slide) {
        window.location.href = stage.dataset.closeHref || "chats.html";
        return;
      }
      if (image) {
        image.src = slide.src;
        image.alt = slide.alt;
      }
      if (caption) caption.textContent = slide.caption;
      segments.forEach((segment, segmentIndex) => {
        segment.classList.toggle("is-done", segmentIndex < index);
        segment.classList.toggle("is-active", segmentIndex === index);
      });
      if (key) store.set(`om_seen_${key}`, "1");
    };

    const next = () => {
      index += 1;
      if (index >= slides.length) {
        window.location.href = stage.dataset.closeHref || "chats.html";
        return;
      }
      update();
    };

    stage.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      next();
    });

    $$("[data-viewer-next]").forEach((button) => button.addEventListener("click", next));
    $$("[data-viewer-close]").forEach((button) => {
      button.addEventListener("click", () => {
        window.location.href = stage.dataset.closeHref || "chats.html";
      });
    });
    update();
  };

  const initStatusComposer = () => {
    const form = $("#status-form");
    if (!form) return;
    const input = $("#status-image");
    const preview = $("#status-preview-image");
    const previewCaption = $(".status-preview__caption");
    const captionInput = $("#status-caption");
    const error = $("#status-image-error");
    const field = input.closest(".field");
    let hasImage = true;

    captionInput.addEventListener("input", () => {
      if (!previewCaption) return;
      previewCaption.textContent = captionInput.value.trim() || "Dein Status";
    });

    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const check = validImage(file);
      if (!check.ok) {
        error.querySelector("span").textContent = check.message;
        field.classList.add("has-error");
        input.value = "";
        return;
      }
      field.classList.remove("has-error");
      previewFile(file, preview);
      hasImage = true;
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const caption = $("#status-caption");
      if (!hasImage) {
        error.querySelector("span").textContent = "Bitte wähle zuerst ein Bild für deinen Status.";
        field.classList.add("has-error");
        return;
      }
      store.set("om_toast", "Dein Status ist jetzt für dein Team sichtbar.");
      if (caption && caption.value.trim()) store.set("om_last_status_caption", caption.value.trim());
      window.location.href = "chats.html";
    });
  };

  const initProfile = () => {
    const avatarInput = $("#profile-avatar-input");
    if (avatarInput) {
      const avatarError = $("#profile-avatar-error");
      const mainAvatar = $("#profile-avatar");
      const cardAvatar = $("#profile-card-avatar");
      avatarInput.addEventListener("change", () => {
        const file = avatarInput.files && avatarInput.files[0];
        if (!file) return;
        const check = validImage(file);
        if (!check.ok) {
          avatarError.querySelector("span").textContent = check.message;
          avatarError.classList.add("is-visible");
          avatarInput.value = "";
          return;
        }
        avatarError.classList.remove("is-visible");
        previewFile(file, mainAvatar);
        if (cardAvatar) previewFile(file, cardAvatar);
        store.set("om_toast", "Dein neues Profilbild ist gespeichert.");
      });
    }

    const profileForm = $("#profile-form");
    if (profileForm) {
      profileForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = $("#profile-name");
        const info = $("#profile-info");
        const errorName = $("#profile-name-error");
        const success = $("#profile-success");
        setFieldError(name, "");
        errorName.classList.remove("is-visible");
        if (!name.value.trim()) {
          setFieldError(name, "Bitte gib einen Anzeigenamen ein.");
          return;
        }
        const nameNodes = $$("[data-profile-name]");
        nameNodes.forEach((node) => {
          if (node.tagName === "IMG") return;
          node.textContent = name.value.trim();
        });
        const infoNodes = $$("[data-profile-info]");
        infoNodes.forEach((node) => {
          node.textContent = info.value.trim() || "Noch kein Statustext.";
        });
        setFormMessage(success, "Profil gespeichert. Deine Änderungen sind für das Team sichtbar.", "success");
        showToast("Profil gespeichert.");
      });
    }

    const passwordForm = $("#password-form");
    if (passwordForm) {
      passwordForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const current = $("#password-current");
        const next = $("#password-new");
        const repeat = $("#password-repeat");
        const message = $("#password-message");
        [current, next, repeat].forEach((field) => setFieldError(field));
        clearFormMessage(message);
        let valid = true;
        if (!current.value) {
          setFieldError(current, "Bitte gib dein aktuelles Passwort ein.");
          valid = false;
        } else if (current.value !== "office2") {
          setFieldError(current, "Das aktuelle Passwort ist nicht korrekt.");
          valid = false;
        }
        if (next.value.length < 8) {
          setFieldError(next, "Das neue Passwort muss mindestens 8 Zeichen lang sein.");
          valid = false;
        }
        if (repeat.value !== next.value) {
          setFieldError(repeat, "Die Passwörter stimmen nicht überein.");
          valid = false;
        }
        if (!valid) return;
        passwordForm.reset();
        setFormMessage(message, "Passwort geändert. Deine aktuelle Sitzung bleibt bestehen.", "success");
      });
    }

    const deleteForm = $("#delete-account-form");
    if (deleteForm) {
      deleteForm.addEventListener("submit", (event) => {
        event.preventDefault();
        store.remove("om_logged_in");
        window.location.href = "login.html?konto=geloescht";
      });
    }
  };

  const initGroupCreate = () => {
    const form = $("#new-group-form");
    if (!form) return;
    const name = $("#group-name");
    const nameError = $("#group-name-error");
    const memberError = $("#group-member-error");
    const memberCount = $("#selected-count");
    const submit = $("#create-group-submit");
    const photoInput = $("#group-photo-input");
    const photoPreview = $("#group-photo-preview");
    const photoError = $("#group-photo-error");

    const update = () => {
      const selected = $$('input[name="members"]:checked').length;
      if (memberCount) memberCount.textContent = `${selected} ausgewählt`;
      memberError.classList.remove("is-visible");
      return selected;
    };

    $$('input[name="members"]').forEach((box) => box.addEventListener("change", update));

    if (photoInput) {
      photoInput.addEventListener("change", () => {
        const file = photoInput.files && photoInput.files[0];
        if (!file) return;
        const check = validImage(file);
        if (!check.ok) {
          photoError.querySelector("span").textContent = check.message;
          photoError.classList.add("is-visible");
          photoInput.value = "";
          return;
        }
        photoError.classList.remove("is-visible");
        if (photoPreview) {
          photoPreview.innerHTML = "";
          const image = document.createElement("img");
          image.alt = "Vorschau des Gruppenfotos";
          previewFile(file, image);
          photoPreview.appendChild(image);
        }
      });
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const selected = $$('input[name="members"]:checked').length;
      let valid = true;
      if (!name.value.trim()) {
        setFieldError(name, "Bitte gib der Gruppe einen Namen.");
        valid = false;
      }
      if (selected < 1) {
        memberError.classList.add("is-visible");
        memberError.querySelector("span").textContent = "Wähle mindestens eine Person für die Gruppe aus.";
        valid = false;
      }
      if (!valid) return;
      const chosen = $$('input[name="members"]:checked').map((box) => {
        const option = box.closest(".member-option");
        return {
          name: $(".member-option__name", option).textContent.trim(),
          avatar: $("img", option).getAttribute("src")
        };
      });
      store.set("om_created_group", JSON.stringify({ name: name.value.trim(), members: chosen }));
      store.set("om_toast", `„${name.value.trim()}“ wurde erstellt. Du bist Admin.`);
      window.location.href = "group-chat.html?group=neu";
    });

    name.addEventListener("input", () => setFieldError(name, ""));
    update();
    if (submit) submit.disabled = false;
  };

  const initGroupInfo = () => {
    const nameForm = $("#group-name-form");
    if (!nameForm) return;
    const nameInput = $("#group-name-edit");
    const memberRows = () => $$("[data-member-row]");
    const adminCount = () => memberRows().filter((row) => row.dataset.admin === "1").length;
    const renameError = $("#group-name-error");
    const photoInput = $("#group-photo-input");
    const photoError = $("#group-photo-error");
    const photoPreview = $("#group-photo-preview");
    const lastAdminNote = $("#last-admin-note");
    const leaveButton = $("#leave-group");
    const demoteButton = $("#demote-self");
    const addForm = $("#add-member-form");
    const removeDialog = $("#remove-member-dialog");
    let pendingRemoval = null;

    const updateAdminState = () => {
      const isSoleAdmin = adminCount() === 1;
      if (lastAdminNote) lastAdminNote.hidden = !isSoleAdmin;
      if (leaveButton) {
        leaveButton.disabled = isSoleAdmin;
        leaveButton.title = isSoleAdmin ? "Du bist die letzte Admin-Person. Mache zuerst jemand anderen zum Admin." : "";
      }
      if (demoteButton) {
        demoteButton.disabled = isSoleAdmin;
        demoteButton.title = isSoleAdmin ? "Du bist die letzte Admin-Person. Mache zuerst jemand anderen zum Admin." : "";
      }
      const adminCountNode = $("#admin-count");
      if (adminCountNode) adminCountNode.textContent = `${adminCount()} Admin${adminCount() === 1 ? "" : "s"}`;
    };

    nameForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = nameInput.value.trim();
      renameError.classList.remove("is-visible");
      if (!value) {
        setFieldError(nameInput, "Bitte gib einen Gruppennamen ein.");
        return;
      }
      $$("[data-group-name]").forEach((node) => {
        node.textContent = value;
      });
      setFieldError(nameInput, "");
      showToast("Gruppenname gespeichert.");
    });

    nameInput.addEventListener("input", () => setFieldError(nameInput, ""));

    if (photoInput) {
      photoInput.addEventListener("change", () => {
        const file = photoInput.files && photoInput.files[0];
        if (!file) return;
        const check = validImage(file);
        if (!check.ok) {
          photoError.querySelector("span").textContent = check.message;
          photoError.classList.add("is-visible");
          photoInput.value = "";
          return;
        }
        photoError.classList.remove("is-visible");
        $$("[data-group-photo]").forEach((image) => previewFile(file, image));
        showToast("Gruppenfoto aktualisiert.");
      });
    }

    $$("[data-toggle-admin]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest("[data-member-row]");
        if (!row) return;
        const promote = row.dataset.admin !== "1";
        row.dataset.admin = promote ? "1" : "0";
        const badge = $(".admin-badge", row);
        if (badge) badge.hidden = !promote;
        const role = $("[data-member-role]", row);
        if (role) role.textContent = promote ? "Admin" : "Mitglied";
        button.textContent = promote ? "Admin entziehen" : "Zum Admin machen";
        button.classList.toggle("btn--soft", !promote);
        button.classList.toggle("btn--ghost", promote);
        updateAdminState();
        showToast(promote ? "Mitglied ist jetzt Admin." : "Admin-Rechte entzogen.");
      });
    });

    if (demoteButton) {
      demoteButton.addEventListener("click", () => {
        if (adminCount() <= 1) return;
        store.set("om_toast", "Du bist jetzt Mitglied der Gruppe.");
        window.location.href = "group-info-member.html";
      });
    }

    if (leaveButton) {
      leaveButton.addEventListener("click", () => {
        if (leaveButton.disabled) return;
        const dialog = $("#leave-group-dialog");
        if (dialog) dialog.showModal();
      });
    }

    const leaveForm = $("#leave-group-form");
    if (leaveForm) {
      leaveForm.addEventListener("submit", (event) => {
        event.preventDefault();
        store.set("om_toast", "Du hast die Gruppe verlassen.");
        window.location.href = "chats.html";
      });
    }

    $$("[data-remove-member]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest("[data-member-row]");
        if (!row) return;
        pendingRemoval = row;
        const name = $(".member-cell__name", row);
        const label = $("#remove-member-name");
        if (label) label.textContent = name ? name.textContent : "diese Person";
        if (removeDialog) removeDialog.showModal();
      });
    });

    const removeForm = $("#remove-member-form");
    if (removeForm) {
      removeForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (pendingRemoval) {
          pendingRemoval.remove();
          pendingRemoval = null;
          updateAdminState();
          const count = memberRows().length;
          $$("[data-member-count]").forEach((node) => {
            node.textContent = `${count} Mitglieder`;
          });
          if (removeDialog) removeDialog.close();
          showToast("Mitglied wurde entfernt.");
        }
      });
    }

    if (addForm) {
      const addSubmit = $("#add-member-submit");
      const syncAddSubmit = () => {
        if (addSubmit) addSubmit.disabled = !$$('input[name="add-members"]:checked', addForm).length;
      };
      $$('input[name="add-members"]', addForm).forEach((box) => {
        box.addEventListener("change", syncAddSubmit);
      });
      syncAddSubmit();

      addForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const selected = $$('input[name="add-members"]:checked', addForm);
        if (!selected.length) return;
        const body = $("#member-table-body");
        selected.forEach((box) => {
          const row = document.createElement("tr");
          row.dataset.memberRow = "";
          row.dataset.admin = "0";
          row.innerHTML = `
            <td data-label="Person">
              <div class="member-cell">
                <img class="avatar avatar--sm" src="${box.dataset.avatar}" alt="">
                <div>
                  <div class="member-cell__name">${box.dataset.name}</div>
                  <div class="member-cell__info">${box.dataset.info}</div>
                </div>
              </div>
            </td>
            <td data-label="Rolle"><span class="badge" data-member-role>Mitglied</span> <span class="badge badge--accent admin-badge" hidden>Admin</span></td>
            <td data-label="Aktionen">
              <div class="member-actions">
                <button class="btn btn--sm btn--ghost" type="button" data-toggle-admin>Zum Admin machen</button>
                <button class="btn btn--sm btn--ghost" type="button" data-remove-member>Entfernen</button>
              </div>
            </td>`;
          body.appendChild(row);
          row.querySelector("[data-toggle-admin]").addEventListener("click", () => {
            const toggle = $("[data-toggle-admin]", row);
            const promote = row.dataset.admin !== "1";
            row.dataset.admin = promote ? "1" : "0";
            const badge = $(".admin-badge", row);
            if (badge) badge.hidden = !promote;
            const role = $("[data-member-role]", row);
            if (role) role.textContent = promote ? "Admin" : "Mitglied";
            toggle.textContent = promote ? "Admin entziehen" : "Zum Admin machen";
            toggle.classList.toggle("btn--soft", !promote);
            toggle.classList.toggle("btn--ghost", promote);
            updateAdminState();
            showToast(promote ? "Mitglied ist jetzt Admin." : "Admin-Rechte entzogen.");
          });
          row.querySelector("[data-remove-member]").addEventListener("click", () => {
            pendingRemoval = row;
            const name = $(".member-cell__name", row);
            const label = $("#remove-member-name");
            if (label) label.textContent = name ? name.textContent : "diese Person";
            if (removeDialog) removeDialog.showModal();
          });
          box.checked = false;
        });
        syncAddSubmit();
        const count = memberRows().length;
        $$("[data-member-count]").forEach((node) => {
          node.textContent = `${count} Mitglieder`;
        });
        updateAdminState();
        addForm.closest("dialog").close();
        showToast("Mitglieder hinzugefügt.");
      });
    }

    const memberSearch = $("#member-search");
    if (memberSearch) {
      memberSearch.addEventListener("input", () => {
        const query = memberSearch.value.trim().toLocaleLowerCase("de-DE");
        $$("[data-member-row]").forEach((row) => {
          row.hidden = Boolean(query) && !row.textContent.toLocaleLowerCase("de-DE").includes(query);
        });
      });
    }

    updateAdminState();
  };

  const initMemberView = () => {
    const form = $("#leave-member-group-form");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      store.set("om_toast", "Du hast die Gruppe verlassen.");
      window.location.href = "chats.html";
    });
  };

  if (document.body.dataset.page === "login") initLogin();
  if (document.body.dataset.page === "register") initRegister();
  if (document.body.dataset.page === "chats") initChatFilters();
  if (document.body.dataset.page === "contacts") initContactSearch();
  if (document.body.dataset.page === "direct-chat" || document.body.dataset.page === "group-chat") initChatThread();
  if (document.body.dataset.page === "status-viewer" || document.body.dataset.page === "status-viewer-own") initStatusViewer();
  if (document.body.dataset.page === "status-create") initStatusComposer();
  if (document.body.dataset.page === "profile") initProfile();
  if (document.body.dataset.page === "new-group") initGroupCreate();
  if (document.body.dataset.page === "group-info") initGroupInfo();
  if (document.body.dataset.page === "group-info-member") initMemberView();

  takeStoredToast();
})();
