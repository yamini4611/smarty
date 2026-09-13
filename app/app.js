/* ==========================================================================
   Ballast — Personal Commitments Dashboard
   Vanilla JS, no build step, no server. Everything persists to
   localStorage on the device it runs on (see README for the tradeoffs).
   ========================================================================== */
(() => {
  "use strict";

  /* ---------------------------------------------------------- constants */
  const STORAGE_KEY = "ballast.v1";

  const AREAS = [
    { id: "work", label: "Work", color: "var(--area-work)", keywords: ["work", "meeting", "client", "project", "deadline", "report", "email", "boss", "presentation", "interview", "colleague", "invoice"] },
    { id: "home", label: "Home", color: "var(--area-home)", keywords: ["home", "house", "cabinet", "contractor", "repair", "plumber", "rent", "lease", "grocery", "clean", "laundry", "car", "insurance", "bill"] },
    { id: "family", label: "Family", color: "var(--area-family)", keywords: ["family", "mom", "dad", "son", "daughter", "kid", "kids", "wife", "husband", "parent", "school", "wedding", "venue", "anniversary"] },
    { id: "social", label: "Social", color: "var(--area-social)", keywords: ["friend", "friends", "dinner", "party", "birthday", "hang out", "catch up", "reunion", "wedding", "coffee with"] },
    { id: "growth", label: "Personal Growth", color: "var(--area-growth)", keywords: ["course", "class", "learn", "read", "book", "study", "resume", "network", "mentor", "certification", "journal"] },
    { id: "hobbies", label: "Hobbies", color: "var(--area-hobbies)", keywords: ["flute", "guitar", "piano", "paint", "hobby", "garden", "hike", "run", "practice", "photography", "cook", "recipe"] },
  ];
  const AREA_MAP = Object.fromEntries(AREAS.map((a) => [a.id, a]));

  const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const WEEKDAY_FULL = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z"/></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 12l5 5L20 6"/></svg>';

  /* ---------------------------------------------------------- date helpers */
  const pad = (n) => String(n).padStart(2, "0");
  const fmtISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
  const todayISO = () => fmtISO(new Date());

  function nextWeekday(base, targetDow) {
    const d = new Date(base);
    let diff = (targetDow - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function fmtDueDate(iso) {
    const d = parseISO(iso);
    const t = startOfDay(new Date());
    const delta = daysBetween(t, d);
    if (delta === 0) return "Today";
    if (delta === 1) return "Tomorrow";
    if (delta === -1) return "Yesterday";
    if (delta > 1 && delta < 7) return WEEKDAY_ABBR[d.getDay()];
    return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  }

  function fmtTime12(hhmm) {
    if (!hhmm) return "";
    let [h, m] = hhmm.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}${m ? ":" + pad(m) : ""} ${ap}`;
  }

  const capitalizeFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const titleCase = (s) => s.split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)).join(" ").trim();
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));

  /* ---------------------------------------------------------- store */
  function defaultState() {
    return {
      onboarded: false,
      settings: {
        areas: AREAS.map((a) => a.id),
        dailyStart: "08:00",
        weeklyReviewDay: 0,
        reminderStyle: "gentle",
        dailyBriefing: true,
        askBeforeScheduling: true,
      },
      items: [],
      projects: [],
    };
  }

  function seedExamples(state) {
    const today = todayISO();
    const tomorrow = fmtISO((() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })());
    state.items.push(
      { id: uid(), title: "Send project update", area: "work", projectId: null, dueDate: today, dueTime: null, priority: "now", recurring: { freq: "none" }, done: false, createdAt: Date.now(), rawInput: "Send project update", areaGuessed: false },
      { id: uid(), title: "Book venue walkthrough", area: "family", projectId: null, dueDate: tomorrow, dueTime: null, priority: "soon", recurring: { freq: "none" }, done: false, createdAt: Date.now(), rawInput: "Book venue walkthrough", areaGuessed: false },
      { id: uid(), title: "Flute practice", area: "hobbies", projectId: null, dueDate: today, dueTime: "19:00", priority: "later", recurring: { freq: "weekly" }, done: false, createdAt: Date.now(), rawInput: "Flute practice every week at 7pm", areaGuessed: false }
    );
  }

  const Store = {
    state: null,
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        this.state = raw ? JSON.parse(raw) : defaultState();
      } catch {
        this.state = defaultState();
      }
      return this.state;
    },
    save() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch { /* storage unavailable — app still works in-memory */ }
    },
    clear() {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    },
  };

  const state = Store.load();

  /* ---------------------------------------------------------- capture parser */
  function parseCapture(rawText, activeAreaIds) {
    const text = rawText.trim();
    let working = text;
    const now = new Date();
    const strip = (m) => { if (m) working = working.slice(0, m.index) + " " + working.slice(m.index + m[0].length); };

    let recurring = { freq: "none" };
    let m;
    if ((m = working.match(/\bevery\s+day\b|\bdaily\b/i))) { recurring.freq = "daily"; strip(m); }
    else if ((m = working.match(/\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i))) { recurring.freq = "weekly"; strip(m); }
    else if ((m = working.match(/\bevery\s+week\b|\bweekly\b/i))) { recurring.freq = "weekly"; strip(m); }
    else if ((m = working.match(/\bevery\s+month\b|\bmonthly\b/i))) { recurring.freq = "monthly"; strip(m); }

    let dueDate = null;
    if ((m = working.match(/\btoday\b/i))) { dueDate = fmtISO(now); strip(m); }
    else if ((m = working.match(/\btomorrow\b/i))) { const d = new Date(now); d.setDate(d.getDate() + 1); dueDate = fmtISO(d); strip(m); }
    else if ((m = working.match(/\bin\s+(\d+)\s+days?\b/i))) { const d = new Date(now); d.setDate(d.getDate() + parseInt(m[1], 10)); dueDate = fmtISO(d); strip(m); }
    else if ((m = working.match(/\bin\s+(\d+)\s+weeks?\b/i))) { const d = new Date(now); d.setDate(d.getDate() + 7 * parseInt(m[1], 10)); dueDate = fmtISO(d); strip(m); }
    else if ((m = working.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i))) { dueDate = fmtISO(nextWeekday(now, WEEKDAYS.indexOf(m[1].toLowerCase()))); strip(m); }
    else if ((m = working.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) { dueDate = m[0]; strip(m); }
    else if ((m = working.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(st|nd|rd|th)?\b/i))) {
      const monthIdx = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3));
      const day = parseInt(m[2], 10);
      let d = new Date(now.getFullYear(), monthIdx, day);
      if (startOfDay(d) < startOfDay(now)) d = new Date(now.getFullYear() + 1, monthIdx, day);
      dueDate = fmtISO(d); strip(m);
    } else if ((m = working.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
      const mo = parseInt(m[1], 10) - 1, da = parseInt(m[2], 10);
      let yr = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10)) : now.getFullYear();
      let d = new Date(yr, mo, da);
      if (!m[3] && startOfDay(d) < startOfDay(now)) d = new Date(yr + 1, mo, da);
      dueDate = fmtISO(d); strip(m);
    } else if ((m = working.match(/\bon\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i))) {
      dueDate = fmtISO(nextWeekday(now, WEEKDAYS.indexOf(m[1].toLowerCase()))); strip(m);
    } else if ((m = working.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i))) {
      dueDate = fmtISO(nextWeekday(now, WEEKDAYS.indexOf(m[1].toLowerCase()))); strip(m);
    }

    let dueTime = null;
    if ((m = working.match(/\bat\s+(\d{1,2})(:(\d{2}))?\s*(am|pm)?\b/i)) || (m = working.match(/\b(\d{1,2})(:(\d{2}))?\s*(am|pm)\b/i))) {
      let hh = parseInt(m[1], 10);
      const mm = m[3] ? parseInt(m[3], 10) : 0;
      const ap = (m[4] || "").toLowerCase();
      if (ap === "pm" && hh < 12) hh += 12;
      if (ap === "am" && hh === 12) hh = 0;
      dueTime = `${pad(hh)}:${pad(mm)}`; strip(m);
    } else if ((m = working.match(/\bmorning\b/i))) { dueTime = "09:00"; strip(m); }
    else if ((m = working.match(/\bafternoon\b/i))) { dueTime = "14:00"; strip(m); }
    else if ((m = working.match(/\bevening\b/i))) { dueTime = "18:00"; strip(m); }
    else if ((m = working.match(/\bnight\b/i))) { dueTime = "20:00"; strip(m); }

    const urgent = /\b(urgent|asap|immediately|right away)\b/i.test(working);
    working = working.replace(/\b(urgent|asap|immediately|right away)\b/gi, " ");

    let project = null;
    if ((m = working.match(/\b(about|regarding|re:)\s+(.+)$/i))) {
      project = titleCase(m[2].trim());
      working = working.slice(0, m.index);
    }

    working = working
      .replace(/^\s*(remind me to|remind me|i need to|i should|i've got to|i have to|don't forget to|note to self:?|todo:?)\s*/i, "")
      .replace(/\s{2,}/g, " ")
      .replace(/[,;]\s*$/, "")
      .trim();

    const title = capitalizeFirst(working || text);

    let area = null;
    const lower = text.toLowerCase();
    for (const a of AREAS) {
      if (!activeAreaIds.includes(a.id)) continue;
      if (a.keywords.some((k) => lower.includes(k))) { area = a.id; break; }
    }
    const areaGuessed = area === null;
    if (!area) area = activeAreaIds[0] || "work";

    let priority;
    if (urgent) priority = "now";
    else if (dueDate === fmtISO(now)) priority = "now";
    else if (dueDate) priority = daysBetween(now, parseISO(dueDate)) <= 2 ? "soon" : "later";
    else priority = "later";

    return { title, dueDate, dueTime, area, areaGuessed, project, priority, recurring, rawInput: text };
  }

  /* ---------------------------------------------------------- item helpers */
  function findOrCreateProject(name, areaId) {
    if (!name) return null;
    const existing = state.projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const p = { id: uid(), name, area: areaId, createdAt: Date.now() };
    state.projects.push(p);
    return p.id;
  }

  function activeAreaIds() { return state.settings.areas; }

  function advanceRecurring(item) {
    if (!item.dueDate) return;
    const d = parseISO(item.dueDate);
    if (item.recurring.freq === "daily") d.setDate(d.getDate() + 1);
    else if (item.recurring.freq === "weekly") d.setDate(d.getDate() + 7);
    else if (item.recurring.freq === "monthly") d.setMonth(d.getMonth() + 1);
    else return;
    item.dueDate = fmtISO(d);
  }

  /* ---------------------------------------------------------- DOM refs */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const el = {
    app: $("#app"),
    onboard: $("#onboard"),
    navGroup: $("#nav-group"),
    tabbar: $(".tabbar"),
    views: $$(".view"),
    inboxBadge: $("#inbox-badge"),
    todayDate: $("#today-date"),
    todayGreeting: $("#today-greeting"),
    todaySub: $("#today-sub"),
    briefing: $("#daily-briefing"),
    briefingTitle: $("#briefing-title"),
    briefingBody: $("#briefing-body"),
    captureForm: $("#capture-form"),
    captureInput: $("#capture-input"),
    micBtn: $("#mic-btn"),
    voiceHint: $("#voice-hint"),
    segmented: $("#today-segmented"),
    areaFilterRow: $("#area-filter-row"),
    todaySections: $("#today-sections"),
    inboxList: $("#inbox-list"),
    projectGrid: $("#project-grid"),
    projectDetail: $("#project-detail"),
    projectDetailName: $("#project-detail-name"),
    projectDetailList: $("#project-detail-list"),
    reviewSegmented: $("#review-segmented"),
    reviewDaily: $("#review-daily"),
    reviewWeekly: $("#review-weekly"),
    dailyStats: $("#daily-stats"),
    dailyOpenList: $("#daily-open-list"),
    weeklyNeglected: $("#weekly-neglected"),
    weeklyByArea: $("#weekly-by-area"),
    settingsAreas: $("#settings-areas"),
    toastWrap: $("#toast-wrap"),
    confirmOverlay: $("#confirm-overlay"),
    confirmRaw: $("#confirm-raw"),
    cfTitle: $("#cf-title"),
    cfDate: $("#cf-date"),
    cfTime: $("#cf-time"),
    cfArea: $("#cf-area"),
    cfProject: $("#cf-project"),
    cfRecurring: $("#cf-recurring"),
    cfPriority: $("#cf-priority"),
    projectList: $("#project-list"),
    projectOverlay: $("#project-overlay"),
    npName: $("#np-name"),
    npArea: $("#np-area"),
  };

  /* ---------------------------------------------------------- ui state (not persisted) */
  const ui = {
    range: "today",
    areaFilter: null,
    reviewTab: "daily",
    editingId: null,
    pendingParsed: null,
    lastAdded: null,
  };

  /* ---------------------------------------------------------- toast */
  function toast(msg, action) {
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<span>${msg}</span>`;
    if (action) {
      const b = document.createElement("button");
      b.textContent = action.label;
      b.addEventListener("click", () => { action.fn(); t.remove(); });
      t.appendChild(b);
    }
    el.toastWrap.appendChild(t);
    setTimeout(() => t.remove(), 5000);
  }

  /* ---------------------------------------------------------- chips / pills builders */
  function areaChip(area, pressed, onClick, opts = {}) {
    const chip = document.createElement("button");
    chip.className = "chip" + (opts.extraClass ? " " + opts.extraClass : "");
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(pressed));
    chip.style.setProperty("--dot", area.color);
    chip.style.setProperty("--dot-soft", `color-mix(in srgb, ${area.color} 18%, transparent)`);
    chip.innerHTML = `<span class="dot"></span>${area.label}`;
    chip.addEventListener("click", onClick);
    return chip;
  }

  function pillButton(label, val, pressed, colorVar) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.dataset.val = val;
    b.setAttribute("aria-pressed", String(pressed));
    if (colorVar) {
      b.style.setProperty("--sel", colorVar);
      b.style.setProperty("--sel-soft", `color-mix(in srgb, ${colorVar} 16%, transparent)`);
    }
    return b;
  }

  function buildAreaPillSelect(container, selectedId) {
    container.innerHTML = "";
    for (const id of activeAreaIds()) {
      const a = AREA_MAP[id];
      const b = pillButton(a.label, a.id, a.id === selectedId, a.color);
      b.addEventListener("click", () => {
        $$("button", container).forEach((x) => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
      });
      container.appendChild(b);
    }
  }

  function pillSelectedValue(container, fallback) {
    const btn = container.querySelector('button[aria-pressed="true"]');
    return btn ? btn.dataset.val : fallback;
  }

  /* ---------------------------------------------------------- item card */
  function itemCard(item) {
    const area = AREA_MAP[item.area];
    const project = item.projectId ? state.projects.find((p) => p.id === item.projectId) : null;
    const isOverdue = item.dueDate && !item.done && daysBetween(new Date(), parseISO(item.dueDate)) < 0;
    const wrap = document.createElement("div");
    wrap.className = `item priority-${item.priority}` + (item.done ? " done" : "");
    wrap.dataset.id = item.id;

    const metaBits = [];
    metaBits.push(`<span class="tag"><span class="dot" style="--dot:${area.color}"></span>${area.label}</span>`);
    if (project) metaBits.push(`<span class="tag">${project.name}</span>`);
    if (item.dueDate) {
      const dueLabel = fmtDueDate(item.dueDate) + (item.dueTime ? " · " + fmtTime12(item.dueTime) : "");
      metaBits.push(`<span class="tag ${isOverdue ? "overdue" : ""}">${isOverdue ? "Overdue · " : ""}${dueLabel}</span>`);
    }
    if (item.recurring && item.recurring.freq !== "none") metaBits.push(`<span class="tag">↻ ${item.recurring.freq}</span>`);
    if (item.areaGuessed) metaBits.push(`<span class="badge guess">Guessed</span>`);

    wrap.innerHTML = `
      <button class="item-check" data-action="toggle" aria-label="Mark done">${ICON_CHECK}</button>
      <div class="item-body">
        <div class="item-title">${item.title}</div>
        <div class="item-meta">${metaBits.join("")}</div>
      </div>
      <div class="item-actions">
        <button class="icon-btn" data-action="edit" aria-label="Edit">${ICON_EDIT}</button>
        <button class="icon-btn" data-action="delete" aria-label="Delete">${ICON_TRASH}</button>
      </div>`;
    return wrap;
  }

  function wireItemContainer(container) {
    container.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const row = e.target.closest(".item");
      if (!row) return;
      const id = row.dataset.id;
      const item = state.items.find((i) => i.id === id);
      if (!item) return;
      const action = btn.dataset.action;
      if (action === "toggle") {
        if (item.recurring && item.recurring.freq !== "none" && !item.done) {
          advanceRecurring(item);
          toast(`Nice — next one is ${fmtDueDate(item.dueDate)}.`);
        } else {
          item.done = !item.done;
        }
        Store.save();
        renderAll();
      } else if (action === "delete") {
        state.items = state.items.filter((i) => i.id !== id);
        Store.save();
        toast("Deleted", { label: "Undo", fn: () => { state.items.push(item); Store.save(); renderAll(); } });
        renderAll();
      } else if (action === "edit") {
        openConfirmSheet({ mode: "edit", item });
      }
    });
  }

  [el.todaySections, el.inboxList, el.dailyOpenList, el.projectDetailList].forEach((c) => c && wireItemContainer(c));

  function emptyState(icon, text) {
    const d = document.createElement("div");
    d.className = "empty";
    d.innerHTML = `<span class="ic">${icon}</span><span>${text}</span>`;
    return d;
  }

  const EMPTY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 12.5l2.6 2.6L16 9.5"/><circle cx="12" cy="12" r="9.2"/></svg>';

  /* ---------------------------------------------------------- Today view */
  function renderTopbar() {
    const now = new Date();
    el.todayDate.textContent = `${WEEKDAY_FULL[now.getDay()]} · ${MONTH_NAMES[now.getMonth()].toUpperCase()} ${now.getDate()}`;
    const hour = now.getHours();
    const greeting = hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening.";
    el.todayGreeting.textContent = greeting;

    const dueToday = state.items.filter((i) => i.dueDate === todayISO() && !i.done);
    el.todaySub.textContent = dueToday.length ? `A composed start: ${dueToday.length} item${dueToday.length === 1 ? "" : "s"} need your attention today.` : "Nothing due today — a good day to get ahead on Soon or Later.";

    if (state.settings.dailyBriefing && dueToday.length > 0) {
      el.briefing.hidden = false;
      el.briefingTitle.textContent = greeting;
      const nowCount = dueToday.filter((i) => i.priority === "now").length;
      el.briefingBody.textContent = nowCount ? ` ${nowCount} need focus right now, ${dueToday.length - nowCount} more later today.` : ` ${dueToday.length} item${dueToday.length === 1 ? "" : "s"} to get through today.`;
    } else {
      el.briefing.hidden = true;
    }
  }

  function renderAreaFilterRow() {
    el.areaFilterRow.innerHTML = "";
    const allChip = document.createElement("button");
    allChip.className = "chip all";
    allChip.type = "button";
    allChip.textContent = "All areas";
    allChip.setAttribute("aria-pressed", String(ui.areaFilter === null));
    allChip.addEventListener("click", () => { ui.areaFilter = null; renderToday(); });
    el.areaFilterRow.appendChild(allChip);

    for (const id of activeAreaIds()) {
      const a = AREA_MAP[id];
      el.areaFilterRow.appendChild(areaChip(a, ui.areaFilter === id, () => { ui.areaFilter = ui.areaFilter === id ? null : id; renderToday(); }));
    }
  }

  function itemsForRange(range) {
    const scheduled = state.items.filter((i) => i.dueDate);
    let list;
    if (range === "today") list = scheduled.filter((i) => i.dueDate === todayISO());
    else if (range === "overdue") list = scheduled.filter((i) => !i.done && daysBetween(new Date(), parseISO(i.dueDate)) < 0);
    else list = scheduled.filter((i) => !i.done && daysBetween(new Date(), parseISO(i.dueDate)) > 0);
    if (ui.areaFilter) list = list.filter((i) => i.area === ui.areaFilter);
    return list;
  }

  function renderToday() {
    $$("#today-segmented button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.range === ui.range)));
    el.todaySections.innerHTML = "";
    const list = itemsForRange(ui.range);

    const buildSection = (title, items, countLabel) => {
      if (!items.length) return null;
      const section = document.createElement("div");
      section.className = "section";
      section.innerHTML = `<div class="section-head"><h2>${title}</h2><span class="count">${countLabel != null ? countLabel : items.length}</span></div>`;
      const list_ = document.createElement("div");
      list_.className = "item-list";
      items.forEach((i) => list_.appendChild(itemCard(i)));
      section.appendChild(list_);
      return section;
    };

    if (ui.range === "today") {
      const open = list.filter((i) => !i.done);
      const done = list.filter((i) => i.done);
      const now_ = open.filter((i) => i.priority === "now");
      const soon = open.filter((i) => i.priority === "soon");
      const later = open.filter((i) => i.priority === "later");
      const sections = [
        buildSection("Focus now", now_),
        buildSection("Also today", soon),
        buildSection("Make space for", later),
        buildSection("Done today", done),
      ].filter(Boolean);
      if (!sections.length) el.todaySections.appendChild(emptyState(EMPTY_ICON, "Nothing scheduled today. Capture something above, or check Inbox for things waiting on a date."));
      else sections.forEach((s) => el.todaySections.appendChild(s));
    } else if (ui.range === "overdue") {
      list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const section = buildSection("Overdue", list);
      if (section) el.todaySections.appendChild(section);
      else el.todaySections.appendChild(emptyState(EMPTY_ICON, "Nothing overdue. You're caught up."));
    } else {
      list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const soonWeek = list.filter((i) => daysBetween(new Date(), parseISO(i.dueDate)) <= 7);
      const later = list.filter((i) => daysBetween(new Date(), parseISO(i.dueDate)) > 7);
      const sections = [buildSection("This week", soonWeek), buildSection("Later", later)].filter(Boolean);
      if (!sections.length) el.todaySections.appendChild(emptyState(EMPTY_ICON, "Nothing upcoming yet."));
      else sections.forEach((s) => el.todaySections.appendChild(s));
    }
  }

  /* ---------------------------------------------------------- Inbox view */
  function renderInbox() {
    const unscheduled = state.items.filter((i) => !i.dueDate);
    el.inboxList.innerHTML = "";
    el.inboxBadge.hidden = unscheduled.length === 0;
    el.inboxBadge.textContent = String(unscheduled.length);
    if (!unscheduled.length) {
      el.inboxList.appendChild(emptyState(EMPTY_ICON, "Your inbox is clear. Anything you capture without a date lands here until you give it a place."));
      return;
    }
    unscheduled.forEach((i) => el.inboxList.appendChild(itemCard(i)));
  }

  /* ---------------------------------------------------------- Projects view */
  function renderProjects() {
    el.projectGrid.innerHTML = "";
    if (!state.projects.length) {
      el.projectGrid.appendChild(emptyState(EMPTY_ICON, "No projects yet. Create one, or mention a project when you capture a task (“…about the kitchen remodel”)."));
      return;
    }
    state.projects.forEach((p) => {
      const tasks = state.items.filter((i) => i.projectId === p.id);
      const done = tasks.filter((i) => i.done).length;
      const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
      const area = AREA_MAP[p.area] || AREA_MAP.work;
      const card = document.createElement("button");
      card.className = "project-card";
      card.innerHTML = `
        <div class="p-top">
          <span class="chip" style="--dot:${area.color}; pointer-events:none;"><span class="dot"></span>${area.label}</span>
        </div>
        <div class="p-name">${p.name}</div>
        <div class="project-bar"><span style="width:${pct}%; background:${area.color}"></span></div>
        <div class="p-meta">${done} of ${tasks.length} done</div>`;
      card.addEventListener("click", () => openProjectDetail(p.id));
      el.projectGrid.appendChild(card);
    });
  }

  function openProjectDetail(projectId) {
    const p = state.projects.find((x) => x.id === projectId);
    if (!p) return;
    el.projectGrid.hidden = true;
    $("#new-project-btn").hidden = true;
    el.projectDetail.hidden = false;
    el.projectDetailName.textContent = p.name;
    el.projectDetailList.innerHTML = "";
    const tasks = state.items.filter((i) => i.projectId === projectId);
    if (!tasks.length) el.projectDetailList.appendChild(emptyState(EMPTY_ICON, "No tasks in this project yet."));
    else tasks.forEach((i) => el.projectDetailList.appendChild(itemCard(i)));
  }

  $("#project-back").addEventListener("click", () => {
    el.projectGrid.hidden = false;
    $("#new-project-btn").hidden = false;
    el.projectDetail.hidden = true;
    renderProjects();
  });

  /* ---------------------------------------------------------- Review view */
  function renderReview() {
    $$("#review-segmented button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.review === ui.reviewTab)));
    el.reviewDaily.hidden = ui.reviewTab !== "daily";
    el.reviewWeekly.hidden = ui.reviewTab !== "weekly";
    if (ui.reviewTab === "daily") renderReviewDaily(); else renderReviewWeekly();
  }

  function renderReviewDaily() {
    const dueToday = state.items.filter((i) => i.dueDate === todayISO());
    const done = dueToday.filter((i) => i.done).length;
    const open = dueToday.length - done;
    const overdue = state.items.filter((i) => i.dueDate && !i.done && daysBetween(new Date(), parseISO(i.dueDate)) < 0).length;
    el.dailyStats.innerHTML = `
      <div class="stat-tile"><div class="num tabular">${done}</div><div class="lbl">Done today</div></div>
      <div class="stat-tile"><div class="num tabular">${open}</div><div class="lbl">Still open</div></div>
      <div class="stat-tile"><div class="num tabular">${overdue}</div><div class="lbl">Overdue</div></div>`;
    el.dailyOpenList.innerHTML = "";
    const openItems = dueToday.filter((i) => !i.done);
    if (!openItems.length) el.dailyOpenList.appendChild(emptyState(EMPTY_ICON, "Everything due today is handled."));
    else openItems.forEach((i) => el.dailyOpenList.appendChild(itemCard(i)));
  }

  function renderReviewWeekly() {
    const upcoming = state.items.filter((i) => i.dueDate && !i.done && daysBetween(new Date(), parseISO(i.dueDate)) >= 0 && daysBetween(new Date(), parseISO(i.dueDate)) <= 7);
    const counts = {};
    activeAreaIds().forEach((id) => (counts[id] = 0));
    upcoming.forEach((i) => { if (counts[i.area] != null) counts[i.area]++; });
    const neglected = activeAreaIds().filter((id) => counts[id] === 0);

    el.weeklyNeglected.innerHTML = "";
    if (neglected.length) {
      const names = neglected.map((id) => AREA_MAP[id].label).join(", ");
      const b = document.createElement("div");
      b.className = "banner";
      b.innerHTML = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="9.2"/></svg><div><strong>Nothing planned this week</strong>${names} — worth making space for, even a small step.</div>`;
      el.weeklyNeglected.appendChild(b);
    }

    el.weeklyByArea.innerHTML = "";
    activeAreaIds().forEach((id) => {
      const a = AREA_MAP[id];
      const row = document.createElement("button");
      row.className = "review-area-row";
      row.style.width = "100%";
      row.style.border = "none";
      row.style.background = "none";
      row.style.cursor = "pointer";
      row.innerHTML = `<span class="dot" style="--dot:${a.color}"></span><span class="name">${a.label}</span><span class="n tabular">${counts[id]}</span>`;
      row.addEventListener("click", () => {
        ui.range = "upcoming"; ui.areaFilter = id;
        setActiveView("today");
      });
      el.weeklyByArea.appendChild(row);
    });
  }

  /* ---------------------------------------------------------- Settings view */
  function renderSettings() {
    el.settingsAreas.innerHTML = "";
    AREAS.forEach((a) => {
      const active = state.settings.areas.includes(a.id);
      const chip = areaChip(a, active, () => {
        const idx = state.settings.areas.indexOf(a.id);
        if (idx >= 0) {
          if (state.settings.areas.length === 1) { toast("Keep at least one life area active."); return; }
          state.settings.areas.splice(idx, 1);
        } else state.settings.areas.push(a.id);
        Store.save();
        renderSettings();
        renderAll();
      });
      el.settingsAreas.appendChild(chip);
    });
    $("#pref-start").value = state.settings.dailyStart;
    $("#pref-review-day").value = String(state.settings.weeklyReviewDay);
    $$("#reminder-style-select button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === state.settings.reminderStyle)));
    $("#pref-briefing").checked = state.settings.dailyBriefing;
    $("#pref-confirm").checked = state.settings.askBeforeScheduling;
  }

  $("#pref-start").addEventListener("change", (e) => { state.settings.dailyStart = e.target.value; Store.save(); });
  $("#pref-review-day").addEventListener("change", (e) => { state.settings.weeklyReviewDay = Number(e.target.value); Store.save(); });
  $$("#reminder-style-select button").forEach((b) => b.addEventListener("click", () => {
    state.settings.reminderStyle = b.dataset.val;
    $$("#reminder-style-select button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    Store.save();
  }));
  $("#pref-briefing").addEventListener("change", (e) => { state.settings.dailyBriefing = e.target.checked; Store.save(); renderTopbar(); });
  $("#pref-confirm").addEventListener("change", (e) => { state.settings.askBeforeScheduling = e.target.checked; Store.save(); });

  $("#export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ballast-export-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("Exported your data.");
  });

  $("#clear-btn").addEventListener("click", () => {
    if (!confirm("This deletes everything Ballast has stored on this device. This can't be undone. Continue?")) return;
    Store.clear();
    location.reload();
  });

  /* ---------------------------------------------------------- capture confirm sheet */
  function openConfirmSheet({ mode, parsed, item }) {
    ui.editingId = mode === "edit" ? item.id : null;
    ui.pendingParsed = mode === "create" ? parsed : null;

    const data = mode === "edit"
      ? { title: item.title, dueDate: item.dueDate, dueTime: item.dueTime, area: item.area, project: item.projectId ? state.projects.find((p) => p.id === item.projectId)?.name : "", recurring: item.recurring.freq, priority: item.priority, raw: item.rawInput }
      : { title: parsed.title, dueDate: parsed.dueDate, dueTime: parsed.dueTime, area: parsed.area, project: parsed.project || "", recurring: parsed.recurring.freq, priority: parsed.priority, raw: parsed.rawInput };

    el.confirmRaw.textContent = `“${data.raw}”`;
    el.cfTitle.value = data.title;
    el.cfDate.value = data.dueDate || "";
    el.cfTime.value = data.dueTime || "";
    buildAreaPillSelect(el.cfArea, data.area);
    el.cfProject.value = data.project || "";
    el.cfRecurring.value = data.recurring;
    $$("button", el.cfPriority).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === data.priority)));

    el.projectList.innerHTML = state.projects.map((p) => `<option value="${p.name}"></option>`).join("");

    el.confirmOverlay.hidden = false;
    el.cfTitle.focus();
  }

  function closeConfirmSheet() {
    el.confirmOverlay.hidden = true;
    ui.editingId = null;
    ui.pendingParsed = null;
  }

  $("#confirm-close").addEventListener("click", closeConfirmSheet);
  $("#confirm-discard").addEventListener("click", closeConfirmSheet);
  $("#confirm-overlay").addEventListener("click", (e) => { if (e.target === el.confirmOverlay) closeConfirmSheet(); });

  $$("#cf-priority button").forEach((b) => b.addEventListener("click", () => {
    $$("#cf-priority button").forEach((x) => x.setAttribute("aria-pressed", "false"));
    b.setAttribute("aria-pressed", "true");
  }));

  $("#confirm-save").addEventListener("click", () => {
    const title = el.cfTitle.value.trim();
    if (!title) { el.cfTitle.focus(); return; }
    const areaId = pillSelectedValue(el.cfArea, activeAreaIds()[0]);
    const dueDate = el.cfDate.value || null;
    const dueTime = el.cfTime.value || null;
    const projectName = el.cfProject.value.trim();
    const projectId = projectName ? findOrCreateProject(projectName, areaId) : null;
    const recurringFreq = el.cfRecurring.value;
    const priority = pillSelectedValue(el.cfPriority, "soon");

    if (ui.editingId) {
      const item = state.items.find((i) => i.id === ui.editingId);
      Object.assign(item, { title, dueDate, dueTime, area: areaId, projectId, priority, recurring: { freq: recurringFreq }, areaGuessed: false });
      toast("Updated.");
    } else {
      state.items.push({
        id: uid(), title, dueDate, dueTime, area: areaId, projectId, priority,
        recurring: { freq: recurringFreq }, done: false, createdAt: Date.now(),
        rawInput: ui.pendingParsed ? ui.pendingParsed.rawInput : title, areaGuessed: false,
      });
      toast(dueDate ? "Added to your dashboard." : "Saved to Inbox.");
    }
    Store.save();
    closeConfirmSheet();
    renderAll();
  });

  /* ---------------------------------------------------------- new project sheet */
  $("#new-project-btn").addEventListener("click", () => {
    el.npName.value = "";
    buildAreaPillSelect(el.npArea, activeAreaIds()[0]);
    el.projectOverlay.hidden = false;
    el.npName.focus();
  });
  const closeProjectSheet = () => { el.projectOverlay.hidden = true; };
  $("#project-close").addEventListener("click", closeProjectSheet);
  $("#project-cancel").addEventListener("click", closeProjectSheet);
  $("#project-overlay").addEventListener("click", (e) => { if (e.target === el.projectOverlay) closeProjectSheet(); });
  $("#project-save").addEventListener("click", () => {
    const name = el.npName.value.trim();
    if (!name) { el.npName.focus(); return; }
    const areaId = pillSelectedValue(el.npArea, activeAreaIds()[0]);
    if (state.projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) { toast("A project with that name already exists."); return; }
    state.projects.push({ id: uid(), name, area: areaId, createdAt: Date.now() });
    Store.save();
    closeProjectSheet();
    renderProjects();
    toast("Project created.");
  });

  /* ---------------------------------------------------------- capture bar + voice */
  function handleCaptureText(raw) {
    const text = raw.trim();
    if (!text) return;
    const parsed = parseCapture(text, activeAreaIds());
    if (state.settings.askBeforeScheduling) {
      openConfirmSheet({ mode: "create", parsed });
    } else {
      const projectId = parsed.project ? findOrCreateProject(parsed.project, parsed.area) : null;
      const item = { id: uid(), title: parsed.title, dueDate: parsed.dueDate, dueTime: parsed.dueTime, area: parsed.area, areaGuessed: parsed.areaGuessed, projectId, priority: parsed.priority, recurring: parsed.recurring, done: false, createdAt: Date.now(), rawInput: parsed.rawInput };
      state.items.push(item);
      Store.save();
      renderAll();
      toast(parsed.dueDate ? "Added — tap to edit anytime." : "Saved to Inbox.", { label: "Edit", fn: () => openConfirmSheet({ mode: "edit", item }) });
    }
    el.captureInput.value = "";
  }

  el.captureForm.addEventListener("submit", (e) => { e.preventDefault(); handleCaptureText(el.captureInput.value); });

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;
  let listening = false;
  function showVoiceHint(msg) {
    el.voiceHint.textContent = msg;
    el.voiceHint.hidden = false;
    setTimeout(() => { el.voiceHint.hidden = true; }, 4500);
  }
  if (SR) {
    recognizer = new SR();
    recognizer.lang = "en-US";
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;
    recognizer.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      el.captureInput.value = transcript;
      handleCaptureText(transcript);
    };
    recognizer.onerror = (e) => {
      listening = false;
      el.micBtn.classList.remove("listening");
      if (e.error === "not-allowed" || e.error === "service-not-allowed") showVoiceHint("Microphone access was blocked — type your commitment instead.");
      else if (e.error === "no-speech") showVoiceHint("Didn't catch that — try again, or type it.");
      else showVoiceHint("Voice capture hit a snag — type instead.");
    };
    recognizer.onend = () => { listening = false; el.micBtn.classList.remove("listening"); };
  }
  el.micBtn.addEventListener("click", () => {
    if (!SR) { showVoiceHint("Voice capture isn't supported in this browser — type your commitment instead."); el.captureInput.focus(); return; }
    if (listening) { recognizer.stop(); return; }
    try {
      recognizer.start();
      listening = true;
      el.micBtn.classList.add("listening");
    } catch {
      showVoiceHint("Couldn't start the microphone — type instead.");
    }
  });

  /* ---------------------------------------------------------- nav / views */
  function setActiveView(name) {
    el.views.forEach((v) => v.classList.toggle("active", v.dataset.view === name));
    $$(".nav-item", el.navGroup).forEach((b) => b.setAttribute("aria-current", b.dataset.view === name ? "page" : "false"));
    $$(".nav-item", $("#app > .rail-foot") || document).forEach(() => {});
    $$("[data-view]").forEach((b) => { if (b.tagName === "BUTTON") b.setAttribute("aria-current", b.dataset.view === name ? "page" : "false"); });
    $$(".tab-btn").forEach((b) => b.setAttribute("aria-current", b.dataset.view === name ? "page" : "false"));
    renderViewData(name);
    window.scrollTo(0, 0);
  }

  function renderViewData(name) {
    if (name === "today") { renderTopbar(); renderAreaFilterRow(); renderToday(); }
    else if (name === "inbox") renderInbox();
    else if (name === "projects") { el.projectDetail.hidden = true; el.projectGrid.hidden = false; $("#new-project-btn").hidden = false; renderProjects(); }
    else if (name === "review") renderReview();
    else if (name === "settings") renderSettings();
  }

  function renderAll() {
    renderTopbar();
    el.inboxBadge.hidden = state.items.filter((i) => !i.dueDate).length === 0;
    el.inboxBadge.textContent = String(state.items.filter((i) => !i.dueDate).length);
    const active = document.querySelector(".view.active");
    renderViewData(active ? active.dataset.view : "today");
  }

  $$("[data-view]").forEach((btn) => btn.addEventListener("click", () => setActiveView(btn.dataset.view)));

  $$("#today-segmented button").forEach((b) => b.addEventListener("click", () => { ui.range = b.dataset.range; renderToday(); }));
  $$("#review-segmented button").forEach((b) => b.addEventListener("click", () => { ui.reviewTab = b.dataset.review; renderReview(); }));

  /* ---------------------------------------------------------- theme toggle */
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  const savedTheme = (() => { try { return localStorage.getItem("ballast.theme"); } catch { return null; } })();
  applyTheme(savedTheme);
  $("#theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("ballast.theme", next); } catch {}
  });

  /* ---------------------------------------------------------- onboarding */
  function initOnboardAreas() {
    const container = $("#onboard-areas");
    container.innerHTML = "";
    const selected = new Set(state.settings.areas);
    AREAS.forEach((a) => {
      const chip = areaChip(a, selected.has(a.id), () => {
        if (selected.has(a.id)) selected.delete(a.id); else selected.add(a.id);
        chip.setAttribute("aria-pressed", String(selected.has(a.id)));
      });
      chip.dataset.areaId = a.id;
      container.appendChild(chip);
    });
    return selected;
  }

  function runOnboarding() {
    el.onboard.hidden = false;
    el.app.hidden = true;
    const selected = initOnboardAreas();

    $("#onboard-next-1").addEventListener("click", () => {
      if (selected.size === 0) { toast("Pick at least one life area to continue."); return; }
      state.settings.areas = AREAS.filter((a) => selected.has(a.id)).map((a) => a.id);
      $$(".onboard-step").forEach((s) => s.classList.toggle("active", s.dataset.step === "2"));
    }, { once: true });

    $("#onboard-finish").addEventListener("click", () => {
      state.settings.dailyStart = $("#ob-start").value || "08:00";
      state.settings.weeklyReviewDay = Number($("#ob-review-day").value);
      state.settings.dailyBriefing = $("#ob-briefing").checked;
      state.settings.askBeforeScheduling = $("#ob-confirm").checked;
      state.onboarded = true;
      if (!state.items.length) seedExamples(state);
      Store.save();
      el.onboard.hidden = true;
      el.app.hidden = false;
      setActiveView("today");
    }, { once: true });
  }

  /* ---------------------------------------------------------- boot */
  function boot() {
    if (!state.onboarded) {
      runOnboarding();
    } else {
      el.app.hidden = false;
      setActiveView("today");
    }
  }

  boot();
})();
