import { createBrowserRouter } from 'react-router-dom';
import { ErrorState } from '../../components/feedback/States';
import { AppShell } from '../../components/layout/AppShell';
import { ProtectedRoute } from '../../features/auth/ProtectedRoute';
import { studentRoutes } from '../../features/student/routes';
import { AcceptInvitationPage } from '../../pages/auth/AcceptInvitationPage';
import { ForgotPasswordPage } from '../../pages/auth/ForgotPasswordPage';
import { LoginPage } from '../../pages/auth/LoginPage';
import { RegisterPage } from '../../pages/auth/RegisterPage';
import { ResetPasswordPage } from '../../pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from '../../pages/auth/VerifyEmailPage';
import { CaseDetailsPage } from '../../pages/public/Cases/CaseDetailsPage';
import { CasesPage } from '../../pages/public/Cases/CasesPage';
import { CompanyDetailsPage } from '../../pages/public/Cases/CompanyDetailsPage';
import { HomePage } from '../../pages/public/HomePage/HomePage';
import {
  UniversityCompaniesPage,
  UniversityCompanyDetailsPage,
  UniversityCreateCompanyPage,
  UniversityDashboardPage,
} from '../../pages/university/UniversityPages';
import { PlaceholderPage } from '../../pages/PlaceholderPage';
import { PublicLayout } from './PublicLayout';
import '../../pages/auth/Auth.css';

const placeholderRoute = (path: string) => ({ path, element: <PlaceholderPage /> });

const universityRoute = {
  path: 'university',
  element: <ProtectedRoute allowedArea="university" />,
  children: [{
    element: <AppShell area="university" />,
    children: [
      { index: true, element: <UniversityDashboardPage /> },
      placeholderRoute('moderation'),
      placeholderRoute('moderation/:kind/:id'),
      {
        path: 'companies',
        element: <ProtectedRoute allowedArea="university" requiredPermissions={['companies.listAll']} />,
        children: [{ index: true, element: <UniversityCompaniesPage /> }],
      },
      {
        path: 'companies/new',
        element: <ProtectedRoute allowedArea="university" requiredPermissions={['companies.create']} />,
        children: [{ index: true, element: <UniversityCreateCompanyPage /> }],
      },
      {
        path: 'companies/:id',
        element: <ProtectedRoute allowedArea="university" requiredPermissions={['companies.readPrivate']} />,
        children: [{ index: true, element: <UniversityCompanyDetailsPage /> }],
      },
      placeholderRoute('curators'),
      placeholderRoute('projects'),
      placeholderRoute('reports'),
    ],
  }],
};

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
      {
        path: 'company',
        element: <ProtectedRoute allowedArea="company" />,
        children: [{ index: true, element: <PlaceholderPage /> }],
      },
      universityRoute,
      {
        path: 'mentor',
        element: <ProtectedRoute allowedArea="mentor" />,
        children: [{
          element: <AppShell area="mentor" />,
          children: [
            { index: true, element: <PlaceholderPage /> },
            placeholderRoute('projects/:kind/:id'),
            placeholderRoute('projects/:kind/:id/progress'),
          ],
        }],
      },
      {
        path: 'admin',
        element: <ProtectedRoute allowedArea="admin" />,
        children: [{
          element: <AppShell area="admin" />,
          children: [
            { index: true, element: <PlaceholderPage /> },
            placeholderRoute('users'),
            placeholderRoute('users/:id'),
            placeholderRoute('directories'),
            placeholderRoute('companies'),
            placeholderRoute('audit'),
          ],
        }],
      },
      { path: '403', element: <ErrorState title="Нет доступа" description="Для этого раздела у вашей учётной записи нет разрешения." /> },
      { path: '*', element: <ErrorState title="Страница не найдена" description="Проверьте адрес или вернитесь на главную." /> },
    ],
  },
]);
