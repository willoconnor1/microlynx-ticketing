"use client";

import React from "react";
import {
  Calendar, Phone, Plug, PlugZap, Search, Pencil, EllipsisVertical, Check, X,
  List, SignalHigh, Columns3, Archive, Plus, Menu, Inbox, Wrench, CircleCheck,
  PackageCheck, Clock, Circle, Loader, GripVertical, ChevronLeft, ChevronRight,
  Trash2, type LucideIcon,
} from "lucide-react";
import {
  URGENCY, STATUS, STATUS_ORDER, PEOPLE, fmtDate, fmtDateLong, fmtDueAt, fmtDueHalf,
  buildDueAt, dueParts, sortQueue, cmpDue, sortEntryOrder,
  type Ticket, type Status, type Person, type AmPm,
} from "@/lib/tickets";

/* Field-level edits the expanded row can save. */
export type InlinePatch = Partial<Pick<Ticket,
  "name" | "phone" | "desc" | "urgency" | "charger" | "assignedTo" | "deviceType" |
  "dropoff" | "dropoffAmPm" | "dueAt">>;

export type View = "list" | "urgency" | "status" | "archive";
export type Drag = { id: string; from: string; over: string } | null;

/* ---------- icons ---------- */
const ICONS: Record<string, LucideIcon> = {
  calendar: Calendar, phone: Phone, plug: Plug, "plug-zap": PlugZap, search: Search,
  pencil: Pencil, "ellipsis-vertical": EllipsisVertical, check: Check, x: X, list: List,
  "signal-high": SignalHigh, "columns-3": Columns3, archive: Archive, plus: Plus, menu: Menu,
  inbox: Inbox, wrench: Wrench, "circle-check": CircleCheck, "package-check": PackageCheck,
  clock: Clock, circle: Circle, loader: Loader, "grip-vertical": GripVertical,
  "chevron-left": ChevronLeft, "chevron-right": ChevronRight, "trash-2": Trash2,
};

const pad2 = (n: number) => String(n).padStart(2, "0");

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

/* ---------- anchored popover (shared by the pickers below) ---------- */
/* Fixed-position dropdown pinned to an anchor rect; flips above when there's no
   room below. Sits above the ticket modal (which is z-index 90). */
function Pop({ anchor, width, height, onClose, children, className = "" }: {
  anchor: DOMRect; width: number; height: number;
  onClose: () => void; children: React.ReactNode; className?: string;
}) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const left = Math.max(10, Math.min(anchor.left, vw - width - 10));
  const flip = anchor.bottom + 6 + height > vh - 10 && anchor.top - height - 6 > 10;
  const top = flip ? anchor.top - height - 6 : anchor.bottom + 6;
  return (
    <>
      <div className="scrim pick-scrim" onClick={onClose} />
      <div className={`pop pick-pop ${className}`} style={{ left, top, width }}>{children}</div>
    </>
  );
}

/* ---------- app-styled status menu (click the pill) ---------- */
export function StatusPillMenu({ t, onStatus }: { t: Ticket; onStatus: (id: string, s: Status) => void }) {
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);
  const s = STATUS[t.status] || STATUS.todo;
  return (
    <>
      <button type="button" className={`spill ${s.cls} spill-sel`} title="Change status"
        onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget.getBoundingClientRect()); }}>
        <span className="d" />{s.label}
      </button>
      {anchor && (
        <Pop anchor={anchor} width={176} height={172} onClose={() => setAnchor(null)} className="statmenu">
          {STATUS_ORDER.map((k) => (
            <button key={k} type="button" className={`pop-item stat-opt ${t.status === k ? "on" : ""}`}
              onClick={() => { setAnchor(null); if (k !== t.status) onStatus(t.id, k); }}>
              <span className={`sdot ${k}`} />{STATUS[k].label}
              {t.status === k && <Icon name="check" className="chk" />}
            </button>
          ))}
        </Pop>
      )}
    </>
  );
}

/* ---------- app-styled date picker ---------- */
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function CalendarPop({ anchor, value, clearable, onPick, onClear, onClose }: {
  anchor: DOMRect; value: string; clearable?: boolean;
  onPick: (iso: string) => void; onClear: () => void; onClose: () => void;
}) {
  const sel = value ? new Date(value + "T12:00:00") : null;
  const [view, setView] = React.useState(() => {
    const d = sel || new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const todayIso = iso(new Date());
  const start = new Date(view.y, view.m, 1).getDay();
  const cells = Array.from({ length: 42 }, (_, i) => new Date(view.y, view.m, 1 - start + i));
  const step = (n: number) => setView((p) => {
    const d = new Date(p.y, p.m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <Pop anchor={anchor} width={252} height={320} onClose={onClose} className="cal">
      <div className="cal-head">
        <button type="button" className="iconbtn" onClick={() => step(-1)}><Icon name="chevron-left" /></button>
        <span className="cal-title">{MONTH_NAMES[view.m]} {view.y}</span>
        <button type="button" className="iconbtn" onClick={() => step(1)}><Icon name="chevron-right" /></button>
      </div>
      <div className="cal-grid">
        {DOW.map((d) => <span key={d} className="cal-dow">{d}</span>)}
        {cells.map((d) => {
          const v = iso(d);
          const cls = [
            "cal-day",
            d.getMonth() !== view.m ? "out" : "",
            v === todayIso ? "today" : "",
            v === value ? "sel" : "",
          ].join(" ");
          return <button key={v} type="button" className={cls} onClick={() => onPick(v)}>{d.getDate()}</button>;
        })}
      </div>
      <div className="cal-foot">
        <button type="button" className="cal-link" onClick={() => onPick(todayIso)}>Today</button>
        {clearable && value && <button type="button" className="cal-link clear" onClick={onClear}>Clear</button>}
      </div>
    </Pop>
  );
}

export function DateField({ value, onChange, placeholder, clearable }: {
  value: string; onChange: (v: string) => void; placeholder?: string; clearable?: boolean;
}) {
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);
  return (
    <>
      <button type="button" className={`inp mono pickbtn ${value ? "" : "empty"}`}
        onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}>
        <Icon name="calendar" />
        <span className="pv">{value ? fmtDateLong(value) : placeholder || "Pick a date"}</span>
        {clearable && value && (
          <span className="clr" title="Clear" onClick={(e) => { e.stopPropagation(); onChange(""); }}>
            <Icon name="x" size={13} />
          </span>
        )}
      </button>
      {anchor && (
        <CalendarPop anchor={anchor} value={value} clearable={clearable}
          onPick={(v) => { onChange(v); setAnchor(null); }}
          onClear={() => { onChange(""); setAnchor(null); }}
          onClose={() => setAnchor(null)} />
      )}
    </>
  );
}

/* ---------- AM/PM toggle (shared by drop-off and due fields) ---------- */
export function AmPmToggle({ value, onChange, disabled }: {
  value: AmPm | null; onChange: (v: AmPm) => void; disabled?: boolean;
}) {
  return (
    <div className="toggle ampm">
      <button type="button" disabled={disabled} className={`am ${value === "AM" ? "on" : ""}`}
        onClick={(e) => { e.stopPropagation(); onChange("AM"); }}>AM</button>
      <button type="button" disabled={disabled} className={`pm ${value === "PM" ? "on" : ""}`}
        onClick={(e) => { e.stopPropagation(); onChange("PM"); }}>PM</button>
    </div>
  );
}

export function UrgencyChip({ u, lg }: { u: number; lg?: boolean }) {
  return <span className={`uchip ${lg ? "lg" : ""} u${u}`}>{u}</span>;
}

export function AvatarChip({ who }: { who?: Person }) {
  const p = who || "keith";
  const label = PEOPLE.find((x) => x.key === p)?.label || "Keith";
  return <span className={`avchip ${p}`} title={`Assigned to ${label}`}>{label[0]}</span>;
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
  const cls = ["tcard", variant, `u${t.urgency}`, dragging ? "dragging" : "", picked ? "is-picked" : "", t.deviceType === "desktop" ? "desktop" : ""].join(" ");

  const foot = (
    <div className="tc-foot">
      <div className="tc-footL">
        <span className="meta-mono"><Icon name="calendar" />{fmtDate(t.dropoff)}{t.dropoffAmPm ? ` · ${t.dropoffAmPm}` : ""}</span>
        <Charger yes={t.charger} />
        <AvatarChip who={t.assignedTo} />
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

/* ================= LIST VIEW ================= */
export type PendingMove = {
  ticket: Ticket;
  urgency: number;
  prevId: string | null;
  nextId: string | null;
  jumped: Ticket[]; // sooner-due tickets this move would jump ahead of
};

type ListProps = {
  tickets: Ticket[];
  onMenu: (e: React.MouseEvent, t: Ticket) => void;
  onEdit: (t: Ticket) => void;
  onStatus: (id: string, s: Status) => void;
  onMoveRequest: (m: PendingMove) => void;
  onPatch: (id: string, patch: InlinePatch) => void;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  drag: Drag;
  setDrag: (d: Drag) => void;
  canReorder: boolean; // off while a person filter or search hides rows
};
export function ListView({ tickets, onMenu, onEdit, onStatus, onMoveRequest, onPatch, expandedId, onToggleExpand, drag, setDrag, canReorder }: ListProps) {
  const queue = tickets.filter((t) => t.status === "todo" || t.status === "prog");
  const sorted = [...queue].sort(sortQueue);
  const done = tickets.filter((t) => t.status === "done").sort(sortEntryOrder);
  const topId = sorted[0] && sorted[0].id;

  const listDrag = drag && drag.from === "list" ? drag : null;
  const dragged = listDrag ? sorted.find((t) => t.id === listDrag.id) || null : null;
  // Where the dragged row would land: urgency group + index among that group's rows.
  const [target, setTarget] = React.useState<{ u: number; index: number } | null>(null);

  const byU = new Map<number, Ticket[]>();
  for (const u of [1, 2, 3, 4, 5]) byU.set(u, sorted.filter((t) => t.urgency === u));

  const clearDrag = () => { setDrag(null); setTarget(null); };

  const startDrag = (e: React.DragEvent, t: Ticket) => {
    if (expandedId) onToggleExpand(expandedId); // collapse so the drop math sees normal-height rows
    try {
      e.dataTransfer.setData("text/plain", t.id);
      e.dataTransfer.effectAllowed = "move";
      const row = (e.currentTarget as HTMLElement).closest(".lrow");
      if (row) e.dataTransfer.setDragImage(row as HTMLElement, 24, 24);
    } catch {}
    setDrag({ id: t.id, from: "list", over: "list" });
  };

  const overRow = (e: React.DragEvent, u: number, index: number) => {
    if (!dragged) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const idx = index + (e.clientY < r.top + r.height / 2 ? 0 : 1);
    setTarget((p) => (p && p.u === u && p.index === idx ? p : { u, index: idx }));
  };

  const overTop = (e: React.DragEvent, u: number) => {
    if (!dragged) return;
    e.preventDefault();
    setTarget((p) => (p && p.u === u && p.index === 0 ? p : { u, index: 0 }));
  };

  // Native drag doesn't auto-scroll the page in Firefox/Safari — nudge it near the edges.
  const overList = (e: React.DragEvent) => {
    if (!dragged) return;
    e.preventDefault();
    if (e.clientY < 90) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 90) window.scrollBy(0, 14);
  };

  const commitDrop = () => {
    if (!dragged || !target) { clearDrag(); return; }
    const grp = byU.get(target.u) || [];
    const beforeItems = grp.slice(0, target.index).filter((t) => t.id !== dragged.id);
    const afterItems = grp.slice(target.index).filter((t) => t.id !== dragged.id);
    const prevId = beforeItems.length ? beforeItems[beforeItems.length - 1].id : null;
    const nextId = afterItems.length ? afterItems[0].id : null;

    // Simulate the new order to find which sooner-due tickets get jumped.
    const moved = { ...dragged, urgency: target.u };
    const newOrder: Ticket[] = [];
    for (const u of [1, 2, 3, 4, 5]) {
      const arr = (byU.get(u) || []).filter((t) => t.id !== dragged.id);
      if (u === target.u) {
        const at = nextId ? arr.findIndex((t) => t.id === nextId) : arr.length;
        arr.splice(at === -1 ? arr.length : at, 0, moved);
      }
      newOrder.push(...arr);
    }
    const oldIdx = sorted.findIndex((t) => t.id === dragged.id);
    const newIdx = newOrder.findIndex((t) => t.id === dragged.id);
    const newPos = new Map(newOrder.map((t, i) => [t.id, i] as const));
    const jumped = sorted.filter((t, i) =>
      t.id !== dragged.id &&
      i < oldIdx && (newPos.get(t.id) ?? 0) > newIdx &&
      !!t.dueAt && (!dragged.dueAt || (t.dueAt as string) < (dragged.dueAt as string))
    );

    clearDrag();
    if (newIdx === oldIdx && dragged.urgency === target.u) return; // dropped where it started
    onMoveRequest({ ticket: dragged, urgency: target.u, prevId, nextId, jumped });
  };

  return (
    <div className="list-wrap" onDragOver={overList} onDrop={(e) => { e.preventDefault(); commitDrop(); }}>
      {[1, 2, 3, 4, 5].map((u) => {
        const list = byU.get(u) || [];
        if (!list.length && !dragged) return null;
        const lineAt = dragged && target && target.u === u ? target.index : -1;
        return (
          <React.Fragment key={u}>
            <div className="list-group-label" onDragOver={(e) => overTop(e, u)}>
              <span>Urgency {u} · {URGENCY[u].label}</span>
              <span className="ln" />
              <span>{list.length}</span>
            </div>
            {list.length === 0 && dragged && (
              <div className={`ins-zone ${lineAt === 0 ? "on" : ""}`} onDragOver={(e) => overTop(e, u)}>
                drop here
              </div>
            )}
            {list.map((t, i) => (
              <React.Fragment key={t.id}>
                {lineAt === i && <div className="ins-line" />}
                <QueueRow t={t}
                  isNext={t.id === topId}
                  dragging={!!listDrag && listDrag.id === t.id}
                  canReorder={canReorder}
                  expanded={expandedId === t.id}
                  onToggle={onToggleExpand}
                  onPatch={onPatch}
                  onRowDragOver={(e) => overRow(e, u, i)}
                  startDrag={startDrag}
                  clearDrag={clearDrag}
                  onStatus={onStatus} onEdit={onEdit} onMenu={onMenu} />
              </React.Fragment>
            ))}
            {lineAt >= list.length && list.length > 0 && <div className="ins-line" />}
          </React.Fragment>
        );
      })}

      {done.length > 0 && (
        <>
          <div className="list-group-label done-label">
            <span>Completed · ready for pickup</span>
            <span className="ln" />
            <span>{done.length}</span>
          </div>
          {done.map((t) => (
            <div key={t.id} className={`lrow done-row u${t.urgency} ${t.deviceType === "desktop" ? "desktop" : ""}`}>
              <div className="lrow-head static">
                <span className="done-ic"><Icon name="circle-check" size={16} /></span>
                <UrgencyChip u={t.urgency} />
                <div style={{ minWidth: 0 }}>
                  <div className="nm">{t.name}</div>
                  <div className="ds">{t.desc}</div>
                </div>
                <span className="meta-mono l-date done-at" title="Completed"><Icon name="check" />{t.statusChangedAt ? fmtDueAt(t.statusChangedAt) : "—"}</span>
                <span className="meta-mono l-phone"><Icon name="phone" />{t.phone}</span>
                <StatusPillMenu t={t} onStatus={onStatus} />
                <span className="acts">
                  <button className="btn pickup" onClick={() => onStatus(t.id, "picked")}>
                    <Icon name="package-check" />Picked up
                  </button>
                </span>
              </div>
            </div>
          ))}
        </>
      )}

      {sorted.length === 0 && done.length === 0 && (
        <div className="empty">
          <div className="mark">{"<"}<b>/</b>{">"}</div>
          <div className="et">No active tickets</div>
          <div className="es">Every device is handled. New drop-offs will show up here, most urgent first.</div>
        </div>
      )}
    </div>
  );
}

/* ================= QUEUE ROW (accordion) ================= */
type QueueRowProps = {
  t: Ticket;
  isNext: boolean;
  dragging: boolean;
  canReorder: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
  onPatch: (id: string, patch: InlinePatch) => void;
  onRowDragOver: (e: React.DragEvent) => void;
  startDrag: (e: React.DragEvent, t: Ticket) => void;
  clearDrag: () => void;
  onStatus: (id: string, s: Status) => void;
  onEdit: (t: Ticket) => void;
  onMenu: (e: React.MouseEvent, t: Ticket) => void;
};

function QueueRow({ t, isNext, dragging, canReorder, expanded, onToggle, onPatch, onRowDragOver, startDrag, clearDrag, onStatus, onEdit, onMenu }: QueueRowProps) {
  // Keep the expansion body mounted through the collapse animation, then unmount.
  const [bodyMounted, setBodyMounted] = React.useState(expanded);
  // Two stages: a compact read-only peek first; its Edit button opens the full inline editor.
  const [mode, setMode] = React.useState<"info" | "edit">("info");
  React.useEffect(() => { if (expanded) { setBodyMounted(true); setMode("info"); } }, [expanded]);

  const headClick = () => {
    if (window.getSelection()?.toString()) return; // copying text shouldn't bounce the row
    onToggle(t.id);
  };

  const cls = [
    "lrow", `u${t.urgency}`,
    isNext ? "next" : "",
    dragging ? "dragging" : "",
    expanded ? "expanded" : "",
    t.deviceType === "desktop" ? "desktop" : "",
  ].join(" ");

  return (
    <div className={cls} onDragOver={onRowDragOver}>
      <div className="lrow-head" onClick={headClick}>
        <span className={`grip ${canReorder ? "" : "off"}`}
          title={canReorder ? "Drag to reorder" : "Reordering is off while filtering"}
          draggable={canReorder}
          onClick={(e) => e.stopPropagation()}
          onDragStart={canReorder ? (e) => startDrag(e, t) : undefined}
          onDragEnd={canReorder ? clearDrag : undefined}>
          <Icon name="grip-vertical" size={15} />
        </span>
        <UrgencyChip u={t.urgency} />
        <div style={{ minWidth: 0 }}>
          <div className="nm">{t.name}</div>
          <div className="ds">{t.desc}</div>
        </div>
        <span className="meta-mono l-date l-drop" title="Dropped off">
          <Icon name="calendar" />{fmtDate(t.dropoff)}{t.dropoffAmPm ? ` · ${t.dropoffAmPm}` : ""}
        </span>
        {t.dueAt
          ? <span className="meta-mono l-date due l-due" title="Pickup due"><Icon name="clock" />{fmtDueHalf(t.dueAt)}</span>
          : <span className="meta-mono l-date l-due nodue">—</span>}
        <span className="meta-mono l-phone"><Icon name="phone" />{t.phone}</span>
        <StatusPillMenu t={t} onStatus={onStatus} />
        <span className="acts">
          <button className="iconbtn tick" title="Mark complete" onClick={(e) => { e.stopPropagation(); onStatus(t.id, "done"); }}><Icon name="check" /></button>
          <button className="iconbtn" title="Edit" onClick={(e) => { e.stopPropagation(); onEdit(t); }}><Icon name="pencil" /></button>
          <button className="iconbtn" title="Quick change" onClick={(e) => { e.stopPropagation(); onMenu(e, t); }}><Icon name="ellipsis-vertical" /></button>
        </span>
      </div>
      <div className="lrow-exp"
        onTransitionEnd={(e) => { if (e.propertyName === "grid-template-rows" && !expanded) setBodyMounted(false); }}>
        <div className="lrow-exp-clip">
          {bodyMounted && (
            <div className="lrow-exp-body">
              {mode === "edit"
                ? <RowExpansion t={t} onPatch={onPatch} />
                : <RowPeek t={t} onEdit={() => setMode("edit")} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Compact read-only peek shown first when a row expands: the full description plus
   the details the collapsed row hides, with an Edit button to open the inline editor. */
function RowPeek({ t, onEdit }: { t: Ticket; onEdit: () => void }) {
  const who = PEOPLE.find((p) => p.key === (t.assignedTo || "keith"));
  return (
    <div className="exp-peek">
      <div className="peek-desc">{t.desc || <span className="muted">No description</span>}</div>
      <div className="peek-meta">
        <span className="peek-item"><Icon name={t.charger ? "plug-zap" : "plug"} />{t.charger ? "Charger in" : "No charger"}</span>
        <span className="peek-item">
          <Icon name="wrench" />
          {t.deviceType === "desktop" ? "Desktop" : t.deviceType === "laptop" ? "Laptop" : "Device not set"}
        </span>
        <span className="peek-item"><AvatarChip who={t.assignedTo} />{who ? who.label : "Keith"}</span>
        <span className="peek-spacer" />
        <button type="button" className="btn ghost peek-edit" onClick={onEdit}>
          <Icon name="pencil" />Edit
        </button>
      </div>
    </div>
  );
}

/* Inline editor inside the expanded row. Buttons save instantly; text saves on blur
   (and on unmount, so collapsing mid-edit never loses typing). */
function RowExpansion({ t, onPatch }: { t: Ticket; onPatch: (id: string, p: InlinePatch) => void }) {
  const [draft, setDraft] = React.useState({ name: t.name, phone: t.phone, desc: t.desc });
  const draftRef = React.useRef(draft); draftRef.current = draft;
  const tRef = React.useRef(t); tRef.current = t;
  const onPatchRef = React.useRef(onPatch); onPatchRef.current = onPatch;

  const flush = React.useCallback(() => {
    const d = draftRef.current, cur = tRef.current;
    const p: InlinePatch = {};
    if (d.name.trim() && d.name.trim() !== cur.name) p.name = d.name.trim();
    if (d.phone.trim() !== cur.phone) p.phone = d.phone.trim();
    if (d.desc.trim() !== cur.desc) p.desc = d.desc.trim();
    if (Object.keys(p).length) onPatchRef.current(cur.id, p);
  }, []);
  React.useEffect(() => () => flush(), [flush]);

  const due = t.dueAt ? dueParts(t.dueAt) : null;
  const setDue = (date: string, half: AmPm) => onPatch(t.id, { dueAt: date ? buildDueAt(date, half) : null });

  return (
    <div className="exp-grid">
      <div className="exp-field">
        <label className="lbl">Customer name</label>
        <input className="inp" value={draft.name} onBlur={flush}
          onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
      </div>
      <div className="exp-field">
        <label className="lbl">Phone</label>
        <input className="inp mono" type="tel" value={draft.phone} onBlur={flush}
          onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))} />
      </div>
      <div className="exp-field full">
        <label className="lbl">What&apos;s wrong?</label>
        <textarea className="ta" value={draft.desc} onBlur={flush}
          onChange={(e) => setDraft((p) => ({ ...p, desc: e.target.value }))} />
      </div>
      <div className="exp-field">
        <label className="lbl">Drop-off</label>
        <div className="dropoff-row">
          <DateField value={t.dropoff} onChange={(v) => onPatch(t.id, { dropoff: v })} />
          <AmPmToggle value={t.dropoffAmPm ?? null} onChange={(v) => onPatch(t.id, { dropoffAmPm: v })} />
        </div>
      </div>
      <div className="exp-field">
        <label className="lbl">Pickup due</label>
        <div className="dropoff-row">
          <DateField value={due ? due.date : ""} clearable placeholder="No due date"
            onChange={(v) => setDue(v, due ? due.half : "PM")} />
          <AmPmToggle value={due ? due.half : null} disabled={!due}
            onChange={(v) => due && setDue(due.date, v)} />
        </div>
      </div>
      <div className="exp-field">
        <label className="lbl">Urgency</label>
        <div className="uselect compact">
          {[1, 2, 3, 4, 5].map((u) => (
            <div key={u} className={`opt u${u} ${t.urgency === u ? "on" : ""}`} onClick={() => onPatch(t.id, { urgency: u })}>
              <span className="n">{u}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="exp-field">
        <label className="lbl">Device</label>
        <div className="toggle device">
          <button type="button" className={t.deviceType === "laptop" ? "on" : ""}
            onClick={() => onPatch(t.id, { deviceType: "laptop" })}>Laptop</button>
          <button type="button" className={t.deviceType === "desktop" ? "on" : ""}
            onClick={() => onPatch(t.id, { deviceType: "desktop" })}>Desktop</button>
        </div>
      </div>
      <div className="exp-field">
        <label className="lbl">Charger</label>
        <div className="toggle">
          <button type="button" className={`yes ${t.charger ? "on" : ""}`} onClick={() => onPatch(t.id, { charger: true })}>
            <Icon name="plug-zap" />Yes
          </button>
          <button type="button" className={`no ${!t.charger ? "on" : ""}`} onClick={() => onPatch(t.id, { charger: false })}>
            <Icon name="plug" />No
          </button>
        </div>
      </div>
      <div className="exp-field">
        <label className="lbl">Assigned to</label>
        <div className="toggle people">
          {PEOPLE.map((p) => (
            <button key={p.key} type="button" className={t.assignedTo === p.key ? "on" : ""}
              onClick={() => onPatch(t.id, { assignedTo: p.key })}>
              <span className={`avchip ${p.key}`}>{p.label[0]}</span>{p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= CONFIRM MOVE DIALOG ================= */
export function ConfirmMoveDialog({ move, onCancel, onConfirm }: {
  move: PendingMove;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCancel]);

  return (
    <div className="scrim-dark" onMouseDown={onCancel}>
      <div className="modal confirm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{"</"} HOLD ON {">"}</div>
            <h2>Move ahead of sooner due dates?</h2>
          </div>
          <button className="iconbtn" onClick={onCancel} style={{ width: 34, height: 34 }}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="confirm-msg">
            You are moving <b>{move.ticket.name}</b> in front of tickets that are due sooner.
            Here are the tickets you will override:
          </p>
          <div className="confirm-list">
            {move.jumped.map((t) => (
              <div key={t.id} className={`confirm-row u${t.urgency}`}>
                <UrgencyChip u={t.urgency} />
                <span className="nm">{t.name}</span>
                <span className="meta-mono"><Icon name="clock" />{t.dueAt ? fmtDueHalf(t.dueAt) : "no due date"}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn primary" onClick={onConfirm}><Icon name="check" />Confirm move</button>
        </div>
      </div>
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
        const list = active.filter((t) => t.urgency === u).sort(sortQueue);
        return (
          <BoardColumn key={u} className={`urg u${u}`} colKey={String(u)} variant="rail"
            items={list} comparator={cmpDue}
            drag={drag} setDrag={setDrag} draggedTicket={draggedTicket}
            onDropCard={(id, col) => onUrgency(id, Number(col))}
            onMenu={onMenu} onOpen={onOpen}
            emptyText="No tickets at this level"
            header={
              <div className="col-head">
                <span className="ch-num">{u}</span>
                <span className="ch-lab">{URGENCY[u].label}<span className="sm">{u === 1 ? "grab these first" : "soonest due first"}</span></span>
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
    todo: sortQueue, prog: sortQueue, done: sortEntryOrder, picked: sortEntryOrder,
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
          <span className="meta-mono"><Icon name="calendar" />In {fmtDate(t.dropoff)}{t.dropoffAmPm ? ` · ${t.dropoffAmPm}` : ""}</span>
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
export function QuickMenu({ ctx, onClose, onUrgency, onStatus, onEdit, onDelete }: {
  ctx: { x: number; y: number; ticket: Ticket };
  onClose: () => void;
  onUrgency: (id: string, u: number) => void;
  onStatus: (id: string, s: Status) => void;
  onEdit: (t: Ticket) => void;
  onDelete: (t: Ticket) => void;
}) {
  const t = ctx.ticket;
  const vw = window.innerWidth, vh = window.innerHeight;
  const W = 210, H = 410;
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
        <div className="pop-div" />
        <button className="pop-item danger" onClick={() => { onDelete(t); onClose(); }}>
          <Icon name="trash-2" />Delete ticket
        </button>
      </div>
    </>
  );
}

/* ================= CONFIRM DELETE DIALOG ================= */
export function ConfirmDeleteDialog({ ticket, onCancel, onConfirm }: {
  ticket: Ticket;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCancel]);

  return (
    <div className="scrim-dark" onMouseDown={onCancel}>
      <div className="modal confirm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{"</"} DELETE TICKET {">"}</div>
            <h2>Delete {ticket.id}?</h2>
          </div>
          <button className="iconbtn" onClick={onCancel} style={{ width: 34, height: 34 }}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="confirm-msg">
            This permanently removes <b>{ticket.name}</b>&apos;s ticket ({ticket.desc}).
            It will NOT go to the archive and can&apos;t be brought back.
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn danger" onClick={onConfirm}><Icon name="trash-2" />Delete ticket</button>
        </div>
      </div>
    </div>
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
  dropoffAmPm: AmPm | null;
  dueAt: string | null; // ISO timestamp, built from the due date + AM/PM on submit
  assignedTo: Person;
  deviceType: "desktop" | "laptop" | null;
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
    // New tickets default to the current half of the day; old tickets may have none.
    dropoffAmPm: editing?.id ? editing?.dropoffAmPm ?? null : (new Date().getHours() < 12 ? "AM" : "PM"),
    dueAt: editing?.dueAt || null,
    assignedTo: editing?.assignedTo || "keith",
    // New tickets default to Laptop; legacy tickets show neither selected until set.
    deviceType: editing?.id ? editing?.deviceType ?? null : "laptop",
  }));
  // Due date is a half-day pickup window ("Thursday AM"); default PM.
  const [due, setDueState] = React.useState<{ date: string; half: AmPm }>(() =>
    editing?.dueAt ? dueParts(editing.dueAt) : { date: "", half: "PM" }
  );
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
    onSave({
      ...f, name: f.name.trim(), phone: f.phone.trim(), desc: f.desc.trim(),
      dueAt: due.date ? buildDueAt(due.date, due.half) : null,
    });
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
              <div className="dropoff-row">
                <DateField value={f.dropoff} onChange={(v) => set("dropoff", v)} />
                <AmPmToggle value={f.dropoffAmPm} onChange={(v) => set("dropoffAmPm", v)} />
              </div>
            </div>
            <div className="field">
              <label className="lbl">Phone</label>
              <input className="inp mono" type="tel" placeholder="(253) 555-0000" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>

          <div className="field-grid">
            <div className="field">
              <label className="lbl">Pickup due <span className="opt-hint">optional</span></label>
              <div className="dropoff-row">
                <DateField value={due.date} clearable placeholder="No due date"
                  onChange={(v) => setDueState((p) => ({ ...p, date: v }))} />
                <AmPmToggle value={due.date ? due.half : null} disabled={!due.date}
                  onChange={(v) => setDueState((p) => ({ ...p, half: v }))} />
              </div>
            </div>
            <div className="field">
              <label className="lbl">Device</label>
              <div className="toggle device">
                <button type="button" className={f.deviceType === "laptop" ? "on" : ""}
                  onClick={() => set("deviceType", "laptop")}>Laptop</button>
                <button type="button" className={f.deviceType === "desktop" ? "on" : ""}
                  onClick={() => set("deviceType", "desktop")}>Desktop</button>
              </div>
            </div>
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

          <div className="field">
            <label className="lbl">Assigned to</label>
            <div className="toggle people">
              {PEOPLE.map((p) => (
                <button key={p.key} type="button" className={`person ${p.key} ${f.assignedTo === p.key ? "on" : ""}`}
                  onClick={() => set("assignedTo", p.key)}>
                  <span className={`avchip ${p.key}`}>{p.label[0]}</span>{p.label}
                </button>
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
