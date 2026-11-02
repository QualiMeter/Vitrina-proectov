import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { PublicHeader } from './PublicHeader';
import { MockAuthProvider } from '../../test/MockAuthProvider';

it('tabs from toggle into links, closes with Escape and restores toggle focus', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><MockAuthProvider><PublicHeader /></MockAuthProvider></MemoryRouter>);
  const toggle = screen.getByRole('button', { name: 'Открыть меню' });
  await user.click(toggle);
  await user.tab();
  expect(screen.getByRole('link', { name: 'О платформе' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle).toHaveFocus();
  await user.click(toggle);
  await user.click(screen.getByRole('link', { name: 'Каталог кейсов' }));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
