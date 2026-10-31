export type ClientTier = "Premium" | "Medium" | "Standard";
export type AssignmentStatus = "Assigned" | "In Progress" | "Completed" | "Unassigned";
export type AssignmentMethod = "Round Robin" | "Fallback" | "Manual reassignment" | "Unassigned";

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  role: string;
  status: "Active" | "Inactive";
}

export interface TierConfig {
  tier: ClientTier;
  enabled: boolean;
  eligibleEmployeeIds: string[];
  sequence: string[];
  rotationPosition: number;
  fallback: string | null;
}

export interface MockClient {
  id: string;
  name: string;
  tier: ClientTier;
}

export interface Reassignment {
  previousEmployeeId: string | null;
  newEmployeeId: string;
  reason: string;
  reassignedAt: string;
}

export interface HistoryItem {
  orderId: string;
  clientId: string;
  clientName: string;
  tier: ClientTier;
  assignedEmployeeId: string | null;
  method: AssignmentMethod;
  assignedAt: string;
  status: AssignmentStatus;
  reassignments: Reassignment[];
}

export interface DemoState {
  enabled: boolean;
  tiers: Record<ClientTier, TierConfig>;
  history: HistoryItem[];
}

export interface AssignmentPreview {
  sequence: number;
  employeeId: string | null;
  method: "Round Robin" | "Fallback" | "Unassigned";
}

export const DEMO_STORAGE_KEY = "nido_auto_assignment_demo_v1";
export const CLIENT_TIERS: ClientTier[] = ["Premium", "Medium", "Standard"];

export const EMPLOYEES: Employee[] = [
  { id: "employee-a", employeeId: "EMP-00001", name: "Employee A", department: "Order Operations", role: "Assignment Specialist", status: "Active" },
  { id: "employee-b", employeeId: "EMP-00002", name: "Employee B", department: "Client Services", role: "Client Operations Lead", status: "Active" },
  { id: "employee-c", employeeId: "EMP-00003", name: "Employee C", department: "Order Operations", role: "Order Coordinator", status: "Active" },
  { id: "employee-d", employeeId: "EMP-00004", name: "Employee D", department: "Client Services", role: "Assignment Specialist", status: "Inactive" },
];

export const MOCK_CLIENTS: MockClient[] = [
  { id: "client-northstar", name: "Northstar Clinics", tier: "Premium" },
  { id: "client-cedar", name: "Cedar & Vale Group", tier: "Premium" },
  { id: "client-meridian", name: "Meridian Works", tier: "Medium" },
  { id: "client-harbour", name: "Harbourline Hotels", tier: "Medium" },
  { id: "client-fieldnote", name: "Fieldnote Learning", tier: "Standard" },
  { id: "client-kinetic", name: "Kinetic Supply Co.", tier: "Standard" },
];

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const initialHistory: HistoryItem[] = [
  { orderId: "AA-DEMO-01038", clientId: "client-northstar", clientName: "Northstar Clinics", tier: "Premium", assignedEmployeeId: "employee-a", method: "Round Robin", assignedAt: ago(34), status: "In Progress", reassignments: [] },
  { orderId: "AA-DEMO-01037", clientId: "client-meridian", clientName: "Meridian Works", tier: "Medium", assignedEmployeeId: "employee-c", method: "Manual reassignment", assignedAt: ago(82), status: "Assigned", reassignments: [{ previousEmployeeId: "employee-b", newEmployeeId: "employee-c", reason: "Balanced the regional workload", reassignedAt: ago(82) }] },
  { orderId: "AA-DEMO-01036", clientId: "client-fieldnote", clientName: "Fieldnote Learning", tier: "Standard", assignedEmployeeId: "employee-a", method: "Round Robin", assignedAt: ago(145), status: "Completed", reassignments: [] },
  { orderId: "AA-DEMO-01035", clientId: "client-cedar", clientName: "Cedar & Vale Group", tier: "Premium", assignedEmployeeId: "employee-b", method: "Round Robin", assignedAt: ago(211), status: "Assigned", reassignments: [] },
  { orderId: "AA-DEMO-01034", clientId: "client-harbour", clientName: "Harbourline Hotels", tier: "Medium", assignedEmployeeId: "employee-c", method: "Fallback", assignedAt: ago(295), status: "In Progress", reassignments: [] },
  { orderId: "AA-DEMO-01033", clientId: "client-kinetic", clientName: "Kinetic Supply Co.", tier: "Standard", assignedEmployeeId: null, method: "Unassigned", assignedAt: ago(370), status: "Unassigned", reassignments: [] },
  { orderId: "AA-DEMO-01032", clientId: "client-northstar", clientName: "Northstar Clinics", tier: "Premium", assignedEmployeeId: "employee-c", method: "Round Robin", assignedAt: ago(460), status: "Completed", reassignments: [] },
  { orderId: "AA-DEMO-01031", clientId: "client-meridian", clientName: "Meridian Works", tier: "Medium", assignedEmployeeId: "employee-b", method: "Round Robin", assignedAt: ago(525), status: "Assigned", reassignments: [] },
];

function mapSeedEmployeeId(employeeId: string | null, employees: Employee[]): string | null {
  if (!employeeId) return null;
  if (employees.some((employee) => employee.id === employeeId)) return employeeId;
  const seedIndex = EMPLOYEES.findIndex((employee) => employee.id === employeeId);
  const activeEmployees = employees.filter((employee) => employee.status === "Active");
  return seedIndex >= 0 && activeEmployees.length
    ? activeEmployees[seedIndex % activeEmployees.length].id
    : null;
}

function resolveStoredEmployeeId(employeeId: unknown, employees: Employee[]): string | null {
  if (typeof employeeId !== "string") return null;
  return employees.some((employee) => employee.id === employeeId)
    ? employeeId
    : mapSeedEmployeeId(employeeId, employees);
}

export function createDefaultDemoState(employees: Employee[] = EMPLOYEES): DemoState {
  const makeTier = (
    tier: ClientTier,
    employeeIds: string[],
    rotationPosition: number,
    fallback: string | null,
  ): TierConfig => {
    const sequence = [...new Set(employeeIds
      .map((employeeId) => mapSeedEmployeeId(employeeId, employees))
      .filter((employeeId): employeeId is string => employeeId !== null))];
    return {
      tier,
      enabled: true,
      eligibleEmployeeIds: [...sequence],
      sequence,
      rotationPosition: sequence.length ? rotationPosition % sequence.length : 0,
      fallback: mapSeedEmployeeId(fallback, employees),
    };
  };
  const tiers = {
    Premium: makeTier("Premium", ["employee-a", "employee-b", "employee-c"], 1, "employee-b"),
    Medium: makeTier("Medium", ["employee-b", "employee-c", "employee-d"], 0, "employee-c"),
    Standard: makeTier("Standard", ["employee-a", "employee-c", "employee-d"], 2, null),
  };
  const history = initialHistory.map((item) => {
    const assignedEmployeeId = mapSeedEmployeeId(item.assignedEmployeeId, employees);
    return {
      ...item,
      assignedEmployeeId,
      method: assignedEmployeeId ? item.method : "Unassigned" as const,
      status: assignedEmployeeId ? item.status : "Unassigned" as const,
      reassignments: item.reassignments.flatMap((entry) => {
        const newEmployeeId = mapSeedEmployeeId(entry.newEmployeeId, employees);
        return newEmployeeId
          ? [{ ...entry, previousEmployeeId: mapSeedEmployeeId(entry.previousEmployeeId, employees), newEmployeeId }]
          : [];
      }),
    };
  });
  return { enabled: true, tiers, history };
}

function normalizeTier(
  raw: Partial<TierConfig> | undefined,
  tier: ClientTier,
  fallback: TierConfig,
  employees: Employee[],
): TierConfig {
  const eligible = Array.isArray(raw?.eligibleEmployeeIds)
    ? [...new Set(raw.eligibleEmployeeIds
      .map((id) => resolveStoredEmployeeId(id, employees))
      .filter((id): id is string => id !== null))]
    : [...fallback.eligibleEmployeeIds];
  const proposedSequence = Array.isArray(raw?.sequence) ? raw.sequence : fallback.sequence;
  const sequence = [...new Set(proposedSequence
    .map((id) => resolveStoredEmployeeId(id, employees))
    .filter((id): id is string => id !== null && eligible.includes(id)))];
  eligible.forEach((id) => { if (!sequence.includes(id)) sequence.push(id); });
  const position = Number.isFinite(raw?.rotationPosition) ? Number(raw?.rotationPosition) : fallback.rotationPosition;
  return {
    tier,
    enabled: raw?.enabled !== false,
    eligibleEmployeeIds: eligible,
    sequence,
    rotationPosition: sequence.length ? ((position % sequence.length) + sequence.length) % sequence.length : 0,
    fallback: resolveStoredEmployeeId(raw?.fallback, employees),
  };
}

function normalizeHistory(raw: unknown, defaults: HistoryItem[], employees: Employee[]): HistoryItem[] {
  if (!Array.isArray(raw)) return defaults;
  const validStatuses: AssignmentStatus[] = ["Assigned", "In Progress", "Completed", "Unassigned"];
  const validMethods: AssignmentMethod[] = ["Round Robin", "Fallback", "Manual reassignment", "Unassigned"];
  return raw.filter((item): item is HistoryItem => !!item && typeof item.orderId === "string").map((item) => {
    const assignedEmployeeId = resolveStoredEmployeeId(item.assignedEmployeeId, employees);
    const reassignments = Array.isArray(item.reassignments)
      ? item.reassignments.flatMap((entry: Reassignment) => {
        const newEmployeeId = resolveStoredEmployeeId(entry?.newEmployeeId, employees);
        if (!entry || typeof entry.reason !== "string" || !newEmployeeId) return [];
        const previousEmployeeId = resolveStoredEmployeeId(entry.previousEmployeeId, employees);
        return [{ ...entry, previousEmployeeId, newEmployeeId }];
      })
      : [];
    return {
      orderId: String(item.orderId),
      clientId: String(item.clientId || ""),
      clientName: String(item.clientName || "Demo client"),
      tier: CLIENT_TIERS.includes(item.tier) ? item.tier : "Standard",
      assignedEmployeeId,
      method: assignedEmployeeId && validMethods.includes(item.method) ? item.method : "Unassigned",
      assignedAt: typeof item.assignedAt === "string" ? item.assignedAt : new Date().toISOString(),
      status: assignedEmployeeId && validStatuses.includes(item.status) ? item.status : "Unassigned",
      reassignments,
    };
  });
}

export function loadDemoState(employees: Employee[] = EMPLOYEES): { state: DemoState; error: string | null } {
  const defaults = createDefaultDemoState(employees);
  if (typeof window === "undefined") return { state: defaults, error: null };
  try {
    const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!stored) return { state: defaults, error: null };
    const raw = JSON.parse(stored) as Partial<DemoState>;
    const tiers = {} as Record<ClientTier, TierConfig>;
    CLIENT_TIERS.forEach((tier) => { tiers[tier] = normalizeTier(raw.tiers?.[tier], tier, defaults.tiers[tier], employees); });
    return {
      state: {
        enabled: raw.enabled !== false,
        tiers,
        history: normalizeHistory(raw.history, defaults.history, employees),
      },
      error: null,
    };
  } catch {
    return { state: defaults, error: "Saved demo settings could not be read. Defaults are shown; your browser storage may be unavailable." };
  }
}

export function reconcileDemoState(state: DemoState, employees: Employee[]): DemoState {
  const defaults = createDefaultDemoState(employees);
  const tiers = {} as Record<ClientTier, TierConfig>;
  CLIENT_TIERS.forEach((tier) => {
    tiers[tier] = normalizeTier(state.tiers[tier], tier, defaults.tiers[tier], employees);
  });
  return {
    enabled: state.enabled,
    tiers,
    history: normalizeHistory(state.history, defaults.history, employees),
  };
}

export function persistDemoState(state: DemoState): void {
  window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
}

export function getEmployee(employeeId: string | null | undefined, employees: Employee[] = EMPLOYEES): Employee | undefined {
  return employees.find((employee) => employee.id === employeeId);
}

export function getNextAssignments(config: TierConfig, count = 5, employees: Employee[] = EMPLOYEES): AssignmentPreview[] {
  const rows: AssignmentPreview[] = [];
  const sequence = config.sequence.filter((id) => config.eligibleEmployeeIds.includes(id));
  let cursor = sequence.length ? config.rotationPosition % sequence.length : 0;
  for (let index = 0; index < count; index += 1) {
    let selectedIndex = -1;
    if (sequence.length) {
      for (let offset = 0; offset < sequence.length; offset += 1) {
        const candidateIndex = (cursor + offset) % sequence.length;
        const employee = getEmployee(sequence[candidateIndex], employees);
        if (employee?.status === "Active") {
          selectedIndex = candidateIndex;
          break;
        }
      }
    }
    if (selectedIndex >= 0) {
      rows.push({ sequence: index + 1, employeeId: sequence[selectedIndex], method: "Round Robin" });
      cursor = (selectedIndex + 1) % sequence.length;
    } else if (getEmployee(config.fallback, employees)?.status === "Active") {
      rows.push({ sequence: index + 1, employeeId: config.fallback, method: "Fallback" });
    } else {
      rows.push({ sequence: index + 1, employeeId: null, method: "Unassigned" });
    }
  }
  return rows;
}

export function simulateNext(
  state: DemoState,
  client: MockClient,
  employees: Employee[] = EMPLOYEES,
): { nextState: DemoState; item: HistoryItem; message: string } {
  const config = state.tiers[client.tier];
  const orderNumber = state.history.reduce((highest, item) => {
    const match = item.orderId.match(/(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 1030) + 1;
  const active = state.enabled && config.enabled
    ? getNextAssignments(config, 1, employees)[0]
    : { sequence: 1, employeeId: null, method: "Unassigned" as const };
  const assignedEmployeeId = active.employeeId;
  const item: HistoryItem = {
    orderId: `AA-DEMO-${String(orderNumber).padStart(5, "0")}`,
    clientId: client.id,
    clientName: client.name,
    tier: client.tier,
    assignedEmployeeId,
    method: assignedEmployeeId ? active.method : "Unassigned",
    assignedAt: new Date().toISOString(),
    status: assignedEmployeeId ? "Assigned" : "Unassigned",
    reassignments: [],
  };
  let nextTier = config;
  if (assignedEmployeeId && active.method === "Round Robin" && config.sequence.length) {
    const assignedIndex = config.sequence.indexOf(assignedEmployeeId);
    nextTier = { ...config, rotationPosition: (assignedIndex + 1) % config.sequence.length };
  }
  const nextState: DemoState = {
    ...state,
    tiers: { ...state.tiers, [client.tier]: nextTier },
    history: [item, ...state.history],
  };
  const message = assignedEmployeeId
    ? `${item.orderId} assigned to ${getEmployee(assignedEmployeeId, employees)?.name} for ${client.tier} (${active.method.toLowerCase()}).`
    : `${item.orderId} was not assigned. Auto assignment is disabled or no active eligible employee is available; the rotation did not advance.`;
  return { nextState, item, message };
}

export function createReassignment(
  state: DemoState,
  orderId: string,
  employeeId: string,
  reason: string,
  employees: Employee[] = EMPLOYEES,
): DemoState {
  if (getEmployee(employeeId, employees)?.status !== "Active") return state;
  const item = state.history.find((entry) => entry.orderId === orderId);
  if (!item) return state;
  const now = new Date().toISOString();
  return {
    ...state,
    history: state.history.map((entry) => entry.orderId !== orderId ? entry : {
      ...entry,
      assignedEmployeeId: employeeId,
      method: "Manual reassignment",
      status: entry.status === "Unassigned" ? "Assigned" : entry.status,
      reassignments: [...entry.reassignments, {
        previousEmployeeId: entry.assignedEmployeeId,
        newEmployeeId: employeeId,
        reason: reason.trim(),
        reassignedAt: now,
      }],
    }),
  };
}
