#!/bin/bash

pages=(
  "SLAOverview"
  "OrdersPage"
  "OrderDetailsPage"
  "PermissionsPage"
  "LocationsPage"
  "AuditTrailPage"
  "OrderStatusesPage"
  "NotificationsPage"
  "ApprovalWorkflowsPage"
  "VendorCategoriesPage"
  "VendorsPage"
  "VendorDetailPage"
  "VendorOrdersPage"
  "VendorOnboardingPage"
  "AddVendorPage"
  "ClientsPage"
  "AddClient"
  "ClientDetailPage"
  "UsersPage"
  "UserProfilePage"
  "ConfigurationPage"
  "ConfigurationHubPage"
  "IntegrationsPage"
  "SupportPage"
  "ServicesPage"
  "NewAMCRequestPage"
  "InvoicePage"
  "InvoiceDetails"
  "SalesQuotesPage"
  "SalesQuoteDetailPage"
  "SalesOrdersPage"
  "SalesOrderDetails"
  "ExpensesPage"
  "CategoriesPage"
  "CartPage"
  "OrganizationsPage"
  "ArchivePage"
  "TicketTrackingPage"
  "PricingDiscountsPage"
  "MasterCataloguePage"
  "AddMasterCatalogueItemWrapper"
  "NotFound"
  "SalesQuoteFormPage"
  "RecurringInvoicesPage"
  "DeliveryChallansPage"
  "PaymentReceiptsPage"
  "CreditNotesPage"
  "EWayBillsPage"
  "RecurringExpensesPage"
  "PurchaseOrdersPage"
  "BillsPage"
  "RecurringBillsPage"
  "PaymentsMadePage"
  "VendorCreditsPage"
  "EnhancedUsersPage"
  "RoleTemplatesPage"
  "DepartmentsPage"
  "UserInvitationPage"
  "AuditLogPage"
  "ShopPage"
  "ProductDetailPage"
  "ProductEnquiryPage"
  "CheckoutPage"
  "OrderConfirmationPage"
  "UserOnboardingPage"
  "NidoUserProfilePage"
  "LoginPage"
)

for page in "${pages[@]}"; do
  if [ ! -f "${page}.tsx" ]; then
    cat > "${page}.tsx" << PAGEOF
export default function ${page}() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">${page}</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-gray-600 dark:text-gray-400">Content coming soon...</p>
      </div>
    </div>
  );
}
PAGEOF
    echo "Created ${page}.tsx"
  fi
done
