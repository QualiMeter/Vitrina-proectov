import { expect, it } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { router } from './router';
import { isValidElement } from 'react';
import { ProtectedRoute } from '../../features/auth/ProtectedRoute';

it('preserves company, student, demo and existing cabinet routes', () => {
  for (const path of ['/', '/company/cases', '/company/cases/new', '/company/cases/demo-id/edit',
    '/cases', '/cases/demo-id', '/companies/demo-id',
    '/student', '/student/profile', '/student/participations', '/students/demo-id', '/demo/student',
    '/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/accept-invitation',
    '/university/companies', '/mentor/projects/case/demo-id', '/admin/users']) {
    const matches = matchRoutes(router.routes, path);
    expect(matches, path).not.toBeNull();
    expect(matches?.at(-1)?.route.path, path).not.toBe('*');
  }
});

it('retains real cabinet guards alongside the explicit company demo', () => {
  for (const path of ['/company', '/student', '/university/companies', '/mentor', '/admin/users']) {
    const matches = matchRoutes(router.routes, path) ?? [];
    expect(matches.some(({ route }) => isValidElement(route.element) && route.element.type === ProtectedRoute), path).toBe(true);
  }
});
