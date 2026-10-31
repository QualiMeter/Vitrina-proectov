import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from '../../pages/public/HomePage/HomePage';
import { AppShell } from '../../components/layout/AppShell';
import { PlaceholderPage } from '../../pages/PlaceholderPage';
import { ErrorState } from '../../components/feedback/States';
import { studentRoutes } from '../../features/student/routes';

const route = (path: string) => ({ path, element: <PlaceholderPage /> });

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  ...studentRoutes,
  { path: '/university', element: <AppShell area="university" />, children: [
    { index: true, element: <PlaceholderPage /> }, route('moderation'), route('moderation/:kind/:id'), route('companies'), route('companies/new'), route('companies/:id'), route('curators'), route('projects'), route('reports')
  ] },
  { path: '/mentor', element: <AppShell area="mentor" />, children: [
    { index: true, element: <PlaceholderPage /> }, route('projects/:kind/:id'), route('projects/:kind/:id/progress')
  ] },
  { path: '/admin', element: <AppShell area="admin" />, children: [
    { index: true, element: <PlaceholderPage /> }, route('users'), route('users/:id'), route('directories'), route('companies'), route('audit')
  ] },
  { path: '*', element: <ErrorState title="Страница не найдена" description="Проверьте адрес или вернитесь на главную." /> }
]);
