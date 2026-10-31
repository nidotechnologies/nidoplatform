/**
 * Frontend-only import for the user list supplied in the attached reference
 * document. This writes only to the existing localStorage users collection.
 */
import userSource from "../../attached_assets/Pasted--Full-Name-Email-Employee-1787337315920_1787337315921.txt?raw";

const USERS_KEY = "nido_config_users";
const IMPORT_KEY = "nido_users_imported_reference";
const IMPORT_VERSION = "users-reference-v1";

function parseEmail(value: string): string {
  return value.match(/\[([^\]]+)\]\(mailto:([^)]+)\)/)?.[2] || value;
}

function parseUsers() {
  return userSource
    .split(/\r?\n/)
    .filter(line => /^\s*\|\s*\d+\s*\|/.test(line))
    .map(line => {
      const columns = line.split("|").slice(1, -1).map(column => column.trim());
      if (columns.length < 9) return null;

      const [, fullName, emailValue, employeeId, role, jobTitle, designation, department, status] = columns;
      const email = parseEmail(emailValue);
      const id = `imported-user-${employeeId.toLowerCase()}`;
      return {
        id,
        employeeId,
        name: fullName,
        email,
        password: "",
        phone: "",
        role,
        jobTitle,
        designation,
        department,
        status: status === "Active" ? "Active" : "Inactive",
        createdAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
        forcePasswordChange: true,
        locked: false,
        failedLoginAttempts: 0,
        loginHistory: [],
      };
    })
    .filter(Boolean);
}

export function importFrontendUsers(): void {
  if (typeof window === "undefined" || localStorage.getItem(IMPORT_KEY) === IMPORT_VERSION) return;

  const importedUsers = parseUsers();
  let existingUsers: any[] = [];
  try {
    existingUsers = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    existingUsers = [];
  }

  const existingIds = new Set(existingUsers.map(user => user.id));
  const existingEmails = new Set(existingUsers.map(user => String(user.email || "").toLowerCase()));
  const mergedUsers = [
    ...existingUsers,
    ...importedUsers.filter(user =>
      !existingIds.has(user.id) && !existingEmails.has(user.email.toLowerCase()),
    ),
  ];

  localStorage.setItem(USERS_KEY, JSON.stringify(mergedUsers));
  localStorage.setItem(IMPORT_KEY, IMPORT_VERSION);
}
