"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { mockDataService } from "@/lib/mockData";

export default function ClientListPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load clients from mock data
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const data = mockDataService.getClients();
        setClients(data || []);
      } catch (error) {
        console.error("[v0] Error fetching clients:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-[#1e293b]">
          Client Management
        </h1>

        <button
          onClick={() => navigate("/add-client")}
          className="bg-[#204d83] text-white px-2 h-10 rounded-lg text-sm font-medium hover:bg-[#1c4371]"
        >
          + Add Client
        </button>
      </div>

      {/* TABLE HEADER */}
      <div className="grid grid-cols-6 bg-white px-2 py-3 text-sm font-semibold text-gray-600 border rounded-t-lg">
        <div>Client ID</div>
        <div>Name</div>
        <div>Representative</div>
        <div>Email</div>
        <div>Total Spend</div>
        <div>Status</div>
      </div>

      {/* TABLE BODY */}
      <div className="bg-white border-t-0 border rounded-b-lg">
        {loading ? (
          <div className="p-6 text-center text-gray-400">Loading...</div>
        ) : clients.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-gray-400 text-sm">
            <p className="text-lg">No clients found</p>
            <p className="mt-2">Try adding a new client</p>
          </div>
        ) : (
          clients.map((client) => (
            <div
              key={client.id}
              onClick={() => navigate(`/clients/${client.id}`)}
              className="grid grid-cols-6 px-2 py-2 border-b cursor-pointer hover:bg-gray-50 text-sm"
            >
              <div className="text-blue-600 font-medium">
                {client.id}
              </div>

              <div>{client.name}</div>

              <div>{client.representative || "-"}</div>

              <div>{client.email}</div>

              <div>{client.total_spend ?? 0}</div>

              <div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    client.status === "Inactive"
                      ? "bg-red-100 text-red-600"
                      : "bg-green-100 text-green-600"
                  }`}
                >
                  {client.status || "Active"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
