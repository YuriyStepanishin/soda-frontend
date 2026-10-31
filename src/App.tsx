import { lazy, Suspense, useEffect, useState } from 'react';

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
  type AppSection,
} from './config/userRoles';

import { backendFeatures } from './config/backendFeatures';

// App is the top-level flow coordinator:
// - keeps auth and navigation state
// - keeps currently selected tenant
// - enforces role/feature access
// - routes user to page-level lazy modules
//
// IMPORTANT:
// App does not contain company-specific sales pages.
// All companies use the same SalesPage.
// The active company is represented by activeDatabase.

export default function App() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState<
    | 'home'
    | 'sales'
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

  const [activeDatabase, setActiveDatabase] = useState<string>(() => {
    const user = getAuthSession()?.user;
    return user?.role === 'admin'
      ? ''
      : (user?.tenant ?? '');
  });

  useEffect(() => {
    if (activeDatabase) localStorage.setItem('activeTenant', activeDatabase);
    else localStorage.removeItem('activeTenant');
  }, [activeDatabase]);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(() => !email || !activeDatabase);

  const [showStoreSelector, setShowStoreSelector] = useState(false);

  const [reportType, setReportType] = useState<'display' | 'bonus' | null>(
    null
  );

  const [showGallery, setShowGallery] = useState(false);

  const [selectedStore, setSelectedStore] = useState<{
    department: string;
    representative: string;
    store: string;
  } | null>(null);

  const messagesCenter = useMessagesCenter(email);

  const userRole = getUserRole(email);
  const userDepartment = getUserDepartment(email);

  const canAccess = (section: AppSection) =>
    canAccessSection(userRole, section);

  function resetToHome() {
    setPage('home');
    setShowStoreSelector(false);
    setReportType(null);
    setShowGallery(false);
    setSelectedStore(null);
  }

  function handleLogin(nextEmail: string) {
    setEmail(nextEmail);

    const session = getAuthSession();

    // Admin must explicitly select a working company after signing in.
    // tenantAdmin identifies the credential store, not a default company.
    const user = session?.user;

    const tenant =
      user?.role === 'admin' ? '' : (user?.tenant ?? '');

    setActiveDatabase(tenant);

    if (tenant) {
      localStorage.setItem('activeTenant', tenant);
    } else {
      localStorage.removeItem('activeTenant');
    }

    queryClient.clear();

    setIsUserMenuOpen(!tenant);
  }

  function handleLogout() {
    clearAuthSession();

    setEmail(null);
    setActiveDatabase('');
    localStorage.removeItem('activeTenant');

    void queryClient.clear();

    resetToHome();

    setIsUserMenuOpen(true);
  }

  /**
   * Centralized authorization for protected sections.
   */
  function runProtectedAction(action: () => void, section?: AppSection) {
    if (!email) {
      setIsUserMenuOpen(true);
      return;
    }

    if (!activeDatabase) {
      setIsUserMenuOpen(true);
      return;
    }

    if (section && !canAccess(section)) {
      return;
    }

    action();
  }

  /**
   * PHOTO GALLERY
   *
   * This module is currently available only for OLGATORG.
   * This is a feature limitation, not tenant routing.
   */
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

  /**
   * SALES
   *
   * IMPORTANT:
   * There is ONE SalesPage for ALL companies.
   *
   * SalesPage/backend work with the currently selected
   * activeDatabase.
   *
   * No:
   *   laska-sales
   *   olgatorg-sales
   *   company3-sales
   *
   * This is what makes the architecture scalable.
   */
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

  if (page === 'sales-by-days' && canAccess('sales')) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <SalesByDaysPage key={activeDatabase} database={activeDatabase} onBack={() => setPage('sales')} />
        </Suspense>
      </>
    );
  }

  /**
   * ROUTE HISTORY
   */
  if (page === 'route-history' && canAccess('route-history')) {
    return (
      <>
        <Suspense fallback={<Loader />}>
          <RouteHistoryPage
            key={activeDatabase}
            onBack={() => setPage('home')}
            database={activeDatabase}
          />
        </Suspense>
      </>
    );
  }

  /**
   * ACTIVE CUSTOMER BASE
   */
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

  /**
   * IMPLEMENTATION
   */
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

  /**
   * STORE CHECK
   */
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

  /**
   * STORE CHECK REVIEW
   */
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

  /**
   * PLAN TARGETS
   */
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

  /**
   * MESSAGES
   */
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

  /**
   * HOME
   */
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
            /**
             * ONE sales page for ALL tenants.
             *
             * No tenant-specific page names here.
             */
            onOpenSales={() =>
              runProtectedAction(() => setPage('sales'), 'sales')
            }
            activeDatabase={activeDatabase}
            onOpenRouteHistory={() =>
              runProtectedAction(
                () => setPage('route-history'),
                'route-history'
              )
            }
            onOpenSalesByDays={() =>
              runProtectedAction(() => setPage('sales-by-days'), 'sales')
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
            canOpenSalesByDays={canAccess('sales')}
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
          activeDatabase={activeDatabase}
          canSwitchDatabase={getAuthSession()?.user.role === 'admin'}
          onSelectDatabase={async tenantId => {
            if (!['olgatorg', 'laska'].includes(tenantId)) return;
            await queryClient.cancelQueries();
            queryClient.clear();
            resetToHome();
            setActiveDatabase(tenantId);
            localStorage.setItem('activeTenant', tenantId);
          }}
          isOpen={isUserMenuOpen}
          onOpen={() => setIsUserMenuOpen(true)}
          onClose={() => { if (!email || activeDatabase) setIsUserMenuOpen(false); }}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />

        <InstallButton />
      </>
    );
  }

  /**
   * STORE SELECTOR
   */
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

  /**
   * REPORT FORMS
   */
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
