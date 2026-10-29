import { render, screen } from '@testing-library/react';
import { PermissionGate } from './PermissionGate';

test('shows children when all permissions are granted', () => {
  render(<PermissionGate access={{ permissions: new Set(['project:read', 'project:edit']) }} require={['project:read', 'project:edit']}><button>Изменить</button></PermissionGate>);
  expect(screen.getByRole('button', { name: 'Изменить' })).toBeInTheDocument();
});

test('shows fallback when permission is missing or access is absent', () => {
  const { rerender } = render(<PermissionGate access={{ permissions: new Set(['project:read']) }} require="project:edit" fallback={<span>Нет доступа</span>}><button>Изменить</button></PermissionGate>);
  expect(screen.queryByRole('button', { name: 'Изменить' })).not.toBeInTheDocument();
  expect(screen.getByText('Нет доступа')).toBeInTheDocument();
  rerender(<PermissionGate access={null} require="project:edit" fallback={<span>Нет доступа</span>}><button>Изменить</button></PermissionGate>);
  expect(screen.getByText('Нет доступа')).toBeInTheDocument();
});

test('checks object action in addition to general permission', () => {
  const { rerender } = render(<PermissionGate access={{ permissions: new Set(['project:edit']), objectPermissions: { 'project:42:edit': false } }} require="project:edit" objectAction="project:42:edit"><button>Изменить</button></PermissionGate>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(<PermissionGate access={{ permissions: new Set(['project:edit']), objectPermissions: { 'project:42:edit': true } }} require="project:edit" objectAction="project:42:edit"><button>Изменить</button></PermissionGate>);
  expect(screen.getByRole('button', { name: 'Изменить' })).toBeInTheDocument();
});
