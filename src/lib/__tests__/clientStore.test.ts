import { beforeEach, describe, expect, it } from "vitest";
import {
  addClient,
  getArchivedClients,
  getClients,
  saveArchivedClients,
  saveClients,
  type StoredClient,
} from "@/lib/clientStore";

const userA = { id: "user-a", email: "a@example.com" };
const userB = { id: "user-b", email: "b@example.com" };

const addedClient: StoredClient = {
  id: "CL-00001",
  name: "Added for User A",
  category: "IT Hardware",
  tier: "Standard",
  status: "active",
};

function signIn(user: typeof userA) {
  localStorage.setItem("nido_user", JSON.stringify(user));
}

describe("clientStore account-scoped persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the five seed clients visible for every account", () => {
    signIn(userA);
    expect(getClients()).toHaveLength(5);

    localStorage.removeItem("nido_user");
    signIn(userB);
    expect(getClients()).toHaveLength(5);
  });

  it("keeps added clients with their owner after switching accounts", () => {
    signIn(userA);
    addClient(addedClient);
    expect(getClients().some(client => client.id === addedClient.id)).toBe(true);

    localStorage.removeItem("nido_user");
    signIn(userB);
    expect(getClients().some(client => client.id === addedClient.id)).toBe(false);

    localStorage.removeItem("nido_user");
    signIn(userA);
    expect(getClients().some(client => client.id === addedClient.id)).toBe(true);
  });

  it("does not allow saving or archiving to remove the shared seed clients", () => {
    signIn(userA);
    saveClients([]);
    expect(getClients()).toHaveLength(5);

    saveArchivedClients([getClients()[0] as StoredClient & { archivedOn: string }]);
    expect(getClients()).toHaveLength(5);
    expect(getArchivedClients()).toHaveLength(0);
  });
});