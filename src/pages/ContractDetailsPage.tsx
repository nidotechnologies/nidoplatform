import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Edit, Trash2, Calendar, DollarSign, FileText, Users } from "lucide-react";

interface Contract {
  id: string;
  title: string;
  type: string;
  status: "Active" | "Expired" | "Pending" | "Renewal";
  startDate: string;
  endDate: string;
  value: string;
  vendor: string;
  description: string;
  paymentTerms: string;
  keyContacts: Array<{ name: string; role: string; email: string }>;
  documents: Array<{ name: string; size: string; date: string }>;
}

const CONTRACTS: Record<string, Contract> = {
  "CTR-001": {
    id: "CTR-001",
    title: "Software License Agreement",
    type: "License Agreement",
    status: "Active",
    startDate: "Jan 15, 2024",
    endDate: "Jan 14, 2025",
    value: "₹5,00,000",
    vendor: "Tech Solutions Inc",
    description: "Annual software licensing contract for enterprise tools including development and collaboration software.",
    paymentTerms: "Net 30 - Annual upfront payment",
    keyContacts: [
      { name: "John Smith", role: "Contract Manager", email: "john@techsolutions.com" },
      { name: "Sarah Johnson", role: "Technical Lead", email: "sarah@techsolutions.com" }
    ],
    documents: [
      { name: "License_Agreement_2024.pdf", size: "2.4 MB", date: "Jan 15, 2024" },
      { name: "Addendum_Q4_2024.pdf", size: "1.2 MB", date: "Oct 1, 2024" }
    ]
  },
  "CTR-002": {
    id: "CTR-002",
    title: "Maintenance & Support Services",
    type: "Service Agreement",
    status: "Active",
    startDate: "Mar 1, 2024",
    endDate: "Feb 28, 2025",
    value: "₹2,50,000",
    vendor: "InfoTech Services",
    description: "24/7 maintenance and technical support for all IT infrastructure.",
    paymentTerms: "Monthly - ₹20,833.33",
    keyContacts: [
      { name: "Mike Davis", role: "Support Director", email: "mike@infotech.com" }
    ],
    documents: [
      { name: "Service_SLA.pdf", size: "890 KB", date: "Mar 1, 2024" }
    ]
  }
};

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-800",
  Expired: "bg-red-100 text-red-800",
  Pending: "bg-yellow-100 text-yellow-800",
  Renewal: "bg-blue-100 text-blue-800"
};

export default function ContractDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const contract = id ? CONTRACTS[id] : null;

  if (!contract) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Contract Not Found</h2>
          <p className="text-gray-600 mb-6">The contract you&apos;re looking for doesn&apos;t exist.</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-transparent border-b border-gray-200/70">
        <div className="px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{contract.title}</h1>
              <p className="text-sm text-gray-500">Contract ID: {contract.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Edit className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="w-5 h-5 text-red-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contract Information</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Type</p>
                  <p className="text-gray-900 mt-1">{contract.type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Status</p>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[contract.status]}`}>
                      {contract.status}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Vendor</p>
                  <p className="text-gray-900 mt-1">{contract.vendor}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Value</p>
                  <p className="text-gray-900 mt-1 font-semibold">{contract.value}</p>
                </div>
              </div>
            </div>

            {/* Duration */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Duration</h3>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Start Date</p>
                  <p className="text-gray-900 mt-1">{contract.startDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">End Date</p>
                  <p className="text-gray-900 mt-1">{contract.endDate}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Description</h3>
              <p className="text-gray-700">{contract.description}</p>
            </div>

            {/* Payment Terms */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Payment Terms</h3>
              </div>
              <p className="text-gray-900">{contract.paymentTerms}</p>
            </div>

            {/* Documents */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
              </div>
              <div className="space-y-3">
                {contract.documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-500">{doc.size} • {doc.date}</p>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-blue-600" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Key Contacts */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Key Contacts</h3>
              </div>
              <div className="space-y-4">
                {contract.keyContacts.map((contact, idx) => (
                  <div key={idx} className="pb-4 border-b last:border-b-0 last:pb-0">
                    <p className="font-medium text-gray-900">{contact.name}</p>
                    <p className="text-xs text-gray-600 mt-1">{contact.role}</p>
                    <a href={`mailto:${contact.email}`} className="text-xs text-blue-600 hover:underline mt-2 inline-block">
                      {contact.email}
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full px-2 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                  Edit Contract
                </button>
                <button className="w-full px-2 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Renew Contract
                </button>
                <button className="w-full px-2 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors">
                  Terminate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
