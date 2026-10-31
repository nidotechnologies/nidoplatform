import { useState, useMemo, Fragment, useEffect } from "react";
import { usePageMeta } from "@/contexts/PageMetaContext";
import ReportShell from "@/components/reports/ReportShell";
import { useReportShellContext } from "@/contexts/ReportShellContext";
import FilterBar from "@/components/reports/FilterBar";
import ExportBar from "@/components/reports/ExportBar";
import { useReportFilters, useSetReportExportData } from "@/contexts/ReportControlsContext";
import { applyReportFilters } from "@/lib/reportData";
import { downloadReportExport } from "@/lib/reportExport";
import {
  Search, Filter, Download, RefreshCw, ChevronDown,
  User, Shield, AlertTriangle, Info, XCircle, CheckCircle2,
  LogIn, LogOut, Edit3, Trash2, Plus, Eye, Settings,
  FileText, Database, Activity, Clock, Monitor, Globe,
  Lock, Unlock, UserCheck, AlertCircle, BarChart2,
  ChevronLeft, ChevronRight, Package, ShoppingCart,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ── Store imports ──────────────────────────────────────────────────────────────
import { getUsers, type NidoUser } from "@/lib/nidoUsersStore";
import { getOrders } from "@/lib/salesOrderStore";
import { getQuotes } from "@/lib/quoteStore";
import { getInvoices } from "@/lib/invoiceStore";
import { getVendors } from "@/lib/vendorDataStore";
import { getClients } from "@/lib/clientStore";
import { getSupportTickets } from "@/lib/supportTicketStore";
import { getServiceRequests } from "@/lib/serviceRequestsStore";
import { getStockHistory } from "@/lib/stockHistoryStore";
import { getAllPOs } from "@/lib/purchaseOrderStore";
import { getImpersonationAudit } from "@/lib/impersonationStore";
import { getTaxAuditLog } from "@/lib/taxEngine";

// ── Types ──────────────────────────────────────────────────────────────────────

type ActivityAction =
  | "Login" | "Logout" | "Failed Login"
  | "Create" | "Edit" | "Delete" | "View" | "Export" | "Download"
  | "Approve" | "Reject" | "Invite" | "Password Reset" | "Settings";

type LogSeverity = "Info" | "Warning" | "Error" | "Critical";
type LogCategory = "Authentication" | "Data" | "System" | "Security" | "Configuration";

interface UserActivity {
  id: string;
  user: string;
  avatar: string;
  role: string;
  action: ActivityAction;
  resource: string;
  module: string;
  ip: string;
  device: string;
  location: string;
  timestamp: string;
  tsMs: number;
  status: "Success" | "Failed" | "Warning";
  details: string;
}

interface SystemLog {
  id: string;
  severity: LogSeverity;
  category: LogCategory;
  event: string;
  service: string;
  message: string;
  timestamp: string;
  tsMs: number;
  user: string;
  ip: string;
  duration?: string;
  statusCode?: number;
}

// ── Deterministic helpers ──────────────────────────────────────────────────────

const DEVICE_LIST = [
  "Chrome / Windows", "Safari / macOS", "Firefox / Ubuntu",
  "Edge / Windows",   "Chrome / macOS",  "Chrome / Android",
  "Safari / iOS",     "Firefox / Windows",
];
const LOCATION_LIST = [
  "Mumbai, IN", "Delhi, IN",   "Bangalore, IN", "Pune, IN",
  "Chennai, IN","Hyderabad, IN","Kolkata, IN",   "Ahmedabad, IN",
];
const IP_POOL = [
  "192.168.1.101","192.168.1.45","10.0.0.22","192.168.2.78",
  "192.168.3.15", "192.168.4.55","172.16.0.10","10.0.1.50",
  "192.168.5.20", "10.0.2.31",
];

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}
function pickFrom<T>(arr: T[], key: string): T { return arr[djb2(key) % arr.length]; }
function pickIP(key: string)       { return pickFrom(IP_POOL,      key + "ip"); }
function pickDevice(key: string)   { return pickFrom(DEVICE_LIST,  key + "dv"); }
function pickLocation(key: string) { return pickFrom(LOCATION_LIST,key + "lc"); }

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "??";
}

function pickActiveUser(users: NidoUser[], key: string): NidoUser {
  const active = users.filter(u => u.status === "Active");
  const pool = active.length ? active : users;
  return pool[djb2(key) % pool.length] ?? ({ name: "System", role: "System", email: "system@nido", id: "sys" } as NidoUser);
}

// Parse any timestamp string/number to milliseconds
function toMs(ts: string | number | undefined): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

// Format ms → "Month DD, YYYY HH:MM:SS"
function fmtTs(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  const ss = String(d.getSeconds()).padStart(2,"0");
  return `${M} ${String(d.getDate()).padStart(2,"0")}, ${d.getFullYear()} ${hh}:${mm}:${ss}`;
}

function formatCoordinates(latitude?: number, longitude?: number, accuracy?: number): string {
  if (typeof latitude !== "number" || typeof longitude !== "number") return "Not recorded";
  const accuracyText = typeof accuracy === "number" ? ` · ±${Math.round(accuracy)}m` : "";
  return `Lat ${latitude.toFixed(6)}, Lng ${longitude.toFixed(6)}${accuracyText}`;
}

function formatDevice(userAgent?: string): string {
  if (!userAgent) return "Not recorded";
  const browser = userAgent.match(/Edg\/[\d.]+|Chrome\/[\d.]+|Firefox\/[\d.]+|Version\/[\d.]+.*Safari/)?.[0]
    ?.replace(/^Version\//, "Safari ")
    .replace(/\/[\d.]+/, "") ?? "Browser";
  const os = userAgent.match(/Windows NT [\d.]+|Mac OS X [\d_]+|Android [\d.]+|iPhone OS [\d_]+|Linux/)
    ?. [0]
    ?.replace("Windows NT", "Windows")
    .replace("Mac OS X", "macOS")
    .replace("iPhone OS", "iOS")
    .replace(/_/g, ".") ?? "Unknown OS";
  return `${browser} / ${os}`;
}

function fmtINR(n: number): string {
  return "₹" + (n ?? 0).toLocaleString("en-IN");
}

// ── Live data derivation ───────────────────────────────────────────────────────

function deriveActivity(): UserActivity[] {
  const users  = getUsers();
  const events: UserActivity[] = [];

  // ── 1. Login / Logout / Failed Login from loginHistory ────────────────────
  users.forEach(u => {
    (u.loginHistory ?? []).forEach((entry, i) => {
      const ms = toMs(entry.timestamp);
      if (!ms) return;
      const isSuccess = entry.result === "success";
      const action: ActivityAction = isSuccess ? "Login" : "Failed Login";
      events.push({
        id:        `login-${u.id}-${i}`,
        user:      u.name,
        avatar:    initials(u.name),
        role:      u.role,
        action,
        resource:  "Platform",
        module:    "Auth",
        ip:        pickIP(u.email + i),
        device:    pickDevice(u.email),
        location:  pickLocation(u.email),
        timestamp: fmtTs(ms),
        tsMs:      ms,
        status:    isSuccess ? "Success" : "Failed",
        details:   isSuccess
          ? `Successful login via email/password`
          : `Failed login attempt — ${entry.result.replace(/_/g, " ")}`,
      });
    });

    // Locked accounts: show a special event at updatedAt
    if (u.locked) {
      const ms = toMs(u.updatedAt) || Date.now();
      events.push({
        id:        `lock-${u.id}`,
        user:      u.name,
        avatar:    initials(u.name),
        role:      u.role,
        action:    "Failed Login",
        resource:  "Platform — Account Locked",
        module:    "Auth",
        ip:        pickIP(u.email + "lock"),
        device:    pickDevice(u.email),
        location:  pickLocation(u.email),
        timestamp: fmtTs(ms),
        tsMs:      ms,
        status:    "Failed",
        details:   `Account locked after ${u.failedLoginAttempts ?? MAX_FAILED} consecutive failed attempts`,
      });
    }

    // User creation event
    const createdMs = toMs(u.createdAt);
    if (createdMs) {
      const admin = pickActiveUser(users.filter(x => x.role === "System Admin" || x.role === "System Owner"), u.id);
      events.push({
        id:        `user-create-${u.id}`,
        user:      admin.name,
        avatar:    initials(admin.name),
        role:      admin.role,
        action:    "Create",
        resource:  `User: ${u.name}`,
        module:    "Users",
        ip:        pickIP(admin.email + u.id),
        device:    pickDevice(admin.email),
        location:  pickLocation(admin.email),
        timestamp: fmtTs(createdMs),
        tsMs:      createdMs,
        status:    "Success",
        details:   `New user created — ${u.email} (${u.role})`,
      });
    }
  });

  // ── 2. Stock history (has real user attribution) ───────────────────────────
  getStockHistory().forEach(sh => {
    const ms = toMs(sh.timestamp);
    if (!ms) return;
    const action: ActivityAction =
      sh.action === "Stock In"             ? "Create"  :
      sh.action === "Stock Out"            ? "Delete"  :
      sh.action === "PO Raised"            ? "Create"  :
      sh.action === "PO Cancelled"         ? "Reject"  :
      sh.action === "Order Reserved"       ? "Approve" :
      sh.action === "Reservation Released" ? "Reject"  :
      "Edit";
    const status: "Success"|"Warning" =
      sh.action === "Stock Correction" && Math.abs(sh.qtyChanged) > 50 ? "Warning" : "Success";
    const user = users.find(u => u.name === sh.user || u.email === sh.user)
               ?? pickActiveUser(users, sh.user);
    events.push({
      id:        `stock-${sh.id}`,
      user:      sh.user,
      avatar:    initials(sh.user),
      role:      user.role,
      action,
      resource:  `${sh.productName} (${sh.masterProductCode})`,
      module:    "Inventory",
      ip:        pickIP(sh.user),
      device:    pickDevice(sh.user),
      location:  pickLocation(sh.user),
      timestamp: fmtTs(ms),
      tsMs:      ms,
      status,
      details:   `${sh.action}: ${sh.qtyChanged > 0 ? "+" : ""}${sh.qtyChanged} units → ${sh.qtyAfter} in stock | Vendor: ${sh.vendorName} | Ref: ${sh.reference}`,
    });
  });

  // ── 3. Sales Orders ────────────────────────────────────────────────────────
  getOrders().forEach(order => {
    const u = pickActiveUser(users, order.id);
    const createdMs = toMs(order.createdAt);
    if (createdMs) {
      events.push({
        id:        `so-create-${order.id}`,
        user:      u.name, avatar: initials(u.name), role: u.role,
        action:    "Create", resource: order.orderNumber, module: "Sales",
        ip: pickIP(u.email + order.id), device: pickDevice(u.email + "s"),
        location: pickLocation(u.email), timestamp: fmtTs(createdMs), tsMs: createdMs,
        status: "Success",
        details: `Sales order created for ${order.clientName} — ${fmtINR(order.grandTotal)}`,
      });
    }
    const updatedMs = toMs(order.updatedAt);
    if (updatedMs && updatedMs !== createdMs) {
      events.push({
        id:        `so-edit-${order.id}`,
        user:      u.name, avatar: initials(u.name), role: u.role,
        action:    order.status === "Cancelled" ? "Delete" : "Edit",
        resource:  order.orderNumber, module: "Sales",
        ip: pickIP(u.email + order.id + "u"), device: pickDevice(u.email + "u"),
        location: pickLocation(u.email), timestamp: fmtTs(updatedMs), tsMs: updatedMs,
        status:    order.status === "Cancelled" ? "Warning" : "Success",
        details:   `Order status updated to ${order.status} — ${fmtINR(order.grandTotal)}`,
      });
    }
  });

  // ── 4. Quotes ──────────────────────────────────────────────────────────────
  getQuotes().forEach(q => {
    const u = pickActiveUser(users, q.id);
    const createdMs = toMs(q.createdAt);
    if (createdMs) {
      events.push({
        id:        `qt-create-${q.id}`,
        user:      u.name, avatar: initials(u.name), role: u.role,
        action:    "Create", resource: q.quoteNumber, module: "Sales",
        ip: pickIP(u.email + q.id), device: pickDevice(u.email + "q"),
        location: pickLocation(u.email), timestamp: fmtTs(createdMs), tsMs: createdMs,
        status: "Success",
        details: `Quote created for ${q.clientName} — ${fmtINR(q.grandTotal)}`,
      });
    }
    const updatedMs = toMs(q.updatedAt);
    if (updatedMs && updatedMs !== createdMs) {
      const action: ActivityAction =
        q.status === "Accepted" ? "Approve" :
        q.status === "Rejected" ? "Reject"  : "Edit";
      events.push({
        id:        `qt-upd-${q.id}`,
        user:      u.name, avatar: initials(u.name), role: u.role,
        action,   resource: q.quoteNumber, module: "Sales",
        ip: pickIP(u.email + q.id + "u"), device: pickDevice(u.email + "qu"),
        location: pickLocation(u.email), timestamp: fmtTs(updatedMs), tsMs: updatedMs,
        status:   q.status === "Rejected" ? "Warning" : "Success",
        details:  `Quote ${q.status.toLowerCase()} — ${q.clientName} — ${fmtINR(q.grandTotal)}`,
      });
    }
  });

  // ── 5. Invoices ────────────────────────────────────────────────────────────
  getInvoices().forEach(inv => {
    const u = pickActiveUser(users, inv.id);
    const createdMs = toMs(inv.createdAt);
    if (createdMs) {
      events.push({
        id:        `inv-create-${inv.id}`,
        user:      u.name, avatar: initials(u.name), role: u.role,
        action:    "Create", resource: inv.invoiceNumber, module: "Sales",
        ip: pickIP(u.email + inv.id), device: pickDevice(u.email + "i"),
        location: pickLocation(u.email), timestamp: fmtTs(createdMs), tsMs: createdMs,
        status: "Success",
        details: `Invoice created for ${inv.clientName} — ${fmtINR(inv.grandTotal)}`,
      });
    }
    const updatedMs = toMs(inv.updatedAt);
    if (updatedMs && updatedMs !== createdMs) {
      const action: ActivityAction = inv.status === "Paid" ? "Approve" :
                                     inv.status === "Cancelled" ? "Delete" : "Edit";
      events.push({
        id:        `inv-upd-${inv.id}`,
        user:      u.name, avatar: initials(u.name), role: u.role,
        action,   resource: inv.invoiceNumber, module: "Sales",
        ip: pickIP(u.email + inv.id + "u"), device: pickDevice(u.email + "iu"),
        location: pickLocation(u.email), timestamp: fmtTs(updatedMs), tsMs: updatedMs,
        status:   inv.status === "Overdue" ? "Warning" : inv.status === "Cancelled" ? "Warning" : "Success",
        details:  `Invoice status: ${inv.status} — ${inv.clientName} — ${fmtINR(inv.grandTotal)}`,
      });
    }
  });

  // ── 6. Purchase Orders ─────────────────────────────────────────────────────
  getAllPOs().forEach(po => {
    const u = pickActiveUser(users, po.poNumber);
    const ms = toMs(po.createdOn);
    if (ms) {
      events.push({
        id:        `po-create-${po.poNumber}`,
        user:      u.name, avatar: initials(u.name), role: u.role,
        action:    "Create", resource: po.poNumber, module: "Purchase",
        ip: pickIP(u.email + po.poNumber), device: pickDevice(u.email + "po"),
        location: pickLocation(u.email), timestamp: fmtTs(ms), tsMs: ms,
        status: "Success",
        details: `Purchase order raised for ${po.vendorName} — ${fmtINR(po.grandTotal)}`,
      });
    }
    if (po.status === "Cancelled") {
      events.push({
        id:        `po-cancel-${po.poNumber}`,
        user:      u.name, avatar: initials(u.name), role: u.role,
        action:    "Reject", resource: po.poNumber, module: "Purchase",
        ip: pickIP(u.email + po.poNumber + "c"), device: pickDevice(u.email + "poc"),
        location: pickLocation(u.email), timestamp: fmtTs((ms || Date.now()) + 3600_000), tsMs: (ms || 0) + 3600_000,
        status: "Warning",
        details: `Purchase order cancelled — ${po.vendorName} — ${fmtINR(po.grandTotal)}`,
      });
    }
  });

  // ── 7. Vendors ─────────────────────────────────────────────────────────────
  getVendors().forEach(v => {
    const ms = toMs(v.onboardedDate);
    if (!ms) return;
    const u = pickActiveUser(users, v.id);
    events.push({
      id:        `vendor-create-${v.id}`,
      user:      u.name, avatar: initials(u.name), role: u.role,
      action:    "Create", resource: `Vendor: ${v.name}`, module: "Vendors",
      ip: pickIP(u.email + v.id), device: pickDevice(u.email + "v"),
      location: pickLocation(u.email), timestamp: fmtTs(ms), tsMs: ms,
      status: v.status === "Pending" ? "Warning" : "Success",
      details: `Vendor onboarded — ${v.category} | Status: ${v.status} | Rating: ${v.rating}/5`,
    });
  });

  // ── 8. Clients ─────────────────────────────────────────────────────────────
  getClients().forEach(c => {
    const ms = toMs(c.contractStartDate);
    if (!ms) return;
    const u = pickActiveUser(users, c.id);
    events.push({
      id:        `client-create-${c.id}`,
      user:      u.name, avatar: initials(u.name), role: u.role,
      action:    "Create", resource: `Client: ${c.name}`, module: "Clients",
      ip: pickIP(u.email + c.id), device: pickDevice(u.email + "c"),
      location: pickLocation(u.email), timestamp: fmtTs(ms), tsMs: ms,
      status: c.status === "pending" ? "Warning" : "Success",
      details: `Client registered — ${c.category ?? "General"} | Tier: ${c.tier ?? "Standard"} | Rep: ${c.rep ?? "—"}`,
    });
  });

  // ── 9. Support Tickets ─────────────────────────────────────────────────────
  getSupportTickets().forEach(t => {
    const ms = toMs(t.created);
    if (!ms) return;
    const u = pickActiveUser(users, t.id);
    events.push({
      id:        `ticket-${t.id}`,
      user:      u.name, avatar: initials(u.name), role: u.role,
      action:    "Create", resource: `Ticket ${t.number}`, module: "Support",
      ip: pickIP(u.email + t.id), device: pickDevice(u.email + "t"),
      location: pickLocation(u.email), timestamp: fmtTs(ms), tsMs: ms,
      status: t.priority === "high" ? "Warning" : "Success",
      details: `${t.subject} | Priority: ${t.priority} | Status: ${t.status}`,
    });
  });

  // ── 10. Service Requests ───────────────────────────────────────────────────
  getServiceRequests().forEach(sr => {
    const ms = sr.requestDateTs || toMs(sr.requestDate);
    if (!ms) return;
    const u = users.find(x => x.name === sr.requestedBy) ?? pickActiveUser(users, sr.id);
    events.push({
      id:        `sr-${sr.id}`,
      user:      sr.requestedBy || u.name, avatar: initials(sr.requestedBy || u.name),
      role:      u.role, action: "Create",
      resource:  `${sr.requestType}: ${sr.itemAsset}`, module: "Services",
      ip: pickIP(u.email + sr.id), device: pickDevice(u.email + "sr"),
      location: sr.location || pickLocation(u.email),
      timestamp: fmtTs(ms), tsMs: ms,
      status: sr.priority === "high" ? "Warning" : "Success",
      details: `Service request — ${sr.requestType} | Asset: ${sr.itemAsset} | Status: ${sr.status}`,
    });
  });

  // Sort newest first, cap at 200
  return events.sort((a, b) => b.tsMs - a.tsMs).slice(0, 200);
}

const MAX_FAILED = 5;

function deriveSystemLogs(activity: UserActivity[]): SystemLog[] {
  const logs: SystemLog[] = [];

  // ── Auth events from user loginHistory ────────────────────────────────────
  getUsers().forEach(u => {
    (u.loginHistory ?? []).forEach((entry, i) => {
      const ms = toMs(entry.timestamp);
      if (!ms) return;
      const isSuccess = entry.result === "success";
      logs.push({
        id:         `slog-auth-${u.id}-${i}`,
        severity:   isSuccess ? "Info" : (entry.result === "locked" ? "Critical" : "Warning"),
        category:   entry.result === "locked" || !isSuccess ? "Security" : "Authentication",
        event:      isSuccess ? "User Session Created" : "Authentication Failure",
        service:    "auth-service",
        message:    isSuccess
          ? `Session token issued for ${u.email} (${u.role})`
          : `Auth failed for ${u.email} — reason: ${entry.result.replace(/_/g," ")}`,
        timestamp:  fmtTs(ms), tsMs: ms,
        user:       u.email.split("@")[0],
        ip:         pickIP(u.email + i),
        duration:   isSuccess ? `${3 + (djb2(u.email + i) % 40)}ms` : undefined,
        statusCode: isSuccess ? 200 : 401,
      });
    });

    // Locked account → Critical
    if (u.locked) {
      const ms = toMs(u.updatedAt) || Date.now();
      logs.push({
        id: `slog-lock-${u.id}`, severity: "Critical", category: "Security",
        event: "Account Locked",
        service: "auth-service",
        message: `Account locked for ${u.email} after ${u.failedLoginAttempts ?? MAX_FAILED} failed attempts`,
        timestamp: fmtTs(ms), tsMs: ms,
        user: u.email.split("@")[0],
        ip: pickIP(u.email + "lock"),
        statusCode: 423,
      });
    }
  });

  // ── Stock corrections → Data logs ─────────────────────────────────────────
  getStockHistory().forEach(sh => {
    const ms = toMs(sh.timestamp);
    if (!ms) return;
    const isLarge = Math.abs(sh.qtyChanged) > 100;
    const isCorrection = sh.action === "Stock Correction";
    logs.push({
      id:         `slog-stock-${sh.id}`,
      severity:   isCorrection && isLarge ? "Warning" : "Info",
      category:   "Data",
      event:      `Stock ${sh.action}`,
      service:    "inventory-service",
      message:    `${sh.action} on ${sh.productName} (${sh.masterProductCode}): qty ${sh.qtyChanged > 0 ? "+" : ""}${sh.qtyChanged} → ${sh.qtyAfter} | Vendor: ${sh.vendorName} | By: ${sh.user} | Ref: ${sh.reference}`,
      timestamp:  fmtTs(ms), tsMs: ms,
      user:       sh.user,
      ip:         pickIP(sh.user),
      duration:   `${5 + (djb2(sh.id) % 20)}ms`,
      statusCode: 200,
    });
  });

  // ── Cancelled orders → Data warning ───────────────────────────────────────
  getOrders().filter(o => o.status === "Cancelled").forEach(o => {
    const ms = toMs(o.updatedAt) || toMs(o.createdAt);
    if (!ms) return;
    logs.push({
      id:         `slog-order-cancel-${o.id}`,
      severity:   "Warning",
      category:   "Data",
      event:      "Sales Order Cancelled",
      service:    "order-service",
      message:    `Order ${o.orderNumber} cancelled — client: ${o.clientName} — value: ${fmtINR(o.grandTotal)}`,
      timestamp:  fmtTs(ms), tsMs: ms,
      user:       pickActiveUser(getUsers(), o.id).email.split("@")[0],
      ip:         pickIP(o.id),
      statusCode: 200,
    });
  });

  // ── Overdue invoices → Warning ─────────────────────────────────────────────
  getInvoices().filter(i => i.status === "Overdue").forEach(inv => {
    const ms = toMs(inv.dueDate) || toMs(inv.updatedAt);
    if (!ms) return;
    logs.push({
      id:         `slog-inv-overdue-${inv.id}`,
      severity:   "Warning",
      category:   "Data",
      event:      "Invoice Overdue",
      service:    "billing-service",
      message:    `Invoice ${inv.invoiceNumber} overdue — ${inv.clientName} — ${fmtINR(inv.grandTotal)} — due ${inv.dueDate}`,
      timestamp:  fmtTs(ms), tsMs: ms,
      user:       pickActiveUser(getUsers(), inv.id).email.split("@")[0],
      ip:         pickIP(inv.id),
      statusCode: 200,
    });
  });

  // ── Rejected quotes → Warning ─────────────────────────────────────────────
  getQuotes().filter(q => q.status === "Rejected").forEach(q => {
    const ms = toMs(q.updatedAt) || toMs(q.createdAt);
    if (!ms) return;
    logs.push({
      id:         `slog-qt-reject-${q.id}`,
      severity:   "Warning",
      category:   "Data",
      event:      "Quote Rejected",
      service:    "sales-service",
      message:    `Quote ${q.quoteNumber} rejected by ${q.clientName} — ${fmtINR(q.grandTotal)}`,
      timestamp:  fmtTs(ms), tsMs: ms,
      user:       pickActiveUser(getUsers(), q.id).email.split("@")[0],
      ip:         pickIP(q.id),
      statusCode: 200,
    });
  });

  // ── Cancelled POs → Warning ────────────────────────────────────────────────
  getAllPOs().filter(p => p.status === "Cancelled").forEach(po => {
    const ms = toMs(po.createdOn);
    if (!ms) return;
    logs.push({
      id:         `slog-po-cancel-${po.poNumber}`,
      severity:   "Warning",
      category:   "Data",
      event:      "Purchase Order Cancelled",
      service:    "procurement-service",
      message:    `PO ${po.poNumber} cancelled — vendor: ${po.vendorName} — ${fmtINR(po.grandTotal)}`,
      timestamp:  fmtTs(ms + 3600_000), tsMs: ms + 3600_000,
      user:       pickActiveUser(getUsers(), po.poNumber).email.split("@")[0],
      ip:         pickIP(po.poNumber),
      statusCode: 200,
    });
  });

  // ── High-priority support tickets → Warning ───────────────────────────────
  getSupportTickets().filter(t => t.priority === "high").forEach(t => {
    const ms = toMs(t.created);
    if (!ms) return;
    logs.push({
      id:         `slog-ticket-${t.id}`,
      severity:   "Warning",
      category:   "System",
      event:      "High Priority Ticket Opened",
      service:    "support-service",
      message:    `Ticket ${t.number} opened with HIGH priority — ${t.subject} — Status: ${t.status}`,
      timestamp:  fmtTs(ms), tsMs: ms,
      user:       "system",
      ip:         pickIP(t.id),
      statusCode: 201,
    });
  });

  // ── New user created → Config log ─────────────────────────────────────────
  getUsers().forEach(u => {
    const ms = toMs(u.createdAt);
    if (!ms) return;
    logs.push({
      id:         `slog-user-new-${u.id}`,
      severity:   "Info",
      category:   "Configuration",
      event:      "User Account Created",
      service:    "user-service",
      message:    `New user ${u.email} created with role "${u.role}" | Dept: ${u.department}`,
      timestamp:  fmtTs(ms), tsMs: ms,
      user:       "system-admin",
      ip:         pickIP(u.id + "admin"),
      duration:   `${20 + (djb2(u.id) % 80)}ms`,
      statusCode: 201,
    });
  });

  // ── Vendor onboarding → Data log ──────────────────────────────────────────
  getVendors().forEach(v => {
    const ms = toMs(v.onboardedDate);
    if (!ms) return;
    logs.push({
      id:         `slog-vendor-${v.id}`,
      severity:   v.status === "Pending" ? "Warning" : "Info",
      category:   "Data",
      event:      "Vendor Onboarded",
      service:    "vendor-service",
      message:    `Vendor "${v.name}" registered — category: ${v.category} | status: ${v.status} | region: ${v.region}`,
      timestamp:  fmtTs(ms), tsMs: ms,
      user:       "vendor-admin",
      ip:         pickIP(v.id),
      duration:   `${10 + (djb2(v.id) % 50)}ms`,
      statusCode: v.status === "Pending" ? 202 : 201,
    });
  });

  // Sort newest first, cap at 200
  return logs.sort((a, b) => b.tsMs - a.tsMs).slice(0, 200);
}

// Only read audit records that are explicitly written by live application
// actions. This intentionally excludes seeded business records and generated
// IP/device/location values from the report.
function deriveRecordedActivity(): UserActivity[] {
  const users = getUsers();
  const events: UserActivity[] = [];

  users.forEach(user => {
    (user.loginHistory ?? []).forEach((entry, index) => {
      const ms = toMs(entry.timestamp);
      if (!ms) return;
      const success = entry.result === "success";
      events.push({
        id: `live-login-${user.id}-${index}`,
        user: user.name,
        avatar: initials(user.name),
        role: user.role,
        action: success ? "Login" : "Failed Login",
        resource: "Platform",
        module: "Authentication",
        ip: entry.ip ?? "Not recorded",
        device: formatDevice(entry.device),
        location: formatCoordinates(entry.latitude, entry.longitude, entry.locationAccuracy),
        timestamp: fmtTs(ms),
        tsMs: ms,
        status: success ? "Success" : "Failed",
        details: success
          ? "Successful login recorded by the authentication service"
          : `Failed login recorded — ${entry.result.replace(/_/g, " ")}`,
      });
    });
  });

  getStockHistory().forEach(entry => {
    const ms = toMs(entry.timestamp);
    if (!ms) return;
    const user = users.find(candidate => candidate.name === entry.user || candidate.email === entry.user);
    const action: ActivityAction =
      entry.action === "Stock In" ? "Create" :
      entry.action === "Stock Out" ? "Delete" :
      entry.action === "PO Cancelled" ? "Reject" :
      entry.action === "Order Reserved" ? "Approve" :
      entry.action === "Reservation Released" ? "Reject" : "Edit";
    events.push({
      id: `live-stock-${entry.id}`,
      user: entry.user,
      avatar: initials(entry.user),
      role: user?.role ?? "Recorded event",
      action,
      resource: `${entry.productName} (${entry.masterProductCode})`,
      module: "Inventory",
      ip: "Not recorded",
      device: "Not recorded",
      location: "Not recorded",
      timestamp: fmtTs(ms),
      tsMs: ms,
      status: entry.action === "Stock Correction" && Math.abs(entry.qtyChanged) > 50 ? "Warning" : "Success",
      details: `${entry.action}: ${entry.qtyChanged > 0 ? "+" : ""}${entry.qtyChanged} units → ${entry.qtyAfter} in stock | Ref: ${entry.reference}`,
    });
  });

  getImpersonationAudit().forEach((entry, index) => {
    const ms = toMs(entry.timestamp);
    if (!ms) return;
    const user = users.find(candidate => candidate.id === entry.originalUserId);
    const started = entry.eventType === "IMPERSONATION_STARTED";
    events.push({
      id: `live-impersonation-${entry.impersonationSessionId}-${index}`,
      user: user?.name ?? entry.originalUserId,
      avatar: initials(user?.name ?? entry.originalUserId),
      role: user?.role ?? "Recorded event",
      action: "View",
      resource: `Client Portal: ${entry.clientId}`,
      module: "Security",
      ip: "Not recorded",
      device: "Not recorded",
      location: "Not recorded",
      timestamp: fmtTs(ms),
      tsMs: ms,
      status: "Success",
      details: started ? "Client portal impersonation started" : "Client portal impersonation ended",
    });
  });

  getTaxAuditLog().forEach(entry => {
    const ms = toMs(entry.timestamp);
    if (!ms) return;
    events.push({
      id: `live-tax-${entry.id}`,
      user: entry.user,
      avatar: initials(entry.user),
      role: "Recorded event",
      action: "Settings",
      resource: entry.module,
      module: "Tax Configuration",
      ip: entry.clientIp ?? "Not recorded",
      device: "Not recorded",
      location: "Not recorded",
      timestamp: fmtTs(ms),
      tsMs: ms,
      status: "Success",
      details: `Tax configuration changed${entry.reason ? ` — ${entry.reason}` : ""}`,
    });
  });

  return events.sort((a, b) => b.tsMs - a.tsMs).slice(0, 200);
}

function deriveRecordedSystemLogs(): SystemLog[] {
  const users = getUsers();
  const logs: SystemLog[] = [];

  users.forEach(user => {
    (user.loginHistory ?? []).forEach((entry, index) => {
      const ms = toMs(entry.timestamp);
      if (!ms) return;
      const success = entry.result === "success";
      logs.push({
        id: `live-slog-login-${user.id}-${index}`,
        severity: success ? "Info" : entry.result === "locked" ? "Critical" : "Warning",
        category: success ? "Authentication" : "Security",
        event: success ? "User Session Created" : "Authentication Failure",
        service: "auth-service",
        message: success
          ? `Successful login recorded for ${user.email}`
          : `Authentication failed for ${user.email} — ${entry.result.replace(/_/g, " ")}`,
        timestamp: fmtTs(ms),
        tsMs: ms,
        user: user.email,
        ip: entry.ip ?? "Not recorded",
        statusCode: success ? 200 : 401,
      });
    });
  });

  getStockHistory().forEach(entry => {
    const ms = toMs(entry.timestamp);
    if (!ms) return;
    const correction = entry.action === "Stock Correction";
    logs.push({
      id: `live-slog-stock-${entry.id}`,
      severity: correction && Math.abs(entry.qtyChanged) > 100 ? "Warning" : "Info",
      category: "Data",
      event: `Stock ${entry.action}`,
      service: "inventory-service",
      message: `${entry.action} on ${entry.productName}: ${entry.qtyChanged > 0 ? "+" : ""}${entry.qtyChanged} units | Ref: ${entry.reference}`,
      timestamp: fmtTs(ms),
      tsMs: ms,
      user: entry.user,
      ip: "Not recorded",
      statusCode: 200,
    });
  });

  getImpersonationAudit().forEach((entry, index) => {
    const ms = toMs(entry.timestamp);
    if (!ms) return;
    const started = entry.eventType === "IMPERSONATION_STARTED";
    logs.push({
      id: `live-slog-impersonation-${entry.impersonationSessionId}-${index}`,
      severity: "Info",
      category: "Security",
      event: started ? "Client Impersonation Started" : "Client Impersonation Ended",
      service: "impersonation-service",
      message: `${started ? "Started" : "Ended"} view-only impersonation for client ${entry.clientId}`,
      timestamp: fmtTs(ms),
      tsMs: ms,
      user: entry.originalUserId,
      ip: "Not recorded",
      statusCode: 200,
    });
  });

  getTaxAuditLog().forEach(entry => {
    const ms = toMs(entry.timestamp);
    if (!ms) return;
    logs.push({
      id: `live-slog-tax-${entry.id}`,
      severity: "Info",
      category: "Configuration",
      event: "Tax Configuration Updated",
      service: "tax-service",
      message: `${entry.module} configuration changed${entry.reason ? ` — ${entry.reason}` : ""}`,
      timestamp: fmtTs(ms),
      tsMs: ms,
      user: entry.user,
      ip: entry.clientIp ?? "Not recorded",
      statusCode: 200,
    });
  });

  return logs.sort((a, b) => b.tsMs - a.tsMs).slice(0, 200);
}

// ── Hourly chart: count events from activity per last-24h hours ───────────────
function buildHourlyChart(activity: UserActivity[]): { hour: string; activity: number; errors: number }[] {
  const now = Date.now();
  const hours: { hour: string; activity: number; errors: number }[] = [];
  for (let h = 23; h >= 0; h--) {
    const from = now - (h + 1) * 3_600_000;
    const to   = now - h       * 3_600_000;
    const inWindow = activity.filter(a => a.tsMs >= from && a.tsMs < to);
    const d = new Date(to);
    const label = `${String(d.getHours()).padStart(2,"0")}:00`;
    hours.push({ hour: label, activity: inWindow.length, errors: inWindow.filter(a => a.status === "Failed").length });
  }
  // Trim leading zeros but keep at least 8 buckets
  let first = hours.findIndex(h => h.activity > 0 || h.errors > 0);
  first = Math.max(0, first - 1);
  return hours.slice(Math.min(first, hours.length - 8));
}

// ── Helper components ──────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  Login:            { icon: <LogIn className="w-3.5 h-3.5" />,       color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Logout:           { icon: <LogOut className="w-3.5 h-3.5" />,      color: "bg-gray-100 text-gray-600 border-gray-200" },
  "Failed Login":   { icon: <Lock className="w-3.5 h-3.5" />,        color: "bg-red-50 text-red-700 border-red-200" },
  Create:           { icon: <Plus className="w-3.5 h-3.5" />,        color: "bg-blue-50 text-blue-700 border-blue-200" },
  Edit:             { icon: <Edit3 className="w-3.5 h-3.5" />,       color: "bg-amber-50 text-amber-700 border-amber-200" },
  Delete:           { icon: <Trash2 className="w-3.5 h-3.5" />,      color: "bg-red-50 text-red-700 border-red-200" },
  View:             { icon: <Eye className="w-3.5 h-3.5" />,         color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  Export:           { icon: <Download className="w-3.5 h-3.5" />,    color: "bg-purple-50 text-purple-700 border-purple-200" },
  Download:         { icon: <Download className="w-3.5 h-3.5" />,    color: "bg-purple-50 text-purple-700 border-purple-200" },
  Approve:          { icon: <CheckCircle2 className="w-3.5 h-3.5" />,color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Reject:           { icon: <XCircle className="w-3.5 h-3.5" />,     color: "bg-red-50 text-red-700 border-red-200" },
  Invite:           { icon: <UserCheck className="w-3.5 h-3.5" />,   color: "bg-teal-50 text-teal-700 border-teal-200" },
  "Password Reset": { icon: <Unlock className="w-3.5 h-3.5" />,      color: "bg-orange-50 text-orange-700 border-orange-200" },
  Settings:         { icon: <Settings className="w-3.5 h-3.5" />,    color: "bg-gray-100 text-gray-700 border-gray-200" },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CONFIG[action] ?? { icon: <Activity className="w-3.5 h-3.5" />, color: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium ${cfg.color}`}>
      {cfg.icon}{action}
    </span>
  );
}

const SEV_CONFIG: Record<LogSeverity, { icon: React.ReactNode; color: string; dot: string }> = {
  Info:     { icon: <Info className="w-3.5 h-3.5" />,           color: "bg-blue-50 text-blue-700 border-blue-200",    dot: "bg-blue-500"  },
  Warning:  { icon: <AlertTriangle className="w-3.5 h-3.5" />,  color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  Error:    { icon: <AlertCircle className="w-3.5 h-3.5" />,    color: "bg-red-50 text-red-700 border-red-200",       dot: "bg-red-500"   },
  Critical: { icon: <XCircle className="w-3.5 h-3.5" />,        color: "bg-red-100 text-red-800 border-red-300",      dot: "bg-red-700"   },
};

function SeverityBadge({ severity }: { severity: LogSeverity }) {
  const cfg = SEV_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-semibold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {severity}
    </span>
  );
}

const AVATAR_COLORS = ["bg-blue-500","bg-emerald-500","bg-violet-500","bg-orange-500","bg-pink-500","bg-teal-500","bg-indigo-500","bg-rose-500","bg-amber-500","bg-cyan-500"];
function avatarColor(name: string) { return AVATAR_COLORS[djb2(name) % AVATAR_COLORS.length]; }

function AvatarBubble({ initials: init, name }: { initials: string; name: string }) {
  const color = (init === "??" || init === "") ? "bg-gray-400" : avatarColor(name);
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${color}`}>
      {init || "?"}
    </div>
  );
}

// ── User Activity Tab ──────────────────────────────────────────────────────────

function UserActivityTab({ data }: { data: UserActivity[] }) {
  const [search, setSearch]     = useState("");
  const [actionFilter, setAF]   = useState("All");
  const [statusFilter, setSF]   = useState("All");
  const [page, setPage]         = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const PAGE_SIZE = 12;

  const actionOptions = ["All","Login","Failed Login","Create","Edit","Delete","Approve","Reject","Invite","Export","Password Reset","Settings"];
  const statusOptions = ["All","Success","Failed","Warning"];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(a => {
      const matchSearch = !q || a.user.toLowerCase().includes(q) || a.resource.toLowerCase().includes(q)
                              || a.module.toLowerCase().includes(q) || a.ip.includes(q) || a.details.toLowerCase().includes(q);
      return matchSearch && (actionFilter === "All" || a.action === actionFilter)
                         && (statusFilter === "All" || a.status === statusFilter);
    });
  }, [data, search, actionFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search user, resource, IP…"
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={actionFilter} onChange={e => { setAF(e.target.value); setPage(1); }}
          className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          {actionOptions.map(o => <option key={o}>{o === "All" ? "All Actions" : o}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setSF(e.target.value); setPage(1); }}
          className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          {statusOptions.map(o => <option key={o}>{o === "All" ? "All Statuses" : o}</option>)}
        </select>
        <button onClick={() => { setSearch(""); setAF("All"); setSF("All"); setPage(1); }}
          className="flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
          <Filter className="w-3.5 h-3.5" /> Clear
        </button>
        <span className="ml-auto text-xs text-gray-400">{filtered.length} events</span>
        <button onClick={() => downloadReportExport("CSV", "User Activity", [
          { key: "user", label: "User" }, { key: "role", label: "Role" }, { key: "action", label: "Action" },
          { key: "resource", label: "Resource" }, { key: "module", label: "Module" }, { key: "ip", label: "IP" },
          { key: "location", label: "Location" }, { key: "timestamp", label: "Time" }, { key: "status", label: "Status" },
          { key: "details", label: "Details" },
        ], filtered)}
          className="flex items-center gap-1.5 text-xs px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Activity className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">No activity events found</p>
            <p className="text-xs text-gray-300 mt-1">Try clearing filters or creating some records in the platform</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    {["User","Action","Resource / Module","IP & Device","Location","Time","Status"].map(h => (
                      <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map(row => (
                    <Fragment key={row.id}>
                      <tr onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                        className={`border-b border-gray-50 hover:bg-gray-50/70 transition-colors cursor-pointer ${expanded === row.id ? "bg-blue-50/40" : ""}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <AvatarBubble initials={initials(row.user)} name={row.user} />
                            <div>
                              <div className="text-xs font-semibold text-gray-900 whitespace-nowrap">{row.user}</div>
                              <div className="text-[11px] text-gray-400">{row.role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4"><ActionBadge action={row.action} /></td>
                        <td className="py-3 px-4 max-w-[180px]">
                          <div className="text-xs font-medium text-gray-800 truncate">{row.resource}</div>
                          <div className="text-[11px] text-gray-400">{row.module}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 text-xs text-gray-700">
                            <Globe className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="font-mono">{row.ip}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                            <Monitor className="w-3 h-3 shrink-0" />{row.device}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">{row.location}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 text-xs text-gray-700 whitespace-nowrap">
                            <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                            {row.timestamp.split(" ").slice(-2).join(" ")}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{row.timestamp.split(",")[0]}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            row.status === "Success" ? "bg-emerald-50 text-emerald-700" :
                            row.status === "Failed"  ? "bg-red-50 text-red-700" :
                            "bg-amber-50 text-amber-700"
                          }`}>
                            {row.status === "Success" ? <CheckCircle2 className="w-3 h-3" /> :
                             row.status === "Failed"  ? <XCircle className="w-3 h-3" /> :
                             <AlertTriangle className="w-3 h-3" />}
                            {row.status}
                          </span>
                        </td>
                      </tr>
                      {expanded === row.id && (
                        <tr className="bg-blue-50/30 border-b border-blue-100">
                          <td colSpan={7} className="px-6 py-3">
                            <div className="flex items-start gap-2">
                              <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                              <div>
                                <span className="text-xs font-semibold text-blue-800">Details: </span>
                                <span className="text-xs text-gray-700">{row.details}</span>
                                <span className="ml-4 text-[11px] text-gray-400">Full timestamp: {row.timestamp}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 text-xs rounded border transition-colors ${p === page ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 hover:bg-gray-50"}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── System Logs Tab ────────────────────────────────────────────────────────────

function SystemLogsTab({ data }: { data: SystemLog[] }) {
  const [search, setSearch] = useState("");
  const [sevFilter, setSF]  = useState("All");
  const [catFilter, setCF]  = useState("All");
  const [page, setPage]     = useState(1);
  const PAGE_SIZE = 12;

  const sevOptions = ["All","Info","Warning","Error","Critical"];
  const catOptions = ["All","Authentication","Data","System","Security","Configuration"];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(l => {
      const matchSearch = !q || l.event.toLowerCase().includes(q) || l.message.toLowerCase().includes(q)
                              || l.service.toLowerCase().includes(q) || l.user.toLowerCase().includes(q);
      return matchSearch && (sevFilter === "All" || l.severity === sevFilter)
                         && (catFilter === "All" || l.category === catFilter);
    });
  }, [data, search, sevFilter, catFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const criticalCount = data.filter(l => l.severity === "Critical").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search event, service, message…"
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={sevFilter} onChange={e => { setSF(e.target.value); setPage(1); }}
          className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          {sevOptions.map(o => <option key={o}>{o === "All" ? "All Severities" : o}</option>)}
        </select>
        <select value={catFilter} onChange={e => { setCF(e.target.value); setPage(1); }}
          className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          {catOptions.map(o => <option key={o}>{o === "All" ? "All Categories" : o}</option>)}
        </select>
        <button onClick={() => { setSearch(""); setSF("All"); setCF("All"); setPage(1); }}
          className="flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
          <Filter className="w-3.5 h-3.5" /> Clear
        </button>
        <span className="ml-auto text-xs text-gray-400">{filtered.length} logs</span>
        <button onClick={() => downloadReportExport("CSV", "System Logs", [
          { key: "severity", label: "Severity" }, { key: "event", label: "Event" }, { key: "category", label: "Category" },
          { key: "service", label: "Service" }, { key: "message", label: "Message" }, { key: "user", label: "User" },
          { key: "duration", label: "Duration" }, { key: "timestamp", label: "Timestamp" },
        ], filtered)}
          className="flex items-center gap-1.5 text-xs px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">No log entries found</p>
            <p className="text-xs text-gray-300 mt-1">Try clearing filters or adding some data to the platform</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    {["Severity","Event","Service","Message","User","Duration","Timestamp"].map(h => (
                      <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map(log => (
                    <tr key={log.id} className={`border-b border-gray-50 transition-colors hover:bg-gray-50/70 ${
                      log.severity === "Critical" ? "bg-red-50/30" :
                      log.severity === "Error"    ? "bg-orange-50/20" : ""
                    }`}>
                      <td className="py-3 px-4"><SeverityBadge severity={log.severity} /></td>
                      <td className="py-3 px-4">
                        <div className="text-xs font-semibold text-gray-900 whitespace-nowrap">{log.event}</div>
                        <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          log.category === "Security"       ? "bg-red-50 text-red-600" :
                          log.category === "Authentication" ? "bg-blue-50 text-blue-600" :
                          log.category === "Data"           ? "bg-emerald-50 text-emerald-600" :
                          log.category === "Configuration"  ? "bg-violet-50 text-violet-600" :
                          "bg-gray-100 text-gray-600"
                        }`}>{log.category}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Database className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="text-xs font-mono text-gray-700">{log.service}</span>
                        </div>
                        {log.statusCode && (
                          <span className={`text-[11px] font-mono mt-0.5 block ${
                            log.statusCode < 300 ? "text-emerald-600" :
                            log.statusCode < 400 ? "text-amber-600" : "text-red-600"
                          }`}>{log.statusCode}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-[280px]">
                        <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">{log.message}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="text-xs font-mono text-gray-700">{log.user}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                          <Globe className="w-2.5 h-2.5" />{log.ip}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-gray-600 whitespace-nowrap">{log.duration ?? "—"}</td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-gray-700 whitespace-nowrap">{log.timestamp.split(" ").slice(-2).join(" ")}</div>
                        <div className="text-[11px] text-gray-400">{log.timestamp.split(",")[0]}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 text-xs rounded border transition-colors ${p === page ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 hover:bg-gray-50"}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AuditTrailPage() {
  usePageMeta({ title: "Audit Reports" });
  const { inline } = useReportShellContext();
  const filters = useReportFilters();
  const setExportData = useSetReportExportData();
  const [tab, setTab]         = useState<"activity" | "logs">("activity");
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange]   = useState("All Time");
  const [lastLiveUpdate, setLastLiveUpdate] = useState(() => Date.now());

  // Keep both report tabs synchronized with the platform's local stores.
  // Store events update immediately in this tab; storage and polling cover
  // changes made by another tab or by legacy code that does not emit an event.
  useEffect(() => {
    const liveEvents = [
      "nidoConfigUsersUpdated",
      "nidoSalesOrdersUpdated",
      "nidoQuotesUpdated",
      "nidoInvoicesUpdated",
      "nidoVendorsUpdated",
      "nidoClientsUpdated",
      "supportTicketsUpdated",
      "serviceRequestsUpdated",
      "stockHistoryUpdated",
      "poCreated",
      "poCancelled",
      "nidoPortalUsersUpdated",
      "nidoImpersonationUpdated",
      "nido:config-changed",
    ];

    const refreshLiveData = () => {
      setRefreshKey(key => key + 1);
      setLastLiveUpdate(Date.now());
    };

    liveEvents.forEach(eventName => window.addEventListener(eventName, refreshLiveData));
    window.addEventListener("storage", refreshLiveData);
    const pollingTimer = window.setInterval(refreshLiveData, 3000);

    return () => {
      liveEvents.forEach(eventName => window.removeEventListener(eventName, refreshLiveData));
      window.removeEventListener("storage", refreshLiveData);
      window.clearInterval(pollingTimer);
    };
  }, []);

  // Derive live data (re-derived on every refreshKey bump)
  const activity  = useMemo(() => deriveRecordedActivity(),       [refreshKey]);
  const systemLogs = useMemo(() => deriveRecordedSystemLogs(),    [refreshKey]);
  const hourlyData = useMemo(() => buildHourlyChart(activity),   [activity]);

  // Filter by date range
  const now = Date.now();
  const rangeMs: number = dateRange === "Today" ? 86_400_000 :
                          dateRange === "Last 7 Days" ? 7 * 86_400_000 :
                          dateRange === "Last 30 Days" ? 30 * 86_400_000 : Infinity;

  const filteredActivity = useMemo(() =>
    applyReportFilters(activity.filter(a => (now - a.tsMs) <= rangeMs), filters),
  [activity, rangeMs, filters]);

  const filteredLogs = useMemo(() =>
    applyReportFilters(systemLogs.filter(l => (now - l.tsMs) <= rangeMs), filters),
  [systemLogs, rangeMs, filters]);

  useEffect(() => {
    const activityView = tab === "activity";
    setExportData({
      title: activityView ? "User Activity" : "System Logs",
      columns: activityView
        ? [
            { key: "user", label: "User" }, { key: "role", label: "Role" }, { key: "action", label: "Action" },
            { key: "resource", label: "Resource" }, { key: "module", label: "Module" }, { key: "ip", label: "IP" },
            { key: "location", label: "Location" }, { key: "timestamp", label: "Time" }, { key: "status", label: "Status" },
            { key: "details", label: "Details" },
          ]
        : [
            { key: "severity", label: "Severity" }, { key: "event", label: "Event" }, { key: "category", label: "Category" },
            { key: "service", label: "Service" }, { key: "message", label: "Message" }, { key: "user", label: "User" },
            { key: "duration", label: "Duration" }, { key: "timestamp", label: "Timestamp" },
          ],
      rows: (activityView ? filteredActivity : filteredLogs) as unknown as Record<string, unknown>[],
    });
  }, [setExportData, tab, filteredActivity, filteredLogs]);

  // KPIs from live data
  const totalEvents    = filteredActivity.length + filteredLogs.length;
  const failedLogins   = filteredActivity.filter(a => a.action === "Failed Login").length;
  const systemErrors   = filteredLogs.filter(l => l.severity === "Error" || l.severity === "Critical").length;
  const criticalAlerts = filteredLogs.filter(l => l.severity === "Critical").length;
  const configChanges  = filteredLogs.filter(l => l.category === "Configuration").length;
  const uniqueUsers    = new Set(filteredActivity.filter(a => a.status === "Success").map(a => a.user)).size;

  const kpis = [
    { label: "Total Events",    value: totalEvents.toLocaleString(),   sub: `${filteredActivity.length} activity + ${filteredLogs.length} logs`,    icon: <Activity className="w-5 h-5 text-blue-500" />,    bg: "bg-blue-50"   },
    { label: "Active Users",    value: uniqueUsers.toString(),          sub: "Unique actors",                                                         icon: <User className="w-5 h-5 text-emerald-500" />,    bg: "bg-emerald-50"},
    { label: "Failed Logins",   value: failedLogins.toString(),         sub: failedLogins > 0 ? "Review security" : "No failures",                   icon: <Lock className="w-5 h-5 text-red-500" />,        bg: "bg-red-50"    },
    { label: "System Errors",   value: systemErrors.toString(),         sub: `${criticalAlerts} critical`,                                            icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, bg: "bg-amber-50"},
    { label: "Security Alerts", value: criticalAlerts.toString(),       sub: criticalAlerts > 0 ? "Needs attention" : "All clear",                   icon: <Shield className="w-5 h-5 text-violet-500" />,   bg: "bg-violet-50" },
    { label: "Config Changes",  value: configChanges.toString(),        sub: "Last period",                                                           icon: <Settings className="w-5 h-5 text-indigo-500" />, bg: "bg-indigo-50" },
  ];

  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => { setRefreshKey(k => k + 1); setRefreshing(false); toast({ title: "Audit logs refreshed" }); }, 800);
  }

  const content = (
    <div className="space-y-5">
      <ExportBar reportTitle={tab === "activity" ? "User Activity" : "System Logs"} onRefresh={handleRefresh} />
      <FilterBar
        categories={["Login", "Failed Login", "Create", "Edit", "Delete", "Approve", "Reject", "Invite", "Security", "Authentication", "Data", "System", "Configuration"]}
        statuses={["Success", "Failed", "Warning", "Info", "Error", "Critical"]}
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {inline && <h2 className="text-lg font-bold text-gray-900">Audit Reports</h2>}
          <div className={`flex items-center gap-2 ${inline ? "mt-0.5" : ""}`}>
            <p className="text-sm text-gray-500">
              Live user activity &amp; system logs derived from all platform data
            </p>
            <span
              title={`Updated ${new Date(lastLiveUpdate).toLocaleTimeString()}`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 whitespace-nowrap"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors ${refreshing ? "opacity-60 pointer-events-none" : ""}`}>
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <select value={dateRange} onChange={e => setDateRange(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
            {["All Time","Today","Last 7 Days","Last 30 Days"].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
            <div className={`w-9 h-9 rounded-lg ${k.bg} flex items-center justify-center shrink-0`}>{k.icon}</div>
            <div>
              <div className="text-xl font-bold text-gray-900 leading-tight">{k.value}</div>
              <div className="text-[11px] text-gray-500 leading-tight mt-0.5">{k.label}</div>
              <div className="text-[11px] text-gray-400 mt-1">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-900">Event Volume — Last 24 Hours</h3>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-blue-500 inline-block" /> Activity</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-red-400 inline-block" /> Failures</span>
          </div>
        </div>
        <div className="px-4 py-4">
          {hourlyData.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-xs text-gray-400">
              No events in the last 24 hours — activity will appear here as it happens
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={hourlyData} barSize={12} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E5E7EB" }} cursor={{ fill: "#F9FAFB" }} />
                <Bar dataKey="activity" fill="#3B82F6" radius={[3,3,0,0]} name="Activity Events" />
                <Bar dataKey="errors"   fill="#F87171" radius={[3,3,0,0]} name="Failures" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 px-4 pt-1">
          <button onClick={() => setTab("activity")}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${tab === "activity" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <User className="w-4 h-4" />
            User Activity
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === "activity" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
              {filteredActivity.length}
            </span>
          </button>
          <button onClick={() => setTab("logs")}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${tab === "logs" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <FileText className="w-4 h-4" />
            System Logs
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === "logs" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
              {filteredLogs.length}
            </span>
          </button>
          {criticalAlerts > 0 && (
            <div className="ml-auto flex items-center self-center">
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                {criticalAlerts} Critical
              </span>
            </div>
          )}
        </div>
        <div className="p-4">
          {tab === "activity" && <UserActivityTab data={filteredActivity} />}
          {tab === "logs"     && <SystemLogsTab   data={filteredLogs}    />}
        </div>
      </div>
    </div>
  );

  if (inline) return content;

  return (
    <ReportShell title="Audit Reports" subtitle="Live user activity & system logs from all platform data">
      {content}
    </ReportShell>
  );
}
