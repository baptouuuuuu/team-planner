/* ==========================================================================
 * Team Planner - plain JS, no build step, no backend.
 * Code is in English, the UI is in French.
 * ========================================================================== */

/* --------------------------------------------------------------------------
 * 1. LABELS: every visible UI text lives here. Edit this object to change UI.
 * -------------------------------------------------------------------------- */
const LABELS = {
  appTitle: "Planificateur d'équipe",
  export: "Exporter (JSON)",
  import: "Importer (JSON)",
  resetAll: "Tout réinitialiser",
  autoFill: "Remplir automatiquement",
  clearAll: "Tout supprimer",
  clearAllHint: "Supprime toutes les affectations du chronogramme",
  confirmClearAll: "Supprimer toutes les affectations ? Les tâches, personnes et besoins sont conservés.",
  autoFillDone: "Remplissage terminé.",
  autoFillUnfilled: "postes non pourvus (règles ou personnes insuffisantes)",
  autoFillBelowMin: "personne(s) sous le minimum d'heures par jour",
  autoFillHint: "Complète les postes manquants sans modifier les affectations existantes",
  confirmResetAll: "Supprimer toutes les données ?",
  importError: "Fichier invalide : import impossible.",
  settingsTitle: "Période",
  days: "Nombre de jours",
  startHour: "Heure de début",
  endHour: "Heure de fin (+1 = lendemain)",
  nextDay: "+1",
  defaultNeed: "Personnes par défaut",
  dayTitle: "Jour",
  slotLength: "Durée d'un créneau",
  minutes30: "30 minutes",
  minutes60: "1 heure",
  minDaily: "Heures min. par jour",
  maxDaily: "Heures max. par jour",
  maxShiftHours: "Durée max. d'un créneau (h, 0 = illimité)",
  minBreakHours: "Pause min. entre créneaux (h)",
  invalidSettings: "Paramètres invalides : la fin doit suivre le début et la durée doit être un multiple du créneau.",
  confirmGranularity: "Changer la période réinitialisera les besoins et les affectations. Continuer ?",
  tasksTitle: "Tâches",
  taskPlaceholder: "Nom de la tâche",
  addTask: "Ajouter",
  deleteTask: "Supprimer",
  taskColor: "Couleur de la tâche",
  renameTask: "Renommer la tâche",
  confirmDeleteTask: "Supprimer cette tâche ?",
  noTasks: "Aucune tâche pour le moment.",
  defaultTaskName: "Nouvelle tâche",
  peopleTitle: "Personnes",
  personPlaceholder: "Nom de la personne",
  addPerson: "Ajouter",
  deletePerson: "Supprimer",
  confirmDeletePerson: "Supprimer cette personne ?",
  noPeople: "Aucune personne pour le moment.",
  totalHours: "Total",
  hoursUnit: "h",
  perDay: "par jour",
  statusLow: "Trop peu d'heures",
  statusHigh: "Trop d'heures",
  statusOk: "Dans la plage",
  timelineTitle: "Chronogramme",
  taskColumn: "Tâche",
  dayShort: "J",
  increase: "Augmenter le besoin",
  decrease: "Diminuer le besoin",
  noTasksTimeline: "Ajoutez une tâche pour afficher le chronogramme.",
  legendOk: "Complet",
  legendUnder: "Manque du monde",
  legendOver: "Surplus",
  popupSlot: "Créneau",
  popupAssigned: "Affectés",
  popupRequired: "requis",
  popupClose: "Fermer",
  popupNoPeople: "Ajoutez d'abord des personnes.",
  popupBusyOn: "déjà sur",
  fillHandle: "Étirer vers le bas pour copier l'équipe et le besoin",
  byPersonTitle: "Vue par personne",
  personCellHint: "Cliquer pour changer de tâche (jusqu'à vide, puis retour au début)",
};

/* --------------------------------------------------------------------------
 * 2. STATE + persistence (localStorage)
 * -------------------------------------------------------------------------- */
const STORAGE_KEY = "team-planner-data-v1";
const DEFAULT_NEED = 1;
const MAX_END = 48; // end hour may reach 24h after midnight of the next day
const PALETTE = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed", "#0891b2", "#65a30d", "#dc2626"];

function defaultState() {
  return {
    settings: { days: 1, startHour: 8, endHour: 18, slotMinutes: 60, minDaily: 4, maxDaily: 8, maxShiftHours: 2, minBreakHours: 2 },
    tasks: [],
    people: [],
    needs: {},       // "taskId|slot" -> required count (missing = DEFAULT_NEED)
    assignments: {}, // "taskId|slot" -> array of person ids
    nextId: 1,
  };
}

let state = loadState();
let openPopup = null; // { taskId, slot } while the popup is open

/** Checks the minimal shape of a state object (used for storage and import). */
function isValidState(s) {
  return s && typeof s === "object" && s.settings && Array.isArray(s.tasks) && Array.isArray(s.people)
    && s.needs && typeof s.needs === "object" && s.assignments && typeof s.assignments === "object";
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isValidState(parsed)) return Object.assign(defaultState(), parsed, { settings: Object.assign(defaultState().settings, parsed.settings) });
  } catch (e) { /* ignore corrupted storage */ }
  return defaultState();
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage may be unavailable */ }
}

/** Generates an internal id. Ids are never displayed in the UI. */
function newId(prefix) { return prefix + state.nextId++; }

/* --------------------------------------------------------------------------
 * 3. Helpers: time slots, needs, assignments, hours
 * -------------------------------------------------------------------------- */
const key = (taskId, slot) => taskId + "|" + slot;
const slotsPerDay = () => Math.round(((state.settings.endHour - state.settings.startHour) * 60) / state.settings.slotMinutes);
const totalSlots = () => slotsPerDay() * state.settings.days;
const dayOf = (slot) => Math.floor(slot / slotsPerDay());
const slotHours = () => state.settings.slotMinutes / 60;
const getTask = (id) => state.tasks.find((t) => t.id === id);
const getPerson = (id) => state.people.find((p) => p.id === id);
const taskDefaultNeed = (taskId) => { const t = getTask(taskId); return t && Number.isInteger(t.defaultNeed) ? t.defaultNeed : DEFAULT_NEED; };
const getNeed = (taskId, slot) => (key(taskId, slot) in state.needs ? state.needs[key(taskId, slot)] : taskDefaultNeed(taskId));
const getAssigned = (taskId, slot) => state.assignments[key(taskId, slot)] || [];

const pad = (n) => String(n).padStart(2, "0");
/** Formats minutes since the work day's midnight; past 24h shows "+1" (next calendar day) */
function formatMinutes(minutes) {
  minutes = Math.round(minutes);
  const m = minutes % 1440;
  return pad(Math.floor(m / 60)) + ":" + pad(m % 60) + (minutes >= 1440 ? " " + LABELS.nextDay : "");
}
const formatHour = (h) => formatMinutes(h * 60);
function slotTime(slot) {
  return formatMinutes(state.settings.startHour * 60 + (slot % slotsPerDay()) * state.settings.slotMinutes);
}
const slotLabel = (slot) => LABELS.dayShort + (dayOf(slot) + 1) + " " + slotTime(slot);

/** Staffing status of a cell: "ok" (equal), "under", "over" or "zero" (nothing needed, nobody assigned). */
function cellStatus(taskId, slot) {
  const need = getNeed(taskId, slot);
  const n = getAssigned(taskId, slot).length;
  if (need === 0 && n === 0) return "zero";
  return n === need ? "ok" : n < need ? "under" : "over";
}

/** Hours assigned to a person for each day (array) */
function dailyHours(personId) {
  const hours = new Array(state.settings.days).fill(0);
  for (const t of state.tasks) {
    for (let s = 0; s < totalSlots(); s++) {
      if (getAssigned(t.id, s).includes(personId)) hours[dayOf(s)] += slotHours();
    }
  }
  return hours;
}

/** "low" / "high" / "ok" for one day's hours against the configured range */
function hoursStatus(h) {
  return h < state.settings.minDaily ? "low" : h > state.settings.maxDaily ? "high" : "ok";
}

/** Worst status over all days: high > low > ok */
function personStatus(hours) {
  const statuses = hours.map(hoursStatus);
  return statuses.includes("high") ? "high" : statuses.includes("low") ? "low" : "ok";
}

/** Returns the task a person is already assigned to on this slot (other than exceptTaskId), if any */
function busyTask(personId, slot, exceptTaskId) {
  return state.tasks.find((t) => t.id !== exceptTaskId && getAssigned(t.id, slot).includes(personId));
}

const statusLabel = (s) => (s === "low" ? LABELS.statusLow : s === "high" ? LABELS.statusHigh : LABELS.statusOk);
const fmt = (h) => String(Math.round(h * 100) / 100).replace(".", ",");

/* --------------------------------------------------------------------------
 * 4. State mutations
 * -------------------------------------------------------------------------- */
function adjustNeed(taskId, slot, delta) {
  state.needs[key(taskId, slot)] = Math.max(0, getNeed(taskId, slot) + delta);
  commit();
}

function toggleAssignment(taskId, slot, personId) {
  const k = key(taskId, slot);
  const list = getAssigned(taskId, slot);
  if (list.includes(personId)) {
    state.assignments[k] = list.filter((id) => id !== personId);
  } else if (!busyTask(personId, slot, taskId)) {
    state.assignments[k] = list.concat(personId);
  }
  commit();
}

/** Copies need + team of a slot onto the following slots (same task); people busy elsewhere are skipped */
function copySlot(taskId, fromSlot, toSlot) {
  const need = getNeed(taskId, fromSlot);
  const team = getAssigned(taskId, fromSlot);
  for (let s = fromSlot + 1; s <= toSlot; s++) {
    state.needs[key(taskId, s)] = need;
    state.assignments[key(taskId, s)] = team.filter((id) => !busyTask(id, s, taskId));
  }
  commit();
}

/**
 * Fills missing positions without touching existing assignments. Rules: one task per person and slot,
 * max shift length, min break between shifts (same day), max daily hours; people furthest below
 * the daily minimum are served first, and continuing the same task is preferred.
 */
function autoFill() {
  const cfg = state.settings;
  const per = slotsPerDay();
  const maxRun = cfg.maxShiftHours > 0 ? Math.floor((cfg.maxShiftHours * 60) / cfg.slotMinutes) : Infinity;
  const minGap = Math.ceil(((cfg.minBreakHours || 0) * 60) / cfg.slotMinutes);
  const occ = {};
  const hours = {};
  for (const p of state.people) {
    occ[p.id] = new Array(totalSlots()).fill(false);
    hours[p.id] = new Array(cfg.days).fill(0);
  }
  for (const t of state.tasks) {
    for (let s = 0; s < totalSlots(); s++) {
      for (const id of getAssigned(t.id, s)) if (occ[id]) { occ[id][s] = true; hours[id][dayOf(s)] += slotHours(); }
    }
  }
  /** Would working slot s keep the person's shifts within the rules? Only the shift containing s and its neighbours are checked. */
  const allowed = (id, s) => {
    const o = occ[id];
    const lo = dayOf(s) * per, hi = lo + per - 1;
    let a = s, b = s;
    while (a - 1 >= lo && o[a - 1]) a--;
    while (b + 1 <= hi && o[b + 1]) b++;
    if (b - a + 1 > maxRun) return false;
    let p = a - 1;
    while (p >= lo && !o[p]) p--;
    if (p >= lo && a - p - 1 < minGap) return false;
    let n = b + 1;
    while (n <= hi && !o[n]) n++;
    if (n <= hi && n - b - 1 < minGap) return false;
    return true;
  };
  let unfilled = 0;
  for (let s = 0; s < totalSlots(); s++) {
    const d = dayOf(s);
    for (const t of state.tasks) {
      const list = getAssigned(t.id, s).slice();
      const missing = getNeed(t.id, s) - list.length;
      if (missing <= 0) continue;
      const prev = s % per > 0 ? getAssigned(t.id, s - 1) : [];
      const candidates = state.people
        .filter((p) => !list.includes(p.id) && !occ[p.id][s] && hours[p.id][d] + slotHours() <= cfg.maxDaily && allowed(p.id, s))
        .sort((x, y) => (prev.includes(y.id) - prev.includes(x.id)) || (hours[x.id][d] - hours[y.id][d]));
      const picked = candidates.slice(0, missing);
      for (const p of picked) { list.push(p.id); occ[p.id][s] = true; hours[p.id][d] += slotHours(); }
      unfilled += missing - picked.length;
      state.assignments[key(t.id, s)] = list;
    }
  }
  const belowMin = state.people.filter((p) => hours[p.id].some((h) => h < cfg.minDaily)).length;
  commit();
  const notes = [];
  if (unfilled) notes.push(unfilled + " " + LABELS.autoFillUnfilled);
  if (belowMin) notes.push(belowMin + " " + LABELS.autoFillBelowMin);
  alert(LABELS.autoFillDone + (notes.length ? "\n- " + notes.join("\n- ") : ""));
}

function clearAllAssignments() {
  state.assignments = {};
  commit();
}

function deleteTask(taskId) {
  state.tasks = state.tasks.filter((t) => t.id !== taskId);
  for (const k of Object.keys(state.needs)) if (k.startsWith(taskId + "|")) delete state.needs[k];
  for (const k of Object.keys(state.assignments)) if (k.startsWith(taskId + "|")) delete state.assignments[k];
  commit();
}

function deletePerson(personId) {
  state.people = state.people.filter((p) => p.id !== personId);
  for (const k of Object.keys(state.assignments)) {
    state.assignments[k] = state.assignments[k].filter((id) => id !== personId);
  }
  commit();
}

/** Save then re-render everything (including the popup if open) */
function commit() {
  saveState();
  render();
}

/* --------------------------------------------------------------------------
 * 5. DOM helpers
 * -------------------------------------------------------------------------- */
/** Creates an element. Text is set with textContent (safe against HTML injection). */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "text") node.textContent = v;
    else if (k === "class") node.className = v;
    else if (k === "data") Object.assign(node.dataset, v);
    else node[k] = v;
  }
  for (const c of children) if (c) node.append(c);
  return node;
}
const $ = (id) => document.getElementById(id);

/* --------------------------------------------------------------------------
 * 6. Rendering
 * -------------------------------------------------------------------------- */
function renderSettings() {
  const s = state.settings;
  const box = $("settings-section");
  box.replaceChildren(el("h2", { text: LABELS.settingsTitle }));
  const numField = (label, prop, min, max, step) => {
    const input = el("input", { type: "number", value: s[prop], min, max, step });
    input.dataset.setting = prop;
    return el("label", { text: label }, input);
  };
  const select = el("select");
  select.dataset.setting = "slotMinutes";
  for (const [v, l] of [[30, LABELS.minutes30], [60, LABELS.minutes60]]) {
    select.append(el("option", { value: v, text: l, selected: s.slotMinutes === v }));
  }
  const hourSelect = (prop, from, to) => {
    const sel = el("select");
    sel.dataset.setting = prop;
    for (let h = from; h <= to; h += 0.5) sel.append(el("option", { value: h, text: formatHour(h), selected: s[prop] === h }));
    return el("label", { text: LABELS[prop] }, sel);
  };
  box.append(el("div", { class: "settings-grid" },
    numField(LABELS.days, "days", 1, 14, 1),
    hourSelect("startHour", 0, 23.5),
    hourSelect("endHour", 0.5, MAX_END),
    el("label", { text: LABELS.slotLength }, select),
    numField(LABELS.minDaily, "minDaily", 0, 24, 0.5),
    numField(LABELS.maxDaily, "maxDaily", 0, 24, 0.5),
    numField(LABELS.maxShiftHours, "maxShiftHours", 0, 24, 0.5),
    numField(LABELS.minBreakHours, "minBreakHours", 0, 24, 0.5)));
}

function renderTasks() {
  const box = $("tasks-section");
  box.replaceChildren(el("h2", { text: LABELS.tasksTitle }));
  if (!state.tasks.length) box.append(el("p", { class: "empty", text: LABELS.noTasks }));
  for (const t of state.tasks) {
    const color = el("input", { type: "color", value: t.color, title: LABELS.taskColor });
    color.dataset.action = "task-color";
    color.dataset.id = t.id;
    const name = el("input", { type: "text", value: t.name, title: LABELS.renameTask });
    name.dataset.action = "task-rename";
    name.dataset.id = t.id;
    const del = el("button", { type: "button", text: LABELS.deleteTask });
    del.dataset.action = "task-delete";
    del.dataset.id = t.id;
    const need = el("input", { type: "number", value: taskDefaultNeed(t.id), min: 0, max: 99, step: 1 });
    need.dataset.action = "task-default-need";
    need.dataset.id = t.id;
    box.append(el("div", { class: "row" }, color, name, el("label", { class: "inline", title: LABELS.defaultNeed }, "👥", need), del));
  }
  box.append(el("form", { class: "row", id: "task-form" },
    el("input", { type: "text", id: "task-input", placeholder: LABELS.taskPlaceholder }),
    el("button", { type: "submit", text: LABELS.addTask })));
}

function renderPeople() {
  const box = $("people-section");
  box.replaceChildren(el("h2", { text: LABELS.peopleTitle }));
  if (!state.people.length) box.append(el("p", { class: "empty", text: LABELS.noPeople }));
  for (const p of state.people) {
    const hours = dailyHours(p.id);
    const total = hours.reduce((a, b) => a + b, 0);
    const status = personStatus(hours);
    const del = el("button", { type: "button", text: LABELS.deletePerson });
    del.dataset.action = "person-delete";
    del.dataset.id = p.id;
    const perDay = hours.map((h, i) => LABELS.dayShort + (i + 1) + ": " + fmt(h) + LABELS.hoursUnit
      + " (" + statusLabel(hoursStatus(h)) + ")").join(" | ");
    box.append(el("div", { class: "row person-line " + status, title: perDay },
      el("span", { class: "person-name", text: p.name }),
      el("span", { class: "badge " + status, text: LABELS.totalHours + " " + fmt(total) + LABELS.hoursUnit, title: statusLabel(status) }),
      del,
      el("small", { text: LABELS.perDay + " — " + hours.map((h, i) => LABELS.dayShort + (i + 1) + " " + fmt(h) + LABELS.hoursUnit).join(", ") })));
  }
  box.append(el("form", { class: "row", id: "person-form" },
    el("input", { type: "text", id: "person-input", placeholder: LABELS.personPlaceholder }),
    el("button", { type: "submit", text: LABELS.addPerson })));
}

function renderTimeline() {
  const box = $("timeline-section");
  const auto = el("button", { type: "button", class: "auto-fill", text: "✨ " + LABELS.autoFill, title: LABELS.autoFillHint, disabled: !state.people.length || !state.tasks.length });
  auto.dataset.action = "auto-fill";
  const clear = el("button", { type: "button", class: "clear-all", text: "🗑 " + LABELS.clearAll, title: LABELS.clearAllHint });
  clear.dataset.action = "clear-all";
  box.replaceChildren(el("div", { class: "section-head" }, el("h2", { text: LABELS.timelineTitle }), el("div", { class: "head-actions" }, clear, auto)));
  if (!state.tasks.length) {
    box.append(el("p", { class: "empty", text: LABELS.noTasksTimeline }));
    return;
  }
  const perDay = slotsPerDay();
  const days = el("div", { class: "days" });
  for (let d = 0; d < state.settings.days; d++) {
    const head = el("tr", {}, el("th", { class: "time-head" }));
    for (const t of state.tasks) {
      const th = el("th", { class: "task-head", text: t.name });
      th.style.borderTopColor = t.color;
      head.append(th);
    }
    const body = el("tbody");
    for (let i = 0; i < perDay; i++) {
      const s = d * perDay + i;
      const row = el("tr", {}, el("th", { class: "time-label" + (i % (60 / state.settings.slotMinutes) === 0 ? "" : " minor"), text: slotTime(s) }));
      for (const t of state.tasks) {
        const need = getNeed(t.id, s);
        const cls = ["cell", cellStatus(t.id, s)];
        const minus = el("button", { type: "button", class: "ctrl minus", text: "−", title: LABELS.decrease, disabled: need === 0 });
        minus.dataset.action = "need-minus";
        const plus = el("button", { type: "button", class: "ctrl plus", text: "+", title: LABELS.increase });
        plus.dataset.action = "need-plus";
        const names = getAssigned(t.id, s).map(getPerson).filter(Boolean)
          .map((p) => el("span", { class: "chip", text: p.name, title: p.name }));
        const td = el("td", { class: cls.join(" ") },
          el("div", { class: "cell-inner" },
            el("span", { class: "count", text: getAssigned(t.id, s).length + "/" + need }),
            el("span", { class: "chips" }, ...names),
            el("span", { class: "ctrls" }, minus, plus)),
          el("span", { class: "fill-handle", title: LABELS.fillHandle }));
        td.dataset.task = t.id;
        td.dataset.slot = s;
        row.append(td);
      }
      body.append(row);
    }
    days.append(el("div", { class: "day" }, el("h3", { text: LABELS.dayTitle + " " + (d + 1) }),
      el("div", { class: "table-wrap" }, el("table", { class: "timeline" }, el("thead", {}, head), body))));
  }
  box.append(days);
  const dot = (c, l) => el("span", {}, el("span", { class: "dot", style: "background:" + c }), l);
  box.append(el("div", { class: "legend" }, dot("#22c55e", LABELS.legendOk), dot("#ef4444", LABELS.legendUnder), dot("#f59e0b", LABELS.legendOver)));
}

/** Secondary read-only view: rows = people, columns = slots, cell = assigned task name */
function renderByPerson() {
  const box = $("byperson-section");
  box.replaceChildren(el("h2", { text: LABELS.byPersonTitle }));
  if (!state.people.length || !state.tasks.length) return;
  const per = slotsPerDay();
  const days = el("div", { class: "person-days" });
  for (let d = 0; d < state.settings.days; d++) {
    const head = el("tr", {}, el("th", { text: LABELS.peopleTitle }));
    for (let i = 0; i < per; i++) head.append(el("th", { text: slotTime(d * per + i) }));
    const body = el("tbody");
    for (const p of state.people) {
      const row = el("tr", {}, el("th", { text: p.name }));
      for (let i = 0; i < per; i++) {
        const s = d * per + i;
        const t = state.tasks.find((x) => getAssigned(x.id, s).includes(p.id));
        const td = el("td", { text: t ? t.name : "", class: "pcell" + (t ? " assigned" : ""), title: LABELS.personCellHint });
        if (t) td.style.background = t.color + "55";
        td.dataset.person = p.id;
        td.dataset.slot = s;
        row.append(td);
      }
      body.append(row);
    }
    days.append(el("div", { class: "day" }, el("h3", { text: LABELS.dayTitle + " " + (d + 1) }),
      el("div", { class: "table-wrap" }, el("table", { class: "mini" }, el("thead", {}, head), body))));
  }
  box.append(days);
}

/** Click on a person's slot: cycles empty -> task 1 -> ... -> last task -> empty */
function cyclePersonSlot(personId, slot) {
  const idx = state.tasks.findIndex((x) => getAssigned(x.id, slot).includes(personId));
  for (const t of state.tasks) {
    const k = key(t.id, slot);
    if (state.assignments[k]) state.assignments[k] = state.assignments[k].filter((id) => id !== personId);
  }
  if (idx + 1 < state.tasks.length) {
    const t = state.tasks[idx + 1];
    state.assignments[key(t.id, slot)] = getAssigned(t.id, slot).concat(personId);
  }
  commit();
}

/** Renders the assignment popup content (or hides it). Called after every change. */
function renderPopup() {
  const overlay = $("popup-overlay");
  const task = openPopup && getTask(openPopup.taskId);
  if (!task) {
    openPopup = null;
    overlay.hidden = true;
    overlay.replaceChildren();
    return;
  }
  const { slot } = openPopup;
  const title = el("span", { class: "popup-title", text: task.name }); // readable name, never an id
  title.style.background = task.color;
  const close = el("button", { type: "button", text: LABELS.popupClose });
  close.dataset.action = "popup-close";
  const list = el("div", { class: "person-btns" });
  if (!state.people.length) list.append(el("p", { class: "empty", text: LABELS.popupNoPeople }));
  const assigned = getAssigned(task.id, slot);
  for (const p of state.people) {
    const other = busyTask(p.id, slot, task.id);
    const isOn = assigned.includes(p.id);
    const label = other && !isOn ? p.name + " (" + LABELS.popupBusyOn + " " + other.name + ")" : p.name;
    const btn = el("button", { type: "button", class: "person-btn" + (isOn ? " assigned" : ""), text: label, disabled: !!other && !isOn });
    btn.dataset.action = "toggle-person";
    btn.dataset.person = p.id;
    list.append(btn);
  }
  // The popup is rebuilt from scratch; listeners are delegated on the overlay (see section 7)
  overlay.replaceChildren(el("div", { class: "popup", role: "dialog" },
    el("div", { class: "popup-head" }, title, close),
    el("p", { class: "popup-sub", text: LABELS.popupSlot + " : " + slotLabel(slot) + " — " + LABELS.popupAssigned + " "
      + assigned.length + "/" + getNeed(task.id, slot) + " " + LABELS.popupRequired }),
    list));
  overlay.hidden = false;
}

function render() {
  // Keep the page's focus when a re-render happens while typing is not needed: inputs commit on 'change'.
  renderSettings();
  renderTasks();
  renderPeople();
  renderTimeline();
  renderByPerson();
  renderPopup();
}

/* --------------------------------------------------------------------------
 * 7. Events (delegated: attached once, so re-rendering never kills listeners)
 * -------------------------------------------------------------------------- */
function applySettings(prop, rawValue) {
  const next = Object.assign({}, state.settings, { [prop]: Number(rawValue) });
  const valid = next.days >= 1 && next.days <= 14 && next.endHour > next.startHour && next.endHour <= MAX_END
    && next.startHour >= 0 && next.startHour < 24 && next.endHour - next.startHour <= 24 && next.minDaily >= 0 && next.maxDaily >= next.minDaily && next.maxShiftHours >= 0 && next.minBreakHours >= 0
    && Number.isInteger(((next.endHour - next.startHour) * 60) / next.slotMinutes);
  if (!valid) { alert(LABELS.invalidSettings); render(); return; }
  const timeChanged = ["days", "startHour", "endHour", "slotMinutes"].includes(prop);
  if (timeChanged) {
    if (!confirm(LABELS.confirmGranularity)) { render(); return; }
    state.needs = {};
    state.assignments = {};
  }
  state.settings = next;
  commit();
}

let suppressClick = false;

function setupEvents() {
  // Settings, task rename / color
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.setting) applySettings(t.dataset.setting, t.value);
    else if (t.dataset.action === "task-rename") {
      const task = getTask(t.dataset.id);
      if (task) { task.name = t.value.trim() || task.name; commit(); }
    } else if (t.dataset.action === "task-default-need") {
      const task = getTask(t.dataset.id);
      const v = Math.floor(Number(t.value));
      if (task && v >= 0 && v <= 99) task.defaultNeed = v;
      commit();
    } else if (t.dataset.action === "task-color") {
      const task = getTask(t.dataset.id);
      if (task) { task.color = t.value; commit(); }
    }
  });

  // Add task / person
  document.addEventListener("submit", (e) => {
    e.preventDefault();
    if (e.target.id === "task-form") {
      const name = $("task-input").value.trim() || LABELS.defaultTaskName;
      state.tasks.push({ id: newId("t"), name, color: PALETTE[state.tasks.length % PALETTE.length] });
      commit();
    } else if (e.target.id === "person-form") {
      const name = $("person-input").value.trim();
      if (!name) return;
      state.people.push({ id: newId("p"), name });
      commit();
    }
  });

  // Clicks: buttons with data-action, and timeline cells
  document.addEventListener("click", (e) => {
    const actionEl = e.target.closest("[data-action]");
    const action = actionEl && actionEl.dataset.action;
    const cell = e.target.closest("td.cell");
    const pcell = e.target.closest("td.pcell");
    if (pcell) { cyclePersonSlot(pcell.dataset.person, Number(pcell.dataset.slot)); return; }

    if (e.target.closest(".fill-handle")) return;
    if (action === "task-delete" && confirm(LABELS.confirmDeleteTask)) deleteTask(actionEl.dataset.id);
    else if (action === "person-delete" && confirm(LABELS.confirmDeletePerson)) deletePerson(actionEl.dataset.id);
    else if (action === "auto-fill") autoFill();
    else if (action === "clear-all" && confirm(LABELS.confirmClearAll)) clearAllAssignments();
    else if (action === "need-plus" && cell) adjustNeed(cell.dataset.task, Number(cell.dataset.slot), 1);
    else if (action === "need-minus" && cell) adjustNeed(cell.dataset.task, Number(cell.dataset.slot), -1);
    else if (action === "toggle-person" && openPopup) toggleAssignment(openPopup.taskId, openPopup.slot, actionEl.dataset.person);
    else if (action === "popup-close") { openPopup = null; renderPopup(); }
    else if (e.target === $("popup-overlay")) { openPopup = null; renderPopup(); } // click outside
    else if (cell && !action) { openPopup = { taskId: cell.dataset.task, slot: Number(cell.dataset.slot) }; renderPopup(); }
  });

  // Drag the fill handle of a cell down to copy its team onto the slots below
  let fill = null; // { taskId, from, to }
  const clearFill = () => {
    document.querySelectorAll(".fill-ghost").forEach((n) => n.remove());
    document.querySelectorAll(".fill-target, .fill-source, .fill-hit").forEach((n) => n.classList.remove("fill-target", "fill-source", "fill-hit"));
    document.body.classList.remove("filling");
    if (tip) { tip.remove(); tip = null; }
  };
  document.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".fill-handle");
    const cell = h && h.closest("td.cell");
    if (!cell) return;
    e.preventDefault();
    fill = { taskId: cell.dataset.task, from: Number(cell.dataset.slot), to: Number(cell.dataset.slot) };
    cell.classList.add("fill-source");
  });
  const cellAt = (taskId, slot) => document.querySelector('td.cell[data-task="' + taskId + '"][data-slot="' + slot + '"]');
  let tip = null;
  document.addEventListener("pointermove", (e) => {
    if (!fill) return;
    // Follow the pointer vertically within the source column, whichever column it is over
    const first = cellAt(fill.taskId, fill.from);
    if (!first) return;
    let to = fill.from;
    for (let k = fill.from + 1; dayOf(k) === dayOf(fill.from); k++) {
      const n = cellAt(fill.taskId, k);
      if (!n) break;
      if (n.getBoundingClientRect().top <= e.clientY) to = k; else break;
    }
    fill.to = to;
    clearFill();
    document.body.classList.add("filling");
    const src = first.querySelector(".cell-inner");
    for (let k = fill.from; k <= fill.to; k++) {
      const n = cellAt(fill.taskId, k);
      if (!n) continue;
      n.classList.add(k === fill.from ? "fill-source" : "fill-target");
      const lbl = n.parentElement.querySelector(".time-label");
      if (lbl) lbl.classList.add("fill-hit");
      if (k > fill.from && src) {
        const ghost = el("div", { class: "fill-ghost" });
        ghost.append(src.cloneNode(true));
        n.append(ghost);
      }
    }
    if (!tip) { tip = el("div", { class: "fill-tip" }); document.body.append(tip); }
    tip.textContent = slotTime(fill.from) + " → " + formatMinutes(state.settings.startHour * 60 + ((fill.to % slotsPerDay()) + 1) * state.settings.slotMinutes) + " (" + (fill.to - fill.from) + ")";
    tip.style.left = e.clientX + 16 + "px";
    tip.style.top = e.clientY + 12 + "px";
  });
  document.addEventListener("pointerup", () => {
    if (!fill) return;
    const f = fill;
    fill = null;
    clearFill();
    if (f.to > f.from) {
      suppressClick = true;
      copySlot(f.taskId, f.from, f.to);
      for (let k = f.from + 1; k <= f.to; k++) {
        const n = document.querySelector('td.cell[data-task="' + f.taskId + '"][data-slot="' + k + '"]');
        if (n) n.classList.add("fill-done");
      }
    }
  });
  document.addEventListener("click", (e) => {
    if (suppressClick) { suppressClick = false; e.stopImmediatePropagation(); }
  }, true);

  // Escape closes the popup
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openPopup) { openPopup = null; renderPopup(); }
  });

  // Toolbar: export / import / reset
  $("btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: "team-planner.json" });
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("btn-import").addEventListener("click", () => $("file-import").click());
  $("file-import").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!isValidState(parsed)) throw new Error("invalid");
        state = Object.assign(defaultState(), parsed, { settings: Object.assign(defaultState().settings, parsed.settings) });
        openPopup = null;
        commit();
      } catch (err) { alert(LABELS.importError); }
    };
    reader.readAsText(file);
    e.target.value = "";
  });
  $("btn-reset").addEventListener("click", () => {
    if (confirm(LABELS.confirmResetAll)) { state = defaultState(); openPopup = null; commit(); }
  });
}

/* --------------------------------------------------------------------------
 * 8. Start
 * -------------------------------------------------------------------------- */
document.title = LABELS.appTitle;
$("app-title").textContent = LABELS.appTitle;
$("btn-export").textContent = LABELS.export;
$("btn-import").textContent = LABELS.import;
$("btn-reset").textContent = LABELS.resetAll;
setupEvents();
render();
