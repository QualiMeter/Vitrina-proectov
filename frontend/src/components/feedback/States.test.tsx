import { render, screen } from '@testing-library/react';
import { EmptyState, ErrorState, LoadingState } from './States';

test('LoadingState announces its default title', () => {
  render(<LoadingState />);
  expect(screen.getByRole('status')).toHaveTextContent('Загрузка данных');
  expect(screen.getByRole('heading', { name: 'Загрузка данных' })).toBeInTheDocument();
});

test('EmptyState presents description and action', () => {
  render(<EmptyState title="Пока нет проектов" description="Создайте первый проект" action={<button>Создать</button>} />);
  expect(screen.getByRole('status')).toHaveTextContent('Создайте первый проект');
  expect(screen.getByRole('button', { name: 'Создать' })).toBeInTheDocument();
});

test('ErrorState presents the error and recovery action', () => {
  render(<ErrorState title="Ошибка загрузки" description="Попробуйте ещё раз" action={<button>Повторить</button>} />);
  expect(screen.getByRole('heading', { name: 'Ошибка загрузки' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Попробуйте ещё раз');
  expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
});
