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

const route = (path: string) => ({ path, element: <PlaceholderPage /> });

export const router = createBrowserRouter([
  {
  element: <PublicLayout />,
  children: [
    { index: true, element: <HomePage /> },
    { path: 'login', element: <LoginPage /> },
    { path: 'register', element: <RegisterPage /> },
    { path: 'verify-email', element: <VerifyEmailPage /> },
    { path: 'forgot-password', element: <ForgotPasswordPage /> },
    { path: 'reset-password', element: <ResetPasswordPage /> },
    { path: 'accept-invitation', element: <AcceptInvitationPage /> },

    { path: '/university', element: <ProtectedRoute allowedRoles={['UniversityStaff', 'Admin']} />, children: [
      { index: true, element: <PlaceholderPage />},
      route('moderation'),
      route('moderation/:kind/:id'), 
      route('companies'), 
      route('companies/new'), 
      route('companies/:id'), 
      route('curators'), 
      route('projects'), 
      route('reports'),],
    },

    { path: '/mentor', element: <ProtectedRoute allowedRoles={['Mentor']} />, children: [
      { index: true, element: <PlaceholderPage />},
      route('projects/:kind/:id'), 
      route('projects/:kind/:id/progress')
      ],
    },
    
    { path: '/admin', element: <ProtectedRoute allowedRoles={['Admin']} />, children: [
      { index: true, element: <PlaceholderPage />},
      route('users'), 
      route('users/:id'), 
      route('directories'), 
      route('companies'), 
      route('audit')
      ],
    },

    { path: '*', element: <ErrorState title="Страница не найдена" description="Проверьте адрес или вернитесь на главную." /> }
  ],
 },
]);
  
