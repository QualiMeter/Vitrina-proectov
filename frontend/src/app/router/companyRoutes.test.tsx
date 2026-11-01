import { expect, it } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { router } from './router';

it('preserves company, student, demo and existing cabinet routes', () => {
  for (const path of ['/', '/company/cases', '/company/cases/new', '/company/cases/demo-id/edit',
    '/cases', '/cases/demo-id', '/companies/demo-id',
    '/student', '/student/profile', '/student/participations', '/students/demo-id', '/demo/student',
    '/university/companies', '/mentor/projects/case/demo-id', '/admin/users']) {
    const matches = matchRoutes(router.routes, path);
    expect(matches, path).not.toBeNull();
    expect(matches?.at(-1)?.route.path, path).not.toBe('*');
  }
});
