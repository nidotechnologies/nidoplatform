import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getRoles,
  getUsers,
  isSystemOwner,
  NIDO_ROLES_EVENT,
  NIDO_USERS_EVENT,
  SYSTEM_OWNER_ROLE,
  type NidoUser,
  updateUser,
} from "@/lib/nidoUsersStore";
import { sanitizePhoneNumber, isValidPhoneNumber } from "@/lib/phoneValidation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cardClass = "rounded-xl border border-border bg-card shadow-sm";
const inputClass = "mt-2";
const selectClass =
  "mt-2 flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export default function NidoUserEditPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [users, setUsers] = useState<NidoUser[]>(() => getUsers());
  const [roles, setRoles] = useState(() => getRoles());
  const [error, setError] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [designation, setDesignation] = useState("");
  const [reportingManager, setReportingManager] = useState("");
  const [department, setDepartment] = useState("");
  const [dateOfJoining, setDateOfJoining] = useState("");
  const [status, setStatus] = useState<NidoUser["status"]>("Active");

  const selectedUser = users.find((candidate) => candidate.id === userId);

  useEffect(() => {
    const refresh = () => {
      setUsers(getUsers());
      setRoles(getRoles());
    };
    window.addEventListener(NIDO_USERS_EVENT, refresh);
    window.addEventListener(NIDO_ROLES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(NIDO_USERS_EVENT, refresh);
      window.removeEventListener(NIDO_ROLES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    setEmployeeId(selectedUser.employeeId ?? "");
    setName(selectedUser.name ?? "");
    setEmail(selectedUser.email ?? "");
    setPhone(selectedUser.phone ?? "");
    setPassword("");
    setRole(selectedUser.role ?? "");
    setJobTitle(selectedUser.jobTitle ?? "");
    setDesignation(selectedUser.designation ?? "");
    setReportingManager(selectedUser.reportingManager ?? "");
    setDepartment(selectedUser.department ?? "");
    setDateOfJoining(selectedUser.dateOfJoining ?? selectedUser.createdAt?.slice(0, 10) ?? "");
    setStatus(selectedUser.status ?? "Active");
    setError("");
  }, [selectedUser]);

  const goToProfile = () => {
    navigate(`/configuration/nido-users/users/${encodeURIComponent(userId ?? "")}/profile`);
  };

  const handleSubmit = () => {
    if (!selectedUser) return;
    if (isSystemOwner(selectedUser)) {
      setError("The System Owner account is protected and cannot be edited.");
      return;
    }
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!role) {
      setError("Select a role for this user.");
      return;
    }
    if (role === SYSTEM_OWNER_ROLE) {
      setError("The System Owner role is reserved.");
      return;
    }
    if (phone && !isValidPhoneNumber(phone)) {
      setError("Phone number must contain exactly 10 digits.");
      return;
    }
    const duplicate = users.some(
      (candidate) =>
        candidate.id !== selectedUser.id &&
        candidate.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (duplicate) {
      setError("Email already in use.");
      return;
    }

    updateUser(selectedUser.id, {
      employeeId: employeeId.trim(),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password: password.trim() || selectedUser.password,
      role,
      jobTitle: jobTitle.trim(),
      designation: designation.trim() || jobTitle.trim(),
      reportingManager: reportingManager.trim(),
      department: department.trim(),
      dateOfJoining: dateOfJoining || selectedUser.dateOfJoining || selectedUser.createdAt,
      status,
      forcePasswordChange: selectedUser.forcePasswordChange ?? false,
    });
    toast.success("User updated", {
      description: `${name.trim()}'s details have been saved.`,
    });
    goToProfile();
  };

  if (!selectedUser) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className={`${cardClass} max-w-md p-8 text-center`}>
          <h1 className="text-h2">User not found</h1>
          <p className="mt-2 text-body-sm text-muted-foreground">
            This employee may have been removed from NIDO Users.
          </p>
          <Button className="mt-5" onClick={() => navigate("/configuration/nido-users?tab=users")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-[960px] space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goToProfile} aria-label="Back to user profile">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-h1">Edit User</h1>
            <p className="mt-1 text-body-sm text-muted-foreground">
              Update this user&apos;s details. Leave the password blank to keep the current password.
            </p>
          </div>
        </div>

        <section className={`${cardClass} p-5 sm:p-6`}>
          <h2 className="text-h3 mb-5">User Information</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Jane Doe" />
            </div>
            <div>
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="jane@nidotech.com" />
            </div>
            <div>
              <Label>Password <span className="text-xs text-muted-foreground">(blank = keep current)</span></Label>
              <Input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Leave blank to keep current" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input className={inputClass} type="tel" inputMode="numeric" maxLength={10} value={phone} onChange={(event) => setPhone(sanitizePhoneNumber(event.target.value))} placeholder="10-digit phone number" />
            </div>
            <div>
              <Label>Employee ID</Label>
              <Input className={inputClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="EMP-001" />
            </div>
            <div>
              <Label>Role <span className="text-red-500">*</span></Label>
              <select className={selectClass} value={role} onChange={(event) => setRole(event.target.value)}>
                {!role && <option value="">Select a role</option>}
                {roles.filter((item) => item.status === "Active" && item.name !== SYSTEM_OWNER_ROLE).map((item) => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Job Title</Label>
              <Input className={inputClass} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="e.g. Procurement Manager" />
            </div>
            <div>
              <Label>Designation</Label>
              <Input className={inputClass} value={designation} onChange={(event) => setDesignation(event.target.value)} placeholder="e.g. Senior Manager" />
            </div>
            <div>
              <Label>Reporting Manager</Label>
              <Input className={inputClass} value={reportingManager} onChange={(event) => setReportingManager(event.target.value)} placeholder="e.g. John Smith" />
            </div>
            <div>
              <Label>Department</Label>
              <Input className={inputClass} value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="e.g. Procurement" />
            </div>
            <div>
              <Label>Date of Joining</Label>
              <Input className={inputClass} type="date" value={dateOfJoining} onChange={(event) => setDateOfJoining(event.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value as NidoUser["status"])}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
            <div>
              <Label>Last Login <span className="text-xs text-muted-foreground">(system-managed)</span></Label>
              <Input className={inputClass} value={selectedUser.lastLogin || "Never"} disabled />
            </div>
          </div>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-5">
            <Button variant="outline" onClick={goToProfile}>Cancel</Button>
            <Button onClick={handleSubmit}><Save className="mr-2 h-4 w-4" /> Save Changes</Button>
          </div>
        </section>
      </div>
    </div>
  );
}