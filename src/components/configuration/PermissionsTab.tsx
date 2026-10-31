import NidoUsersPage from "./UserRolesTab";

/**
 * Compatibility wrapper for older configuration imports.
 * There is one permission editor in the platform: Nido Users → Roles →
 * Permissions. Keeping this wrapper prevents legacy callers from rendering a
 * non-persistent, disconnected permissions matrix.
 */
export default function PermissionsTab() {
  return <NidoUsersPage />;
}