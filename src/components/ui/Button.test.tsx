import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { Button, ButtonLink } from './Button';

test('Button renders text and handles click', async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Сохранить</Button>);
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(onClick).toHaveBeenCalledOnce();
});

test('disabled Button does not handle click', async () => {
  const onClick = vi.fn();
  render(<Button disabled onClick={onClick}>Сохранить</Button>);
  const button = screen.getByRole('button', { name: 'Сохранить' });
  expect(button).toBeDisabled();
  await userEvent.click(button);
  expect(onClick).not.toHaveBeenCalled();
});

test('ButtonLink points to a client route', () => {
  render(<MemoryRouter><ButtonLink to="/university">Кабинет</ButtonLink></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Кабинет' })).toHaveAttribute('href', '/university');
});
