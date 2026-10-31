import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getServiceRequests } from "@/lib/serviceRequestsStore";
import { getPortalUsersByClient } from "@/lib/portalUserStore";
import { serviceRequestBelongsToPortalUser } from "@/lib/serviceRequestAccess";
import AMCRequestDetailPage from "./AMCRequestDetailPage";
import RepairServiceDetailPage from "./RepairServiceDetailPage";
import RecycleDisposalDetailPage from "./RecycleDisposalDetailPage";
import RentalServiceDetailPage from "./RentalServiceDetailPage";
import RegularPurchaseDetailPage from "./RegularPurchaseDetailPage";

export default function MyRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { user, isClientPortalUser } = useAuth();
  const storedRequest = getServiceRequests().find(request => request.id === requestId);
  if (isClientPortalUser && (
    !user
    || !storedRequest
    || !serviceRequestBelongsToPortalUser(
      storedRequest,
      user,
      user.clientId ? getPortalUsersByClient(user.clientId) : [],
    )
  )) {
    return (
      <div className="min-h-screen bg-white p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <h1 className="text-lg font-semibold text-gray-900">Service request not found</h1>
            <button
              type="button"
              onClick={() => navigate("/portal/my-services")}
              className="mt-4 text-sm font-medium text-blue-600 hover:underline"
            >
              Back to My Services
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }
  const requestType = storedRequest?.requestType.trim().toLowerCase();

  // Use the saved request type for new records whose IDs use a shared prefix.
  if (requestType === "amc" || requestId?.startsWith("AMC-")) {
    return <AMCRequestDetailPage requestId={requestId} />;
  }
  if (requestType === "repair service" || requestId?.startsWith("REP-")) {
    return <RepairServiceDetailPage requestId={requestId} />;
  }
  if (requestType === "recycle / disposal" || requestId?.startsWith("REC-")) {
    return <RecycleDisposalDetailPage requestId={requestId} />;
  }
  if (requestType === "rental service" || requestId?.startsWith("REN-")) {
    return <RentalServiceDetailPage requestId={requestId} />;
  }
  if (requestType === "regular purchase" || requestId?.startsWith("PUR-")) {
    return <RegularPurchaseDetailPage requestId={requestId} />;
  }

  // Unknown type → placeholder
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-transparent border-b border-gray-200/70">
        <div className="w-full px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(window.location.pathname.startsWith("/portal/") ? "/portal/my-services" : "/my-services")}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-xs text-gray-500">Services / My Requests / {requestId}</p>
            <h1 className="text-2xl font-bold text-gray-900">{requestId}</h1>
          </div>
        </div>
      </div>
      <div className="w-full px-4 py-6">
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-2">
              <span className="text-2xl">📋</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-700">Request Details</h2>
            <p className="text-sm text-gray-400">
              Details for <span className="font-medium text-gray-600">{requestId}</span> will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
