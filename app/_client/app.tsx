"use client";

import React from "react";
import { todayISO, posBetween, PEOPLE, DEVICE_TYPES, assignees, type Ticket, type Status, type Person } from "@/lib/tickets";
import {
  fetchState, saveTicketAction, setUrgencyAction, setStatusAction, moveTicketAction,
  deleteTicketAction, patchTicketAction,
} from "@/lib/actions";
import {
  Icon, ListView, PartsView, MaybeView, ArchiveView, TopNav, QuickMenu,
  MobileSheet, TicketForm, ConfirmMoveDialog, ConfirmDeleteDialog, SettingsModal, PrintPanel,
  type View, type Drag, type FormDraft, type PendingMove, type InlinePatch,
} from "./ui";
import { celebrate } from "./confetti";
import { alertReason, alertSignature, alertTime, type AlertKind } from "./alerts";
import { playChime, unlockAudio, DEFAULT_NEW, DEFAULT_REORDER } from "./chime";
import {
  loadResolved, saveResolved, loadFeed, saveFeed, loadSoundOn, saveSoundOn,
  loadSoundChoice, saveSoundChoice, FEED_MAX, type FeedItem,
} from "./notifStore";

const VIEW_META: Record<View, [string, string, string]> = {
  list: ["ACTIVE QUEUE", "Repair tickets", "Most urgent first, then soonest due — grab the top of the list."],
  parts: ["ON HOLD", "Waiting on parts", "Parked until parts arrive — set a ticket's status to bring it back to the queue."],
  maybe: ["MAYBE LATER", "Maybe later", "Tickets parked here aren't urgent — set any active status to bring one back."],
  archive: ["RECORDS VAULT", "Archive", "Picked-up tickets from the last 7 days. Search to find older records."],
};

type MenuCtx = { x: number; y: number; ticket: Ticket } | null;

export default function App({ initialTickets, initialArchive }: { initialTickets: Ticket[]; initialArchive: Ticket[] }) {
  const [tickets, setTickets] = React.useState<Ticket[]>(initialTickets);
  const [archive, setArchive] = React.useState<Ticket[]>(initialArchive);
  const [view, setView] = React.useState<View>(() => {
    try {
      const s = typeof window !== "undefined" ? localStorage.getItem("mlx-view") : null;
      return (s && ["list", "parts", "maybe", "archive"].includes(s) ? s : "list") as View;
    } catch { return "list"; }
  });
  React.useEffect(() => { try { localStorage.setItem("mlx-view", view); } catch {} }, [view]);
  const [search, setSearch] = React.useState("");
  const [form, setForm] = React.useState<Partial<Ticket> | null>(null);
  const [menu, setMenu] = React.useState<MenuCtx>(null);
  const [sheet, setSheet] = React.useState(false);
  const [drag, setDrag] = React.useState<Drag>(null);
  const [pendingMove, setPendingMove] = React.useState<PendingMove | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<Ticket | null>(null);
  const [printTicket, setPrintTicket] = React.useState<Ticket | null>(null);
  const onPrint = React.useCallback((t: Ticket) => setPrintTicket(t), []);
  const [who, setWho] = React.useState<"all" | Person>("all");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const today = todayISO();

  const busy = React.useRef(false); // suppress polling while the user is mid-interaction
  busy.current = !!drag || !!form || !!menu || !!pendingMove || !!confirmDelete || !!printTicket;

  /* ---- notifications (all per-screen, saved in this browser) ---- */
  const [resolved, setResolved] = React.useState<Record<string, string>>(loadResolved);
  const [feed, setFeed] = React.useState<FeedItem[]>(loadFeed);
  const [soundOn, setSoundOn] = React.useState<boolean>(loadSoundOn);
  const [soundNew, setSoundNew] = React.useState<string>(() => loadSoundChoice("new", DEFAULT_NEW));
  const [soundReorder, setSoundReorder] = React.useState<string>(() => loadSoundChoice("reorder", DEFAULT_REORDER));
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [alertTick, setAlertTick] = React.useState(0); // ticks each minute so 2h-old glows expire

  const prevSigRef = React.useRef<Map<string, string> | null>(null); // last seen alert per ticket
  const selfChangedIds = React.useRef<Set<string>>(new Set());       // ids this screen just changed
  const audioReady = React.useRef(false);
  const resolvedRef = React.useRef(resolved); resolvedRef.current = resolved;
  const soundOnRef = React.useRef(soundOn); soundOnRef.current = soundOn;
  const soundChoiceRef = React.useRef({ new: soundNew, reorder: soundReorder });
  soundChoiceRef.current = { new: soundNew, reorder: soundReorder };

  React.useEffect(() => saveResolved(resolved), [resolved]);
  React.useEffect(() => saveFeed(feed), [feed]);
  React.useEffect(() => saveSoundOn(soundOn), [soundOn]);
  React.useEffect(() => saveSoundChoice("new", soundNew), [soundNew]);
  React.useEffect(() => saveSoundChoice("reorder", soundReorder), [soundReorder]);
  React.useEffect(() => { const id = setInterval(() => setAlertTick((t) => t + 1), 60000); return () => clearInterval(id); }, []);

  // If this screen had sound on from a previous visit, the browser still blocks
  // audio until a gesture — unlock on the first interaction.
  React.useEffect(() => {
    if (!soundOn || audioReady.current) return;
    const unlock = async () => {
      audioReady.current = await unlockAudio();
      if (audioReady.current) { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); }
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, [soundOn]);

  // Compare each fresh server state to the last one: surface genuinely new/moved
  // tickets to the feed (and chime, on Keith's screen). Glow itself is derived
  // separately from timestamps, so it needs no bookkeeping here.
  const processAlerts = React.useCallback((next: Ticket[]) => {
    const now = Date.now();
    const nextSig = new Map<string, string>();
    const kinds = new Map<string, AlertKind>();
    for (const t of next) {
      const r = alertReason(t, now);
      if (!r) continue;
      nextSig.set(t.id, alertSignature(t, r));
      kinds.set(t.id, r);
    }

    const prev = prevSigRef.current;
    const self = selfChangedIds.current;
    const fresh: FeedItem[] = [];
    const autoResolve: Record<string, string> = {};
    const makeItem = (t: Ticket, kind: AlertKind, sig: string): FeedItem => ({
      key: `${t.id}|${sig}`, id: t.id, kind,
      text: kind === "new" ? `New ticket — ${t.name}` : `Moved in queue — ${t.name}`,
      ts: alertTime(t, kind),
    });

    if (prev === null) {
      // First state of the session: seed the baseline silently, but backfill the
      // feed so a screen opened mid-shift still shows what's currently glowing.
      for (const [id, sig] of nextSig) {
        if (resolvedRef.current[id] === sig) continue;
        const t = next.find((x) => x.id === id)!;
        fresh.push(makeItem(t, kinds.get(id)!, sig));
      }
    } else {
      for (const [id, sig] of nextSig) {
        if (prev.get(id) === sig) continue;             // nothing new for this ticket
        const t = next.find((x) => x.id === id)!;
        if (self.has(id)) { autoResolve[id] = sig; continue; } // our own action — stay quiet
        if (resolvedRef.current[id] === sig) continue;  // already acknowledged
        const kind = kinds.get(id)!;
        fresh.push(makeItem(t, kind, sig));
        if (soundOnRef.current && audioReady.current) playChime(kind, soundChoiceRef.current[kind]);
      }
    }

    self.clear();
    prevSigRef.current = nextSig;

    if (fresh.length) {
      fresh.sort((a, b) => b.ts - a.ts);
      setFeed((p) => {
        const have = new Set(p.map((f) => f.key));
        const add = fresh.filter((f) => !have.has(f.key));
        return add.length ? [...add, ...p].slice(0, FEED_MAX) : p;
      });
    }

    // Keep resolved only for ids still alerting (and apply our own auto-resolves),
    // so a ticket that gets a *new* event after being resolved glows again.
    setResolved((prevResolved) => {
      const out: Record<string, string> = {};
      for (const [id, sig] of nextSig) {
        if (autoResolve[id]) out[id] = autoResolve[id];
        else if (prevResolved[id] === sig) out[id] = sig;
      }
      const same = Object.keys(out).length === Object.keys(prevResolved).length &&
        Object.keys(out).every((k) => prevResolved[k] === out[k]);
      return same ? prevResolved : out;
    });
  }, []);

  // Stable identities: these reach the memoized list rows, so recreating them
  // every render would defeat the memo and repaint all rows on any state change.
  const apply = React.useCallback((s: { tickets: Ticket[]; archive: Ticket[] }) => {
    processAlerts(s.tickets);
    setTickets(s.tickets);
    setArchive(s.archive);
  }, [processAlerts]);
  const ticketsRef = React.useRef(tickets); ticketsRef.current = tickets;

  /* Real-time sync: SSE push from the server on every mutation, with a 30 s poll
     and a focus-refetch as fallback in case the SSE connection drops. */
  React.useEffect(() => {
    const refresh = async () => { if (!busy.current) apply(await fetchState()); };
    const es = new EventSource("/api/updates");
    es.onmessage = refresh;
    es.onerror = () => es.close(); // poll fallback takes over if SSE fails
    const id = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { es.close(); clearInterval(id); window.removeEventListener("focus", refresh); };
  }, []);

  // On mount, treat the server-rendered initial tickets as the baseline so the
  // feed backfills and no chimes fire for tickets that were already there.
  React.useEffect(() => { processAlerts(ticketsRef.current); }, [processAlerts]);

  /* derived: which tickets are glowing right now (new/moved < 2h, not resolved) */
  const alertSet = React.useMemo(() => {
    const now = Date.now();
    const s = new Set<string>();
    for (const t of tickets) {
      const r = alertReason(t, now);
      if (!r) continue;
      if (resolved[t.id] === alertSignature(t, r)) continue;
      s.add(t.id);
    }
    return s;
  }, [tickets, resolved, alertTick]);
  const getAlert = React.useCallback((id: string) => alertSet.has(id), [alertSet]);

  const resolveAll = React.useCallback(() => {
    const now = Date.now();
    setResolved((prev) => {
      const out = { ...prev };
      for (const t of ticketsRef.current) {
        const r = alertReason(t, now);
        if (r) out[t.id] = alertSignature(t, r);
      }
      return out;
    });
  }, []);

  const toggleSound = React.useCallback(async () => {
    if (soundOnRef.current) { setSoundOn(false); return; }
    audioReady.current = await unlockAudio();
    setSoundOn(true);
  }, []);

  React.useEffect(() => { setSearch(""); }, [view]);

  /* ---- undo (Ctrl/Cmd+Z) ---- */
  type UndoEntry = { label: string; undo: () => void };
  const undoStack = React.useRef<UndoEntry[]>([]);
  const isUndoing = React.useRef(false);
  const [undoToast, setUndoToast] = React.useState<string | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = React.useCallback((msg: string) => {
    setUndoToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setUndoToast(null), 2200);
  }, []);
  const pushUndo = React.useCallback((label: string, fn: () => void) => {
    if (isUndoing.current) return;
    undoStack.current.push({ label, undo: fn });
    if (undoStack.current.length > 20) undoStack.current.shift();
  }, []);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "z" || e.shiftKey) return;
      const tgt = e.target as HTMLElement;
      if (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable) return;
      const entry = undoStack.current.pop();
      if (!entry) { showToast("Nothing to undo"); return; }
      e.preventDefault();
      isUndoing.current = true;
      entry.undo();
      isUndoing.current = false;
      showToast(`Undone · ${entry.label}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showToast]);

  /* ---- mutations (optimistic, then reconcile with the server) ---- */
  const setUrgency = React.useCallback((id: string, u: number) => {
    const old = ticketsRef.current.find((x) => x.id === id);
    if (old) pushUndo("urgency change", () => {
      selfChangedIds.current.add(id);
      setTickets((p) => p.map((x) => (x.id === id ? { ...x, urgency: old.urgency } : x)));
      setUrgencyAction(id, old.urgency).then(apply);
    });
    selfChangedIds.current.add(id);
    setTickets((p) => p.map((x) => (x.id === id ? { ...x, urgency: u } : x)));
    setUrgencyAction(id, u).then(apply);
  }, [apply, pushUndo]);
  const setStatus = React.useCallback((id: string, s: Status) => {
    const old = ticketsRef.current.find((x) => x.id === id);
    if (old) pushUndo("status change", () => {
      selfChangedIds.current.add(id);
      setTickets((p) => p.map((x) => (x.id === id ? { ...x, status: old.status, pickedAt: old.pickedAt ?? null } : x)));
      setStatusAction(id, old.status).then(apply);
    });
    if (s === "done" && old?.status !== "done") celebrate();
    setTickets((p) => p.map((x) => {
      if (x.id !== id) return x;
      const next: Ticket = { ...x, status: s, statusChangedAt: new Date().toISOString() };
      next.pickedAt = s === "picked" ? x.pickedAt || today : null;
      return next;
    }));
    setStatusAction(id, s).then(apply);
  }, [apply, today, pushUndo]);
  const saveTicket = (data: FormDraft, print = false) => {
    const oldTicket = data.id ? ticketsRef.current.find((x) => x.id === data.id) : null;
    setForm(null);
    saveTicketAction(data.id, {
      name: data.name, phone: data.phone, password: data.password, desc: data.desc,
      notes: data.notes || null,
      urgency: data.urgency, charger: data.charger, status: data.status, dropoff: data.dropoff,
      dropoffAmPm: data.dropoffAmPm, dueAt: data.dueAt, assignedTo: data.assignedTo,
      deviceType: data.deviceType, serviceTag: data.serviceTag,
    }).then(({ state, id }) => {
      selfChangedIds.current.add(id);
      apply(state);
      if (print) setPrintTicket({ ...data, id });
      if (oldTicket) {
        // edit — undo by restoring the old field values
        pushUndo("ticket edit", () => {
          saveTicketAction(id, {
            name: oldTicket.name, phone: oldTicket.phone, password: oldTicket.password ?? "",
            desc: oldTicket.desc, notes: oldTicket.notes ?? null,
            urgency: oldTicket.urgency, charger: oldTicket.charger,
            status: oldTicket.status, dropoff: oldTicket.dropoff,
            dropoffAmPm: oldTicket.dropoffAmPm ?? null, dueAt: oldTicket.dueAt ?? null,
            assignedTo: oldTicket.assignedTo ?? [], deviceType: oldTicket.deviceType ?? null,
            serviceTag: oldTicket.serviceTag ?? null,
          }).then(({ state: s }) => { selfChangedIds.current.add(id); apply(s); });
        });
      } else {
        // create — undo by deleting the new ticket
        pushUndo("new ticket", () => {
          setTickets((p) => p.filter((x) => x.id !== id));
          deleteTicketAction(id).then(apply);
        });
      }
    });
  };
  const patchTicket = React.useCallback((id: string, patch: InlinePatch) => {
    const old = ticketsRef.current.find((x) => x.id === id);
    if (old) {
      const revert = Object.fromEntries(Object.keys(patch).map((k) => [k, (old as unknown as Record<string, unknown>)[k]])) as InlinePatch;
      pushUndo("edit", () => {
        selfChangedIds.current.add(id);
        setTickets((p) => p.map((x) => (x.id === id ? { ...x, ...revert } : x)));
        patchTicketAction(id, revert).then(apply);
      });
    }
    selfChangedIds.current.add(id);
    setTickets((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    patchTicketAction(id, patch).then(apply);
  }, [apply, pushUndo]);
  const toggleExpand = React.useCallback((id: string) => {
    setExpandedId((p) => (p === id ? null : id));
    const t = ticketsRef.current.find((x) => x.id === id);
    if (t) {
      const r = alertReason(t, Date.now());
      if (r) setResolved((prev) => ({ ...prev, [id]: alertSignature(t, r) }));
    }
  }, []);
  const doDelete = (t: Ticket) => {
    pushUndo("delete", () => {
      saveTicketAction(null, {
        name: t.name, phone: t.phone, password: t.password ?? "", desc: t.desc,
        notes: t.notes ?? null,
        urgency: t.urgency, charger: t.charger, status: t.status, dropoff: t.dropoff,
        dropoffAmPm: t.dropoffAmPm ?? null, dueAt: t.dueAt ?? null,
        assignedTo: t.assignedTo ?? [], deviceType: t.deviceType ?? null,
        serviceTag: t.serviceTag ?? null,
      }).then(({ state }) => apply(state));
    });
    setConfirmDelete(null);
    setTickets((p) => p.filter((x) => x.id !== t.id));
    deleteTicketAction(t.id).then(apply);
  };
  const commitMove = (m: PendingMove) => {
    // Capture neighbors before the move so we can reverse it.
    const grp = ticketsRef.current
      .filter((x) => x.urgency === m.ticket.urgency &&
        (x.status === "todo" || x.status === "prog" || x.status === "call" || x.status === "resp"))
      .sort((a, b) => (a.sortPos ?? Infinity) - (b.sortPos ?? Infinity));
    const gi = grp.findIndex((x) => x.id === m.ticket.id);
    const oldPrevId = gi > 0 ? grp[gi - 1].id : null;
    const oldNextId = gi < grp.length - 1 ? grp[gi + 1].id : null;
    const oldUrgency = m.ticket.urgency;
    pushUndo("move", () => {
      selfChangedIds.current.add(m.ticket.id);
      setTickets((p) => p.map((x) => (x.id === m.ticket.id ? { ...x, urgency: oldUrgency } : x)));
      moveTicketAction(m.ticket.id, oldUrgency, oldPrevId, oldNextId).then(apply);
    });
    selfChangedIds.current.add(m.ticket.id);
    setTickets((p) => {
      const prev = m.prevId ? p.find((x) => x.id === m.prevId)?.sortPos : null;
      const next = m.nextId ? p.find((x) => x.id === m.nextId)?.sortPos : null;
      const pos = posBetween(prev ?? null, next ?? null);
      return p.map((x) => (x.id === m.ticket.id ? { ...x, urgency: m.urgency, sortPos: pos } : x));
    });
    moveTicketAction(m.ticket.id, m.urgency, m.prevId, m.nextId).then(apply);
  };
  const requestMove = (m: PendingMove) => {
    if (m.jumped.length) setPendingMove(m);
    else commitMove(m);
  };
  const openMenu = React.useCallback((e: React.MouseEvent, ticket: Ticket) => setMenu({ x: e.clientX, y: e.clientY, ticket }), []);

  const [eyebrow, title, sub] = VIEW_META[view];

  // Person filter first, then search on top of it. A multi-assigned ticket
  // shows under EACH of its people's tabs.
  const byPerson = React.useMemo(
    () => (who === "all" ? tickets : tickets.filter((x) => assignees(x).includes(who))),
    [tickets, who]
  );
  const listTickets = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return byPerson;
    return byPerson.filter((x) => x.name.toLowerCase().includes(q) || x.desc.toLowerCase().includes(q) || x.id.toLowerCase().includes(q));
  }, [byPerson, search]);
  const visibleArchive = React.useMemo(
    () => (who === "all" ? archive : archive.filter((x) => assignees(x).includes(who))),
    [archive, who]
  );
  // Reordering needs the full list visible — hidden rows would get jumped silently.
  const canReorder = who === "all" && !search.trim();

  // "Active" = work still to be done: To Do + In Progress + Awaiting Response. Complete,
  // Picked Up, and Waiting on Parts all drop out of these numbers (Garrett's request).
  const isActive = (x: Ticket) => x.status === "todo" || x.status === "prog" || x.status === "resp" || x.status === "parts";
  const activeCount = byPerson.filter(isActive).length;
  // Device dot counts include "Call Customer" tickets (still physically in the shop).
  const isInShop = (x: Ticket) => x.status === "todo" || x.status === "prog" || x.status === "resp" || x.status === "call";
  const deviceCounts = React.useMemo(() => {
    const inShop = byPerson.filter(isInShop);
    return DEVICE_TYPES
      .map((d) => ({ ...d, n: inShop.filter((x) => x.deviceType === d.key).length }))
      .filter((d) => d.n > 0);
  }, [byPerson]);
  // The tab badge reflects the whole shop, ignoring the person filter.
  const partsCount = tickets.filter((t) => t.status === "parts").length;
  const maybeCount = tickets.filter((t) => t.status === "maybe").length;
  // Parts count for the stats bar respects the person filter.
  const partsCountForStats = byPerson.filter((x) => x.status === "parts").length;
  const showSearch = true;

  const notif = {
    count: alertSet.size, feed, open: notifOpen, setOpen: setNotifOpen,
    soundOn, onToggleSound: toggleSound,
    soundNew, setSoundNew, soundReorder, setSoundReorder,
    onResolveAll: resolveAll, onOpenSettings: () => setSettingsOpen(true),
  };

  let body: React.ReactNode;
  if (view === "list") body = <ListView tickets={listTickets} onMenu={openMenu} onStatus={setStatus} onMoveRequest={requestMove} onPatch={patchTicket} onPrint={onPrint} expandedId={expandedId} onToggleExpand={toggleExpand} drag={drag} setDrag={setDrag} canReorder={canReorder} getAlert={getAlert} />;
  else if (view === "parts") body = <PartsView tickets={listTickets} onStatus={setStatus} onMenu={openMenu} onPatch={patchTicket} onPrint={onPrint} expandedId={expandedId} onToggleExpand={toggleExpand} drag={drag} setDrag={setDrag} onMoveRequest={requestMove} canReorder={canReorder} />;
  else if (view === "maybe") body = <MaybeView tickets={listTickets} onStatus={setStatus} onMenu={openMenu} onPatch={patchTicket} onPrint={onPrint} expandedId={expandedId} onToggleExpand={toggleExpand} drag={drag} setDrag={setDrag} onMoveRequest={requestMove} canReorder={canReorder} />;
  else body = <ArchiveView archive={visibleArchive} search={search} onStatus={setStatus} onMenu={openMenu} />;

  return (
    <>
      <TopNav view={view} setView={setView} onNew={() => setForm({})} onMobileMenu={() => setSheet(true)} partsCount={partsCount} maybeCount={maybeCount} notif={notif} />

      <main className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">{"</"} {eyebrow} {">"}</div>
            <h1>{title}</h1>
            <div className="sub">{sub}</div>
          </div>
          <div className="page-tools">
            <div className="who-tabs">
              <button className={`who-tab ${who === "all" ? "on" : ""}`} onClick={() => setWho("all")}>All</button>
              {PEOPLE.map((p) => (
                <button key={p.key} className={`who-tab ${p.key} ${who === p.key ? "on" : ""}`} onClick={() => setWho(p.key)}>
                  {p.label}
                </button>
              ))}
            </div>
            {showSearch && (
              <div className="searchbox">
                <Icon name="search" />
                <input placeholder="Search tickets…"
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            )}
            {view === "list" && (
              <div className="queue-stats">
                <span className="count-pill">{activeCount} active</span>
                {deviceCounts.map((d) => (
                  <span key={d.key} className="dev-count">
                    <span className={`dev-dot ${d.key}`} />
                    {d.n} {d.key === "misc" ? "misc" : d.key === "aio" ? (d.n === 1 ? "AIO" : "AIOs") : d.label.toLowerCase() + (d.n === 1 ? "" : "s")}
                  </span>
                ))}
                {partsCountForStats > 0 && (
                  <span className="dev-count parts-count">
                    <span className="dev-dot parts-dot" />
                    {partsCountForStats} on parts
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {body}
      </main>

      {form && <TicketForm editing={form} today={today} onSave={saveTicket} onClose={() => setForm(null)} />}
      {pendingMove && (
        <ConfirmMoveDialog move={pendingMove}
          onCancel={() => setPendingMove(null)}
          onConfirm={() => { commitMove(pendingMove); setPendingMove(null); }} />
      )}
      {menu && <QuickMenu ctx={menu} onClose={() => setMenu(null)} onUrgency={setUrgency} onStatus={setStatus} onEdit={(tk) => setForm(tk)} onDelete={(tk) => setConfirmDelete(tk)} />}
      {confirmDelete && (
        <ConfirmDeleteDialog ticket={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => doDelete(confirmDelete)} />
      )}
      {sheet && <MobileSheet view={view} setView={setView} onClose={() => setSheet(false)} partsCount={partsCount} maybeCount={maybeCount} onOpenSettings={() => setSettingsOpen(true)} />}
      {settingsOpen && <SettingsModal notif={notif} onClose={() => setSettingsOpen(false)} />}
      {printTicket && <PrintPanel ticket={printTicket} onClose={() => setPrintTicket(null)} />}
      {undoToast && <div className="undo-toast">{undoToast}</div>}
    </>
  );
}
