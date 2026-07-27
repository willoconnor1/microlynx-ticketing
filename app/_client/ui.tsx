"use client";

import React from "react";
import {
  Calendar, Phone, Plug, PlugZap, Search, Pencil, EllipsisVertical, Check, X,
  List, SignalHigh, Columns3, Archive, Plus, Menu, Inbox, Wrench, CircleCheck,
  PackageCheck, Clock, Circle, Loader, GripVertical, Printer, type LucideIcon,
} from "lucide-react";
import {
  URGENCY, STATUS, STATUS_ORDER, fmtDate, sortUrgencyOldest, sortOldest,
  sortEntryOrder, type Ticket, type Status,
} from "@/lib/tickets";

export type View = "list" | "urgency" | "status" | "archive";
export type Drag = { id: string; from: string; over: string } | null;

/* ---------- icons ---------- */
const ICONS: Record<string, LucideIcon> = {
  calendar: Calendar, phone: Phone, plug: Plug, "plug-zap": PlugZap, search: Search,
  pencil: Pencil, "ellipsis-vertical": EllipsisVertical, check: Check, x: X, list: List,
  "signal-high": SignalHigh, "columns-3": Columns3, archive: Archive, plus: Plus, menu: Menu,
  inbox: Inbox, wrench: Wrench, "circle-check": CircleCheck, "package-check": PackageCheck,
  clock: Clock, circle: Circle, loader: Loader, "grip-vertical": GripVertical, printer: Printer,
};

export function Icon({ name, size, className = "", style = {} }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) {
  const C = ICONS[name];
  if (!C) return null;
  return <C size={size ?? 16} className={className} style={{ display: "inline-flex", flex: "none", ...style }} />;
}

/* ---------- shared atoms ---------- */
export function Charger({ yes }: { yes: boolean }) {
  return (
    <span className={`chg ${yes ? "yes" : "no"}`} title={yes ? "Charger left with device" : "No charger"}>
      <Icon name={yes ? "plug-zap" : "plug"} />
    </span>
  );
}

export function StatusPill({ status }: { status: Status }) {
  const s = STATUS[status] || STATUS.todo;
  return <span className={`spill ${s.cls}`}><span className="d" />{s.label}</span>;
}

export function UrgencyChip({ u, lg }: { u: number; lg?: boolean }) {
  return <span className={`uchip ${lg ? "lg" : ""} u${u}`}>{u}</span>;
}

/* ---------- ticket card ---------- */
type CardProps = {
  t: Ticket;
  variant?: string;
  dragging?: boolean;
  onDragStart: (e: React.DragEvent, t: Ticket) => void;
  onDragEnd: () => void;
  onMenu: (e: React.MouseEvent, t: Ticket) => void;
  onOpen?: (t: Ticket) => void;
};

export function TicketCard({ t, variant = "rail", dragging, onDragStart, onDragEnd, onMenu, onOpen }: CardProps) {
  const picked = t.status === "picked";
  const cls = ["tcard", variant, `u${t.urgency}`, dragging ? "dragging" : "", picked ? "is-picked" : ""].join(" ");

  const foot = (
    <div className="tc-foot">
      <div className="tc-footL">
        <span className="meta-mono"><Icon name="calendar" />{fmtDate(t.dropoff)}</span>
        <Charger yes={t.charger} />
      </div>
      {picked ? <span className="pickchk"><Icon name="check" /></span> : <StatusPill status={t.status} />}
    </div>
  );

  const menuBtn = (
    <button className="iconbtn menu-btn" title="Quick actions"
      onClick={(e) => { e.stopPropagation(); onMenu(e, t); }}
      onPointerDown={(e) => e.stopPropagation()}>
      <Icon name="ellipsis-vertical" />
    </button>
  );

  return (
    <div className={cls} draggable={!picked} onDragStart={(e) => onDragStart(e, t)} onDragEnd={onDragEnd}
      onClick={() => onOpen && onOpen(t)}>
      <div className="tc-top">
        <UrgencyChip u={t.urgency} />
        <span className="tc-name">{t.name}</span>
        {menuBtn}
      </div>
      <div className="tc-desc">{t.desc}</div>
      {foot}
    </div>
  );
}

/* ---------- board column with drop placeholder ---------- */
type ColProps = {
  className: string;
  header: React.ReactNode;
  footNote?: React.ReactNode;
  items: Ticket[];
  variant: string;
  colKey: string;
  comparator?: (a: Ticket, b: Ticket) => number;
  drag: Drag;
  setDrag: (d: Drag) => void;
  draggedTicket: (Ticket & { _col: string }) | null;
  onDropCard: (id: string, col: string) => void;
  onMenu: (e: React.MouseEvent, t: Ticket) => void;
  onOpen?: (t: Ticket) => void;
  emptyText?: string;
};

function BoardColumn({ className, header, footNote, items, variant, colKey, comparator, drag, setDrag, draggedTicket, onDropCard, onMenu, onOpen, emptyText }: ColProps) {
  const isOver = !!drag && drag.over === colKey && drag.from !== colKey;

  let phIndex = -1;
  if (isOver && draggedTicket) {
    phIndex = comparator ? items.filter((x) => comparator(x, draggedTicket) <= 0).length : items.length;
  }

  const over = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (drag && drag.over !== colKey) setDrag({ ...drag, over: colKey }); };
  const drop = (e: React.DragEvent) => { e.preventDefault(); if (drag && drag.from !== colKey) onDropCard(drag.id, colKey); setDrag(null); };

  const cardEls: React.ReactNode[] = [];
  items.forEach((t, i) => {
    if (i === phIndex) cardEls.push(<div className="drop-ph" key="ph">drop here</div>);
    cardEls.push(
      <TicketCard key={t.id} t={t} variant={variant}
        dragging={!!drag && drag.id === t.id}
        onDragStart={(e, tk) => { try { e.dataTransfer.setData("text/plain", tk.id); e.dataTransfer.effectAllowed = "move"; } catch {} setDrag({ id: tk.id, from: colKey, over: colKey }); }}
        onDragEnd={() => setDrag(null)}
        onMenu={onMenu} onOpen={onOpen} />
    );
  });
  if (phIndex >= items.length) cardEls.push(<div className="drop-ph" key="ph-end">drop here</div>);

  return (
    <div className={`col ${className} ${isOver ? "drop" : ""}`} onDragOver={over} onDrop={drop}>
      {header}
      {footNote}
      <div className="col-body">
        {items.length === 0 && phIndex < 0
          ? <div className="col-empty"><span className="br">{"</>"}</span><span className="t">{emptyText || "Nothing here"}</span></div>
          : cardEls}
      </div>
    </div>
  );
}

/* ================= LABEL PRINTING ================= */
function printTicketLabel(ticket: Ticket) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const nl = ticket.name.length;
  const namePt = nl <= 8 ? 22 : nl <= 12 ? 17 : nl <= 18 ? 13 : nl <= 25 ? 10 : 8;

  const dl = ticket.desc.length;
  const descPt = dl <= 12 ? 22 : dl <= 25 ? 15 : dl <= 50 ? 10 : dl <= 90 ? 7 : dl <= 140 ? 5.5 : 4.5;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(ticket.id)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:2.125in 1in;margin:0}
body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff}
.label{width:2.125in;height:1in;display:flex;flex-direction:column;page-break-after:always}
.cust-body{flex:1;padding:4pt 8pt 2pt;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
.cust-name{font-weight:900;white-space:nowrap;line-height:1;font-size:${namePt}pt}
.cust-phone{white-space:nowrap;line-height:1.1;letter-spacing:.02em;font-size:13pt}
.foot{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;border-top:.5pt solid #ccc;padding:1.5pt 8pt 2pt}
.logo-text{font-weight:900;font-size:4pt;letter-spacing:.2em;text-transform:uppercase;color:#555}
.shop-phone{font-size:8.5pt;color:#444;white-space:nowrap}
.label-desc{justify-content:center;align-items:center;padding:5pt 8pt}
.desc-value{font-weight:700;font-size:${descPt}pt;line-height:1.18;word-break:break-word;overflow-wrap:break-word;text-align:center}
</style></head><body>
<div class="label">
  <div class="cust-body">
    <div class="cust-name">${esc(ticket.name)}</div>
    <div class="cust-phone">${esc(ticket.phone)}</div>
  </div>
  <div class="foot">
    <span class="logo-text">Microlynx</span>
    <span class="shop-phone">(253) 853-3298</span>
  </div>
</div>
<div class="label label-desc">
  <div class="desc-value">${esc(ticket.desc)}</div>
</div>
<script>setTimeout(function(){window.print();},300);</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("Allow pop-ups to print labels."); return; }
  w.document.write(html);
  w.document.close();
}

/* ================= LIST VIEW ================= */
type ListProps = {
  tickets: Ticket[];
  onMenu: (e: React.MouseEvent, t: Ticket) => void;
  onEdit: (t: Ticket) => void;
  onReorder: (id: string, prevId: string | null) => void;
};
export function ListView({ tickets, onMenu, onEdit, onReorder }: ListProps) {
  const [listDragId, setListDragId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  // dropTarget: ticket id (drop before that row) or "end-{urgency}" (drop at bottom of group)

  const active = tickets.filter((t) => t.status !== "picked");
  const sorted = [...active].sort(sortUrgencyOldest);
  const groups = [1, 2, 3, 4, 5].map((u) => [u, sorted.filter((t) => t.urgency === u)] as const).filter(([, l]) => l.length);
  const topId = sorted[0] && sorted[0].id;
  const draggedUrgency = listDragId ? (sorted.find((t) => t.id === listDragId)?.urgency ?? null) : null;

  const clearDrag = () => { setListDragId(null); setDropTarget(null); };

  const handleDrop = (e: React.DragEvent, targetKey: string, targetUrgency: number) => {
    e.preventDefault();
    if (!listDragId || draggedUrgency !== targetUrgency) return;
    const group = sorted.filter((t) => t.urgency === targetUrgency);
    const others = group.filter((t) => t.id !== listDragId);
    let prevId: string | null;
    if (targetKey.startsWith("end-")) {
      prevId = others.length > 0 ? others[others.length - 1].id : null;
    } else {
      const idx = others.findIndex((t) => t.id === targetKey);
      prevId = idx > 0 ? others[idx - 1].id : null;
    }
    onReorder(listDragId, prevId);
    clearDrag();
  };

  return (
    <div className="list-wrap">
      {groups.map(([u, list]) => (
        <React.Fragment key={u}>
          <div className="list-group-label">
            <span>Urgency {u} · {URGENCY[u].label}</span>
            <span className="ln" />
            <span>{list.length}</span>
          </div>
          {list.map((t) => {
            const isNext = t.id === topId;
            const isDragging = t.id === listDragId;
            const isTarget = dropTarget === t.id;
            return (
              <div
                key={t.id}
                className={`lrow u${t.urgency} ${isNext ? "next" : ""}`}
                draggable
                style={{ cursor: isDragging ? "grabbing" : "pointer", opacity: isDragging ? 0.4 : 1, borderTop: isTarget ? "2px solid var(--blue, #3b82f6)" : undefined }}
                onClick={() => onEdit(t)}
                onDragStart={(e) => { try { e.dataTransfer.effectAllowed = "move"; } catch {} setListDragId(t.id); }}
                onDragOver={(e) => { if (draggedUrgency !== t.urgency) return; e.preventDefault(); setDropTarget(t.id); }}
                onDrop={(e) => handleDrop(e, t.id, t.urgency)}
                onDragEnd={clearDrag}
              >
                <span style={{ color: "var(--gray-400,#9ca3af)", display: "flex", flexShrink: 0, cursor: "grab" }}
                  onClick={(e) => e.stopPropagation()}>
                  <Icon name="grip-vertical" size={14} />
                </span>
                <UrgencyChip u={t.urgency} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="nm">{t.name}</div>
                  <div className="ds">{t.desc}</div>
                </div>
                <span className="meta-mono l-date"><Icon name="calendar" />{fmtDate(t.dropoff)}</span>
                {t.dueDate && (
                  <span className="meta-mono" style={{ color: "var(--amber-500,#f59e0b)" }}>
                    <Icon name="clock" />Due {fmtDate(t.dueDate)}
                  </span>
                )}
                <span className="meta-mono l-phone"><Icon name="phone" />{t.phone}</span>
                <Charger yes={t.charger} />
                <StatusPill status={t.status} />
                <span className="acts" onClick={(e) => e.stopPropagation()}>
                  <button className="iconbtn" title="Print labels" onClick={() => printTicketLabel(t)}><Icon name="printer" /></button>
                  <button className="iconbtn" title="Edit" onClick={() => onEdit(t)}><Icon name="pencil" /></button>
                  <button className="iconbtn" title="Quick change" onClick={(e) => onMenu(e, t)}><Icon name="ellipsis-vertical" /></button>
                </span>
              </div>
            );
          })}
          {/* Drop zone at the end of each urgency group */}
          <div
            style={{ height: 8, borderTop: dropTarget === `end-${u}` ? "2px solid var(--blue,#3b82f6)" : "2px solid transparent" }}
            onDragOver={(e) => { if (draggedUrgency !== u) return; e.preventDefault(); setDropTarget(`end-${u}`); }}
            onDrop={(e) => handleDrop(e, `end-${u}`, u)}
          />
        </React.Fragment>
      ))}
      {sorted.length === 0 && (
        <div className="empty">
          <div className="mark">{"<"}<b>/</b>{">"}</div>
          <div className="et">No active tickets</div>
          <div className="es">Every device is handled. New drop-offs will show up here, most urgent first.</div>
        </div>
      )}
    </div>
  );
}

/* ================= URGENCY BOARD ================= */
type UrgencyProps = {
  tickets: Ticket[];
  onMenu: (e: React.MouseEvent, t: Ticket) => void;
  onOpen: (t: Ticket) => void;
  onUrgency: (id: string, u: number) => void;
  drag: Drag;
  setDrag: (d: Drag) => void;
};
export function UrgencyBoard({ tickets, onMenu, onOpen, onUrgency, drag, setDrag }: UrgencyProps) {
  const active = tickets.filter((t) => t.status !== "picked");
  const draggedTicket = drag ? (() => { const t = active.find((x) => x.id === drag.id); return t ? { ...t, _col: String(t.urgency) } : null; })() : null;

  return (
    <div className="board">
      {[1, 2, 3, 4, 5].map((u) => {
        const list = active.filter((t) => t.urgency === u).sort(sortOldest);
        return (
          <BoardColumn key={u} className={`urg u${u}`} colKey={String(u)} variant="rail"
            items={list} comparator={sortOldest}
            drag={drag} setDrag={setDrag} draggedTicket={draggedTicket}
            onDropCard={(id, col) => onUrgency(id, Number(col))}
            onMenu={onMenu} onOpen={onOpen}
            emptyText="No tickets at this level"
            header={
              <div className="col-head">
                <span className="ch-num">{u}</span>
                <span className="ch-lab">{URGENCY[u].label}<span className="sm">{u === 1 ? "grab these first" : "oldest first"}</span></span>
                <span className="ch-count">{list.length}</span>
              </div>
            } />
        );
      })}
    </div>
  );
}

/* ================= STATUS BOARD ================= */
const STATUS_BOARD_ICON: Record<Status, string> = { todo: "inbox", prog: "wrench", done: "circle-check", picked: "package-check" };
type StatusProps = {
  tickets: Ticket[];
  onMenu: (e: React.MouseEvent, t: Ticket) => void;
  onOpen: (t: Ticket) => void;
  onStatus: (id: string, s: Status) => void;
  drag: Drag;
  setDrag: (d: Drag) => void;
};
export function StatusBoard({ tickets, onMenu, onOpen, onStatus, drag, setDrag }: StatusProps) {
  const draggedTicket = drag ? (() => { const t = tickets.find((x) => x.id === drag.id); return t ? { ...t, _col: t.status } : null; })() : null;
  // To do / In progress use the master rule; Complete / Picked Up use entry order.
  const cmpFor: Record<Status, (a: Ticket, b: Ticket) => number> = {
    todo: sortUrgencyOldest, prog: sortUrgencyOldest, done: sortEntryOrder, picked: sortEntryOrder,
  };

  return (
    <div className="board">
      {STATUS_ORDER.map((s) => {
        const list = tickets.filter((t) => t.status === s).sort(cmpFor[s]);
        const sCls = s === "done" ? "s-done" : s === "picked" ? "s-picked" : "";
        return (
          <BoardColumn key={s} className={`stat ${sCls}`} colKey={s} variant="rail"
            items={list} comparator={cmpFor[s]}
            drag={drag} setDrag={setDrag} draggedTicket={draggedTicket}
            onDropCard={(id, col) => onStatus(id, col as Status)}
            onMenu={onMenu} onOpen={onOpen}
            emptyText={s === "todo" ? "Queue is clear" : s === "picked" ? "Nothing picked up yet" : "Empty"}
            footNote={s === "picked"
              ? <div className="col-note"><Icon name="clock" />Auto-archives 3 days after pickup</div>
              : null}
            header={
              <div className="col-head">
                <span className="ch-ic"><Icon name={STATUS_BOARD_ICON[s]} /></span>
                <span className="ch-lab">{STATUS[s].label}</span>
                <span className="ch-count">{list.length}</span>
              </div>
            } />
        );
      })}
    </div>
  );
}

/* ================= ARCHIVE ================= */
export function ArchiveView({ archive, search }: { archive: Ticket[]; search: string }) {
  const q = (search || "").trim().toLowerCase();
  const list = [...archive]
    .filter((t) => !q || t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
    .sort((a, b) => (b.archivedAt || "").localeCompare(a.archivedAt || ""));

  return (
    <div className="vault">
      <div className="vault-head">
        <span className="br">{"</>"}</span>
        <span className="t">Records vault</span>
        <span className="c">{list.length} {list.length === 1 ? "record" : "records"}</span>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <div className="mark">{"<"}<b>/</b>{">"}</div>
          <div className="et">{q ? "No matching records" : "The vault is empty"}</div>
          <div className="es">{q ? "Try a different name, device, or ticket number." : "Picked-up tickets land here automatically after three days."}</div>
        </div>
      ) : list.map((t) => (
        <div key={t.id} className={`arow u${t.urgency}`}>
          <UrgencyChip u={t.urgency} />
          <div style={{ minWidth: 0 }}>
            <div className="nm">{t.name} <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gray-400)", fontWeight: 400 }}>· {t.id}</span></div>
            <div className="ds">{t.desc}</div>
          </div>
          <span className="meta-mono l-phone"><Icon name="phone" />{t.phone}</span>
          <span className="meta-mono"><Icon name="calendar" />In {fmtDate(t.dropoff)}</span>
          <Charger yes={t.charger} />
          <span className="archd"><span className="lbl2">Archived</span>{t.archivedAt ? fmtDate(t.archivedAt) : "—"}</span>
        </div>
      ))}
    </div>
  );
}

/* ================= TOP NAV ================= */
const TABS: [View, string, string][] = [
  ["list", "list", "List"],
  ["urgency", "signal-high", "Urgency Board"],
  ["status", "columns-3", "Status Board"],
];
export function TopNav({ view, setView, onNew, onMobileMenu }: { view: View; setView: (v: View) => void; onNew: () => void; onMobileMenu: () => void }) {
  const isArchive = view === "archive";
  return (
    <header className="nav">
      <div className="nav-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/microlynx-logo.png" alt="Microlynx" />
        <span className="div" />
        <span className="nav-eyebrow">{"</"} TICKETING {">"}</span>
      </div>

      <nav className="nav-tabs">
        {TABS.map(([id, ic, label]) => (
          <button key={id} className={`nav-tab ${view === id ? "on" : ""}`} onClick={() => setView(id)}>
            <Icon name={ic} />{label}
          </button>
        ))}
      </nav>

      <div className="nav-spacer" />

      <button className={`nav-archive ${isArchive ? "on" : ""}`} onClick={() => setView("archive")}>
        <Icon name="archive" /><span>Archive</span>
      </button>
      <button className="btn primary" onClick={onNew}>
        <Icon name="plus" /><span className="nt-label">New Ticket</span>
      </button>
      <button className="iconbtn nav-menu-btn" onClick={onMobileMenu} style={{ width: 38, height: 38 }}>
        <Icon name="menu" size={20} />
      </button>
    </header>
  );
}

/* ================= QUICK MENU ================= */
const STATUS_ICON: Record<Status, string> = { todo: "circle", prog: "loader", done: "circle-check", picked: "package-check" };
export function QuickMenu({ ctx, onClose, onUrgency, onStatus, onEdit }: {
  ctx: { x: number; y: number; ticket: Ticket };
  onClose: () => void;
  onUrgency: (id: string, u: number) => void;
  onStatus: (id: string, s: Status) => void;
  onEdit: (t: Ticket) => void;
}) {
  const t = ctx.ticket;
  const vw = window.innerWidth, vh = window.innerHeight;
  const W = 210, H = 360;
  const left = Math.max(10, Math.min(ctx.x, vw - W - 10));
  const top = Math.max(10, Math.min(ctx.y, vh - H - 10));
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="pop" style={{ left, top }} role="menu">
        <button className="pop-item" onClick={() => { onEdit(t); onClose(); }}>
          <Icon name="pencil" />Edit ticket
        </button>
        <div className="pop-div" />
        <div className="pop-sec">Urgency</div>
        <div className="pop-row">
          {[1, 2, 3, 4, 5].map((u) => (
            <button key={u} className={`uopt u${u} ${t.urgency === u ? "on" : ""}`}
              onClick={() => { onUrgency(t.id, u); onClose(); }}>{u}</button>
          ))}
        </div>
        <div className="pop-div" />
        <div className="pop-sec">Status</div>
        {STATUS_ORDER.map((s) => (
          <button key={s} className={`pop-item ${t.status === s ? "on" : ""}`}
            onClick={() => { onStatus(t.id, s); onClose(); }}>
            <Icon name={t.status === s ? "check" : STATUS_ICON[s]} />{STATUS[s].label}
          </button>
        ))}
      </div>
    </>
  );
}

/* ================= MOBILE SHEET ================= */
export function MobileSheet({ view, setView, onClose }: { view: View; setView: (v: View) => void; onClose: () => void }) {
  const items: [View, string, string][] = [
    ["list", "list", "List"],
    ["urgency", "signal-high", "Urgency Board"],
    ["status", "columns-3", "Status Board"],
    ["archive", "archive", "Archive"],
  ];
  return (
    <div className="msheet" onClick={onClose}>
      <div className="msheet-inner" onClick={(e) => e.stopPropagation()}>
        {items.map(([id, ic, label]) => (
          <button key={id} className={`msheet-item ${view === id ? "on" : ""}`}
            onClick={() => { setView(id); onClose(); }}>
            <Icon name={ic} />{label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================= TICKET FORM ================= */
export type FormDraft = {
  id: string | null;
  name: string;
  phone: string;
  desc: string;
  urgency: number;
  charger: boolean;
  status: Status;
  dropoff: string;
  dueDate: string | null;
};
export function TicketForm({ editing, today, onSave, onClose }: {
  editing: Partial<Ticket>;
  today: string;
  onSave: (d: FormDraft) => void;
  onClose: () => void;
}) {
  const isEdit = !!editing && !!editing.id;
  const [f, setF] = React.useState<FormDraft>(() => ({
    id: editing?.id || null,
    name: editing?.name || "",
    phone: editing?.phone || "",
    desc: editing?.desc || "",
    urgency: editing?.urgency || 3,
    charger: editing?.charger ?? false,
    status: editing?.status || "todo",
    dropoff: editing?.dropoff || today,
    dueDate: editing?.dueDate ?? null,
  }));
  const [touched, setTouched] = React.useState(false);
  const set = <K extends keyof FormDraft>(k: K, v: FormDraft[K]) => setF((p) => ({ ...p, [k]: v }));

  const errs = {
    name: f.name.trim() ? "" : "Customer name is required",
    desc: f.desc.trim() ? "" : "Tell us what's wrong with the device",
  };
  const valid = !errs.name && !errs.desc;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSave({ ...f, name: f.name.trim(), phone: f.phone.trim(), desc: f.desc.trim() });
  };

  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="scrim-dark" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{"</"} {isEdit ? "EDIT TICKET · " + f.id : "NEW TICKET"} {">"}</div>
            <h2>{isEdit ? "Edit repair ticket" : "Log a new repair"}</h2>
          </div>
          <button className="iconbtn" onClick={onClose} style={{ width: 34, height: 34 }}><Icon name="x" size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="field-grid">
            <div className="field">
              <label className="lbl">Drop-off date</label>
              <input className="inp mono" type="date" value={f.dropoff} onChange={(e) => set("dropoff", e.target.value)} />
            </div>
            <div className="field">
              <label className="lbl">Phone</label>
              <input className="inp mono" type="tel" placeholder="(253) 555-0000" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label className="lbl">Due date <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional — sets deadline priority)</span></label>
            <input className="inp mono" type="date" value={f.dueDate || ""} onChange={(e) => set("dueDate", e.target.value || null)} />
          </div>

          <div className="field">
            <label className="lbl">Customer name<span className="req">*</span></label>
            <input className={`inp ${touched && errs.name ? "bad" : ""}`} placeholder="e.g. Dana Whitlock"
              value={f.name} onChange={(e) => set("name", e.target.value)} />
            {touched && errs.name && <div className="err">{errs.name}</div>}
          </div>

          <div className="field">
            <label className="lbl">What&apos;s wrong?<span className="req">*</span></label>
            <textarea className={`ta ${touched && errs.desc ? "bad" : ""}`}
              placeholder="Device and the problem in plain words — e.g. &ldquo;MacBook Air, liquid spill, won't boot.&rdquo;"
              value={f.desc} onChange={(e) => set("desc", e.target.value)} />
            {touched && errs.desc && <div className="err">{errs.desc}</div>}
          </div>

          <div className="field">
            <label className="lbl">Urgency</label>
            <div className="uselect">
              {[1, 2, 3, 4, 5].map((u) => (
                <div key={u} className={`opt u${u} ${f.urgency === u ? "on" : ""}`} onClick={() => set("urgency", u)}>
                  <span className="n">{u}</span>
                  <span className="t">{URGENCY[u].short}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="lbl">Charger left with device?</label>
            <div className="toggle">
              <button className={`yes ${f.charger ? "on" : ""}`} onClick={() => set("charger", true)}>
                <Icon name="plug-zap" />Yes
              </button>
              <button className={`no ${!f.charger ? "on" : ""}`} onClick={() => set("charger", false)}>
                <Icon name="plug" />No
              </button>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit}>
            <Icon name="check" />{isEdit ? "Save changes" : "Save ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}
