"use client";

import React from "react";
import {
  Calendar, Phone, Plug, PlugZap, Search, Pencil, EllipsisVertical, Check, X,
  List, Archive, Plus, Menu, Wrench, CircleCheck,
  PackageCheck, PackageSearch, Clock, Circle, Loader, GripVertical, ChevronLeft, ChevronRight,
  Trash2, MoveRight, RotateCcw, LogOut, KeyRound, Printer, MessageCircle,
  Bell, Volume2, VolumeX, Play, CheckCheck, Settings, type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";
import { printTicketLabels } from "./printLabels";
import { NEW_PRESETS, REORDER_PRESETS, previewChime } from "./chime";
import type { FeedItem } from "./notifStore";
import {
  URGENCY, STATUS, STATUS_ORDER, PEOPLE, DEVICE_TYPES, SERVICE_TAGS,
  fmtDate, fmtDateLong, fmtDueAt, fmtDueHalf,
  buildDueAt, dueParts, sortQueue, sortEntryOrder, todayISO, daysBetween, assignees,
  type Ticket, type Status, type Person, type AmPm, type DeviceType, type ServiceTag,
} from "@/lib/tickets";

/* Field-level edits the expanded row can save. */
export type InlinePatch = Partial<Pick<Ticket,
  "name" | "phone" | "password" | "desc" | "urgency" | "charger" | "assignedTo" | "deviceType" |
  "serviceTag" | "dropoff" | "dropoffAmPm" | "dueAt">>;

export type View = "list" | "parts" | "archive";
export type Drag = { id: string; from: string; over: string } | null;

/* ---------- icons ---------- */
const ICONS: Record<string, LucideIcon> = {
  calendar: Calendar, phone: Phone, plug: Plug, "plug-zap": PlugZap, search: Search,
  pencil: Pencil, "ellipsis-vertical": EllipsisVertical, check: Check, x: X, list: List,
  archive: Archive, plus: Plus, menu: Menu,
  wrench: Wrench, "circle-check": CircleCheck, "package-check": PackageCheck,
  "package-search": PackageSearch, clock: Clock, circle: Circle, loader: Loader,
  "grip-vertical": GripVertical,
  "chevron-left": ChevronLeft, "chevron-right": ChevronRight, "trash-2": Trash2,
  "move-right": MoveRight, "rotate-ccw": RotateCcw, "log-out": LogOut,
  "key-round": KeyRound, printer: Printer, "message-circle": MessageCircle,
  bell: Bell, "volume-2": Volume2, "volume-x": VolumeX, play: Play, "check-check": CheckCheck,
  settings: Settings,
};

const pad2 = (n: number) => String(n).padStart(2, "0");

function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

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

export function SvcTag({ tag }: { tag?: ServiceTag | null }) {
  if (!tag) return null;
  const s = SERVICE_TAGS.find((x) => x.key === tag);
  return <span className={`svc-tag ${tag}`}>{(s?.label || tag).toUpperCase()}</span>;
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
        <Pop anchor={anchor} width={176} height={252} onClose={() => setAnchor(null)} className="statmenu">
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
      {/* "blank", not "empty" — the global .empty empty-state class would balloon the button */}
      <button type="button" className={`inp mono pickbtn ${value ? "" : "blank"}`}
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

/* Overlapping chips for tickets assigned to more than one person. */
export function AvatarStack({ who }: { who?: Person[] }) {
  return (
    <span className="av-stack">
      {assignees({ assignedTo: who }).map((p) => <AvatarChip key={p} who={p} />)}
    </span>
  );
}

/* "Keith + Garrett" in PEOPLE order. */
export function assigneeLabel(who?: Person[]): string {
  return assignees({ assignedTo: who })
    .map((p) => PEOPLE.find((x) => x.key === p)?.label || p)
    .join(" + ");
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
  onStatus: (id: string, s: Status) => void;
  onMoveRequest: (m: PendingMove) => void;
  onPatch: (id: string, patch: InlinePatch) => void;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  drag: Drag;
  setDrag: (d: Drag) => void;
  canReorder: boolean; // off while a person filter or search hides rows
  getAlert: (id: string) => boolean; // true while a row should glow (new/moved, unresolved)
};
export function ListView({ tickets, onMenu, onStatus, onMoveRequest, onPatch, expandedId, onToggleExpand, drag, setDrag, canReorder, getAlert }: ListProps) {
  const sorted = React.useMemo(
    () => tickets.filter((t) => t.status === "todo" || t.status === "prog" || t.status === "call" || t.status === "resp").sort(sortQueue),
    [tickets]
  );
  const done = React.useMemo(
    () => tickets.filter((t) => t.status === "done").sort(sortEntryOrder),
    [tickets]
  );
  const byU = React.useMemo(() => {
    const m = new Map<number, Ticket[]>();
    for (const u of [1, 2, 3, 4, 5]) m.set(u, sorted.filter((t) => t.urgency === u));
    return m;
  }, [sorted]);
  const topId = sorted[0] && sorted[0].id;

  const listDrag = drag && drag.from === "list" ? drag : null;
  const dragged = listDrag ? sorted.find((t) => t.id === listDrag.id) || null : null;
  // Where the dragged row would land: urgency group + index among that group's rows.
  const [target, setTarget] = React.useState<{ u: number; index: number } | null>(null);

  const draggedRef = React.useRef(dragged); draggedRef.current = dragged;
  const expandedIdRef = React.useRef(expandedId); expandedIdRef.current = expandedId;
  // Pointer-events drag — no HTML5 DnD API at all.
  // HTML5 drag is rejected by browsers (Chrome, Safari) when source elements have
  // CSS animations, causing silent failures with no dragend cleanup. Pointer events
  // fire unconditionally regardless of CSS state, so every row behaves identically.
  const listWrapRef = React.useRef<HTMLDivElement | null>(null);
  const pillRef = React.useRef<HTMLDivElement | null>(null);
  const isDraggingRef = React.useRef(false); isDraggingRef.current = !!dragged;
  const pointerY = React.useRef(-1);
  // Grip pressed but not yet moved 5 px — waiting to confirm drag intent vs. click.
  const pendingDrag = React.useRef<{ t: Ticket; startX: number; startY: number } | null>(null);

  // Buffer target updates to at most one per animation frame (pointermove is fast).
  const pendingTarget = React.useRef<{ u: number; index: number } | null>(null);
  const targetRaf = React.useRef(0);
  React.useEffect(() => () => { if (targetRaf.current) cancelAnimationFrame(targetRaf.current); }, []);

  const clearDrag = React.useCallback(() => {
    pendingDrag.current = null;
    pendingTarget.current = null;
    setDrag(null);
    setTarget(null);
    pointerY.current = -1;
    if (pillRef.current) { pillRef.current.remove(); pillRef.current = null; }
  }, [setDrag]);

  // Stored in a ref so the always-on pointer listener always calls the version
  // with the freshest dragged / target / byU / sorted closure values.
  const commitRef = React.useRef<() => void>(() => {});
  commitRef.current = () => {
    const tgt = pendingTarget.current || target;
    if (!draggedRef.current || !tgt) { clearDrag(); return; }
    const dr = draggedRef.current;
    const grp = byU.get(tgt.u) || [];
    const beforeItems = grp.slice(0, tgt.index).filter((t) => t.id !== dr.id);
    const afterItems = grp.slice(tgt.index).filter((t) => t.id !== dr.id);
    const prevId = beforeItems.length ? beforeItems[beforeItems.length - 1].id : null;
    const nextId = afterItems.length ? afterItems[0].id : null;
    const moved = { ...dr, urgency: tgt.u };
    const newOrder: Ticket[] = [];
    for (const u of [1, 2, 3, 4, 5]) {
      const arr = (byU.get(u) || []).filter((t) => t.id !== dr.id);
      if (u === tgt.u) {
        const at = nextId ? arr.findIndex((t) => t.id === nextId) : arr.length;
        arr.splice(at === -1 ? arr.length : at, 0, moved);
      }
      newOrder.push(...arr);
    }
    const oldIdx = sorted.findIndex((t) => t.id === dr.id);
    const newIdx = newOrder.findIndex((t) => t.id === dr.id);
    const newPos = new Map(newOrder.map((t, i) => [t.id, i] as const));
    const jumped = sorted.filter((t, i) =>
      t.id !== dr.id &&
      i < oldIdx && (newPos.get(t.id) ?? 0) > newIdx &&
      !!t.dueAt && (!dr.dueAt || (t.dueAt as string) < (dr.dueAt as string))
    );
    clearDrag();
    if (newIdx === oldIdx && dr.urgency === tgt.u) return;
    onMoveRequest({ ticket: dr, urgency: tgt.u, prevId, nextId, jumped });
  };

  // Single set of document listeners mounted once. All state is accessed via refs
  // so the stable closure never goes stale.
  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // Phase 1: pending — confirm drag intent once pointer moves 5 px.
      if (pendingDrag.current && !isDraggingRef.current) {
        const { t, startX, startY } = pendingDrag.current;
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < 5) return;
        pendingDrag.current = null;
        if (expandedIdRef.current) onToggleExpand(expandedIdRef.current);
        const pill = document.createElement("div");
        pill.textContent = t.name;
        pill.style.cssText = "position:fixed;z-index:9999;pointer-events:none;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:6px 14px;font-size:14px;font-weight:600;color:#111;box-shadow:0 2px 8px rgba(0,0,0,.18);white-space:nowrap;transform:translate(-50%,-50%)";
        pill.style.left = e.clientX + "px";
        pill.style.top = (e.clientY - 24) + "px";
        document.body.appendChild(pill);
        pillRef.current = pill;
        setDrag({ id: t.id, from: "list", over: "list" });
        return;
      }
      // Phase 2: active drag — track position and update drop target.
      if (!isDraggingRef.current) return;
      pointerY.current = e.clientY;
      if (pillRef.current) {
        pillRef.current.style.left = e.clientX + "px";
        pillRef.current.style.top = (e.clientY - 24) + "px";
      }
      if (!listWrapRef.current || !draggedRef.current) return;
      // Scan every draggable row (and empty-group drop zones) by position.
      const nodes = listWrapRef.current.querySelectorAll<HTMLElement>("[data-dgu]");
      let found: { u: number; index: number } | null = null;
      for (const node of nodes) {
        const r = node.getBoundingClientRect();
        const u = +(node.dataset.dgu as string);
        const i = +(node.dataset.dgi as string);
        if (e.clientY < r.top + r.height / 2) { found = { u, index: i }; break; }
        found = { u, index: i + 1 };
      }
      if (found) {
        pendingTarget.current = found;
        if (!targetRaf.current) {
          targetRaf.current = requestAnimationFrame(() => {
            targetRaf.current = 0;
            const pt = pendingTarget.current;
            setTarget((p) => (!pt || (p && p.u === pt.u && p.index === pt.index)) ? p : pt);
          });
        }
      }
    };
    const onUp = () => {
      if (isDraggingRef.current) commitRef.current();
      else pendingDrag.current = null;
    };
    const onCancel = () => clearDrag();
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
    };
  }, [setDrag, clearDrag, onToggleExpand]);

  const isDragging = !!dragged;
  React.useEffect(() => {
    if (!isDragging) return;
    let raf = requestAnimationFrame(function tick() {
      const y = pointerY.current;
      if (y > 0) {
        if (y < 90) window.scrollBy(0, -10);
        else if (y > window.innerHeight - 90) window.scrollBy(0, 10);
      }
      raf = requestAnimationFrame(tick);
    });
    return () => { cancelAnimationFrame(raf); pointerY.current = -1; };
  }, [isDragging]);

  const onGripDown = React.useCallback((e: React.PointerEvent, t: Ticket) => {
    e.preventDefault(); // prevent text selection while holding the grip
    pendingDrag.current = { t, startX: e.clientX, startY: e.clientY };
  }, []);

  return (
    <div className="list-wrap" ref={listWrapRef}>
      {[1, 2, 3, 4, 5].map((u) => {
        const list = byU.get(u) || [];
        if (!list.length && !dragged) return null;
        const lineAt = dragged && target && target.u === u ? target.index : -1;
        return (
          <React.Fragment key={u}>
            <div className="list-group-label">
              <span>Urgency {u} · {URGENCY[u].label}</span>
              <span className="ln" />
              <span>{list.length}</span>
            </div>
            {list.length === 0 && dragged && (
              <div className={`ins-zone ${lineAt === 0 ? "on" : ""}`} data-dgu={u} data-dgi={0}>
                drop here
              </div>
            )}
            {list.map((t, i) => (
              <QueueRow key={t.id} t={t}
                isNext={t.id === topId}
                dragging={!!listDrag && listDrag.id === t.id}
                canReorder={canReorder}
                alert={getAlert(t.id)}
                expanded={expandedId === t.id}
                dropBefore={lineAt === i}
                dropAfter={lineAt === list.length && i === list.length - 1}
                groupU={u} index={i}
                onToggle={onToggleExpand}
                onPatch={onPatch}
                onGripDown={onGripDown}
                onStatus={onStatus} onMenu={onMenu} />
            ))}
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
          {done.map((t) => <DoneRow key={t.id} t={t} onStatus={onStatus} expanded={expandedId === t.id} onToggle={onToggleExpand} onPatch={onPatch} />)}
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
  alert: boolean; // glow this row (new ticket / moved in queue, not yet resolved)
  expanded: boolean;
  dropBefore: boolean; // paint the drop indicator above this row
  dropAfter: boolean; // ...or below it (end of an urgency group)
  groupU: number;
  index: number;
  onToggle: (id: string) => void;
  onPatch: (id: string, patch: InlinePatch) => void;
  onGripDown: (e: React.PointerEvent, t: Ticket) => void;
  onStatus: (id: string, s: Status) => void;
  onMenu: (e: React.MouseEvent, t: Ticket) => void;
};

/* Memoized because dragover re-renders the list up to once per frame while a row is
   dragged — without memo every row repaints on each indicator move. */
const QueueRow = React.memo(function QueueRow({ t, isNext, dragging, canReorder, alert, expanded, dropBefore, dropAfter, groupU, index, onToggle, onPatch, onGripDown, onStatus, onMenu }: QueueRowProps) {
  // Keep the expansion body mounted through the collapse animation, then unmount.
  const [bodyMounted, setBodyMounted] = React.useState(expanded);
  // Two stages: a compact read-only peek first; the pencil opens the full inline editor.
  const [mode, setMode] = React.useState<"info" | "edit">("info");
  React.useEffect(() => { if (expanded) setBodyMounted(true); }, [expanded]);

  const openEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMode("edit");
    if (!expanded) onToggle(t.id);
  };

  const headClick = () => {
    if (window.getSelection()?.toString()) return; // copying text shouldn't bounce the row
    onToggle(t.id);
  };

  const cls = [
    "lrow", `u${t.urgency}`,
    isNext ? "next" : "",
    dragging ? "dragging" : "",
    expanded ? "expanded" : "",
    dropBefore ? "drop-before" : "",
    dropAfter ? "drop-after" : "",
    alert ? "alert" : "",
    t.deviceType ?? "",
  ].join(" ");

  return (
    <div className={cls} data-dgu={groupU} data-dgi={index}>
      <div className="lrow-head" onClick={headClick}>
        <span className={`grip ${canReorder ? "" : "off"}`}
          title={canReorder ? "Drag to reorder" : "Reordering is off while filtering"}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={canReorder ? (e) => onGripDown(e, t) : undefined}>
          <Icon name="grip-vertical" size={15} />
        </span>
        <UrgencyChip u={t.urgency} />
        <div style={{ minWidth: 0 }}>
          <div className="nm">{t.name}<SvcTag tag={t.serviceTag} /></div>
          <div className="ds">{t.desc}</div>
          {/* phone-layout only (CSS-shown ≤640): the narrow row has no phone column */}
          {t.phone && <div className="nm-phone"><Icon name="phone" size={12} />{t.phone}</div>}
        </div>
        <span className="meta-mono l-date l-drop" title="Dropped off">
          <Icon name="calendar" />{fmtDate(t.dropoff)}{t.dropoffAmPm ? ` · ${t.dropoffAmPm}` : ""}
          {t.dueAt && <Icon name="move-right" size={12} className="date-arrow" />}
        </span>
        {t.dueAt
          ? <span className="meta-mono l-date due l-due" title="Pickup due"><Icon name="clock" />{fmtDueHalf(t.dueAt)}</span>
          : <span className="meta-mono l-date l-due nodue">—</span>}
        <span className="meta-mono l-phone"><Icon name="phone" />{t.phone}</span>
        <StatusPillMenu t={t} onStatus={onStatus} />
        <span className="acts">
          <button className="iconbtn tick" title="Mark complete" onClick={(e) => { e.stopPropagation(); onStatus(t.id, "done"); }}><Icon name="check" /></button>
          <button className="iconbtn" title={t.password ? "Print labels (customer + password)" : "Print customer label"} onClick={(e) => { e.stopPropagation(); printTicketLabels(t); }}><Icon name="printer" /></button>
          <button className="iconbtn" title="Edit" onClick={openEditor}><Icon name="pencil" /></button>
          <button className="iconbtn" title="Quick change" onClick={(e) => { e.stopPropagation(); onMenu(e, t); }}><Icon name="ellipsis-vertical" /></button>
        </span>
      </div>
      <div className="lrow-exp"
        onTransitionEnd={(e) => { if (e.propertyName === "grid-template-rows" && !expanded) { setBodyMounted(false); setMode("info"); } }}>
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
});

/* Completed-section row. Memoized for the same reason as QueueRow. */
const DoneRow = React.memo(function DoneRow({ t, onStatus, expanded, onToggle, onPatch }: {
  t: Ticket;
  onStatus: (id: string, s: Status) => void;
  expanded: boolean;
  onToggle: (id: string) => void;
  onPatch: (id: string, patch: InlinePatch) => void;
}) {
  const [bodyMounted, setBodyMounted] = React.useState(expanded);
  const [mode, setMode] = React.useState<"info" | "edit">("info");
  React.useEffect(() => { if (expanded) setBodyMounted(true); }, [expanded]);

  const headClick = () => {
    if (window.getSelection()?.toString()) return;
    onToggle(t.id);
  };

  const openEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMode("edit");
    if (!expanded) onToggle(t.id);
  };

  return (
    <div className={`lrow done-row u${t.urgency} ${t.deviceType ?? ""} ${expanded ? "expanded" : ""}`}>
      <div className="lrow-head" onClick={headClick}>
        <span className="done-ic"><Icon name="circle-check" size={16} /></span>
        <UrgencyChip u={t.urgency} />
        <div style={{ minWidth: 0 }}>
          <div className="nm">{t.name}</div>
          <div className="ds">{t.desc}</div>
        </div>
        <span className="meta-mono l-date done-at" title="Completed"><Icon name="check" />{t.statusChangedAt ? fmtDueAt(t.statusChangedAt) : "—"}</span>
        <span className="meta-mono l-phone"><Icon name="phone" />{t.phone}</span>
        <StatusPillMenu t={t} onStatus={onStatus} />
        <span className="acts" onClick={(e) => e.stopPropagation()}>
          <button className="iconbtn" title="Edit" onClick={openEditor}><Icon name="pencil" /></button>
          <button className="btn pickup" onClick={() => onStatus(t.id, "picked")}>
            <Icon name="package-check" />Picked up
          </button>
        </span>
      </div>
      <div className="lrow-exp"
        onTransitionEnd={(e) => { if (e.propertyName === "grid-template-rows" && !expanded) { setBodyMounted(false); setMode("info"); } }}>
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
});

/* Compact read-only peek shown first when a row expands: the full description plus
   the details the collapsed row hides, with an Edit button to open the inline editor. */
function RowPeek({ t, onEdit }: { t: Ticket; onEdit: () => void }) {
  return (
    <div className="exp-peek">
      <div className="peek-desc">{t.desc || <span className="muted">No description</span>}</div>
      <div className="peek-meta">
        {t.phone && <span className="peek-item"><Icon name="phone" />{t.phone}</span>}
        {/* dates live here too: the phone-width row hides its date columns */}
        <span className="peek-item"><Icon name="calendar" />In {fmtDate(t.dropoff)}{t.dropoffAmPm ? ` · ${t.dropoffAmPm}` : ""}</span>
        {t.dueAt && <span className="peek-item"><Icon name="clock" />Due {fmtDueHalf(t.dueAt)}</span>}
        {t.password && <span className="peek-item"><Icon name="key-round" />{t.password}</span>}
        <span className="peek-item"><Icon name={t.charger ? "plug-zap" : "plug"} />{t.charger ? "Charger in" : "No charger"}</span>
        <span className="peek-item">
          <Icon name="wrench" />
          {DEVICE_TYPES.find((d) => d.key === t.deviceType)?.label || "Device not set"}
        </span>
        <span className="peek-item"><AvatarStack who={t.assignedTo} />{assigneeLabel(t.assignedTo)}</span>
        {t.serviceTag && <span className="peek-item"><SvcTag tag={t.serviceTag} /></span>}
        {t.status === "parts" && (
          <span className="peek-item">
            <Icon name="package-search" />Waiting since {t.statusChangedAt ? fmtDueAt(t.statusChangedAt) : "—"}
          </span>
        )}
        <span className="peek-spacer" />
        <button type="button" className="btn ghost peek-print" onClick={() => printTicketLabels(t)}>
          <Icon name="printer" />{t.password ? "Print labels" : "Print label"}
        </button>
        {/* Mobile only — desktop edits via the pencil in the row (CSS hides this above 860px). */}
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
  const [draft, setDraft] = React.useState({ name: t.name, phone: t.phone, password: t.password ?? "", desc: t.desc });
  const draftRef = React.useRef(draft); draftRef.current = draft;
  const tRef = React.useRef(t); tRef.current = t;
  const onPatchRef = React.useRef(onPatch); onPatchRef.current = onPatch;

  const flush = React.useCallback(() => {
    const d = draftRef.current, cur = tRef.current;
    const p: InlinePatch = {};
    if (d.name.trim() && d.name.trim() !== cur.name) p.name = d.name.trim();
    if (d.phone.trim() !== cur.phone) p.phone = d.phone.trim();
    if (d.password.trim() !== (cur.password ?? "")) p.password = d.password.trim();
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
          onChange={(e) => setDraft((p) => ({ ...p, phone: fmtPhone(e.target.value) }))} />
      </div>
      <div className="exp-field full">
        <label className="lbl">Device password</label>
        <input className="inp mono" placeholder="Login / PIN for the device" value={draft.password} onBlur={flush}
          onChange={(e) => setDraft((p) => ({ ...p, password: e.target.value }))} />
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
          {DEVICE_TYPES.map((d) => (
            <button key={d.key} type="button" className={t.deviceType === d.key ? "on" : ""}
              onClick={() => onPatch(t.id, { deviceType: d.key })}>{d.label}</button>
          ))}
        </div>
      </div>
      <div className="exp-field">
        <label className="lbl">Expedite / contract</label>
        <div className="toggle svc">
          {SERVICE_TAGS.map((s) => (
            <button key={s.key} type="button" className={`${s.key} ${t.serviceTag === s.key ? "on" : ""}`}
              onClick={() => onPatch(t.id, { serviceTag: t.serviceTag === s.key ? null : s.key })}>
              {s.label}
            </button>
          ))}
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
          {PEOPLE.map((p) => {
            const cur = assignees(t);
            const on = cur.includes(p.key);
            return (
              <button key={p.key} type="button" className={on ? "on" : ""}
                onClick={() => {
                  // Toggle membership in PEOPLE order; never allow zero assignees.
                  const next = PEOPLE.map((x) => x.key).filter((k) => (k === p.key ? !on : cur.includes(k)));
                  if (next.length) onPatch(t.id, { assignedTo: next });
                }}>
                <span className={`avchip ${p.key}`}>{p.label[0]}</span>{p.label}
              </button>
            );
          })}
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

/* ================= WAITING ON PARTS ================= */
/* Parked tickets — drag to reorder. The status pill is the way back: set the
   ticket to any other status and it returns to its old slot in the queue. */
// Sort by sortPos (drag order) with statusChangedAt as tiebreaker for new arrivals.
function sortPartsOrder(a: Ticket, b: Ticket): number {
  const ap = a.sortPos ?? Infinity, bp = b.sortPos ?? Infinity;
  if (ap !== bp) return ap - bp;
  return sortEntryOrder(a, b);
}
export function PartsView({ tickets, onStatus, onMenu, onPatch, expandedId, onToggleExpand, drag, setDrag, onMoveRequest, canReorder }: {
  tickets: Ticket[];
  onStatus: (id: string, s: Status) => void;
  onMenu: (e: React.MouseEvent, t: Ticket) => void;
  onPatch: (id: string, patch: InlinePatch) => void;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  drag: Drag;
  setDrag: (d: Drag) => void;
  onMoveRequest: (m: PendingMove) => void;
  canReorder: boolean;
}) {
  const list = tickets.filter((t) => t.status === "parts").sort(sortPartsOrder);

  const partsDrag = drag && drag.from === "parts" ? drag : null;
  const dragged = partsDrag ? list.find((t) => t.id === partsDrag.id) || null : null;
  const [target, setTarget] = React.useState<number | null>(null);

  const draggedRef = React.useRef(dragged); draggedRef.current = dragged;
  const expandedIdRef = React.useRef(expandedId); expandedIdRef.current = expandedId;
  const listWrapRef = React.useRef<HTMLDivElement | null>(null);
  const pillRef = React.useRef<HTMLDivElement | null>(null);
  const isDraggingRef = React.useRef(false); isDraggingRef.current = !!dragged;
  const pointerY = React.useRef(-1);
  const pendingDrag = React.useRef<{ t: Ticket; startX: number; startY: number } | null>(null);

  const pendingTarget = React.useRef<number | null>(null);
  const targetRaf = React.useRef(0);
  React.useEffect(() => () => { if (targetRaf.current) cancelAnimationFrame(targetRaf.current); }, []);

  const clearDrag = React.useCallback(() => {
    pendingDrag.current = null;
    pendingTarget.current = null;
    setDrag(null);
    setTarget(null);
    pointerY.current = -1;
    if (pillRef.current) { pillRef.current.remove(); pillRef.current = null; }
  }, [setDrag]);

  const commitRef = React.useRef<() => void>(() => {});
  commitRef.current = () => {
    const tgt = pendingTarget.current ?? target;
    if (dragged === null || tgt === null) { clearDrag(); return; }
    const oldIdx = list.findIndex((t) => t.id === dragged.id);
    const listWithout = list.filter((t) => t.id !== dragged.id);
    const ins = tgt > oldIdx ? tgt - 1 : tgt;
    const prevId = ins > 0 ? (listWithout[ins - 1]?.id ?? null) : null;
    const nextId = listWithout[ins]?.id ?? null;
    const prevIdBefore = oldIdx > 0 ? list[oldIdx - 1].id : null;
    const nextIdBefore = list[oldIdx + 1]?.id ?? null;
    clearDrag();
    if (prevId === prevIdBefore && nextId === nextIdBefore) return;
    onMoveRequest({ ticket: dragged, urgency: dragged.urgency, prevId, nextId, jumped: [] });
  };

  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (pendingDrag.current && !isDraggingRef.current) {
        const { t, startX, startY } = pendingDrag.current;
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < 5) return;
        pendingDrag.current = null;
        if (expandedIdRef.current) onToggleExpand(expandedIdRef.current);
        const pill = document.createElement("div");
        pill.textContent = t.name;
        pill.style.cssText = "position:fixed;z-index:9999;pointer-events:none;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:6px 14px;font-size:14px;font-weight:600;color:#111;box-shadow:0 2px 8px rgba(0,0,0,.18);white-space:nowrap;transform:translate(-50%,-50%)";
        pill.style.left = e.clientX + "px";
        pill.style.top = (e.clientY - 24) + "px";
        document.body.appendChild(pill);
        pillRef.current = pill;
        setDrag({ id: t.id, from: "parts", over: "parts" });
        return;
      }
      if (!isDraggingRef.current) return;
      pointerY.current = e.clientY;
      if (pillRef.current) {
        pillRef.current.style.left = e.clientX + "px";
        pillRef.current.style.top = (e.clientY - 24) + "px";
      }
      if (!listWrapRef.current || !draggedRef.current) return;
      const nodes = listWrapRef.current.querySelectorAll<HTMLElement>("[data-dgi]");
      let found: number | null = null;
      for (const node of nodes) {
        const r = node.getBoundingClientRect();
        const i = +(node.dataset.dgi as string);
        if (e.clientY < r.top + r.height / 2) { found = i; break; }
        found = i + 1;
      }
      if (found !== null) {
        pendingTarget.current = found;
        if (!targetRaf.current) {
          targetRaf.current = requestAnimationFrame(() => {
            targetRaf.current = 0;
            const pt = pendingTarget.current;
            setTarget((p) => (p === pt ? p : pt));
          });
        }
      }
    };
    const onUp = () => {
      if (isDraggingRef.current) commitRef.current();
      else pendingDrag.current = null;
    };
    const onCancel = () => clearDrag();
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
    };
  }, [setDrag, clearDrag, onToggleExpand]);

  const isDragging = !!dragged;
  React.useEffect(() => {
    if (!isDragging) return;
    let raf = requestAnimationFrame(function tick() {
      const y = pointerY.current;
      if (y > 0) {
        if (y < 90) window.scrollBy(0, -10);
        else if (y > window.innerHeight - 90) window.scrollBy(0, 10);
      }
      raf = requestAnimationFrame(tick);
    });
    return () => { cancelAnimationFrame(raf); pointerY.current = -1; };
  }, [isDragging]);

  const onGripDown = React.useCallback((e: React.PointerEvent, t: Ticket) => {
    e.preventDefault();
    pendingDrag.current = { t, startX: e.clientX, startY: e.clientY };
  }, []);


  if (list.length === 0) {
    return (
      <div className="empty">
        <div className="mark">{"<"}<b>/</b>{">"}</div>
        <div className="et">Nothing waiting on parts</div>
        <div className="es">Set a ticket&apos;s status to &ldquo;Waiting on parts&rdquo; and it will park here until the parts arrive.</div>
      </div>
    );
  }

  return (
    <div className="list-wrap parts-list" ref={listWrapRef}>
      <div className="list-group-label">
        <span>Waiting on parts</span>
        <span className="ln" />
        <span>{list.length}</span>
      </div>
      {list.map((t, i) => (
        <QueueRow key={t.id} t={t} isNext={false} dragging={!!partsDrag && partsDrag.id === t.id} canReorder={canReorder} alert={false}
          dropBefore={target === i} dropAfter={target === i + 1 && i === list.length - 1}
          groupU={0} index={i}
          expanded={expandedId === t.id} onToggle={onToggleExpand} onPatch={onPatch}
          onGripDown={onGripDown}
          onStatus={onStatus} onMenu={onMenu} />
      ))}
    </div>
  );
}

/* ================= ARCHIVE ================= */
/* Picked-up tickets land here the moment they're marked picked up. The default
   view shows the last 7 days; searching looks across EVERY archived record, so
   history is never out of reach. */
const ARCHIVE_WINDOW_DAYS = 7;

export function ArchiveView({ archive, search, onStatus }: {
  archive: Ticket[]; search: string; onStatus: (id: string, s: Status) => void;
}) {
  const q = (search || "").trim().toLowerCase();
  const today = todayISO();
  const inWindow = (t: Ticket) => !!t.archivedAt && daysBetween(t.archivedAt, today) <= ARCHIVE_WINDOW_DAYS;
  const list = [...archive]
    .filter((t) => (q
      ? t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
      : inWindow(t)))
    .sort((a, b) => (b.archivedAt || "").localeCompare(a.archivedAt || ""));

  return (
    <div className="vault">
      <div className="vault-head">
        <span className="br">{"</>"}</span>
        <span className="t">Records vault</span>
        <span className="c">{list.length} {list.length === 1 ? "record" : "records"}</span>
        <span className="vault-note">{q ? "searching all records" : "last 7 days — search to find older tickets"}</span>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <div className="mark">{"<"}<b>/</b>{">"}</div>
          <div className="et">{q ? "No matching records" : "Nothing picked up this week"}</div>
          <div className="es">{q ? "Try a different name, device, or ticket number." : "Tickets land here the moment they're marked picked up. Older records are still on file — search to find them."}</div>
        </div>
      ) : list.map((t) => (
        <div key={t.id} className={`arow u${t.urgency}`}>
          <UrgencyChip u={t.urgency} />
          <div style={{ minWidth: 0 }}>
            <div className="nm">{t.name} <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gray-400)", fontWeight: 400 }}>· {t.id}</span></div>
            <div className="ds">{t.desc}</div>
          </div>
          <span className="meta-mono l-phone"><Icon name="phone" />{t.phone}</span>
          <span className="meta-mono a-in"><Icon name="calendar" />In {fmtDate(t.dropoff)}{t.dropoffAmPm ? ` · ${t.dropoffAmPm}` : ""}</span>
          <Charger yes={t.charger} />
          <span className="archd"><span className="lbl2">Picked up</span>{t.archivedAt ? fmtDate(t.archivedAt) : "—"}</span>
          <button className="iconbtn" title="Picked up by mistake? Send back to Completed"
            onClick={() => onStatus(t.id, "done")}>
            <Icon name="rotate-ccw" size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ================= NOTIFICATIONS ================= */
export type NotifProps = {
  count: number;                 // currently-glowing (unresolved) alerts
  feed: FeedItem[];              // recent activity, newest first
  open: boolean;
  setOpen: (v: boolean) => void;
  soundOn: boolean;              // is THIS screen the one that plays sound
  onToggleSound: () => void;
  soundNew: string;
  setSoundNew: (k: string) => void;
  soundReorder: string;
  setSoundReorder: (k: string) => void;
  onResolveAll: () => void;
  onOpenSettings: () => void;
};

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

/* App-styled sound picker (no bare <select>): a chip per preset; clicking one
   selects it AND previews it so Keith hears the choice immediately. */
function SoundPicker({ label, kind, presets, value, onChange }: {
  label: string; kind: "new" | "reorder";
  presets: { key: string; label: string }[]; value: string; onChange: (k: string) => void;
}) {
  return (
    <div className="notif-pick">
      <span className="notif-pick-label">{label}</span>
      <div className="notif-chips">
        {presets.map((p) => (
          <button key={p.key} className={`notif-chip ${value === p.key ? "on" : ""}`}
            onClick={() => { onChange(p.key); previewChime(kind, p.key); }}>
            {value === p.key && <Icon name="play" size={12} />}{p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NotifBell({ notif }: { notif: NotifProps }) {
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);
  const close = () => { notif.setOpen(false); setAnchor(null); };
  const toggle = (e: React.MouseEvent) => {
    if (notif.open) close();
    else { setAnchor(e.currentTarget.getBoundingClientRect()); notif.setOpen(true); }
  };
  return (
    <div className="notif">
      <button className={`nav-lock notif-bell ${notif.count ? "has" : ""}`}
        title="Notifications" aria-label="Notifications" onClick={toggle}>
        <Icon name="bell" size={18} />
        {notif.count > 0 && <span className="notif-badge">{notif.count > 9 ? "9+" : notif.count}</span>}
      </button>
      {notif.open && anchor && (
        <Pop anchor={anchor} width={326} height={430} onClose={close} className="notif-pop">
          <div className="notif-head">
            <span className="notif-title">Activity</span>
            <button className="notif-gear" onClick={() => { close(); notif.onOpenSettings(); }}
              title="Notification settings">
              <Icon name={notif.soundOn ? "volume-2" : "volume-x"} size={14} />
              <Icon name="settings" size={14} />
            </button>
          </div>

          <div className="notif-list">
            {notif.feed.length === 0
              ? <div className="notif-empty">Nothing new — you’re all caught up.</div>
              : notif.feed.map((f) => (
                <div key={f.key} className="notif-item">
                  <span className={`notif-dot ${f.kind}`} />
                  <span className="notif-text">{f.text}</span>
                  <span className="notif-time">{timeAgo(f.ts)}</span>
                </div>
              ))}
          </div>

          <div className="notif-foot">
            <button className="btn primary notif-resolve" onClick={notif.onResolveAll} disabled={notif.count === 0}>
              <Icon name="check-check" />Resolve all{notif.count > 0 ? ` (${notif.count})` : ""}
            </button>
          </div>
        </Pop>
      )}
    </div>
  );
}

/* ================= SETTINGS (per-screen) ================= */
export function SettingsModal({ notif, onClose }: { notif: NotifProps; onClose: () => void }) {
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="scrim-dark" onMouseDown={onClose}>
      <div className="modal settings-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{"</"} SETTINGS {">"}</div>
            <h2>This screen</h2>
          </div>
          <button className="iconbtn" onClick={onClose} style={{ width: 34, height: 34 }}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="set-row">
            <div className="set-text">
              <div className="set-label">Notification sounds on this screen</div>
              <div className="set-sub">
                Turn this on for the shop screen Keith works at — that&apos;s how the app knows which
                screen should make noise. Leave it off on the owners&apos; laptops; they&apos;ll still
                see new and moved tickets glow, just silently.
              </div>
            </div>
            <button type="button" role="switch" aria-checked={notif.soundOn}
              className={`switch ${notif.soundOn ? "on" : ""}`} onClick={notif.onToggleSound}
              title={notif.soundOn ? "Sounds on" : "Sounds off"}>
              <span className="switch-knob" />
            </button>
          </div>

          {notif.soundOn ? (
            <div className="set-sounds">
              <SoundPicker label="New ticket sound" kind="new" presets={NEW_PRESETS} value={notif.soundNew} onChange={notif.setSoundNew} />
              <SoundPicker label="Queue moved sound" kind="reorder" presets={REORDER_PRESETS} value={notif.soundReorder} onChange={notif.setSoundReorder} />
              <div className="set-hint">Tap a sound to hear it.</div>
            </div>
          ) : (
            <div className="set-off">This screen is silent. Flip the switch above to make it Keith&apos;s screen.</div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

/* ================= TOP NAV ================= */
const TABS: [View, string, string][] = [
  ["list", "list", "List"],
  ["parts", "package-search", "Waiting on Parts"],
];
export function TopNav({ view, setView, onNew, onMobileMenu, partsCount, notif }: {
  view: View; setView: (v: View) => void; onNew: () => void; onMobileMenu: () => void; partsCount: number;
  notif: NotifProps;
}) {
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
            {id === "parts" && partsCount > 0 && <span className="tab-badge">{partsCount}</span>}
          </button>
        ))}
      </nav>

      <div className="nav-spacer" />

      <NotifBell notif={notif} />
      <button className="nav-lock notif-settings-btn" onClick={notif.onOpenSettings} title="Settings" aria-label="Settings">
        <Icon name="settings" size={18} />
      </button>

      <button className={`nav-archive ${isArchive ? "on" : ""}`} onClick={() => setView("archive")}>
        <Icon name="archive" /><span>Archive</span>
      </button>
      <button className="btn primary" onClick={onNew}>
        <Icon name="plus" /><span className="nt-label">New Ticket</span>
      </button>
      <form action={logoutAction} className="nav-logout">
        <button className="nav-lock" type="submit" title="Lock workspace" aria-label="Lock workspace">
          <Icon name="log-out" size={18} />
        </button>
      </form>
      <button className="iconbtn nav-menu-btn" onClick={onMobileMenu} style={{ width: 38, height: 38 }}>
        <Icon name="menu" size={20} />
      </button>
    </header>
  );
}

/* ================= QUICK MENU ================= */
const STATUS_ICON: Record<Status, string> = { todo: "circle", prog: "loader", call: "phone", resp: "message-circle", parts: "package-search", done: "circle-check", picked: "package-check" };
/* Garrett wants "Waiting on parts" at the top of the 3-dots menu (the pill menu keeps flow order). */
const QUICK_STATUS_ORDER: Status[] = ["parts", "todo", "prog", "call", "resp", "done", "picked"];
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
  const W = 210, H = 486;
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
        {QUICK_STATUS_ORDER.map((s) => (
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
/* The small-screen menu. Holds the three views and — since they leave the top
   bar on phones/tablets — Settings and Lock workspace. */
export function MobileSheet({ view, setView, onClose, partsCount, onOpenSettings }: {
  view: View; setView: (v: View) => void; onClose: () => void; partsCount: number;
  onOpenSettings: () => void;
}) {
  const items: [View, string, string][] = [
    ["list", "list", "List"],
    ["parts", "package-search", "Waiting on Parts"],
    ["archive", "archive", "Archive"],
  ];
  return (
    <div className="msheet" onClick={onClose}>
      <div className="msheet-inner" onClick={(e) => e.stopPropagation()}>
        {items.map(([id, ic, label]) => (
          <button key={id} className={`msheet-item ${view === id ? "on" : ""}`}
            onClick={() => { setView(id); onClose(); }}>
            <Icon name={ic} />{label}
            {id === "parts" && partsCount > 0 && <span className="tab-badge">{partsCount}</span>}
          </button>
        ))}
        <div className="msheet-div" />
        <button className="msheet-item" onClick={() => { onOpenSettings(); onClose(); }}>
          <Icon name="settings" />Settings
        </button>
        <form action={logoutAction} className="msheet-logout">
          <button type="submit" className="msheet-item">
            <Icon name="log-out" />Lock workspace
          </button>
        </form>
      </div>
    </div>
  );
}

/* ================= TICKET FORM ================= */
export type FormDraft = {
  id: string | null;
  name: string;
  phone: string;
  password: string;
  desc: string;
  urgency: number;
  charger: boolean;
  status: Status;
  dropoff: string;
  dropoffAmPm: AmPm | null;
  dueAt: string | null; // ISO timestamp, built from the due date + AM/PM on submit
  assignedTo: Person[];
  deviceType: DeviceType | null;
  serviceTag: ServiceTag | null;
};

export function TicketForm({ editing, today, onSave, onClose }: {
  editing: Partial<Ticket>;
  today: string;
  onSave: (d: FormDraft, print?: boolean) => void;
  onClose: () => void;
}) {
  const isEdit = !!editing && !!editing.id;
  const [f, setF] = React.useState<FormDraft>(() => ({
    id: editing?.id || null,
    name: editing?.name || "",
    phone: editing?.phone || "",
    password: editing?.password || "",
    desc: editing?.desc || "",
    urgency: editing?.urgency || 3,
    charger: editing?.charger ?? false,
    status: editing?.status || "todo",
    dropoff: editing?.dropoff || today,
    // New tickets default to the current half of the day; old tickets may have none.
    dropoffAmPm: editing?.id ? editing?.dropoffAmPm ?? null : (new Date().getHours() < 12 ? "AM" : "PM"),
    dueAt: editing?.dueAt || null,
    assignedTo: assignees({ assignedTo: editing?.assignedTo }),
    // New tickets default to Laptop; legacy tickets show neither selected until set.
    deviceType: editing?.id ? editing?.deviceType ?? null : "laptop",
    serviceTag: editing?.serviceTag ?? null,
  }));
  // Due date is a half-day pickup window ("Thursday AM"); default PM.
  const [due, setDueState] = React.useState<{ date: string; half: AmPm }>(() =>
    editing?.dueAt ? dueParts(editing.dueAt) : { date: "", half: "PM" }
  );
  const [touched, setTouched] = React.useState(false);
  // Where the ticket returns to when "Waiting on parts" is toggled back off.
  const prevStatus = React.useRef<Status>(editing?.status && editing.status !== "parts" ? editing.status : "todo");
  const set = <K extends keyof FormDraft>(k: K, v: FormDraft[K]) => setF((p) => ({ ...p, [k]: v }));

  const errs = {
    name: f.name.trim() ? "" : "Customer name is required",
  };
  const valid = !errs.name;

  const submit = (print = false) => {
    setTouched(true);
    if (!valid) return;
    onSave({
      ...f, name: f.name.trim(), phone: f.phone.trim(), password: f.password.trim(), desc: f.desc.trim(),
      dueAt: due.date ? buildDueAt(due.date, due.half) : null,
    }, print);
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
              <label className="lbl">Customer name<span className="req">*</span></label>
              <input className={`inp ${touched && errs.name ? "bad" : ""}`} placeholder="e.g. Dana Whitlock"
                value={f.name} onChange={(e) => set("name", e.target.value)} />
              {touched && errs.name && <div className="err">{errs.name}</div>}
            </div>
            <div className="field">
              <label className="lbl">Phone</label>
              <input className="inp mono" type="tel" placeholder="253-555-0000" value={f.phone} onChange={(e) => set("phone", fmtPhone(e.target.value))} />
            </div>
          </div>

          <div className="field-grid">
            <div className="field">
              <label className="lbl">Drop-off date</label>
              <div className="dropoff-row">
                <DateField value={f.dropoff} onChange={(v) => set("dropoff", v)} />
                <AmPmToggle value={f.dropoffAmPm} onChange={(v) => set("dropoffAmPm", v)} />
              </div>
            </div>
            <div className="field">
              <label className="lbl">Pickup due <span className="opt-hint">optional</span></label>
              <div className="dropoff-row">
                <DateField value={due.date} clearable placeholder="No due date"
                  onChange={(v) => setDueState((p) => ({ ...p, date: v }))} />
                <AmPmToggle value={due.date ? due.half : null} disabled={!due.date}
                  onChange={(v) => setDueState((p) => ({ ...p, half: v }))} />
              </div>
            </div>
          </div>

          <div className="field">
            <label className="lbl">Device</label>
            <div className="toggle device">
              {DEVICE_TYPES.map((d) => (
                <button key={d.key} type="button" className={f.deviceType === d.key ? "on" : ""}
                  onClick={() => set("deviceType", d.key)}>{d.label}</button>
              ))}
            </div>
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

          <div className="field-grid trio">
            <div className="field">
              <label className="lbl">Expedite / contract <span className="opt-hint">optional</span></label>
              <div className="toggle svc">
                {SERVICE_TAGS.map((s) => (
                  <button key={s.key} type="button" className={`${s.key} ${f.serviceTag === s.key ? "on" : ""}`}
                    onClick={() => set("serviceTag", f.serviceTag === s.key ? null : s.key)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="lbl">Charger left?</label>
              <div className="toggle">
                <button className={`yes ${f.charger ? "on" : ""}`} onClick={() => set("charger", true)}>
                  <Icon name="plug-zap" />Yes
                </button>
                <button className={`no ${!f.charger ? "on" : ""}`} onClick={() => set("charger", false)}>
                  <Icon name="plug" />No
                </button>
              </div>
            </div>
            <div className="field">
              <label className="lbl">Waiting on parts?</label>
              <div className="toggle">
                <button className={`parts ${f.status === "parts" ? "on" : ""}`}
                  onClick={() => {
                    if (f.status !== "parts") { prevStatus.current = f.status; set("status", "parts"); }
                  }}>
                  <Icon name="package-search" />Yes
                </button>
                <button className={`no ${f.status !== "parts" ? "on" : ""}`}
                  onClick={() => { if (f.status === "parts") set("status", prevStatus.current); }}>
                  No
                </button>
              </div>
            </div>
          </div>

          <div className="field">
            <label className="lbl">Assigned to <span className="opt-hint">tap to add or remove people</span></label>
            <div className="toggle people">
              {PEOPLE.map((p) => {
                const on = f.assignedTo.includes(p.key);
                return (
                  <button key={p.key} type="button" className={`person ${p.key} ${on ? "on" : ""}`}
                    onClick={() => {
                      const next = PEOPLE.map((x) => x.key).filter((k) => (k === p.key ? !on : f.assignedTo.includes(k)));
                      if (next.length) set("assignedTo", next);
                    }}>
                    <span className={`avchip ${p.key}`}>{p.label[0]}</span>{p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field">
            <label className="lbl">What&apos;s wrong? <span className="opt-hint">optional</span></label>
            <textarea className="ta"
              placeholder="Device and the problem in plain words — e.g. &ldquo;MacBook Air, liquid spill, won't boot.&rdquo;"
              value={f.desc} onChange={(e) => set("desc", e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="lbl">Device password <span className="opt-hint">optional · for getting into the device</span></label>
            <input className="inp mono" placeholder="Login / PIN for the device" value={f.password} onChange={(e) => set("password", e.target.value)} />
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn ghost" onClick={() => submit(true)} title="Save and print the labels">
            <Icon name="printer" />Save &amp; print
          </button>
          <button className="btn primary" onClick={() => submit()}>
            <Icon name="check" />{isEdit ? "Save changes" : "Save ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}
