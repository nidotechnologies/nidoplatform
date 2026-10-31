import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Search,
  Settings,
  Plus,
  ExternalLink,
  RefreshCw,
  Trash2,
  Pencil,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  status: "connected" | "not_connected" | "manage";
  lastSync?: string;
  icon: string;
  popular: boolean;
}

const DEFAULT_INTEGRATIONS: Integration[] = [
  {
    id: "sap",
    name: "SAP",
    category: "ERP System",
    description: "Enterprise resource planning integration",
    status: "connected",
    lastSync: "1h ago",
    icon: "🏢",
    popular: true,
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "Accounting",
    description: "Accounting and bookkeeping sync",
    status: "connected",
    lastSync: "2h ago",
    icon: "📊",
    popular: true,
  },
  {
    id: "razorpay",
    name: "Razorpay",
    category: "Payment Gateway",
    description: "Online payment processing",
    status: "not_connected",
    icon: "💳",
    popular: true,
  },
  {
    id: "paypal",
    name: "PayPal",
    category: "Payment Gateway",
    description: "International payment gateway",
    status: "connected",
    lastSync: "30m ago",
    icon: "💰",
    popular: true,
  },
  {
    id: "zoho-crm",
    name: "Zoho CRM",
    category: "CRM Software",
    description: "Customer relationship management",
    status: "not_connected",
    icon: "👥",
    popular: true,
  },
  {
    id: "zoho-books",
    name: "Zoho Books",
    category: "Accounting",
    description: "Cloud accounting software",
    status: "connected",
    lastSync: "25m ago",
    icon: "📚",
    popular: true,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    category: "SMS & WhatsApp",
    description: "Business messaging and notifications",
    status: "manage",
    lastSync: "5m ago",
    icon: "💬",
    popular: true,
  },
  {
    id: "google-drive",
    name: "Google Drive",
    category: "Cloud Storage",
    description: "File storage and sharing",
    status: "connected",
    lastSync: "10m ago",
    icon: "☁️",
    popular: true,
  },
  {
    id: "oracle",
    name: "Oracle NetSuite",
    category: "ERP System",
    description: "Cloud ERP solution",
    status: "not_connected",
    icon: "🏛️",
    popular: false,
  },
  {
    id: "dynamics",
    name: "Microsoft Dynamics 365",
    category: "ERP System",
    description: "Business applications suite",
    status: "not_connected",
    icon: "🔷",
    popular: false,
  },
  {
    id: "salesforce",
    name: "Salesforce",
    category: "CRM Software",
    description: "CRM and sales platform",
    status: "connected",
    lastSync: "11h ago",
    icon: "☁️",
    popular: false,
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Payment Gateway",
    description: "Payment processing for internet businesses",
    status: "connected",
    lastSync: "2h ago",
    icon: "💳",
    popular: false,
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "Communication",
    description: "Cloud communications platform",
    status: "connected",
    lastSync: "1h ago",
    icon: "📞",
    popular: false,
  },
  {
    id: "dropbox",
    name: "Dropbox",
    category: "Cloud Storage",
    description: "File hosting and storage",
    status: "not_connected",
    lastSync: "1h ago",
    icon: "📦",
    popular: false,
  },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState(DEFAULT_INTEGRATIONS);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showConfig, setShowConfig] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("Popular");
  const [newIntegration, setNewIntegration] = useState({
    name: "",
    category: "",
    apiKey: "",
    webhookUrl: "",
  });

  // Get unique categories
  const categories = ["Popular", ...new Set(integrations.map((i) => i.category))];
  
  // Filter integrations by category
  const getIntegrationsByCategory = (category: string) => {
    if (category === "Popular") return integrations.filter((i) => i.popular);
    return integrations.filter((i) => i.category === category);
  };

  const displayedIntegrations = getIntegrationsByCategory(activeCategory).filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase()),
  );

  const handleConnect = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: "connected" as const, lastSync: "Just now" }
          : i,
      ),
    );
    toast({
      title: "Connected",
      description: `Integration connected successfully.`,
    });
  };

  const handleDisconnect = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: "not_connected" as const, lastSync: undefined }
          : i,
      ),
    );
    toast({ title: "Disconnected" });
  };

  const handleSync = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, lastSync: "Just now" } : i)),
    );
    toast({ title: "Synced", description: "Data synchronized successfully." });
  };

  const handleAddIntegration = () => {
    const newInt: Integration = {
      id: `custom-${Date.now()}`,
      name: newIntegration.name,
      category: newIntegration.category,
      description: "Custom integration",
      status: "not_connected",
      icon: "🔌",
      popular: false,
    };
    setIntegrations((prev) => [...prev, newInt]);
    setShowAdd(false);
    setNewIntegration({ name: "", category: "", apiKey: "", webhookUrl: "" });
    toast({ title: "Integration Added" });
  };

  const getStatusButton = (integration: Integration) => {
    switch (integration.status) {
      case "connected":
        return (
          <Badge
            className="bg-success text-success-foreground cursor-pointer"
            onClick={() => setShowConfig(integration.id)}
          >
            ● Connected
          </Badge>
        );
      case "not_connected":
        return (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => handleConnect(integration.id)}
          >
            Connect
          </Button>
        );
      case "manage":
        return (
          <Badge
            className="bg-warning text-warning-foreground cursor-pointer"
            onClick={() => setShowConfig(integration.id)}
          >
            ● Manage
          </Badge>
        );
    }
  };

  const configIntegration = integrations.find((i) => i.id === showConfig);

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full px-2 sm:px-4 md:px-6 py-2 md:py-6">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Integrations Marketplace</h1>
          <p className="text-slate-600">Connect with 50+ business tools and services</p>
        </div>

        {/* Search & Add Button */}
        <div className="mb-8 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Search integrations..."
              className="pl-12 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            onClick={() => setShowAdd(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-2 rounded-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Integration
          </Button>
        </div>

        {/* Category Tabs */}
        <div className="mb-8 border-b border-slate-200">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-5 py-2.5 rounded-t-lg font-medium transition-all whitespace-nowrap ${
                  activeCategory === category
                    ? "bg-white text-blue-600 border-b-2 border-blue-600"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Integrations Grid */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayedIntegrations.map((integration) => (
              <Card
                key={integration.id}
                className="hover:shadow-lg transition-all duration-200 border border-slate-200 rounded-xl overflow-hidden"
              >
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-4xl">{integration.icon}</div>
                      {getStatusButton(integration)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{integration.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">{integration.category}</p>
                    </div>
                    {integration.lastSync && (
                      <p className="text-xs text-slate-400">Last sync: {integration.lastSync}</p>
                    )}
                    {integration.status === "connected" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => setShowConfig(integration.id)}
                      >
                        <Settings className="h-3 w-3 mr-2" />
                        Configure
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {/* Add Card */}
            <Card
              className="border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
              onClick={() => setShowAdd(true)}
            >
              <CardContent className="p-6 flex items-center justify-center h-full min-h-[200px]">
                <div className="text-center">
                  <Plus className="h-8 w-8 text-slate-400mb-2" />
                  <p className="text-sm text-slate-600 font-medium">Add Integration</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Add Integration Dialog */}
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Integration</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Integration Name</Label>
                <Input
                  value={newIntegration.name}
                  onChange={(e) =>
                    setNewIntegration((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Custom ERP"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  value={newIntegration.category}
                  onChange={(e) =>
                    setNewIntegration((p) => ({
                      ...p,
                      category: e.target.value,
                    }))
                  }
                  placeholder="e.g. ERP System"
                />
              </div>
              <div>
                <Label>API Key</Label>
                <Input
                  value={newIntegration.apiKey}
                  onChange={(e) =>
                    setNewIntegration((p) => ({ ...p, apiKey: e.target.value }))
                  }
                  placeholder="Enter API key"
                  type="password"
                />
              </div>
              <div>
                <Label>Webhook URL</Label>
                <Input
                  value={newIntegration.webhookUrl}
                  onChange={(e) =>
                    setNewIntegration((p) => ({
                      ...p,
                      webhookUrl: e.target.value,
                    }))
                  }
                  placeholder="https://..."
                />
              </div>
              <Button
                onClick={handleAddIntegration}
                className="w-full"
                disabled={!newIntegration.name}
              >
                Add Integration
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Config Dialog */}
        <Dialog open={!!showConfig} onOpenChange={() => setShowConfig(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure: {configIntegration?.name}</DialogTitle>
            </DialogHeader>
            {configIntegration && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{configIntegration.icon}</span>
                  <div>
                    <p className="font-semibold">{configIntegration.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {configIntegration.category}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Auto-Sync</Label>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Sync Frequency</Label>
                    <span className="text-sm text-muted-foreground">
                      Every 15 minutes
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Last Synced</Label>
                    <span className="text-sm text-muted-foreground">
                      {configIntegration.lastSync || "Never"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Status</Label>
                    <Badge
                      className={
                        configIntegration.status === "connected"
                          ? "bg-success text-success-foreground"
                          : "bg-muted"
                      }
                    >
                      {configIntegration.status === "connected"
                        ? "Active"
                        : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      handleSync(configIntegration.id);
                      setShowConfig(null);
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" /> Sync Now
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleDisconnect(configIntegration.id);
                      setShowConfig(null);
                    }}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
