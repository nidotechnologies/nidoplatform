import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgConfig } from '@/contexts/ConfigContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { getPlatformModuleKey } from '@/lib/platformModuleCatalog';
import { hasPortalPermission } from '@/lib/portalUserStore';
import { getClientForPortal } from '@/lib/clientStore';
import {
  LayoutDashboard, ShoppingCart, Wrench, Headphones, Users,
  TrendingUp, Package, DollarSign, Settings, ChevronDown,
  ChevronRight, ChevronLeft, Menu, X, Zap, List,
  ClipboardList, Tags, ShoppingBag, Gauge, FileText, Receipt,
  Repeat, Truck, FileMinus, FileCheck, Wallet, CreditCard,
  Banknote, LogOut,
  Bell, User, KeyRound, ShieldAlert,
} from 'lucide-react';

const RECOVERY_CODE_ROLES = ['System Owner', 'System Admin'];

interface NavItem {
  label: string;
  icon?: React.ReactNode;
  path?: string;
  children?: NavItem[];
  /** Permission module key — if set, only shown when user has view permission. */
  moduleKey?: string;
}

// ── Admin (NIDO) navigation ───────────────────────────────────────────────────
const adminNavigationItems: NavItem[] = [
  { label: 'Dashboard',     icon: <LayoutDashboard size={20} />, path: '/dashboard',   moduleKey: 'dashboard' },
  { label: 'Shop',          icon: <ShoppingCart size={20} />,    path: '/shop',        moduleKey: 'shop' },
  { label: 'Services',      icon: <Wrench size={20} />,          path: '/services',    moduleKey: 'services' },
  { label: 'Support',       icon: <Headphones size={20} />,      path: '/support',     moduleKey: 'support' },
  { label: 'Clients',       icon: <Users size={20} />,           path: '/clients',     moduleKey: 'clients' },
  {
    label: 'Vendors',
    icon: <Package size={20} />,
    children: [
      { label: 'Vendor List',      icon: <List size={16} />,         path: '/vendors',           moduleKey: 'vendors' },
      { label: 'Vendor Orders',    icon: <ClipboardList size={16} />,path: '/vendors/orders',    moduleKey: 'vendors' },
      { label: 'Vendor Dashboard', icon: <LayoutDashboard size={16}/>,path: '/vendors/dashboard',moduleKey: 'vendors' },
      { label: 'Categories',       icon: <Tags size={16} />,         path: '/vendors/categories',moduleKey: 'vendors' },
    ],
  },
  {
    label: 'MY Requests',
    icon: <TrendingUp size={20} />,
    children: [
      { label: 'My Orders',   icon: <ShoppingBag size={16} />, path: '/orders',      moduleKey: 'orders' },
      { label: 'My Services', icon: <Wrench size={16} />,      path: '/my-services', moduleKey: 'services' },
      { label: 'My Renewals',  icon: <Repeat size={16} />,      path: '/my-renewals', moduleKey: 'orders' },
    ],
  },
  { label: 'Reports', icon: <TrendingUp size={20} />, path: '/reports', moduleKey: 'reports' },
  {
    label: 'Transactions',
    icon: <DollarSign size={20} />,
    children: [
      {
        label: 'Sales',
        icon: <TrendingUp size={16} />,
        children: [
          { label: 'Quotes',             icon: <FileText size={16} />,   path: '/sales/quotes',        moduleKey: 'sales' },
          { label: 'Sales Orders',       icon: <ClipboardList size={16}/>,path: '/sales/orders',       moduleKey: 'sales' },
          { label: 'Invoices',           icon: <Receipt size={16} />,    path: '/invoices',            moduleKey: 'invoices' },
          { label: 'Recurring Invoices', icon: <Repeat size={16} />,     path: '/recurring-invoices',  moduleKey: 'invoices' },
          { label: 'Delivery Challans',  icon: <Truck size={16} />,      path: '/delivery-challans',   moduleKey: 'sales' },
          { label: 'Payment Receipts',   icon: <Receipt size={16} />,    path: '/payment-receipts',    moduleKey: 'sales' },
          { label: 'Credit Notes',       icon: <FileMinus size={16} />,  path: '/credit-notes',        moduleKey: 'sales' },
          { label: 'e-Way Bills',        icon: <FileCheck size={16} />,  path: '/eway-bills',          moduleKey: 'sales' },
        ],
      },
      {
        label: 'Purchases',
        icon: <ShoppingCart size={16} />,
        children: [
          { label: 'Expenses',           icon: <Wallet size={16} />,     path: '/expenses',            moduleKey: 'expenses' },
          { label: 'Recurring Expenses', icon: <Repeat size={16} />,     path: '/recurring-expenses',  moduleKey: 'expenses' },
          { label: 'Purchase Orders',    icon: <ClipboardList size={16}/>,path: '/purchase-orders',    moduleKey: 'purchase_orders' },
          { label: 'Bills',              icon: <FileText size={16} />,   path: '/bills',               moduleKey: 'bills' },
          { label: 'Payments Made',      icon: <CreditCard size={16} />, path: '/payments-made',       moduleKey: 'purchases' },
          { label: 'Vendor Credits',     icon: <Banknote size={16} />,   path: '/vendor-credits',      moduleKey: 'purchases' },
        ],
      },
    ],
  },
  { label: 'Configuration', icon: <Settings size={20} />, path: '/configuration', moduleKey: 'configuration' },
];

// ── Client Portal navigation ──────────────────────────────────────────────────
const clientNavigationItems: NavItem[] = [
  { label: 'Dashboard',   icon: <LayoutDashboard size={20} />, path: '/portal/dashboard', moduleKey: 'Dashboard' },
  { label: 'Shop',        icon: <ShoppingCart size={20} />,    path: '/portal/catalog', moduleKey: 'Catalog' },
  { label: 'My Requests', icon: <ClipboardList size={20} />,   path: '/portal/orders', moduleKey: 'Orders' },
  { label: 'My Invoices', icon: <Receipt size={20} />,         path: '/portal/invoices', moduleKey: 'Invoices' },
  { label: 'My Services', icon: <Wrench size={20} />,          path: '/portal/my-services', moduleKey: 'Services' },
  { label: 'Support',     icon: <Headphones size={20} />,      path: '/portal/support', moduleKey: 'Support' },
  { label: 'Contracts',   icon: <FileText size={20} />,        path: '/portal/contracts', moduleKey: 'Contracts' },
  { label: 'Approvals',   icon: <FileCheck size={20} />,       path: '/portal/approvals', moduleKey: 'Approvals' },
  { label: 'Reports',     icon: <TrendingUp size={20} />,      path: '/portal/reports', moduleKey: 'Reports' },
  { label: 'My Profile',  icon: <User size={20} />,            path: '/portal/profile', moduleKey: 'My Profile' },
];

// ── Permission-based nav filtering ────────────────────────────────────────────
function filterNavItems(
  items: NavItem[],
  canView: (key: string, legacyKey?: string) => boolean,
  superAdmin: boolean,
): NavItem[] {
  if (superAdmin) return items;

  const filtered: NavItem[] = [];
  for (const item of items) {
    if (item.children) {
      const kids = filterNavItems(item.children, canView, false);
      if (kids.length > 0) filtered.push({ ...item, children: kids });
    } else {
      const pageKey = item.path ? getPlatformModuleKey(item.path) : item.moduleKey;
      if (!item.moduleKey || canView(pageKey ?? item.moduleKey, item.moduleKey)) filtered.push(item);
    }
  }
  return filtered;
}

// ── Path helpers ───────────────────────────────────────────────────────────────
/** Strip any query string so route matching only compares the pathname portion. */
function basePath(path: string): string {
  return path.split('?')[0];
}

function collectPaths(items: NavItem[], acc: string[] = []): string[] {
  for (const item of items) {
    if (item.path) acc.push(basePath(item.path));
    if (item.children) collectPaths(item.children, acc);
  }
  return acc;
}

function findActivePath(pathname: string, items: NavItem[]): string | null {
  const allPaths = collectPaths(items);
  let best: string | null = null;
  for (const p of allPaths) {
    const matches = pathname === p || pathname.startsWith(p + '/');
    if (!matches) continue;
    if (!best || p.length > best.length) best = p;
  }
  return best;
}

function containsPath(item: NavItem, targetPath: string): boolean {
  if (item.path && basePath(item.path) === targetPath) return true;
  return !!item.children?.some(child => containsPath(child, targetPath));
}

// ── NavItem component ──────────────────────────────────────────────────────────
interface NavItemProps {
  item: NavItem;
  level?: number;
  collapsed?: boolean;
  activePath: string | null;
}

function NavItemComponent({ item, level = 0, collapsed = false, activePath }: NavItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const hasChildren = item.children && item.children.length > 0;
  const isTopLevel = level === 0;
  const isActive = !!item.path && basePath(item.path) === activePath;
  const hasActiveChild = !!hasChildren && !!activePath && item.children!.some(child => containsPath(child, activePath));

  if (hasChildren && isTopLevel && collapsed) {
    const openFlyout = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setFlyoutPos({ top: rect.top, left: rect.right + 8 });
      setFlyoutOpen(true);
    };
    return (
      <div ref={triggerRef} className="relative" onMouseEnter={openFlyout} onMouseLeave={() => setFlyoutOpen(false)}>
        <button
          className={`relative w-full flex items-center justify-center px-2 py-2.5 rounded-lg transition-all ${
            hasActiveChild ? 'text-primary bg-primary/10' : 'text-sidebar-foreground hover:bg-sidebar-accent'
          }`}
          title={item.label}
        >
          {item.icon}
          <ChevronRight size={10} className="absolute right-0.5 bottom-0.5 text-sidebar-foreground/50" />
        </button>
        {flyoutOpen && createPortal(
          <div
            className="fixed min-w-[220px] bg-background border border-border rounded-lg shadow-lg py-2 z-[100]"
            style={{ top: flyoutPos.top, left: flyoutPos.left }}
            onMouseEnter={openFlyout}
            onMouseLeave={() => setFlyoutOpen(false)}
          >
            <p className="px-3 pb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{item.label}</p>
            {item.children!.map((child, idx) => (
              <NavItemComponent key={idx} item={child} level={1} activePath={activePath} />
            ))}
          </div>,
          document.body
        )}
      </div>
    );
  }

  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            hasActiveChild ? 'text-primary bg-primary/10' : 'text-sidebar-foreground hover:bg-sidebar-accent'
          }`}
        >
          <span className="flex items-center gap-3">{item.icon}{item.label}</span>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {isOpen && (
          <div className={`space-y-0.5 ${isTopLevel ? 'pl-2' : 'pl-4'}`}>
            {item.children!.map((child, idx) => (
              <NavItemComponent key={idx} item={child} level={level + 1} activePath={activePath} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isTopLevel && collapsed) {
    return (
      <Link
        to={item.path || '#'}
        title={item.label}
        className={`flex items-center justify-center px-2 py-2.5 rounded-lg transition-all ${
          isActive ? 'text-primary bg-primary/10' : 'text-sidebar-foreground hover:bg-sidebar-accent'
        }`}
      >
        {item.icon}
      </Link>
    );
  }

  return (
    <Link
      to={item.path || '#'}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        isActive ? 'text-primary bg-primary/10' : 'text-sidebar-foreground hover:bg-sidebar-accent'
      }`}
    >
      {item.icon}{item.label}
    </Link>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const { user, logout, isClientPortalUser } = useAuth();
  const { hasPermission, hasRoutePermission, isSuperAdmin } = usePermissions();
  const org = useOrgConfig();
  const portalClient = isClientPortalUser && user?.clientId
    ? getClientForPortal(user.clientId)
    : undefined;
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Apply each tenant's portal role permissions to client navigation.
  const rawNavItems = isClientPortalUser ? clientNavigationItems : adminNavigationItems;
  const navItems = isClientPortalUser
    ? rawNavItems.filter(item =>
        !item.moduleKey ||
        hasPortalPermission(user?.clientId ?? '', user?.role ?? '', item.moduleKey, 'view')
      )
     : filterNavItems(
       rawNavItems,
       (key, legacyKey) => legacyKey
         ? hasRoutePermission(key, legacyKey, 'view')
         : hasPermission(key, 'view'),
       isSuperAdmin,
     );

  const activePath = findActivePath(location.pathname, navItems);

  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024
  );

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const effectiveCollapsed = collapsed && isDesktop;

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const handleSignOut = () => {
    setUserMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  const showRecoveryCodes = !isClientPortalUser && RECOVERY_CODE_ROLES.includes(user?.role ?? '');

  const displayName  = user?.name ?? 'Unknown User';
  const displayRole  = isClientPortalUser
    ? `${user?.clientName ?? 'Client'} — ${user?.role ?? 'User'}`
    : user?.role ?? 'Owner';
  const avatarInitial = displayName.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-40 lg:hidden p-2 rounded-lg bg-background text-foreground hover:bg-muted border border-border shadow-sm"
      >
        {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside
        data-navigation
        className={`fixed left-0 top-0 h-full bg-sidebar flex flex-col transition-all duration-300 z-30 w-64 lg:translate-x-0 shadow-[2px_0_6px_-2px_rgba(15,23,42,0.10)] ${
          effectiveCollapsed ? 'lg:w-16' : 'lg:w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className="relative shrink-0 bg-sidebar h-16 px-2 z-10 flex items-center justify-between gap-2 border-b border-sidebar-border">
          <div className="flex items-center min-w-0 flex-1 h-full py-2">
            {org.logoUrl ? (
              <div className={`h-full w-full flex items-center gap-2.5 overflow-hidden ${effectiveCollapsed ? 'justify-center' : 'justify-start'}`}>
                {effectiveCollapsed ? (
                  <div className="w-full h-full shrink-0 flex items-center justify-center overflow-hidden">
                    <img src={org.logoUrl} alt={org.displayName || 'Logo'} className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="h-full shrink-0 flex items-center overflow-hidden">
                    <img src={org.logoUrl} alt={org.displayName || 'Logo'} className="h-full max-w-full object-contain" />
                  </div>
                )}
                {!effectiveCollapsed && (() => {
                  const raw = org.displayName || 'NIDO';
                  const match = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
                  const mainName = match ? match[1].trim() : raw;
                  const subName  = match ? match[2].trim() : null;
                  return (
                    <div className="min-w-0 flex flex-col justify-center leading-none">
                      <span className="font-extrabold text-sidebar-foreground tracking-tight truncate leading-none"
                        style={{ fontSize: 'clamp(1.1rem, 1.6vw, 1.375rem)' }}>
                        {mainName}
                      </span>
                      {subName && (
                        <span className="text-[11px] font-medium text-sidebar-foreground/60 truncate mt-1">{subName}</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
                  isClientPortalUser
                    ? 'bg-gradient-to-br from-purple-500 to-purple-700'
                    : 'bg-gradient-to-br from-blue-600 to-blue-700'
                }`}>
                  <Zap size={20} className="text-white" />
                </div>
                {!effectiveCollapsed && (
                  <div className="min-w-0">
                    <h1 className="text-sm font-bold text-sidebar-foreground truncate">{org.displayName || 'NIDO'}</h1>
                    <p className="text-xs text-sidebar-foreground/60 truncate">
                      {isClientPortalUser ? 'Client Portal' : 'Procurement'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex absolute -right-3 top-5 w-6 h-6 items-center justify-center rounded-full bg-background border border-border text-muted-foreground shadow-sm hover:text-primary hover:border-primary/50 hover:shadow-md transition-all"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Client badge */}
        {isClientPortalUser && !effectiveCollapsed && (
          <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white p-1.5 flex items-center justify-center">
              {portalClient?.client_logo_url ? (
                <img
                  src={portalClient.client_logo_url}
                  alt={`${portalClient.name || user?.clientName || 'Client'} logo`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-sm font-semibold text-gray-700">
                  {(portalClient?.name || user?.clientName || 'C').trim().charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-900 font-medium truncate">
                {portalClient?.name || user?.clientName}
              </p>
              <p className="text-[10px] text-gray-500 truncate">Client ID: {user?.clientId}</p>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden space-y-1 ${effectiveCollapsed ? 'p-2' : 'p-4'}`}>
          {navItems.map((item, idx) => (
            <NavItemComponent key={idx} item={item} collapsed={effectiveCollapsed} activePath={activePath} />
          ))}
        </nav>

        {/* Bottom — user menu trigger */}
        <div ref={userMenuRef} className="shrink-0 border-t border-sidebar-border relative">

          {/* Dropdown menu — opens upward above the trigger */}
          {userMenuOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-2 bg-background border border-border rounded-xl shadow-xl overflow-hidden z-50">
              {/* User info header */}
              <div className="px-4 py-3 border-b border-border bg-muted/40">
                <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{displayRole}</p>
              </div>

              {/* Menu items */}
              <div className="p-1.5 space-y-0.5">
                {/* My Profile — always visible for non-portal users */}
                {!isClientPortalUser && (
                  <Link
                    to="/my-profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground rounded-lg hover:bg-muted transition-colors w-full"
                  >
                    <User size={15} className="text-muted-foreground shrink-0" />
                    My Profile
                  </Link>
                )}

                {/* Recovery Codes — only for System Owner & System Admin */}
                {showRecoveryCodes && (
                  <Link
                    to="/my-profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground rounded-lg hover:bg-muted transition-colors w-full"
                  >
                    <ShieldAlert size={15} className="text-amber-500 shrink-0" />
                    Recovery Codes
                  </Link>
                )}

                <div className="h-px bg-border my-1" />

                {/* Sign Out */}
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full text-left"
                >
                  <LogOut size={15} className="shrink-0" />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Collapsed sidebar: just avatar button */}
          {effectiveCollapsed ? (
            <div className="p-2 flex flex-col items-center gap-2">
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                title={`${displayName} — ${displayRole}`}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold transition-transform hover:scale-105 ${
                  isClientPortalUser
                    ? 'bg-gradient-to-br from-purple-500 to-purple-700'
                    : 'bg-gradient-to-br from-blue-600 to-blue-700'
                }`}
              >
                {avatarInitial}
              </button>
            </div>
          ) : (
            /* Expanded sidebar: full clickable row */
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className="w-full p-4 flex items-center gap-3 hover:bg-sidebar-accent/50 transition-colors group"
            >
              <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                isClientPortalUser
                  ? 'bg-gradient-to-br from-purple-500 to-purple-700'
                  : 'bg-gradient-to-br from-blue-600 to-blue-700'
              }`}>
                {avatarInitial}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{displayRole}</p>
              </div>
              <ChevronDown
                size={14}
                className={`shrink-0 text-sidebar-foreground/40 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div onClick={() => setIsMobileOpen(false)} className="fixed inset-0 bg-black/50 z-20 lg:hidden" />
      )}
    </>
  );
}
