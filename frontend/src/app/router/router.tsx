import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from '../../pages/public/HomePage/HomePage';
import { PlaceholderPage } from '../../pages/PlaceholderPage';
import { ErrorState } from '../../components/feedback/States';
import { ProtectedRoute } from '../../features/auth/ProtectedRoute';
import { LoginPage } from '../../pages/auth/LoginPage';
import { RegisterPage } from '../../pages/auth/RegisterPage';
import { VerifyEmailPage } from '../../pages/auth/VerifyEmailPage';
import { ForgotPasswordPage } from '../../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../../pages/auth/ResetPasswordPage';
import { AcceptInvitationPage } from '../../pages/auth/AcceptInvitationPage';
import { PublicLayout } from './PublicLayout';
import { studentRoutes } from '../../features/student/routes';
import { CasesPage } from '../../pages/public/Cases/CasesPage';
import { CaseDetailsPage } from '../../pages/public/Cases/CaseDetailsPage';
import { CompanyDetailsPage } from '../../pages/public/Cases/CompanyDetailsPage';
import '../../pages/auth/Auth.css';
import { AppShell } from '../../components/layout/AppShell';

const route = (path: string) => ({ path, element: <PlaceholderPage /> });

export const router = createBrowserRouter([
  {
  element: <PublicLayout />,
  children: [
    ...studentRoutes,
    { index: true, element: <HomePage /> },
    { path: 'login', element: <LoginPage /> },
    { path: 'register', element: <RegisterPage /> },
    { path: 'verify-email', element: <VerifyEmailPage /> },
    { path: 'forgot-password', element: <ForgotPasswordPage /> },
    { path: 'reset-password', element: <ResetPasswordPage /> },
    { path: 'accept-invitation', element: <AcceptInvitationPage /> },
    { path: 'cases', element: <CasesPage /> },
    { path: 'cases/:caseId', element: <CaseDetailsPage /> },
    { path: 'companies/:companyId', element: <CompanyDetailsPage /> },
    { path: 'company', element: <ProtectedRoute allowedArea="company" />, children: [
      { index: true, element: <PlaceholderPage /> },
    ] },
    { path: 'university', element: <ProtectedRoute allowedArea="university" />, children: [{ element: <AppShell area="university" />, children: [
      { index: true, element: <PlaceholderPage />},
      route('moderation'),
      route('moderation/:kind/:id'), 
      route('companies'), 
      route('companies/new'), 
      route('companies/:id'), 
      route('curators'), 
      route('projects'), 
      route('reports'),]},],
    },

    { path: 'mentor', element: <ProtectedRoute allowedArea="mentor" />, children: [{ element: <AppShell area="mentor" />, children: [
      { index: true, element: <PlaceholderPage />},
      route('projects/:kind/:id'), 
      route('projects/:kind/:id/progress')
      ]},],
    },
    
    { path: 'admin', element: <ProtectedRoute allowedArea="admin" />, children: [{ element: <AppShell area="admin" />, children: [
      { index: true, element: <PlaceholderPage />},
      route('users'), 
      route('users/:id'), 
      route('directories'), 
      route('companies'), 
      route('audit')
      ]},],
    },

    { path: '403', element: <ErrorState title="Нет доступа" description="Для этого раздела у вашей учётной записи нет разрешения." /> },
    { path: '*', element: <ErrorState title="Страница не найдена" description="Проверьте адрес или вернитесь на главную." /> }
  ],
 },
]);
  
