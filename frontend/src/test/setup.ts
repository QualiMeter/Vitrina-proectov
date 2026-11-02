import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { clearCsrfToken } from '../api/client';

afterEach(() => {
  cleanup();
  clearCsrfToken();
});
