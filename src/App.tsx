import { lazy, Suspense, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const HomePage = lazy(() => import('./components/HomePage/HomePage'));
const StoreSelector = lazy(
  () => import('./components/StoreSelector/StoreSelector')
);
const ShowcasePromotion = lazy(
  () => import('./components/ShowcasePromotion/ShowcasePromotion')
);
const ReportBonusForm = lazy(
  () => import('./components/PhotoReport/PhotoReport')
);
const PhotoGallery = lazy(
  () => import('./components/PhotoGallery/PhotoGallery')
);
const SalesPage = lazy(() => import('./components/SalesPage/SalesPage'));
const LaskaSalesPage = lazy(
  () => import('./components/LaskaSalesPage/LaskaSalesPage')
);
const SalesByDaysPage = lazy(
  () => import('./components/SalesByDaysPage/SalesByDaysPage')
);
const RouteHistoryPage = lazy(
  () => import('./components/RouteHistoryPage/RouteHistoryPage')
);
const ActiveCustomerBase = lazy(
  () => import('./components/ActiveCustomerBase/ActiveCustomerBase')
);
const ImplementationPage = lazy(
  () => import('./components/ImplementationPage/ImplementationPage')
);
const InfoBoardPage = lazy(
  () => import('./components/InfoBoardPage/InfoBoardPage')
);
const StoreCheckPage = lazy(
  () => import('./components/StoreCheckPage/StoreCheckPage')
);
const StoreCheckReviewPage = lazy(
  () => import('./components/StoreCheckReviewPage')
);
const PlanTargetsPage = lazy(
  () => import('./components/PlanTargetsPage/PlanTargetsPage')
);

import InstallButton from './components/InstallButton/InstallButton';
import Loader from './components/Loader/Loader';
import UserMenu from './components/UserMenu/UserMenu';
import { clearAuthSession, getAuthSession } from './api/auth';

import { useMessagesCenter } from './hooks/useMessagesCenter';
import {
  canAccessSection,
  getUserDepartment,
  getUserRole,
  getRoleLabel,
  isSuperAdminEmail,
  type AppSection,
} from './config/userRoles';
import { backendFeatures } from './config/backendFeatures';

// App is the top-level flow coordinator:
// - keeps auth and navigation state
// - enforces role/feature access
// - routes user to page-level lazy modules
export default function App() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState<
    | 'home'
    | 'sales'
    | 'laska-sales'
    | 'sales-by-days'
    | 'route-history'
    | 'active-customer-base'
    | 'implementation'
    | 'store-check'
    | 'store-check-review'
    | 'messages'
    | 'plan-targets'
  >('home');
  const [email, setEmail] = useState<string | null>(
    () => getAuthSession()?.email ?? null
  );
  const [activeDatabase, setActiveDatabase] = useState<'olgatorg' | 'laska'>(
    'olgatorg'
  );
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(() => !email);
  const [showStoreSelector, setShowStoreSelector] = useState(false);

  const [reportType, setReportType] = useState<'display' | 'bonus' | null>(
    null
  );
  const [showGallery, setShowGallery] = useState(false);
  const messagesCenter = useMessagesCenter(email);
  const userRole = getUserRole(email);
  const userDepartment = getUserDepartment(email);
  const canAccess = (section: AppSection) =>
    canAccessSection(userRole, section);

  const [selectedStore, setSelectedStore] = useState<{
    department: string;
    representative: string;
    store: string;
  } | null>(null);

  function resetToHome() {
    // Reset all transient flow states when returning to dashboard.
    setPage('home');
    setShowStoreSelector(false);
    setReportType(null);
    setShowGallery(false);
    setSelectedStore(null);
  }

  function handleLogin(nextEmail: string) {
    // Save user identity and refresh cached queries for newly authorized scope.
    setEmail(nextEmail);
    void queryClient.invalidateQueries();
    setIsUserMenuOpen(false);
  }

  function handleLogout() {
    // Full sign-out: drop auth storage and clear client-side cached data.
    clearAuthSession();
    setEmail(null);
    void queryClient.clear();
    resetToHome();
    setIsUserMenuOpen(true);
  }

  function runProtectedAction(action: () => void, section?: AppSection) {
    // Centralized gate for auth + role checks before opening protected sections.
    if (!email) {
      // If guest tries protected action, open login panel instead.
      setIsUserMenuOpen(true);
      return;
    }

    if (section && !canAccess(section)) {
      // Silently block sections unavailable for current role.
      return;
    }

    action();
  }

  if (
    showGallery &&
    activeDatabase === 'olgatorg' &&
    canAccess('gallery') &&
    backendFeatures.gallery
  ) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <PhotoGallery onBack={() => setShowGallery(false)} />
        </Suspense>
      </>
    );
  }
  if (page === 'sales' && canAccess('sales')) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <SalesPage
            onBack={() => setPage('home')}
            onOpenSalesByDays={() => setPage('sales-by-days')}
          />
        </Suspense>
      </>
    );
  }

  if (page === 'laska-sales' && isSuperAdminEmail(email)) {
    return (
      <Suspense fallback={<Loader />}>
        <LaskaSalesPage onBack={() => setPage('home')} />
      </Suspense>
    );
  }

  if (page === 'sales-by-days' && activeDatabase === 'olgatorg' && canAccess('sales')) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <SalesByDaysPage onBack={() => setPage('sales')} />
        </Suspense>
      </>
    );
  }

  if (page === 'route-history' && canAccess('route-history')) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <RouteHistoryPage
            onBack={() => setPage('home')}
            database={activeDatabase}
          />
        </Suspense>
      </>
    );
  }

  if (
    page === 'active-customer-base' &&
    activeDatabase === 'olgatorg' &&
    canAccess('active-customer-base')
  ) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <ActiveCustomerBase onBack={() => setPage('home')} />
        </Suspense>
      </>
    );
  }

  if (
    page === 'implementation' &&
    activeDatabase === 'olgatorg' &&
    canAccess('implementation')
  ) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <ImplementationPage onBack={() => setPage('home')} />
        </Suspense>
      </>
    );
  }

  if (
    page === 'store-check' &&
    activeDatabase === 'olgatorg' &&
    backendFeatures.storeCheckCreate
  ) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <StoreCheckPage onBack={() => setPage('home')} />
        </Suspense>
      </>
    );
  }

  if (
    page === 'store-check-review' &&
    activeDatabase === 'olgatorg' &&
    backendFeatures.storeCheckReview
  ) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <StoreCheckReviewPage onBack={() => setPage('home')} />
        </Suspense>
      </>
    );
  }

  if (
    page === 'plan-targets' &&
    activeDatabase === 'olgatorg' &&
    canAccess('plan-targets') &&
    backendFeatures.planTargets
  ) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <PlanTargetsPage onBack={() => setPage('home')} />
        </Suspense>
      </>
    );
  }

  if (
    page === 'messages' &&
    activeDatabase === 'olgatorg' &&
    email &&
    canAccess('messages') &&
    backendFeatures.messages
  ) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <InfoBoardPage
            userEmail={email}
            onBack={() => setPage('home')}
            messagesCenter={messagesCenter}
          />
        </Suspense>
      </>
    );
  }

  // HOME PAGE
  if (!showStoreSelector) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <HomePage
            onOpenDisplay={() =>
              runProtectedAction(() => {
                setReportType('display');
                setShowStoreSelector(true);
              }, 'display-report')
            }
            onOpenBonus={() =>
              runProtectedAction(() => {
                setReportType('bonus');
                setShowStoreSelector(true);
              }, 'bonus-report')
            }
            onOpenGallery={() =>
              runProtectedAction(() => setShowGallery(true), 'gallery')
            }
            onOpenSales={() =>
              runProtectedAction(
                () =>
                  setPage(
                    activeDatabase === 'laska' ? 'laska-sales' : 'sales'
                  ),
                'sales'
              )
            }
            activeDatabase={activeDatabase}
            canSwitchDatabase={isSuperAdminEmail(email)}
            onToggleDatabase={() =>
              setActiveDatabase(current =>
                current === 'laska' ? 'olgatorg' : 'laska'
              )
            }
            onOpenRouteHistory={() =>
              runProtectedAction(
                () => setPage('route-history'),
                'route-history'
              )
            }
            onOpenActiveCustomerBase={() =>
              runProtectedAction(
                () => setPage('active-customer-base'),
                'active-customer-base'
              )
            }
            onOpenImplementation={() =>
              runProtectedAction(
                () => setPage('implementation'),
                'implementation'
              )
            }
            onOpenStoreCheck={() =>
              runProtectedAction(() => setPage('store-check'))
            }
            onOpenStoreCheckReview={() =>
              runProtectedAction(() => setPage('store-check-review'))
            }
            onOpenPlanTargets={() =>
              runProtectedAction(() => setPage('plan-targets'), 'plan-targets')
            }
            canOpenPlanTargets={
              canAccess('plan-targets') && backendFeatures.planTargets
            }
            onOpenMessages={() =>
              runProtectedAction(() => setPage('messages'), 'messages')
            }
            unreadMessagesCount={messagesCenter.unreadCount}
            canOpenGallery={canAccess('gallery') && backendFeatures.gallery}
            canOpenSales={canAccess('sales')}
            canOpenRouteHistory={canAccess('route-history')}
            canOpenActiveCustomerBase={canAccess('active-customer-base')}
            canOpenMessages={canAccess('messages') && backendFeatures.messages}
            canOpenImplementation={canAccess('implementation')}
            canOpenBonusReport={canAccess('bonus-report')}
            canOpenDisplayReport={canAccess('display-report')}
            canOpenStoreCheck={backendFeatures.storeCheckCreate}
            canOpenStoreCheckReview={backendFeatures.storeCheckReview}
          />
        </Suspense>
        <UserMenu
          email={email}
          roleLabel={userRole ? getRoleLabel(userRole) : undefined}
          departmentLabel={userDepartment ?? undefined}
          isOpen={isUserMenuOpen}
          onOpen={() => setIsUserMenuOpen(true)}
          onClose={() => setIsUserMenuOpen(false)}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />
        <InstallButton />
      </>
    );
  }

  // STORE SELECTOR
  if (!selectedStore) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <StoreSelector
            source={reportType === 'bonus' ? 'bonus' : 'sales'}
            onSelect={store => setSelectedStore(store)}
            onBack={() => {
              setShowStoreSelector(false);
              setReportType(null);
            }}
          />
        </Suspense>
        <InstallButton />
      </>
    );
  }

  // REPORT FORMS
  return (
    <>
      <Suspense fallback={<Loader />}>
        {reportType === 'display' ? (
          <ShowcasePromotion
            storeData={selectedStore}
            onBack={() => setSelectedStore(null)}
          />
        ) : (
          <ReportBonusForm
            storeData={selectedStore}
            onBack={() => setSelectedStore(null)}
          />
        )}
      </Suspense>
      <InstallButton />
    </>
  );
}
