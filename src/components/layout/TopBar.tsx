import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ArrowLeft, ChevronRight, Home, FileText, LayoutGrid, X, Command } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useConfig } from '@/contexts/ConfigContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { getPlatformModuleForPath } from '@/lib/platformModuleCatalog';
import { searchGlobalPlatform, type GlobalSearchResult } from '@/lib/globalSearch';
import SLANotificationPopup from '@/components/shared/SLANotificationPopup';

// Route to label mapping for breadcrumbs
const routeLabels: Record<string, string> = {
  'dashboard': 'Dashboard',
  'catalog': 'Shop',
  'shop': 'Shop',
  'services': 'Services',
  'support': 'Support',
  'clients': 'Clients',
  'vendors': 'Vendors',
  'orders': 'Orders',
  'reports': 'Reports',
  'expenses': 'Expenses',
  'invoices': 'Invoices',
  'bills': 'Bills',
  'payment-receipts': 'Payment Receipts',
  'payments-made': 'Payments Made',
  'purchase-orders': 'Purchase Orders',
  'vendor-credits': 'Vendor Credits',
  'recurring-invoices': 'Recurring Invoices',
  'recurring-expenses': 'Recurring Expenses',
  'delivery-challans': 'Delivery Challans',
  'credit-notes': 'Credit Notes',
  'eway-bills': 'e-Way Bills',
  'departments': 'Departments',
  'roles': 'Roles',
  'user-invitations': 'Invitations',
  'audit-logs': 'Audit Logs',
  'my-renewals': 'My Renewals',
  'configuration': 'Configuration',
  'auto-assignment': 'Auto Assignment',
  'categories': 'Categories',
  'onboarding': 'Onboarding',
  'add': 'Add New',
  'contracts': 'Contracts',
  'dashboard/vendor': 'Vendor Dashboard',
  'dashboard/sla': 'SLA Overview',
};

function generateBreadcrumbs(pathname: string) {
  // Drop generic wrapper segments ('app' for admin routes, 'portal' for
  // client portal routes) so breadcrumbs read as plain page names.
  const isPortal = pathname.startsWith('/portal/');
  const routePrefix = isPortal ? '/portal' : '';
  const segments = pathname.split('/').filter(s => s && s !== 'app' && s !== 'portal');
  const breadcrumbs: Array<{ label: string; path: string; isActive: boolean }> = [];

  // Add home
  breadcrumbs.push({
    label: 'Home',
    path: isPortal ? '/portal/dashboard' : '/dashboard',
    isActive: segments.length === 0,
  });

  // Build breadcrumb trail
  let cumulativePath = '';
  const isShopProductPath = segments[0] === 'shop' && segments[1] === 'product';
  const isNidoUserProfilePath =
    segments[0] === 'configuration' &&
    segments[1] === 'nido-users' &&
    segments[2] === 'users' &&
    segments[4] === 'profile';
  segments.forEach((segment, index) => {
    cumulativePath += `/${segment}`;
    // The employee profile already identifies the employee in its header.
    // Keep the higher-level NIDO Users breadcrumb, but hide the generic
    // "Users" and employee-id segments from the global path.
    if (isNidoUserProfilePath && (index === 2 || index === 3)) return;
    // Shop product detail pages already identify the item with its product
    // code. Omit the generic "Product" segment so the breadcrumb reads
    // Shop → product code instead of linking to the non-existent /shop/product
    // page.
    if (isShopProductPath && index === 1) return;
    const isActive = index === segments.length - 1;
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

    // `vendor-orders/:id` is the vendor PO detail route, but there is no
    // `/vendor-orders` list route — the actual list page lives at
    // `/vendors/orders`. Point the breadcrumb there instead of a 404.
    let linkPath = segment === 'vendor-orders'
      ? '/vendors/orders'
      : `${routePrefix}${cumulativePath}`;

    // The portal calls its catalog "Shop", while the shopping cart and
    // checkout live under /portal/shop/*. Keep the breadcrumb's Shop link on
    // the actual catalog route instead of sending portal users to /shop.
    if (isPortal && segment === 'shop') {
      linkPath = '/portal/catalog';
    }

    breadcrumbs.push({
      label,
      path: linkPath,
      isActive,
    });
  });

  return breadcrumbs;
}

export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isClientPortalUser } = useAuth();
  const { config } = useConfig();
  const { hasRoutePermission, isSuperAdmin } = usePermissions();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [now, setNow] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  // Read localization settings from ConfigContext so the clock reacts to a
  // saved General Settings change without requiring a page refresh. The
  // timezone values are stored as "IANA name (label)", so Intl receives only
  // the valid IANA timezone portion.
  const timeZone = config.localization.timezone.split(' ')[0];
  const timeFormat = config.localization.timeFormat;
  const formattedDate = now.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone,
  });
  const formattedTime = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: timeFormat !== '24h',
    timeZone,
  });

  const allBreadcrumbs = generateBreadcrumbs(location.pathname);
  // Client portal users should never see a link back to the owner/admin
  // dashboard, so the leading "Home" crumb is dropped entirely for them.
  const breadcrumbs = isClientPortalUser ? allBreadcrumbs.slice(1) : allBreadcrumbs;

  const handleLogout = () => {
    console.log('[v0] User logging out');
    logout();
    navigate('/login', { replace: true });
  };

  const canViewPath = (path: string) => {
    if (isSuperAdmin) return true;
    const module = getPlatformModuleForPath(path);
    return !module || hasRoutePermission(module.key, module.legacyKey, 'view');
  };

  const searchResults = useMemo<GlobalSearchResult[]>(() => {
    if (isClientPortalUser) return [];
    return searchGlobalPlatform(searchQuery).filter(result => canViewPath(result.path));
  }, [isClientPortalUser, searchQuery, isSuperAdmin, hasRoutePermission]);

  const openSearchResult = (result: GlobalSearchResult) => {
    setSearchQuery('');
    setSearchFocused(false);
    navigate(result.path);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setSearchFocused(false);
      return;
    }
    if (event.key === 'Enter' && searchResults[0]) {
      event.preventDefault();
      openSearchResult(searchResults[0]);
    }
  };

  return (
    <div className="relative z-20 bg-transparent">
      {/* Top section - Search bar and actions */}
      <div className="relative z-10 h-16 px-2 md:px-2 flex items-center justify-between gap-2 bg-background border-b border-border shadow-[0_2px_6px_-2px_rgba(15,23,42,0.10)]">
        {/* Left: Back & Search */}
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors lg:hidden"
          >
            <ArrowLeft size={20} />
          </button>
          {!isClientPortalUser && <div className="relative flex-1 min-w-0 max-w-2xl flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2.5">
            <Search size={18} className="text-muted-foreground" />
            <input
              type="text"
              ref={searchInputRef}
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={handleSearchKeyDown}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
              placeholder="Search pages, clients, vendors, orders..."
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1 min-w-0"
              aria-label="Search anything in NIDO"
              aria-expanded={searchFocused && Boolean(searchQuery.trim())}
            />
            {!searchQuery && (
              <span className="hidden sm:flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground" title="Focus search">
                <Command size={10} />K
              </span>
            )}
            {searchQuery && (
              <button
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => setSearchQuery('')}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
            {searchFocused && searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl border border-border bg-background p-2 shadow-xl">
                {searchResults.length > 0 ? (
                  <div className="space-y-1">
                    {searchResults.map(result => (
                      <button
                        type="button"
                        key={result.id}
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => openSearchResult(result)}
                        className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
                      >
                        <span className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">
                          {result.type === 'page' ? <LayoutGrid size={14} /> : <FileText size={14} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{result.title}</span>
                          <span className="block truncate text-xs capitalize text-muted-foreground">{result.subtitle}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                    No matches found. Try a name, ID, SKU, email, status, or keyword.
                  </p>
                )}
              </div>
            )}
          </div>}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* SLA alerts are internal to the owner platform. */}
          {!isClientPortalUser && <SLANotificationPopup />}

          {/* Live Date & Time */}
          <div className="flex items-center gap-3 pl-4 border-l border-border">
            <div className="text-right">
              <p className="text-base font-bold text-foreground tabular-nums tracking-wide">{formattedTime}</p>
              <p className="text-sm font-medium text-muted-foreground">{formattedDate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb section */}
      <div className="h-10 px-2 md:px-2 flex items-center gap-2 bg-transparent">
        {breadcrumbs.map((crumb, index) => (
          <div key={`${crumb.path}-${index}`} className="flex items-center gap-2">
            {index === 0 && !isClientPortalUser ? (
              <button
                onClick={() => navigate(crumb.path)}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="Go to Dashboard"
              >
                <Home size={16} />
              </button>
            ) : index === 0 ? (
              <button
                onClick={() => navigate(crumb.path)}
                className={`text-sm px-2 py-1 rounded transition-colors ${
                  crumb.isActive
                    ? 'text-primary font-medium bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {crumb.label}
              </button>
            ) : (
              <>
                <ChevronRight size={16} className="text-muted-foreground" />
                <button
                  onClick={() => navigate(crumb.path)}
                  className={`text-sm px-2 py-1 rounded transition-colors ${
                    crumb.isActive
                      ? 'text-primary font-medium bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {crumb.label}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
