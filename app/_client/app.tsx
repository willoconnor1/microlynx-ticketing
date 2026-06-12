"use client";

import React from "react";
import { todayISO, posBetween, PEOPLE, DEVICE_TYPES, assignees, type Ticket, type Status, type Person } from "@/lib/tickets";
import {
  fetchState, saveTicketAction, setUrgencyAction, setStatusAction, moveTicketAction,
  deleteTicketAction, patchTicketAction,
} from "@/lib/actions";
import {
  Icon, ListView, PartsView, ArchiveView, TopNav, QuickMenu,
  MobileSheet, TicketForm, ConfirmMoveDialog, ConfirmDeleteDialog, type View, type Drag,
  type FormDraft, type PendingMove, type InlinePatch,
} from "./ui";
import { celebrate } from "./confetti";

const VIEW_META: Record<View, [string, string, string]> = {
  list: ["ACTIVE QUEUE", "Repair tickets", "Most urgent first, then soonest due — grab the top of the list."],
  parts: ["ON HOLD", "Waiting on parts", "Parked until parts arrive — set a ticket's status to bring it back to the queue."],
  archive: ["RECORDS VAULT", "Archive", "Picked-up tickets from the last 7 days. Search to find older records."],
};

type MenuCtx = { x: number; y: number; ticket: Ticket } | null;

export default function App({ initialTickets, initialArchive }: { initialTickets: Ticket[]; initialArchive: Ticket[] }) {
  const [tickets, setTickets] = React.useState<Ticket[]>(initialTickets);
  const [archive, setArchive] = React.useState<Ticket[]>(initialArchive);
  const [view, setView] = React.useState<View>("list");
  const [search, setSearch] = React.useState("");
  const [form, setForm] = React.useState<Partial<Ticket> | null>(null);
  const [menu, setMenu] = React.useState<MenuCtx>(null);
  const [sheet, setSheet] = React.useState(false);
  const [drag, setDrag] = React.useState<Drag>(null);
  const [pendingMove, setPendingMove] = React.useState<PendingMove | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<Ticket | null>(null);
  const [who, setWho] = React.useState<"all" | Person>("all");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [today] = React.useState(() => todayISO());

  const busy = React.useRef(false); // suppress polling while the user is mid-interaction
  busy.current = !!drag || !!form || !!menu || !!pendingMove || !!confirmDelete || !!expandedId;

  // Stable identities: these reach the memoized list rows, so recreating them
  // every render would defeat the memo and repaint all rows on any state change.
  const apply = React.useCallback((s: { tickets: Ticket[]; archive: Ticket[] }) => {
    setTickets(s.tickets);
    setArchive(s.archive);
  }, []);
  const ticketsRef = React.useRef(tickets); ticketsRef.current = tickets;

  /* keep the board fresh across devices: poll + refetch on focus */
  React.useEffect(() => {
    const refresh = async () => { if (!busy.current) apply(await fetchState()); };
    const id = setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(id); window.removeEventListener("focus", refresh); };
  }, []);

  React.useEffect(() => { setSearch(""); }, [view]);

  /* ---- mutations (optimistic, then reconcile with the server) ---- */
  const setUrgency = React.useCallback((id: string, u: number) => {
    setTickets((p) => p.map((x) => (x.id === id ? { ...x, urgency: u } : x)));
    setUrgencyAction(id, u).then(apply);
  }, [apply]);
  const setStatus = React.useCallback((id: string, s: Status) => {
    if (s === "done" && ticketsRef.current.find((x) => x.id === id)?.status !== "done") celebrate();
    setTickets((p) => p.map((x) => {
      if (x.id !== id) return x;
      const next: Ticket = { ...x, status: s, statusChangedAt: new Date().toISOString() };
      next.pickedAt = s === "picked" ? x.pickedAt || today : null;
      return next;
    }));
    setStatusAction(id, s).then(apply);
  }, [apply, today]);
  const saveTicket = (data: FormDraft) => {
    setForm(null);
    saveTicketAction(data.id, {
      name: data.name, phone: data.phone, desc: data.desc,
      urgency: data.urgency, charger: data.charger, status: data.status, dropoff: data.dropoff,
      dropoffAmPm: data.dropoffAmPm, dueAt: data.dueAt, assignedTo: data.assignedTo,
      deviceType: data.deviceType, serviceTag: data.serviceTag,
    }).then(apply);
  };
  const patchTicket = React.useCallback((id: string, patch: InlinePatch) => {
    setTickets((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    patchTicketAction(id, patch).then(apply);
  }, [apply]);
  const toggleExpand = React.useCallback((id: string) => setExpandedId((p) => (p === id ? null : id)), []);
  const doDelete = (t: Ticket) => {
    setConfirmDelete(null);
    setTickets((p) => p.filter((x) => x.id !== t.id));
    deleteTicketAction(t.id).then(apply);
  };
  const commitMove = (m: PendingMove) => {
    // Optimistic: land the row where it was dropped; the server computes the
    // authoritative position from the neighbor ids and reconciles via apply().
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

  // "Active" = work still to be done: To Do + In Progress only. Complete, Picked Up,
  // and Waiting on Parts all drop out of these numbers (Garrett's request).
  const isActive = (x: Ticket) => x.status === "todo" || x.status === "prog";
  const activeCount = byPerson.filter(isActive).length;
  const deviceCounts = React.useMemo(() => {
    const active = byPerson.filter(isActive);
    return DEVICE_TYPES
      .map((d) => ({ ...d, n: active.filter((x) => x.deviceType === d.key).length }))
      .filter((d) => d.n > 0);
  }, [byPerson]);
  // The tab badge reflects the whole shop, ignoring the person filter.
  const partsCount = tickets.filter((t) => t.status === "parts").length;
  const showSearch = view === "list" || view === "archive";

  let body: React.ReactNode;
  if (view === "list") body = <ListView tickets={listTickets} onMenu={openMenu} onStatus={setStatus} onMoveRequest={requestMove} onPatch={patchTicket} expandedId={expandedId} onToggleExpand={toggleExpand} drag={drag} setDrag={setDrag} canReorder={canReorder} />;
  else if (view === "parts") body = <PartsView tickets={byPerson} onStatus={setStatus} onMenu={openMenu} onPatch={patchTicket} expandedId={expandedId} onToggleExpand={toggleExpand} />;
  else body = <ArchiveView archive={visibleArchive} search={search} onStatus={setStatus} />;

  return (
    <>
      <TopNav view={view} setView={setView} onNew={() => setForm({})} onMobileMenu={() => setSheet(true)} partsCount={partsCount} />

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
                <input placeholder={view === "archive" ? "Search the vault…" : "Search tickets…"}
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            )}
            {view === "list" && (
              <div className="queue-stats">
                <span className="count-pill">{activeCount} active</span>
                {deviceCounts.map((d) => (
                  <span key={d.key} className="dev-count">
                    <span className={`dev-dot ${d.key}`} />
                    {d.n} {d.key === "misc" ? "misc" : d.label.toLowerCase() + (d.n === 1 ? "" : "s")}
                  </span>
                ))}
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
      {sheet && <MobileSheet view={view} setView={setView} onClose={() => setSheet(false)} partsCount={partsCount} />}
    </>
  );
}
