import { expect, test, type Page } from '@playwright/test';

const inviteToken = 'e2e-invitation-token-1234567890';
const session = {
  user: { id: 'e2e-user', email: 'invitee@example.com', fullName: 'Тестовый пользователь', globalRoles: ['STUDENT'], availableAreas: ['company'], permissions: [], companyMemberships: [] },
  session: { expiresAt: '2026-12-01T00:00:00Z' },
};

async function setupAuth(page: Page, initiallySignedIn = false) {
  let signedIn = initiallySignedIn;
  let csrf = 0;
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ csrfToken: `csrf-${++csrf}` }) }));
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: signedIn ? 200 : 401, contentType: 'application/json', body: signedIn ? JSON.stringify(session) : '{}' }));
  await page.route('**/api/v1/auth/login', async route => { signedIn = true; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }); });
  await page.route('**/api/v1/auth/email-verification/confirm', async route => { signedIn = true; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }); });
  await page.route('**/api/v1/auth/password/reset', route => route.fulfill({ status: 204, body: '' }));
  await page.route('**/api/v1/auth/logout', async route => { signedIn = false; await route.fulfill({ status: 204, body: '' }); });
  await page.route('**/api/v1/company-invitations/preview', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ companyId: 'company-1', companyName: 'ООО Пример', role: 'MEMBER', expiresAt: '2026-12-01T00:00:00Z', maskedEmail: 'i***@example.com' }) }));
  await page.route('**/api/v1/company-invitations/accept', async route => {
    const request = route.request().postDataJSON();
    expect(request.token).toBe(inviteToken);
    expect(['existing', 'new']).toContain(request.mode);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
  });
}

test('new invitee previews, confirms, and accepts with a new account', async ({ page }) => {
  await setupAuth(page);
  await page.goto(`/accept-invitation?token=${inviteToken}`);
  await expect(page).toHaveURL(/\/accept-invitation$/);
  await expect(page.getByText('ООО Пример')).toBeVisible();
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await page.getByLabel('ФИО').fill('Тестовый пользователь');
  await page.getByLabel('Пароль').fill('secure-password-123');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Подтвердить и принять приглашение' }).click();
  await expect(page).toHaveURL('/company');
});

test('existing invitee returns from login, accepts, and can log out', async ({ page }) => {
  await setupAuth(page);
  await page.goto(`/accept-invitation?token=${inviteToken}`);
  await page.getByRole('link', { name: 'войдите' }).click();
  await expect(page).toHaveURL('/login');
  await page.getByLabel('Email').fill('invitee@example.com');
  await page.getByLabel('Пароль').fill('password123');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL('/accept-invitation');
  await expect(page.getByText('ООО Пример')).toBeVisible();
  await page.getByRole('button', { name: 'Подтвердить и принять приглашение' }).click();
  await expect(page).toHaveURL('/company');
  await page.goto('/');
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible();
});

test('authenticated public header remains available by keyboard on narrow screens', async ({ page }) => {
  await setupAuth(page, true);
  for (const width of [320, 375, 400]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await expect(page.getByText('Тестовый пользователь')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Кабинет', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
    const toggle = page.getByRole('button', { name: 'Открыть меню' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      elements: Array.from(document.querySelectorAll<HTMLElement>('*')).filter(element => element.getBoundingClientRect().right > innerWidth + 1).map(element => `${element.tagName}.${element.className}=${Math.round(element.getBoundingClientRect().right)}`).slice(0, 8),
    }));
    expect(overflow.width, JSON.stringify(overflow.elements)).toBeLessThanOrEqual(width);
  }
});

test('login form is keyboard accessible and fits requested viewports', async ({ page }) => {
  await setupAuth(page);
  for (const width of [320, 375, 400, 768, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/login');
    const email = page.getByLabel('Email');
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(email).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for (const path of ['/register', '/forgot-password', '/reset-password', `/accept-invitation?token=${inviteToken}`]) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
});

test('email verification and password reset links consume URL tokens without leaving them in history', async ({ page }) => {
  await setupAuth(page);
  await page.goto('/verify-email?token=email-verification-token-123456');
  await expect(page).toHaveURL('/verify-email');
  await expect(page.getByText('Email подтверждён, вход выполнен.')).toBeVisible();
  await page.goto('/reset-password?token=password-reset-token-123456');
  await expect(page).toHaveURL('/reset-password');
  await page.getByLabel('Новый пароль').fill('secure-password-123');
  await page.getByLabel('Подтверждение пароля').fill('secure-password-123');
  await page.getByRole('button', { name: 'Сменить пароль' }).click();
  await expect(page.getByRole('heading', { name: 'Пароль изменён' })).toBeVisible();
  expect(page.url()).not.toContain('password-reset-token');
});
