import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

test('Input is labelled and accepts text', async () => {
  render(<Input label="Название проекта" hint="Введите название" />);
  const input = screen.getByRole('textbox', { name: 'Название проекта' });
  await userEvent.type(input, 'Витрина');
  expect(input).toHaveValue('Витрина');
  expect(input).toHaveAccessibleDescription('Введите название');
  expect(input).toHaveAttribute('aria-invalid', 'false');
});

test('Input exposes validation error accessibly', () => {
  render(<Input label="Название проекта" error="Обязательное поле" />);
  const input = screen.getByRole('textbox', { name: 'Название проекта' });
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Обязательное поле');
});
