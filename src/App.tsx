/// <reference path="./types/react-query-shim.d.ts" />

// ─── Types & constants merged from App.tsx ───────────────────────────────────

export type CartItem = {
  id: number;
  name: string;
  image: string;
  specs: string[];
  moq: number;
  priceNum: number;
  quantity: number;
};

export type CheckoutData = {
  selectedAddressId: number;
  deliveryInstructions: string;
  billingSameAsDelivery: boolean;
  orderNotes: string;
  paymentMethod: string;
  // Card
  cardNumber: string;
  cardName: string;
  expiryDate: string;
  cvv: string;
  saveCard: boolean;
  // Net Banking
  netBankingBank: string;
  // UPI
  upiId: string;
  // Wallets
  selectedWallet: string;
  walletMobile: string;
  // NEFT / RTGS
  neftAccountName: string;
  neftAccountNumber: string;
  neftIfscCode: string;
  neftBankName: string;
  // BNPL
  bnplTenure: string;
  // Promo
  promoCode: string;
};

export const DEFAULT_CHECKOUT: CheckoutData = {
  selectedAddressId: 1,
  deliveryInstructions: "",
  billingSameAsDelivery: true,
  orderNotes: "",
  paymentMethod: "card",
  cardNumber: "",
  cardName: "",
  expiryDate: "",
  cvv: "",
  saveCard: true,
  netBankingBank: "",
  upiId: "",
  selectedWallet: "",
  walletMobile: "",
  neftAccountName: "",
  neftAccountNumber: "",
  neftIfscCode: "",
  neftBankName: "",
  bnplTenure: "3",
  promoCode: "",
};

// ─────────────────────────────────────────────────────────────────────────────

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { EnhancedAuthProvider } from "@/contexts/EnhancedAuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { CartProvider } from "@/contexts/CartContext";
import { OrdersProvider } from "@/contexts/OrdersContext";
import { MyOrdersProvider } from "@/contexts/MyOrdersContext";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ConfigProvider } from "@/contexts/ConfigContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { PageMetaProvider } from "@/contexts/PageMetaContext";
import AppLayout from "@/components/layout/AppLayout";
import PageErrorBoundary from "@/components/shared/PageErrorBoundary";
import ActionConfirmationGuard from "@/components/shared/ActionConfirmationGuard";
import { Suspense, lazy, useEffect, useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { PreferencesProvider } from "./store/preferencesStore";
import { I18nProvider } from "./i18n/I18nProvider";
import { getPortalModuleForPath, hasPortalPermission } from "@/lib/portalUserStore";
import { observeNativeSelects } from "@/lib/alphabeticalDropdowns";

const queryClient = new QueryClient();

// ─── FloatingCartButton merged from App.tsx ───────────────────────────────────
function FloatingCartButton({ count }: { count: number }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/cart")}
      className="fixed top-5 right-6 z-50 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-full shadow-lg transition-colors"
    >
      <div className="relative">
        <ShoppingCart size={20} />
        {count > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>
      <span className="text-sm font-semibold">Cart</span>
    </button>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Guards admin-only routes: redirects client portal users to /portal/dashboard */
function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isClientPortalUser } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isClientPortalUser) return <Navigate to="/portal/dashboard" replace />;
  return <>{children}</>;
}

/** Guards client portal routes: redirects NIDO admins to /dashboard */
function ClientPortalRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isClientPortalUser, isImpersonating, user } = useAuth();
  const location = useLocation();
  const [, refreshPermissions] = useState(0);
  useEffect(() => {
    const refresh = () => refreshPermissions(value => value + 1);
    window.addEventListener("nidoPortalRolesUpdated", refresh);
    window.addEventListener("nidoPortalUsersUpdated", refresh);
    return () => {
      window.removeEventListener("nidoPortalRolesUpdated", refresh);
      window.removeEventListener("nidoPortalUsersUpdated", refresh);
    };
  }, []);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isClientPortalUser && !isImpersonating) return <Navigate to="/dashboard" replace />;
  const adminOnly = /\/(users|roles|addresses)(\/|$)/.test(location.pathname);
  const portalModule = getPortalModuleForPath(location.pathname);
  const permitted = isImpersonating || (
    !!user?.clientId &&
    (adminOnly
      ? user.userType === "client_admin"
      : !portalModule || hasPortalPermission(user.clientId, user.role ?? "", portalModule, "view"))
  );
  if (!permitted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-sm text-gray-500">Your portal role does not have permission to view this page.</p>
        </div>
      </div>
    );
  }
  const readOnlyBlocked = isImpersonating && (
    location.pathname.includes("/shop/cart") ||
    location.pathname.includes("/checkout") ||
    location.pathname.includes("/order-confirmation") ||
    location.pathname.endsWith("/users") ||
    location.pathname.endsWith("/roles") ||
    location.pathname.endsWith("/addresses") ||
    location.pathname.endsWith("/profile")
  );
  return (
    <>
      <ImpersonationBanner />
      {readOnlyBlocked ? (
        <div className="min-h-[70vh] flex items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <h1 className="text-base font-semibold text-amber-900">View-only impersonation</h1>
            <p className="mt-2 text-sm text-amber-800">This action is disabled while using client-user impersonation.</p>
          </div>
        </div>
      ) : children}
    </>
  );
}

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const ClientPortalDashboard = lazy(() => import("@/pages/ClientPortalDashboard"));
const ClientPortalReportsPage = lazy(() => import("@/pages/ClientPortalReportsPage"));
const ClientPortalApprovalsPage = lazy(() => import("@/pages/ClientPortalApprovalsPage"));
const ClientApprovalWorkflowsPage = lazy(() => import("@/pages/ClientApprovalWorkflowsPage"));
const ClientPortalUsersPage = lazy(() => import("@/pages/ClientPortalUsersPage"));
const ClientPortalRolesPage = lazy(() => import("@/pages/ClientPortalRolesPage"));
const ClientPortalAddressesPage = lazy(() => import("@/pages/ClientPortalAddressesPage"));
const MainDashboard = lazy(() => import("@/pages/MainDashboard"));
const VendorDashboard = lazy(() => import("@/pages/VendorDashboard"));
const SLAOverview = lazy(() => import("@/pages/SLAOverview"));
const MyRenewalsPage = lazy(() => import("@/pages/MyRenewalsPage"));
const MyOrderPage = lazy(() => import("@/pages/MyOrderPage"));
const OrderDetailsPage = lazy(() => import("@/pages/OrderDetailsPage"));
const VendorOrderDetailPage = lazy(() => import("@/pages/VendorOrderDetailPage"));
const LocationsPage = lazy(() => import("@/pages/LocationsPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const OrderStatusesPage = lazy(() => import("@/pages/OrderStatusesPage"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const ApprovalWorkflowsPage = lazy(
  () => import("@/pages/ApprovalWorkflowsPage"),
);
const VendorCategoriesPage = lazy(() => import("@/pages/VendorCategoriesPage"));
const VendorsPage = lazy(() => import("@/pages/VendorsPage"));
const VendorDetailPage = lazy(() => import("@/pages/VendorDetailPage"));
const VendorOrdersPage = lazy(() => import("@/pages/VendorOrdersPage"));
const VendorOnboardingPage = lazy(() => import("@/pages/VendorOnboardingPage"));
const VendorEditPage = lazy(() => import("@/pages/VendorEditPage"));
const AddVendorProductsPage = lazy(() => import("@/pages/AddVendorProductsPage"));
const ClientsPage = lazy(() => import("@/pages/ClientsPage"));
const AddClient = lazy(() => import("@/pages/AddClient"));
const ClientDetailPage = lazy(() => import("@/pages/ClientDetailPageRedesigned"));
const ClientContractsPage = lazy(() => import("@/pages/ClientContractsPage"));
const ContractDetailsPage = lazy(() => import("@/pages/ContractDetailsPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const UserProfilePage = lazy(() => import("@/pages/UserProfilePage"));
const ConfigurationPage = lazy(() => import("@/pages/ConfigurationPage"));
const ConfigurationHubPage = lazy(() => import("@/pages/ConfigurationHubPage"));
const AutoAssignmentPage = lazy(() => import("@/pages/AutoAssignmentPage"));
const EmailConfigurationPage = lazy(() => import("@/pages/EmailConfigurationPage"));
const EmailTemplatesPage = lazy(() => import("@/pages/EmailTemplatesPage"));
const EmailLogsPage = lazy(() => import("@/pages/EmailLogsPage"));
const GeneralSettingsTab = lazy(
  () => import("@/components/configuration/GeneralSettingsTab"),
);
const UserRolesTab = lazy(
  () => import("@/components/configuration/UserRolesTab"),
);
const IntegrationsPage = lazy(() => import("@/pages/IntegrationsPage"));
const SupportPage = lazy(() => import("@/pages/SupportPage"));
const SupportTicketsPage = lazy(() => import("@/pages/SupportTicketsPage"));
const CreateSupportTicketPage = lazy(() => import("@/pages/CreateSupportTicketPage"));
const TicketDetailPage = lazy(() => import("@/pages/TicketDetailPage"));
const CreateChildTicketPage = lazy(() => import("@/pages/CreateChildTicketPage"));
const ChildTicketDetailPage = lazy(() => import("@/pages/ChildTicketDetailPage"));
const MyRequestsPage = lazy(() => import("@/pages/MyRequestsPage"));
const MyRequestDetailPage = lazy(() => import("@/pages/MyRequestDetailPage"));
const EditServiceRequestPage = lazy(() => import("@/pages/EditServiceRequestPage"));
const ServicesPage = lazy(() => import("@/pages/ServicesPage"));
const ClientServicesPage = lazy(() => import("@/pages/ClientServicesPage"));
const NewAMCRequestPage = lazy(() => import("@/pages/NewAMCRequestPage"));
const NewRepairServicePage = lazy(() => import("@/pages/NewRepairServicePage"));
const NewRecycleDisposalPage = lazy(() => import("@/pages/NewRecycleDisposalPage"));
const NewRentalServicePage = lazy(() => import("@/pages/NewRentalServicePage"));
const NewRegularPurchasePage = lazy(() => import("@/pages/NewRegularPurchasePage"));
const InvoicePage = lazy(() => import("@/pages/InvoicePage"));
const InvoiceDetails = lazy(() => import("@/pages/InvoiceDetails"));
const InvoiceFormPage = lazy(() => import("@/pages/InvoiceFormPage"));
const SalesQuotesPage = lazy(() => import("@/pages/SalesQuotesPage"));
const ArchivedQuotesPage = lazy(() => import("@/pages/ArchivedQuotesPage"));
const SalesQuoteDetailPage = lazy(() => import("@/pages/SalesQuoteDetailPage"));
const SalesOrdersPage = lazy(() => import("@/pages/SalesOrdersPage"));
const SalesOrderDetails = lazy(() => import("@/pages/SalesOrderDetails"));
const SalesOrderFormPage = lazy(() => import("@/pages/SalesOrderFormPage"));
const ExpensesPage = lazy(() => import("@/pages/ExpensesPage"));
const NewExpensePage = lazy(() => import("@/pages/NewExpensePage"));
const HomePage = lazy(() => import("@/pages/HomePage"));
const CategoriesPage = lazy(() => import("@/pages/CategoriesPage"));
const CartPage = lazy(() => import("@/pages/CartPage"));
const OrganizationsPage = lazy(() => import("@/pages/OrganizationsPage"));
const ArchivePage = lazy(() => import("@/pages/ArchivePage"));
const TicketTrackingPage = lazy(() => import("@/pages/TicketTrackingPage"));
const PricingDiscountsPage = lazy(() => import("@/pages/PricingDiscountsPage"));
const MasterCataloguePage = lazy(() => import("@/pages/MasterCataloguePage"));
const StockManagementPage = lazy(() => import("@/pages/StockManagementPage"));
const AddMasterCatalogueItemWrapper = lazy(
  () => import("@/pages/AddMasterCatalogueItemWrapper"),
);
const NotFound = lazy(() => import("@/pages/NotFound"));
const SalesQuoteFormPage = lazy(() => import("@/pages/SalesQuoteFormPage"));
const RecurringInvoicesPage = lazy(
  () => import("@/pages/RecurringInvoicesPage"),
);
const RecurringInvoiceFormPage = lazy(
  () => import("@/pages/RecurringInvoiceFormPage"),
);
const DeliveryChallansPage = lazy(() => import("@/pages/DeliveryChallansPage"));
const NewDeliveryChallanPage = lazy(() => import("@/pages/NewDeliveryChallanPage"));
const DCPreviewPage = lazy(() => import("@/pages/DCPreviewPage"));
const PaymentReceiptsPage = lazy(() => import("@/pages/PaymentReceiptsPage"));
const NewPaymentReceiptPage = lazy(() => import("@/pages/NewPaymentReceiptPage"));
const CreditNotesPage = lazy(() => import("@/pages/CreditNotesPage"));
const CreditNoteFormPage = lazy(() => import("@/pages/CreditNoteFormPage"));
const EWayBillsPage = lazy(() => import("@/pages/EWayBillsPage"));
const RecurringExpensesPage = lazy(
  () => import("@/pages/RecurringExpensesPage"),
);
const PurchaseOrdersPage = lazy(() => import("@/pages/PurchaseOrdersPage"));
const BillsPage = lazy(() => import("@/pages/BillsPage"));
const RecurringBillsPage = lazy(() => import("@/pages/RecurringBillsPage"));
const PaymentsMadePage = lazy(() => import("@/pages/PaymentsMadePage"));
const VendorCreditsPage = lazy(() => import("@/pages/VendorCreditsPage"));
const DepartmentsPage = lazy(() => import("@/pages/DepartmentsPage"));
const UserInvitationPage = lazy(() => import("@/pages/UserInvitationPage"));
const AuditLogPage = lazy(() => import("@/pages/AuditLogPage"));
const ShopPage = lazy(() => import("@/pages/ShopPage"));
const ProductPreviewPage = lazy(() => import("@/pages/ProductPreviewPage"));
const ProductDetailPage = lazy(() => import("@/pages/ProductDetailPage"));
const ProductEnquiryPage = lazy(() => import("@/pages/ProductEnquiryPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const PaymentPage = lazy(() => import("@/pages/PaymentPage"));
const ReviewPage = lazy(() => import("@/pages/ReviewPage"));
const OrderConfirmationPage = lazy(
  () => import("@/pages/OrderConfirmationPage"),
);
const UserOnboardingPage = lazy(() => import("@/pages/UserOnboardingPage"));
const NidoUserProfilePage = lazy(() => import("@/pages/NidoUserProfilePage"));
const NidoUserDetailPage = lazy(() => import("@/pages/NidoUserDetailPage"));
const NidoUserEditPage = lazy(() => import("@/pages/NidoUserEditPage"));
const TaxSettingsPage = lazy(() => import("@/pages/TaxSettingsPage"));
const SLASettingsPage = lazy(() => import("@/pages/SLASettingsPage"));

function RootRedirect() {
  const { isClientPortalUser } = useAuth();
  return <Navigate to={isClientPortalUser ? "/portal/dashboard" : "/dashboard"} replace />;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      }
    >
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <PageErrorBoundary
                title="Login failed to load"
                resetKey={location.pathname}
              >
                <LoginPage />
              </PageErrorBoundary>
            )
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PageErrorBoundary
              title="Forgot password page failed to load"
              resetKey={location.pathname}
            >
              <ForgotPasswordPage />
            </PageErrorBoundary>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PageErrorBoundary
              title="Reset password page failed to load"
              resetKey={location.pathname}
            >
              <ResetPasswordPage />
            </PageErrorBoundary>
          }
        />
        <Route path="/onboarding/:token" element={<UserOnboardingPage />} />
        <Route path="/preview-product" element={<ProductPreviewPage />} />
        <Route
          path="/sales/delivery-challans/create"
          element={
            isAuthenticated ? (
              <NewDeliveryChallanPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/sales/delivery-challans/:id/preview"
          element={
            isAuthenticated ? (
              <DCPreviewPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/support/track/:ticketId"
          element={<TicketTrackingPage />}
        />
        <Route
          path="/shop/product/:productId/enquire"
          element={<ProductEnquiryPage />}
        />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <AppLayout />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<RootRedirect />} />
          <Route path="home" element={<HomePage />} />
          <Route path="categories" element={<Navigate to="/shop" replace />} />
          <Route path="dashboard" element={<MainDashboard />} />
          <Route path="dashboard/vendor" element={<VendorDashboard />} />
          <Route path="dashboard/sla" element={<SLAOverview />} />
          <Route
            path="my-profile"
            element={
              <PageErrorBoundary title="My Profile failed to load" resetKey={location.pathname}>
                <NidoUserProfilePage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="orders"
            element={
              <PageErrorBoundary
                title="Orders failed to load"
                resetKey={location.pathname}
              >
                <MyOrderPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="orders/:id"
            element={
              <PageErrorBoundary
                title="Order details failed to load"
                resetKey={location.pathname}
              >
                <OrderDetailsPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="vendor-orders/:id"
            element={
              <PageErrorBoundary
                title="Vendor order details failed to load"
                resetKey={location.pathname}
              >
                <VendorOrderDetailPage />
              </PageErrorBoundary>
            }
          />
          <Route path="vendors" element={<VendorsPage />} />
          <Route path="vendors/orders" element={<VendorOrdersPage />} />
          <Route path="vendors/categories" element={<VendorCategoriesPage />} />
          <Route path="vendors/onboarding" element={<VendorOnboardingPage />} />
          <Route path="vendors/:id/edit" element={<VendorEditPage />} />
          <Route path="vendors/:id" element={<VendorDetailPage />} />
          <Route path="vendors/:id/add-products" element={<AddVendorProductsPage />} />
          <Route
            path="procure/orders/:id"
            element={
              <PageErrorBoundary
                title="Procure order details failed to load"
                resetKey={location.pathname}
              >
                <OrderDetailsPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="clients"
            element={
              <PageErrorBoundary
                title="Clients failed to load"
                resetKey={location.pathname}
              >
                <ClientsPage />
              </PageErrorBoundary>
            }
          />
          <Route path="clients/add" element={<AddClient />} />
          <Route path="clients/:id/edit" element={<AddClient />} />
          <Route
            path="clients/:id/contracts/:contractId"
            element={
              <PageErrorBoundary
                title="Client contract failed to load"
                resetKey={location.pathname}
              >
                <ClientContractsPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="clients/:id"
            element={
              <PageErrorBoundary
                title="Client profile failed to load"
                resetKey={location.pathname}
              >
                <ClientDetailPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="clients/:id/contracts"
            element={
              <PageErrorBoundary
                title="Client contracts failed to load"
                resetKey={location.pathname}
              >
                <ClientContractsPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="contracts/:id"
            element={
              <PageErrorBoundary
                title="Contract details failed to load"
                resetKey={location.pathname}
              >
                <ContractDetailsPage />
              </PageErrorBoundary>
            }
          />
          <Route path="clients/contracts" element={<ClientsPage />} />
          <Route path="permissions" element={<Navigate to="/configuration/nido-users?tab=roles" replace />} />
          <Route
            path="users"
            element={
              <PageErrorBoundary
                title="Users failed to load"
                resetKey={location.pathname}
              >
                <UsersPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="users/management"
            element={<Navigate to="/configuration/nido-users?tab=users" replace />}
          />
          <Route
            path="configuration/nido-users/users/:userId/profile"
            element={
              <PageErrorBoundary
                title="Nido user profile failed to load"
                resetKey={location.pathname}
              >
                <NidoUserDetailPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="configuration/nido-users/users/:userId/edit"
            element={
              <PageErrorBoundary
                title="Nido user edit page failed to load"
                resetKey={location.pathname}
              >
                <NidoUserEditPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="users/roles"
            element={<Navigate to="/configuration/nido-users?tab=roles" replace />}
          />
          <Route
            path="users/departments"
            element={
              <PageErrorBoundary
                title="Departments failed to load"
                resetKey={location.pathname}
              >
                <DepartmentsPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="users/invitations"
            element={
              <PageErrorBoundary
                title="Invitations failed to load"
                resetKey={location.pathname}
              >
                <UserInvitationPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="users/audit-trail"
            element={
              <PageErrorBoundary
                title="Audit Trail failed to load"
                resetKey={location.pathname}
              >
                <AuditLogPage />
              </PageErrorBoundary>
            }
          />
          <Route path="configuration" element={<ConfigurationHubPage />} />
          <Route
            path="configuration/auto-assignment"
            element={
              <PageErrorBoundary
                title="Auto Assignment failed to load"
                resetKey={location.pathname}
              >
                <AutoAssignmentPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="configuration/general"
            element={<Navigate to="/configuration" replace />}
          />
          <Route
            path="configuration/general-settings"
            element={<GeneralSettingsTab />}
          />
          <Route path="configuration/nido-users" element={<UserRolesTab />} />
          <Route
            path="configuration/email-settings"
            element={<EmailConfigurationPage />}
          />
          <Route
            path="configuration/email-templates"
            element={<EmailTemplatesPage />}
          />
          <Route
            path="configuration/email-logs"
            element={<EmailLogsPage />}
          />
          <Route
            path="configuration/order-statuses"
            element={<OrderStatusesPage />}
          />
          <Route path="configuration/locations" element={<LocationsPage />} />
          <Route
            path="configuration/notifications"
            element={<NotificationsPage />}
          />
          <Route
            path="configuration/workflows"
            element={<ApprovalWorkflowsPage />}
          />
          <Route
            path="configuration/client-approval-workflows"
            element={<ClientApprovalWorkflowsPage />}
          />
          <Route
            path="configuration/pricing"
            element={<PricingDiscountsPage />}
          />
          <Route
            path="configuration/tax-settings"
            element={<TaxSettingsPage />}
          />
          <Route
            path="configuration/sla-settings"
            element={<SLASettingsPage />}
          />
          <Route
            path="configuration/stock-management"
            element={<StockManagementPage />}
          />
          <Route
            path="configuration/master-catalogue"
            element={<MasterCataloguePage />}
          />
          <Route
            path="configuration/master-catalogue/add"
            element={<AddMasterCatalogueItemWrapper />}
          />
          <Route
            path="configuration/master-catalogue/edit/:itemId"
            element={<AddMasterCatalogueItemWrapper />}
          />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route
            path="shop"
            element={
              <PageErrorBoundary
                title="Shop failed to load"
                resetKey={location.pathname}
              >
                <ShopPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="shop/cart"
            element={
              <PageErrorBoundary
                title="Cart failed to load"
                resetKey={location.pathname}
              >
                <CartPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="shop/product/:productId"
            element={
              <PageErrorBoundary
                title="Product detail failed to load"
                resetKey={location.pathname}
              >
                <ProductDetailPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="shop/checkout"
            element={
              <PageErrorBoundary
                title="Checkout failed to load"
                resetKey={location.pathname}
              >
                <CheckoutPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="shop/checkout/payment"
            element={
              <PageErrorBoundary
                title="Payment failed to load"
                resetKey={location.pathname}
              >
                <PaymentPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="shop/checkout/review"
            element={
              <PageErrorBoundary
                title="Review page failed to load"
                resetKey={location.pathname}
              >
                <ReviewPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="shop/order-confirmation/:orderId"
            element={
              <PageErrorBoundary
                title="Order confirmation failed to load"
                resetKey={location.pathname}
              >
                <OrderConfirmationPage />
              </PageErrorBoundary>
            }
          />
          <Route path="services" element={<ServicesPage />} />
          <Route path="services/amc/new" element={<NewAMCRequestPage />} />
         <Route path="services/repair/new" element={<NewRepairServicePage />} />
         <Route path="services/recycle/new" element={<NewRecycleDisposalPage />} />
         <Route path="services/rental/new" element={<NewRentalServicePage />} />
         <Route path="services/purchase/new" element={<NewRegularPurchasePage />} />
          <Route path="my-services" element={<MyRequestsPage />} />
           <Route path="my-services/requests/:requestId/edit" element={<EditServiceRequestPage />} />
          <Route path="my-services/requests/:requestId" element={<MyRequestDetailPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="support/tickets" element={<SupportTicketsPage />} />
          <Route path="support/create" element={<CreateSupportTicketPage />} />
          <Route path="support/ticket/:ticketId" element={<TicketDetailPage />} />
          <Route path="support/create-child-ticket/:parentNumber" element={<CreateChildTicketPage />} />
          <Route path="support/child-ticket/:childTicketId" element={<ChildTicketDetailPage />} />
          <Route
            path="transactions"
            element={<Navigate to="/sales/quotes" replace />}
          />
          <Route
            path="transactions/sales"
            element={<Navigate to="/sales/quotes" replace />}
          />
          <Route
            path="transactions/purchase"
            element={
              <PageErrorBoundary
                title="Orders failed to load"
                resetKey={location.pathname}
              >
                <MyOrderPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="transactions/purchase/recurring-expenses"
            element={<RecurringExpensesPage />}
          />
          <Route
            path="transactions/purchase/recurring-expenses/create"
            element={<RecurringExpensesPage />}
          />
          <Route
            path="transactions/purchase/recurring-expenses/:id/edit"
            element={<RecurringExpensesPage />}
          />
          <Route
            path="transactions/purchase/expenses"
            element={<ExpensesPage />}
          />
          <Route
            path="transactions/purchase/expenses/create"
            element={<NewExpensePage />}
          />
          <Route
            path="transactions/purchase/expenses/:id"
            element={<ExpensesPage />}
          />
          <Route
            path="transactions/purchase/purchase-orders"
            element={<PurchaseOrdersPage />}
          />
          <Route
            path="transactions/purchase/purchase-orders/create"
            element={<PurchaseOrdersPage />}
          />
          <Route
            path="transactions/purchase/purchase-orders/:id"
            element={<PurchaseOrdersPage />}
          />
          <Route
            path="transactions/purchase/purchase-orders/:id/edit"
            element={<PurchaseOrdersPage />}
          />
          <Route path="transactions/purchase/bills" element={<BillsPage />} />
          <Route
            path="transactions/purchase/bills/create"
            element={<BillsPage />}
          />
          <Route
            path="transactions/purchase/bills/:id"
            element={<BillsPage />}
          />
          <Route
            path="transactions/purchase/bills/:id/edit"
            element={<BillsPage />}
          />
          <Route
            path="transactions/purchase/recurring-bills"
            element={<RecurringBillsPage />}
          />
          <Route
            path="transactions/purchase/recurring-bills/create"
            element={<RecurringBillsPage />}
          />
          <Route
            path="transactions/purchase/recurring-bills/:id"
            element={<RecurringBillsPage />}
          />
          <Route
            path="transactions/purchase/payments-made"
            element={<PaymentsMadePage />}
          />
          <Route
            path="transactions/purchase/payments-made/create"
            element={<PaymentsMadePage />}
          />
          <Route
            path="transactions/purchase/payments-made/:id"
            element={<PaymentsMadePage />}
          />
          <Route
            path="transactions/purchase/vendor-credits"
            element={<VendorCreditsPage />}
          />
          <Route
            path="transactions/purchase/vendor-credits/create"
            element={<VendorCreditsPage />}
          />
          <Route
            path="transactions/purchase/vendor-credits/:id"
            element={<VendorCreditsPage />}
          />
          <Route
            path="transactions/purchase/vendor-credits/:id/edit"
            element={<VendorCreditsPage />}
          />
          <Route
            path="sales"
            element={<Navigate to="/sales/quotes" replace />}
          />
          <Route
            path="sales/quotes"
            element={
              <PageErrorBoundary
                title="Quotes failed to load"
                resetKey={location.pathname}
              >
                <SalesQuotesPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="sales/quotes/archived"
            element={
              <PageErrorBoundary
                title="Archived quotes failed to load"
                resetKey={location.pathname}
              >
                <ArchivedQuotesPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="sales/quotes/create"
            element={
              <PageErrorBoundary
                title="Quote form failed to load"
                resetKey={location.pathname}
              >
                <SalesQuoteFormPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="sales/quotes/:id"
            element={
              <PageErrorBoundary
                title="Quote details failed to load"
                resetKey={location.pathname}
              >
                <SalesQuoteDetailPage />
              </PageErrorBoundary>
            }
          />
          <Route
            path="sales/quotes/:id/edit"
            element={
              <PageErrorBoundary
                title="Quote form failed to load"
                resetKey={location.pathname}
              >
                <SalesQuoteFormPage />
              </PageErrorBoundary>
            }
          />
          <Route path="sales/orders" element={<SalesOrdersPage />} />
          <Route path="sales/orders/create" element={<SalesOrderFormPage />} />
          <Route path="sales/orders/:id/edit" element={<SalesOrderFormPage />} />
          <Route path="sales/orders/:id" element={<SalesOrderDetails />} />
          <Route
            path="sales/invoices"
            element={
              <PageErrorBoundary
                title="Invoices failed to load"
                resetKey={location.pathname}
              >
                <InvoicePage />
              </PageErrorBoundary>
            }
          />
          <Route path="sales/invoices/new" element={<InvoiceFormPage />} />
          <Route path="sales/invoices/:id/edit" element={<InvoiceFormPage />} />
          <Route
            path="sales/invoices/:id"
            element={
              <PageErrorBoundary
                title="Invoice details failed to load"
                resetKey={location.pathname}
              >
                <InvoiceDetails />
              </PageErrorBoundary>
            }
          />
          <Route
            path="sales/recurring-invoices"
            element={<RecurringInvoicesPage />}
          />
          <Route
            path="sales/recurring-invoices/create"
            element={<RecurringInvoiceFormPage />}
          />
          <Route
            path="sales/recurring-invoices/:id/edit"
            element={<RecurringInvoiceFormPage />}
          />
          <Route
            path="sales/delivery-challans"
            element={<DeliveryChallansPage />}
          />
          <Route
            path="sales/delivery-challans/:id"
            element={<DeliveryChallansPage />}
          />
          <Route
            path="sales/payment-receipts"
            element={<PaymentReceiptsPage />}
          />
          <Route
            path="sales/payment-receipts/create"
            element={<NewPaymentReceiptPage />}
          />
          <Route
            path="sales/payment-receipts/:id"
            element={<NewPaymentReceiptPage />}
          />
          <Route path="sales/credit-notes" element={<CreditNotesPage />} />
          <Route
            path="sales/credit-notes/create"
            element={<CreditNoteFormPage />}
          />
          <Route path="sales/credit-notes/:id" element={<CreditNotesPage />} />
          <Route
            path="sales/credit-notes/:id/edit"
            element={<CreditNoteFormPage />}
          />
          <Route path="sales/e-way-bills" element={<EWayBillsPage />} />
          <Route path="sales/e-way-bills/create" element={<EWayBillsPage />} />
          <Route path="sales/e-way-bills/:id" element={<EWayBillsPage />} />
          <Route
            path="invoices"
            element={<Navigate to="/sales/invoices" replace />}
          />
          <Route path="invoices/new" element={<Navigate to="/sales/invoices/new" replace />} />
          <Route path="procure/requests" element={<MyOrderPage />} />
          <Route path="procure/approvals" element={<ApprovalWorkflowsPage />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="archive" element={<ArchivePage />} />
          
          {/* Simplified sidebar routes */}
           <Route path="my-renewals" element={<MyRenewalsPage />} />
          <Route path="vendors/dashboard" element={<VendorDashboard />} />
          <Route path="roles" element={<Navigate to="/configuration/nido-users?tab=roles" replace />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="user-invitations" element={<UserInvitationPage />} />
          <Route path="audit-logs" element={<AuditLogPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="recurring-expenses" element={<RecurringExpensesPage />} />
          <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="bills" element={<BillsPage />} />
          <Route path="payments-made" element={<PaymentsMadePage />} />
          <Route path="vendor-credits" element={<VendorCreditsPage />} />
          <Route path="recurring-invoices" element={<RecurringInvoicesPage />} />
          <Route path="delivery-challans" element={<DeliveryChallansPage />} />
          <Route path="payment-receipts" element={<PaymentReceiptsPage />} />
          <Route path="credit-notes" element={<CreditNotesPage />} />
          <Route path="eway-bills" element={<EWayBillsPage />} />
          <Route path="invoices" element={<InvoicePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reports/*" element={<Navigate to="/reports" replace />} />

          {/* ── Client Portal Routes ────────────────────────────────────── */}
          {/* Portal dashboard is the same live Client Overview used by admins,
              scoped to the authenticated portal user's client. */}
          <Route
            path="portal/dashboard"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Portal dashboard failed to load" resetKey={location.pathname}>
                  <ClientDetailPage portalMode />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          {/* Shop */}
          <Route
            path="portal/catalog"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Shop failed to load" resetKey={location.pathname}>
                  <ShopPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          {/* Backwards-compatible alias for older portal shopping links. */}
          <Route
            path="portal/shop"
            element={<Navigate to="/portal/catalog" replace />}
          />
          <Route
            path="portal/shop/product/:productId"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Product detail failed to load" resetKey={location.pathname}>
                  <ProductDetailPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          {/* My Requests */}
          <Route
            path="portal/orders"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="My Requests failed to load" resetKey={location.pathname}>
                  <MyOrderPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          <Route
            path="portal/orders/:id"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Request details failed to load" resetKey={location.pathname}>
                  <OrderDetailsPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          {/* My Invoices */}
          <Route
            path="portal/invoices"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="My Invoices failed to load" resetKey={location.pathname}>
                  <InvoicePage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          {/* Services */}
          <Route
            path="portal/my-services"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="My Services failed to load" resetKey={location.pathname}>
                  <MyRequestsPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          <Route
            path="portal/my-services/requests/:requestId/edit"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Service request edit failed to load" resetKey={location.pathname}>
                  <EditServiceRequestPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          <Route
            path="portal/my-services/requests/:requestId"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Service request details failed to load" resetKey={location.pathname}>
                  <MyRequestDetailPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          <Route
            path="portal/services"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Services failed to load" resetKey={location.pathname}>
                  <ClientServicesPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          {/* Support */}
          <Route
            path="portal/support"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Support failed to load" resetKey={location.pathname}>
                  <SupportPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          {/* Contracts */}
          <Route
            path="portal/contracts"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Contracts failed to load" resetKey={location.pathname}>
                  <ClientContractsPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          {/* Approvals */}
          <Route
            path="portal/approvals"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Approvals failed to load" resetKey={location.pathname}>
                  <ClientPortalApprovalsPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          {/* Reports */}
          <Route
            path="portal/reports"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Reports failed to load" resetKey={location.pathname}>
                  <ClientPortalReportsPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          {/* My Profile */}
          <Route
            path="portal/profile"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="My Profile failed to load" resetKey={location.pathname}>
                  <UserProfilePage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          {/* Client user administration — existing pages, protected by portal auth */}
          <Route
            path="portal/users"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Portal users failed to load" resetKey={location.pathname}>
                  <ClientPortalUsersPage readOnly />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          <Route
            path="portal/roles"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Portal roles failed to load" resetKey={location.pathname}>
                  <ClientPortalRolesPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          <Route
            path="portal/addresses"
            element={
              <ClientPortalRoute>
                <PageErrorBoundary title="Portal addresses failed to load" resetKey={location.pathname}>
                  <ClientPortalAddressesPage />
                </PageErrorBoundary>
              </ClientPortalRoute>
            }
          />
          {/* Portal shopping flow */}
          <Route path="portal/shop/cart" element={<ClientPortalRoute><CartPage /></ClientPortalRoute>} />
          <Route path="portal/shop/checkout" element={<ClientPortalRoute><CheckoutPage /></ClientPortalRoute>} />
          <Route path="portal/shop/checkout/payment" element={<ClientPortalRoute><PaymentPage /></ClientPortalRoute>} />
          <Route path="portal/shop/checkout/review" element={<ClientPortalRoute><ReviewPage /></ClientPortalRoute>} />
          <Route path="portal/shop/order-confirmation/:orderId" element={<ClientPortalRoute><OrderConfirmationPage /></ClientPortalRoute>} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function AlphabeticalDropdownOrdering() {
  useEffect(() => observeNativeSelects(), []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AlphabeticalDropdownOrdering />
      <BrowserRouter>
        <ConfigProvider>
        <ThemeProvider>
          <I18nProvider>
            <PreferencesProvider>
              <NotificationProvider>
                <AuthProvider>
                  <PermissionsProvider>
                  <EnhancedAuthProvider>
                    <DataProvider>
                      <CartProvider>
                        <OrdersProvider>
                          <MyOrdersProvider>
                            <OrganizationProvider>
                              <PageMetaProvider>
                                <ActionConfirmationGuard />
                                <AppRoutes />
                              </PageMetaProvider>
                            </OrganizationProvider>
                          </MyOrdersProvider>
                        </OrdersProvider>
                      </CartProvider>
                    </DataProvider>
                  </EnhancedAuthProvider>
                  </PermissionsProvider>
                </AuthProvider>
              </NotificationProvider>
            </PreferencesProvider>
          </I18nProvider>
        </ThemeProvider>
        </ConfigProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
