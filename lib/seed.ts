/* Sample tickets used to seed the database (and as the local no-DB fallback). */
import type { Ticket } from "./tickets";

export const SEED_TICKETS: Ticket[] = [
  // active
  { id: "MLX-4821", name: "Dana Whitlock", phone: "(253) 555-0142", desc: "MacBook Air — liquid spill, won't boot", urgency: 1, charger: true, status: "prog", dropoff: "2026-06-01", dropoffAmPm: "AM", deviceType: "laptop", dueAt: "2026-06-10T18:00:00.000Z", statusChangedAt: "2026-06-01T09:30:00" },
  { id: "MLX-4830", name: "Theo Vance", phone: "(253) 555-0119", desc: "Custom desktop — no POST after the storm, suspect PSU", urgency: 1, charger: false, status: "prog", dropoff: "2026-05-30", dropoffAmPm: "PM", deviceType: "desktop", statusChangedAt: "2026-05-30T11:00:00" },
  { id: "MLX-4844", name: "Greta Olsen", phone: "(360) 555-0188", desc: "Dell XPS 15 — battery swelling, trackpad lifting", urgency: 1, charger: true, status: "todo", dropoff: "2026-06-03", dropoffAmPm: "AM", deviceType: "laptop", dueAt: "2026-06-11T00:00:00.000Z", statusChangedAt: "2026-06-03T08:15:00" },
  { id: "MLX-4809", name: "Rosa Iqbal", phone: "(253) 555-0167", desc: "iMac 2019 — data recovery from a failing drive", urgency: 1, charger: false, status: "prog", dropoff: "2026-05-28", deviceType: "desktop", statusChangedAt: "2026-05-28T13:45:00" },

  { id: "MLX-4826", name: "Priya Nair", phone: "(253) 555-0153", desc: "iPhone 13 — cracked screen, touch dead along the bottom", urgency: 2, charger: false, status: "todo", dropoff: "2026-06-02", statusChangedAt: "2026-06-02T10:00:00" },
  { id: "MLX-4822", name: "Sam Rourke", phone: "(360) 555-0174", desc: "ThinkPad T14 — soaked on a kayak trip, corrosion cleanup", urgency: 2, charger: true, status: "prog", dropoff: "2026-06-01", statusChangedAt: "2026-06-01T15:20:00" },
  { id: "MLX-4828", name: "Bianca Cho", phone: "(253) 555-0136", desc: "MacBook Pro 16 — several keys not registering", urgency: 2, charger: true, status: "prog", dropoff: "2026-06-02", statusChangedAt: "2026-06-02T16:00:00" },
  { id: "MLX-4817", name: "Diego Salas", phone: "(253) 555-0125", desc: "Gaming PC — random shutdowns under load", urgency: 2, charger: false, status: "todo", dropoff: "2026-05-31", dropoffAmPm: "PM", deviceType: "desktop", statusChangedAt: "2026-05-31T12:30:00" },

  { id: "MLX-4831", name: "Marcus Bell", phone: "(360) 555-0102", desc: "HP Envy — loud fan and overheating", urgency: 3, charger: false, status: "todo", dropoff: "2026-06-02", statusChangedAt: "2026-06-02T09:00:00" },
  { id: "MLX-4842", name: "Owen Pratt", phone: "(253) 555-0148", desc: "Acer Aspire — sluggish, popups, likely malware", urgency: 3, charger: false, status: "todo", dropoff: "2026-06-03", statusChangedAt: "2026-06-03T11:30:00" },
  { id: "MLX-4823", name: "Lena Park", phone: "(253) 555-0191", desc: "Surface Pro — screen flicker and ghost touches", urgency: 3, charger: true, status: "prog", dropoff: "2026-06-01", statusChangedAt: "2026-06-01T14:10:00" },
  { id: "MLX-4829", name: "Will Tanaka", phone: "(360) 555-0163", desc: "Galaxy S22 — won't power on, possible battery", urgency: 3, charger: false, status: "todo", dropoff: "2026-06-02", statusChangedAt: "2026-06-02T13:00:00" },

  { id: "MLX-4810", name: "Nina Castillo", phone: "(253) 555-0110", desc: "iPad Pro — won't charge, debris packed in the port", urgency: 4, charger: true, status: "done", dropoff: "2026-05-29", statusChangedAt: "2026-06-03T09:00:00" },
  { id: "MLX-4845", name: "Cora Bishop", phone: "(253) 555-0179", desc: "Chromebook — forgotten password, locked out", urgency: 4, charger: true, status: "done", dropoff: "2026-06-03", statusChangedAt: "2026-06-03T15:00:00" },

  { id: "MLX-4805", name: "Hank Mueller", phone: "(360) 555-0157", desc: "Brother printer — won't connect to Wi-Fi", urgency: 5, charger: false, status: "todo", dropoff: "2026-05-27", statusChangedAt: "2026-05-27T10:00:00" },
  { id: "MLX-4846", name: "Felix Grant", phone: "(253) 555-0184", desc: "ASUS ROG — thermal repaste and full dust clean", urgency: 5, charger: true, status: "todo", dropoff: "2026-06-03", statusChangedAt: "2026-06-03T16:30:00" },

  // picked up recently — still on the boards, auto-archive after 3 days
  { id: "MLX-4807", name: "Aaron Webb", phone: "(253) 555-0131", desc: "Mac mini — RAM upgrade to 32 GB", urgency: 4, charger: false, status: "picked", dropoff: "2026-05-28", pickedAt: "2026-06-03", statusChangedAt: "2026-06-03T12:00:00" },
  { id: "MLX-4804", name: "Mia Donovan", phone: "(360) 555-0146", desc: "HP Pavilion — screen panel replacement", urgency: 3, charger: true, status: "picked", dropoff: "2026-05-27", pickedAt: "2026-06-02", statusChangedAt: "2026-06-02T11:00:00" },
];

/* archived (picked up more than 3 days ago) */
export const SEED_ARCHIVE: Ticket[] = [
  { id: "MLX-4796", name: "Jordan Lee", phone: "(253) 555-0108", desc: "iPhone 12 — battery replacement", urgency: 2, charger: false, status: "picked", dropoff: "2026-05-24", pickedAt: "2026-05-30", statusChangedAt: "2026-05-30T10:00:00", archivedAt: "2026-06-02" },
  { id: "MLX-4791", name: "Tess Romano", phone: "(360) 555-0192", desc: "Dell Inspiron — SSD upgrade and clone", urgency: 3, charger: true, status: "picked", dropoff: "2026-05-22", pickedAt: "2026-05-28", statusChangedAt: "2026-05-28T10:00:00", archivedAt: "2026-05-31" },
  { id: "MLX-4787", name: "Victor Alarcón", phone: "(253) 555-0118", desc: "Netgear router — setup and mesh coverage", urgency: 5, charger: false, status: "picked", dropoff: "2026-05-20", pickedAt: "2026-05-26", statusChangedAt: "2026-05-26T10:00:00", archivedAt: "2026-05-29" },
  { id: "MLX-4783", name: "Paula Esposito", phone: "(253) 555-0127", desc: "MacBook Air — keyboard replacement", urgency: 2, charger: true, status: "picked", dropoff: "2026-05-19", pickedAt: "2026-05-25", statusChangedAt: "2026-05-25T10:00:00", archivedAt: "2026-05-28" },
  { id: "MLX-4778", name: "Grant Foley", phone: "(360) 555-0139", desc: "Lenovo Yoga — hinge repair", urgency: 4, charger: true, status: "picked", dropoff: "2026-05-16", pickedAt: "2026-05-22", statusChangedAt: "2026-05-22T10:00:00", archivedAt: "2026-05-25" },
  { id: "MLX-4770", name: "Soo-jin Han", phone: "(253) 555-0151", desc: "Canon printer — driver fix and ink system flush", urgency: 5, charger: false, status: "picked", dropoff: "2026-05-14", pickedAt: "2026-05-20", statusChangedAt: "2026-05-20T10:00:00", archivedAt: "2026-05-23" },
];

export const SEED_NEXT_ID = 5210; // new tickets start here: MLX-5210, MLX-5211, ...
