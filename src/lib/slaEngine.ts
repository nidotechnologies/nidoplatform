// ─── NIDO SLA Engine ──────────────────────────────────────────────────────────
// Single source of truth for all SLA rules across the platform.
// Every module must derive SLA timelines, thresholds, and escalation rules from here.

const KEYS = {
  VENDOR_SLA:       'nido_sla_vendor',
  CLIENT_SLA:       'nido_sla_client',
  PROCUREMENT_SLA:  'nido_sla_procurement',
  SERVICE_SLA:      'nido_sla_service',
  APPROVAL_SLA:     'nido_sla_approval',
  ESCALATION_RULES: 'nido_sla_escalation',
  BUSINESS_CAL:     'nido_sla_calendar',
  AUDIT_LOG:        'nido_sla_audit_log',
} as const;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

function save(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('slaEngineUpdated', { detail: { key } }));
}

// ─── Audit Log ───────────────────────────────────────────────────────────────
export interface SLAAuditEntry {
  id: string;
  timestamp: string;
  user: string;
  module: string;
  action: string;
  field: string;
  previousValue: string;
  newValue: string;
}

export function getSLAAuditLog(): SLAAuditEntry[] {
  return load<SLAAuditEntry[]>(KEYS.AUDIT_LOG, []);
}

export function addSLAAuditEntry(entry: Omit<SLAAuditEntry, 'id' | 'timestamp'>): void {
  const log = getSLAAuditLog();
  log.unshift({
    ...entry,
    id: `sla-audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
  });
  save(KEYS.AUDIT_LOG, log.slice(0, 500));
}

// ─── Vendor SLA ───────────────────────────────────────────────────────────────
export interface VendorSLASettings {
  enabled: boolean;
  slaName: string;
  slaCode: string;
  description: string;
  status: 'Active' | 'Inactive';
  // Procurement commitments (hours)
  rfqResponseTime: number;
  quoteSubmissionTime: number;
  orderAcceptanceTime: number;
  orderConfirmationTime: number;
  dispatchTime: number;
  deliveryTime: number;
  installationTime: number;
  warrantyResponseTime: number;
  // Performance targets (%)
  onTimeDeliveryPct: number;
  orderFulfilmentPct: number;
  acceptanceRatePct: number;
  cancellationRatePct: number;
  returnProcessingTime: number;
  complaintResolutionTime: number;
  // Penalty rules
  lateDeliveryPenalty: string;
  lateResponsePenalty: string;
  slaViolationPenalty: string;
  performanceScoreDeduction: number;
  // Notifications
  slaReminderEnabled: boolean;
  slaWarningEnabled: boolean;
  slaBreachNotificationEnabled: boolean;
  escalationNotificationEnabled: boolean;
}

const DEFAULT_VENDOR_SLA: VendorSLASettings = {
  enabled: true,
  slaName: 'Standard Vendor SLA',
  slaCode: 'VSLA-001',
  description: 'Default SLA policy for all registered vendors',
  status: 'Active',
  rfqResponseTime: 24,
  quoteSubmissionTime: 48,
  orderAcceptanceTime: 4,
  orderConfirmationTime: 8,
  dispatchTime: 72,
  deliveryTime: 168,
  installationTime: 48,
  warrantyResponseTime: 24,
  onTimeDeliveryPct: 95,
  orderFulfilmentPct: 98,
  acceptanceRatePct: 90,
  cancellationRatePct: 5,
  returnProcessingTime: 72,
  complaintResolutionTime: 48,
  lateDeliveryPenalty: '1% per day',
  lateResponsePenalty: '0.5% per hour',
  slaViolationPenalty: '2% of order value',
  performanceScoreDeduction: 5,
  slaReminderEnabled: true,
  slaWarningEnabled: true,
  slaBreachNotificationEnabled: true,
  escalationNotificationEnabled: true,
};

export function getVendorSLA(): VendorSLASettings {
  return load<VendorSLASettings>(KEYS.VENDOR_SLA, DEFAULT_VENDOR_SLA);
}

export function saveVendorSLA(settings: VendorSLASettings, user = 'Admin'): void {
  const prev = getVendorSLA();
  save(KEYS.VENDOR_SLA, settings);
  addSLAAuditEntry({ user, module: 'Vendor SLA', action: 'Updated', field: 'Vendor SLA Settings', previousValue: JSON.stringify(prev), newValue: JSON.stringify(settings) });
}

// ─── Client SLA ───────────────────────────────────────────────────────────────
export interface ClientSLATier {
  id: string;
  name: 'Standard' | 'Premium' | 'Enterprise';
  requestResponseTime: number;
  quoteDeliveryTime: number;
  orderProcessingTime: number;
  invoiceGenerationTime: number;
  contractProcessingTime: number;
  serviceResponseTime: number;
  ticketResolutionTime: number;
  accountManagerResponseTime: number;
  enabled: boolean;
}

const DEFAULT_CLIENT_SLA: ClientSLATier[] = [
  { id: 'csl-1', name: 'Standard',   requestResponseTime: 24, quoteDeliveryTime: 48,  orderProcessingTime: 24, invoiceGenerationTime: 4,  contractProcessingTime: 72, serviceResponseTime: 8,  ticketResolutionTime: 48, accountManagerResponseTime: 24, enabled: true },
  { id: 'csl-2', name: 'Premium',    requestResponseTime: 8,  quoteDeliveryTime: 24,  orderProcessingTime: 12, invoiceGenerationTime: 2,  contractProcessingTime: 48, serviceResponseTime: 4,  ticketResolutionTime: 24, accountManagerResponseTime: 8,  enabled: true },
  { id: 'csl-3', name: 'Enterprise', requestResponseTime: 2,  quoteDeliveryTime: 8,   orderProcessingTime: 4,  invoiceGenerationTime: 1,  contractProcessingTime: 24, serviceResponseTime: 1,  ticketResolutionTime: 8,  accountManagerResponseTime: 2,  enabled: true },
];

export function getClientSLA(): ClientSLATier[] {
  return load<ClientSLATier[]>(KEYS.CLIENT_SLA, DEFAULT_CLIENT_SLA);
}

export function saveClientSLA(tiers: ClientSLATier[], user = 'Admin'): void {
  save(KEYS.CLIENT_SLA, tiers);
  addSLAAuditEntry({ user, module: 'Client SLA', action: 'Updated', field: 'Client SLA Tiers', previousValue: '', newValue: JSON.stringify(tiers) });
}

// ─── Procurement SLA ──────────────────────────────────────────────────────────
export interface ProcurementSLAStage {
  id: string;
  stage: string;
  targetTimeHrs: number;
  warningThresholdHrs: number;
  breachThresholdHrs: number;
  escalationRule: string;
  enabled: boolean;
}

const DEFAULT_PROCUREMENT_SLA: ProcurementSLAStage[] = [
  { id: 'ps-1',  stage: 'Purchase Request Review',  targetTimeHrs: 4,   warningThresholdHrs: 3,   breachThresholdHrs: 4,   escalationRule: 'Notify Manager',         enabled: true },
  { id: 'ps-2',  stage: 'Purchase Request Approval', targetTimeHrs: 8,  warningThresholdHrs: 6,   breachThresholdHrs: 8,   escalationRule: 'Notify Finance Head',     enabled: true },
  { id: 'ps-3',  stage: 'RFQ Generation',            targetTimeHrs: 2,  warningThresholdHrs: 1.5, breachThresholdHrs: 2,   escalationRule: 'Notify Procurement Lead', enabled: true },
  { id: 'ps-4',  stage: 'Vendor Selection',          targetTimeHrs: 24, warningThresholdHrs: 18,  breachThresholdHrs: 24,  escalationRule: 'Notify Manager',         enabled: true },
  { id: 'ps-5',  stage: 'Purchase Order Creation',   targetTimeHrs: 4,  warningThresholdHrs: 3,   breachThresholdHrs: 4,   escalationRule: 'Notify Procurement Lead', enabled: true },
  { id: 'ps-6',  stage: 'Purchase Order Approval',   targetTimeHrs: 8,  warningThresholdHrs: 6,   breachThresholdHrs: 8,   escalationRule: 'Notify Finance Head',     enabled: true },
  { id: 'ps-7',  stage: 'Order Placement',           targetTimeHrs: 2,  warningThresholdHrs: 1.5, breachThresholdHrs: 2,   escalationRule: 'Notify Vendor',          enabled: true },
  { id: 'ps-8',  stage: 'Vendor Confirmation',       targetTimeHrs: 24, warningThresholdHrs: 18,  breachThresholdHrs: 24,  escalationRule: 'Notify Procurement Lead', enabled: true },
  { id: 'ps-9',  stage: 'Goods Dispatch',            targetTimeHrs: 72, warningThresholdHrs: 60,  breachThresholdHrs: 72,  escalationRule: 'Notify Vendor',          enabled: true },
  { id: 'ps-10', stage: 'Goods Receipt',             targetTimeHrs: 4,  warningThresholdHrs: 3,   breachThresholdHrs: 4,   escalationRule: 'Notify Store Manager',   enabled: true },
  { id: 'ps-11', stage: 'Invoice Verification',      targetTimeHrs: 8,  warningThresholdHrs: 6,   breachThresholdHrs: 8,   escalationRule: 'Notify Finance Team',    enabled: true },
  { id: 'ps-12', stage: 'Payment Processing',        targetTimeHrs: 48, warningThresholdHrs: 36,  breachThresholdHrs: 48,  escalationRule: 'Notify Finance Head',    enabled: true },
];

export function getProcurementSLA(): ProcurementSLAStage[] {
  return load<ProcurementSLAStage[]>(KEYS.PROCUREMENT_SLA, DEFAULT_PROCUREMENT_SLA);
}

export function saveProcurementSLA(stages: ProcurementSLAStage[], user = 'Admin'): void {
  save(KEYS.PROCUREMENT_SLA, stages);
  addSLAAuditEntry({ user, module: 'Procurement SLA', action: 'Updated', field: 'Procurement Stages', previousValue: '', newValue: JSON.stringify(stages) });
}

// ─── Service SLA ──────────────────────────────────────────────────────────────
export interface ServiceSLACategory {
  id: string;
  category: string;
  firstResponseTimeHrs: number;
  resolutionTimeHrs: number;
  visitTimeHrs: number;
  escalationTimeHrs: number;
  maxResolutionTimeHrs: number;
  workingHours: string;
  businessHours: string;
  enabled: boolean;
}

const DEFAULT_SERVICE_SLA: ServiceSLACategory[] = [
  { id: 'ss-1', category: 'Installation',           firstResponseTimeHrs: 4,  resolutionTimeHrs: 24,  visitTimeHrs: 8,  escalationTimeHrs: 8,  maxResolutionTimeHrs: 48, workingHours: '9:00-18:00', businessHours: 'Mon-Sat', enabled: true },
  { id: 'ss-2', category: 'AMC',                    firstResponseTimeHrs: 8,  resolutionTimeHrs: 48,  visitTimeHrs: 24, escalationTimeHrs: 16, maxResolutionTimeHrs: 72, workingHours: '9:00-18:00', businessHours: 'Mon-Fri', enabled: true },
  { id: 'ss-3', category: 'Preventive Maintenance', firstResponseTimeHrs: 24, resolutionTimeHrs: 72,  visitTimeHrs: 48, escalationTimeHrs: 36, maxResolutionTimeHrs: 96, workingHours: '9:00-18:00', businessHours: 'Mon-Sat', enabled: true },
  { id: 'ss-4', category: 'Breakdown Maintenance',  firstResponseTimeHrs: 2,  resolutionTimeHrs: 8,   visitTimeHrs: 4,  escalationTimeHrs: 4,  maxResolutionTimeHrs: 24, workingHours: '24x7',       businessHours: 'All Days', enabled: true },
  { id: 'ss-5', category: 'Warranty Service',       firstResponseTimeHrs: 4,  resolutionTimeHrs: 24,  visitTimeHrs: 8,  escalationTimeHrs: 8,  maxResolutionTimeHrs: 48, workingHours: '9:00-18:00', businessHours: 'Mon-Sat', enabled: true },
  { id: 'ss-6', category: 'Technical Support',      firstResponseTimeHrs: 1,  resolutionTimeHrs: 4,   visitTimeHrs: 2,  escalationTimeHrs: 2,  maxResolutionTimeHrs: 8,  workingHours: '9:00-21:00', businessHours: 'Mon-Sat', enabled: true },
  { id: 'ss-7', category: 'Remote Support',         firstResponseTimeHrs: 0.5,resolutionTimeHrs: 2,   visitTimeHrs: 1,  escalationTimeHrs: 1,  maxResolutionTimeHrs: 4,  workingHours: '24x7',       businessHours: 'All Days', enabled: true },
  { id: 'ss-8', category: 'On-site Support',        firstResponseTimeHrs: 4,  resolutionTimeHrs: 8,   visitTimeHrs: 4,  escalationTimeHrs: 6,  maxResolutionTimeHrs: 24, workingHours: '9:00-18:00', businessHours: 'Mon-Sat', enabled: true },
];

export function getServiceSLA(): ServiceSLACategory[] {
  return load<ServiceSLACategory[]>(KEYS.SERVICE_SLA, DEFAULT_SERVICE_SLA);
}

export function saveServiceSLA(categories: ServiceSLACategory[], user = 'Admin'): void {
  save(KEYS.SERVICE_SLA, categories);
  addSLAAuditEntry({ user, module: 'Service SLA', action: 'Updated', field: 'Service Categories', previousValue: '', newValue: JSON.stringify(categories) });
}

// ─── Approval SLA ─────────────────────────────────────────────────────────────
export interface ApprovalSLAConfig {
  id: string;
  approvalType: string;
  responseTimeHrs: number;
  approvalDeadlineHrs: number;
  reminderIntervalHrs: number;
  escalationLevel1Hrs: number;
  escalationLevel2Hrs: number;
  autoEscalation: boolean;
  autoApproval: boolean;
  autoApprovalAfterHrs: number;
  autoRejection: boolean;
  autoRejectionAfterHrs: number;
  enabled: boolean;
}

const DEFAULT_APPROVAL_SLA: ApprovalSLAConfig[] = [
  { id: 'asl-1', approvalType: 'Purchase Request Approval', responseTimeHrs: 4,  approvalDeadlineHrs: 8,  reminderIntervalHrs: 2,  escalationLevel1Hrs: 8,  escalationLevel2Hrs: 16, autoEscalation: true, autoApproval: false, autoApprovalAfterHrs: 0,  autoRejection: false, autoRejectionAfterHrs: 0,  enabled: true },
  { id: 'asl-2', approvalType: 'Manager Approval',          responseTimeHrs: 2,  approvalDeadlineHrs: 4,  reminderIntervalHrs: 1,  escalationLevel1Hrs: 4,  escalationLevel2Hrs: 8,  autoEscalation: true, autoApproval: false, autoApprovalAfterHrs: 0,  autoRejection: false, autoRejectionAfterHrs: 0,  enabled: true },
  { id: 'asl-3', approvalType: 'Finance Approval',          responseTimeHrs: 4,  approvalDeadlineHrs: 12, reminderIntervalHrs: 3,  escalationLevel1Hrs: 12, escalationLevel2Hrs: 24, autoEscalation: true, autoApproval: false, autoApprovalAfterHrs: 0,  autoRejection: false, autoRejectionAfterHrs: 0,  enabled: true },
  { id: 'asl-4', approvalType: 'Purchase Order Approval',   responseTimeHrs: 2,  approvalDeadlineHrs: 6,  reminderIntervalHrs: 2,  escalationLevel1Hrs: 6,  escalationLevel2Hrs: 12, autoEscalation: true, autoApproval: false, autoApprovalAfterHrs: 0,  autoRejection: false, autoRejectionAfterHrs: 0,  enabled: true },
  { id: 'asl-5', approvalType: 'Contract Approval',         responseTimeHrs: 8,  approvalDeadlineHrs: 24, reminderIntervalHrs: 4,  escalationLevel1Hrs: 24, escalationLevel2Hrs: 48, autoEscalation: true, autoApproval: false, autoApprovalAfterHrs: 0,  autoRejection: false, autoRejectionAfterHrs: 0,  enabled: true },
  { id: 'asl-6', approvalType: 'Invoice Approval',          responseTimeHrs: 2,  approvalDeadlineHrs: 8,  reminderIntervalHrs: 2,  escalationLevel1Hrs: 8,  escalationLevel2Hrs: 16, autoEscalation: true, autoApproval: true,  autoApprovalAfterHrs: 72, autoRejection: false, autoRejectionAfterHrs: 0,  enabled: true },
  { id: 'asl-7', approvalType: 'Payment Approval',          responseTimeHrs: 4,  approvalDeadlineHrs: 12, reminderIntervalHrs: 3,  escalationLevel1Hrs: 12, escalationLevel2Hrs: 24, autoEscalation: true, autoApproval: false, autoApprovalAfterHrs: 0,  autoRejection: false, autoRejectionAfterHrs: 0,  enabled: true },
];

export function getApprovalSLA(): ApprovalSLAConfig[] {
  return load<ApprovalSLAConfig[]>(KEYS.APPROVAL_SLA, DEFAULT_APPROVAL_SLA);
}

export function saveApprovalSLA(configs: ApprovalSLAConfig[], user = 'Admin'): void {
  save(KEYS.APPROVAL_SLA, configs);
  addSLAAuditEntry({ user, module: 'Approval SLA', action: 'Updated', field: 'Approval Configs', previousValue: '', newValue: JSON.stringify(configs) });
}

// ─── Escalation Rules ─────────────────────────────────────────────────────────
export interface EscalationLevel {
  level: number;
  label: string;
  notifyRole: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  triggerAfterHrs: number;
  enabled: boolean;
}

const DEFAULT_ESCALATION: EscalationLevel[] = [
  { level: 1, label: 'Level 1', notifyRole: 'Approver',               emailEnabled: true,  smsEnabled: false, pushEnabled: true,  inAppEnabled: true,  triggerAfterHrs: 4,  enabled: true },
  { level: 2, label: 'Level 2', notifyRole: 'Department Head',         emailEnabled: true,  smsEnabled: true,  pushEnabled: true,  inAppEnabled: true,  triggerAfterHrs: 8,  enabled: true },
  { level: 3, label: 'Level 3', notifyRole: 'Operations Manager',      emailEnabled: true,  smsEnabled: true,  pushEnabled: true,  inAppEnabled: true,  triggerAfterHrs: 16, enabled: true },
  { level: 4, label: 'Level 4', notifyRole: 'Platform Administrator',  emailEnabled: true,  smsEnabled: true,  pushEnabled: true,  inAppEnabled: true,  triggerAfterHrs: 24, enabled: true },
  { level: 5, label: 'Level 5', notifyRole: 'Super Administrator',     emailEnabled: true,  smsEnabled: true,  pushEnabled: true,  inAppEnabled: true,  triggerAfterHrs: 48, enabled: false },
];

export function getEscalationRules(): EscalationLevel[] {
  return load<EscalationLevel[]>(KEYS.ESCALATION_RULES, DEFAULT_ESCALATION);
}

export function saveEscalationRules(rules: EscalationLevel[], user = 'Admin'): void {
  save(KEYS.ESCALATION_RULES, rules);
  addSLAAuditEntry({ user, module: 'Escalation Rules', action: 'Updated', field: 'Escalation Levels', previousValue: '', newValue: JSON.stringify(rules) });
}

// ─── Business Calendar ────────────────────────────────────────────────────────
export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'National' | 'Regional' | 'Custom';
}

export interface BusinessCalendar {
  timezone: string;
  workingDays: string[];
  workStartTime: string;
  workEndTime: string;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  shiftTimings: string;
  holidays: Holiday[];
  weekendRule: 'Saturday-Sunday' | 'Sunday Only' | 'Custom';
}

const DEFAULT_CALENDAR: BusinessCalendar = {
  timezone: 'Asia/Kolkata',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  workStartTime: '09:00',
  workEndTime: '18:00',
  lunchBreakStart: '13:00',
  lunchBreakEnd: '14:00',
  shiftTimings: 'Single Shift (9 AM - 6 PM)',
  weekendRule: 'Sunday Only',
  holidays: [
    { id: 'h-1', date: '2026-01-26', name: 'Republic Day',       type: 'National' },
    { id: 'h-2', date: '2026-08-15', name: 'Independence Day',   type: 'National' },
    { id: 'h-3', date: '2026-10-02', name: 'Gandhi Jayanti',     type: 'National' },
    { id: 'h-4', date: '2026-10-24', name: 'Dussehra',           type: 'Regional' },
    { id: 'h-5', date: '2026-11-12', name: 'Diwali',             type: 'Regional' },
    { id: 'h-6', date: '2026-12-25', name: 'Christmas',          type: 'National' },
  ],
};

export function getBusinessCalendar(): BusinessCalendar {
  return load<BusinessCalendar>(KEYS.BUSINESS_CAL, DEFAULT_CALENDAR);
}

export function saveBusinessCalendar(calendar: BusinessCalendar, user = 'Admin'): void {
  save(KEYS.BUSINESS_CAL, calendar);
  addSLAAuditEntry({ user, module: 'Business Calendar', action: 'Updated', field: 'Calendar Settings', previousValue: '', newValue: JSON.stringify(calendar) });
}
