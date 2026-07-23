"use client";

import React from "react";
import { todayISO, type Ticket, type Status } from "@/lib/tickets";
import {
  fetchState, saveTicketAction, setUrgencyAction, setStatusAction, reorderTicketAction,
} from "@/lib/actions";
import {
  Icon, ListView, UrgencyBoard, StatusBoard, ArchiveView, TopNav, QuickMenu,
  MobileSheet, TicketForm, type View, type Drag, type FormDraft,
} from "./ui";

const VIEW_META: Record<View, [string, string, string]> = {
  list: ["ACTIVE QUEUE", "Repair tickets", "Most urgent first, then oldest — grab the top of the list."],
  urgency: ["URGENCY BOARD", "Triage by urgency", "Drag a card between columns to change its urgency. 1 is most urgent."],
  status: ["STATUS BOARD", "Move repairs along", "Drag a card to move a device through the repair flow."],
  archive: ["RECORDS VAULT", "Archive", "Picked-up tickets, kept on file. Read-only."],
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
  const [today] = React.useState(() => todayISO());

  const busy = React.useRef(false); // suppress polling while the user is mid-interaction
  busy.current = !!drag || !!form || !!menu;

  const apply = (s: { tickets: Ticket[]; archive: Ticket[] }) => {
    setTickets(s.tickets);
    setArchive(s.archive);
  };

  /* keep the board fresh across devices: poll + refetch on focus */
  React.useEffect(() => {
    const refresh = async () => { if (!busy.current) apply(await fetchState()); };
    const id = setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(id); window.removeEventListener("focus", refresh); };
  }, []);

  React.useEffect(() => { setSearch(""); }, [view]);

  /* ---- mutations (optimistic, then reconcile with the server) ---- */
  const setUrgency = (id: string, u: number) => {
    setTickets((p) => p.map((x) => (x.id === id ? { ...x, urgency: u } : x)));
    setUrgencyAction(id, u).then(apply);
  };
  const setStatus = (id: string, s: Status) => {
    setTickets((p) => p.map((x) => {
      if (x.id !== id) return x;
      const next: Ticket = { ...x, status: s, statusChangedAt: new Date().toISOString() };
      next.pickedAt = s === "picked" ? x.pickedAt || today : null;
      return next;
    }));
    setStatusAction(id, s).then(apply);
  };
  const saveTicket = (data: FormDraft) => {
    setForm(null);
    saveTicketAction(data.id, {
      name: data.name, phone: data.phone, desc: data.desc,
      urgency: data.urgency, charger: data.charger, status: data.status,
      dropoff: data.dropoff, dueDate: data.dueDate,
    }).then(apply);
  };
  const reorderTicket = (id: string, prevId: string | null) => {
    reorderTicketAction(id, prevId).then(apply);
  };
  const openMenu = (e: React.MouseEvent, ticket: Ticket) => setMenu({ x: e.clientX, y: e.clientY, ticket });

  const [eyebrow, title, sub] = VIEW_META[view];

  const listTickets = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((x) => x.name.toLowerCase().includes(q) || x.desc.toLowerCase().includes(q) || x.id.toLowerCase().includes(q));
  }, [tickets, search]);

  const activeCount = tickets.filter((x) => x.status !== "picked").length;
  const showSearch = view === "list" || view === "archive";

  let body: React.ReactNode;
  if (view === "list") body = <ListView tickets={listTickets} onMenu={openMenu} onEdit={(tk) => setForm(tk)} onReorder={reorderTicket} />;
  else if (view === "urgency") body = <UrgencyBoard tickets={tickets} onMenu={openMenu} onOpen={(tk) => setForm(tk)} onUrgency={setUrgency} drag={drag} setDrag={setDrag} />;
  else if (view === "status") body = <StatusBoard tickets={tickets} onMenu={openMenu} onOpen={(tk) => setForm(tk)} onStatus={setStatus} drag={drag} setDrag={setDrag} />;
  else body = <ArchiveView archive={archive} search={search} />;

  return (
    <>
      <TopNav view={view} setView={setView} onNew={() => setForm({})} onMobileMenu={() => setSheet(true)} />

      <main className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">{"</"} {eyebrow} {">"}</div>
            <h1>{title}</h1>
            <div className="sub">{sub}</div>
          </div>
          <div className="page-tools">
            {view === "list" && <span className="count-pill">{activeCount} active</span>}
            {showSearch && (
              <div className="searchbox">
                <Icon name="search" />
                <input placeholder={view === "archive" ? "Search the vault…" : "Search tickets…"}
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {body}
      </main>

      {form && <TicketForm editing={form} today={today} onSave={saveTicket} onClose={() => setForm(null)} />}
      {menu && <QuickMenu ctx={menu} onClose={() => setMenu(null)} onUrgency={setUrgency} onStatus={setStatus} onEdit={(tk) => setForm(tk)} />}
      {sheet && <MobileSheet view={view} setView={setView} onClose={() => setSheet(false)} />}
    </>
  );
}
