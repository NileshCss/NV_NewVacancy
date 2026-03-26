# Testing Guide & Example Test Cases

## Overview
This guide provides comprehensive testing strategies for the New_vacancy application, including unit tests, integration tests, and end-to-end tests.

## Testing Stack
- **Unit Testing**: Vitest + React Testing Library
- **Integration Testing**: Supertest for API endpoints
- **E2E Testing**: Playwright for user flows
- **Coverage**: V8 coverage reporting

## Project Structure
```
frontend/
├── src/
│   ├── __tests__/           # Unit tests
│   ├── components/
│   │   └── __tests__/       # Component tests
│   └── utils/
│       └── __tests__/       # Utility tests
├── e2e/                     # E2E tests
└── test-utils/              # Testing utilities
```

## 1. Unit Testing Examples

### Component Testing
```jsx
// src/components/common/__tests__/Navbar.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '../../context/ThemeContext'
import Navbar from '../Navbar'

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('Navbar', () => {
  test('renders navigation links', () => {
    renderWithProviders(<Navbar />)

    expect(screen.getByText('Jobs')).toBeInTheDocument()
    expect(screen.getByText('News')).toBeInTheDocument()
    expect(screen.getByText('Affiliates')).toBeInTheDocument()
  })

  test('theme toggle changes theme', () => {
    renderWithProviders(<Navbar />)

    const toggleButton = screen.getByRole('button', { name: /toggle theme/i })
    fireEvent.click(toggleButton)

    // Verify theme change logic
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
```

### Hook Testing
```jsx
// src/hooks/__tests__/useData.test.js
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useJobs } from '../useData'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useJobs', () => {
  test('fetches jobs successfully', async () => {
    const { result } = renderHook(() => useJobs(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeDefined()
    expect(Array.isArray(result.current.data.jobs)).toBe(true)
  })

  test('handles error states', async () => {
    // Mock API error
    const { result } = renderHook(() => useJobs(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
  })
})
```

### Utility Testing
```jsx
// src/utils/__tests__/validation.test.js
import { validateEmail, validatePassword, validateJobForm } from '../validation'

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    test('validates correct email', () => {
      const result = validateEmail('user@example.com')
      expect(result.valid).toBe(true)
    })

    test('rejects invalid email', () => {
      const result = validateEmail('invalid-email')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid email format')
    })

    test('rejects empty email', () => {
      const result = validateEmail('')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Email is required')
    })
  })

  describe('validatePassword', () => {
    test('validates strong password', () => {
      const result = validatePassword('StrongPass123!')
      expect(result.valid).toBe(true)
    })

    test('rejects short password', () => {
      const result = validatePassword('123')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('at least')
    })
  })

  describe('validateJobForm', () => {
    test('validates complete job form', () => {
      const validJob = {
        title: 'Software Engineer',
        organization: 'Tech Corp',
        apply_url: 'https://example.com/apply',
        last_date: '2024-12-31'
      }

      const result = validateJobForm(validJob)
      expect(result.valid).toBe(true)
    })

    test('rejects invalid job form', () => {
      const invalidJob = {
        title: '',
        organization: 'Tech Corp',
        apply_url: 'invalid-url',
        last_date: '2024-12-31'
      }

      const result = validateJobForm(invalidJob)
      expect(result.valid).toBe(false)
      expect(result.errors.title).toBeDefined()
      expect(result.errors.apply_url).toBeDefined()
    })
  })
})
```

## 2. Integration Testing Examples

### API Testing
```javascript
// backend/__tests__/api.test.js
import request from 'supertest'
import { createClient } from '@supabase/supabase-js'
import { app } from '../server.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

describe('Jobs API', () => {
  beforeEach(async () => {
    // Clean up test data
    await supabase.from('jobs').delete().neq('id', '')
  })

  test('GET /api/jobs returns jobs list', async () => {
    const response = await request(app)
      .get('/api/jobs')
      .expect(200)

    expect(Array.isArray(response.body.jobs)).toBe(true)
    expect(response.body).toHaveProperty('total')
  })

  test('POST /api/jobs creates new job', async () => {
    const jobData = {
      title: 'Test Job',
      organization: 'Test Corp',
      category: 'private',
      apply_url: 'https://example.com',
      last_date: '2024-12-31'
    }

    const response = await request(app)
      .post('/api/jobs')
      .send(jobData)
      .expect(201)

    expect(response.body.job).toHaveProperty('id')
    expect(response.body.job.title).toBe(jobData.title)
  })

  test('GET /api/jobs/:id returns specific job', async () => {
    // First create a job
    const createResponse = await request(app)
      .post('/api/jobs')
      .send({
        title: 'Specific Job',
        organization: 'Test Corp',
        category: 'govt',
        apply_url: 'https://example.com',
        last_date: '2024-12-31'
      })

    const jobId = createResponse.body.job.id

    // Then fetch it
    const response = await request(app)
      .get(`/api/jobs/${jobId}`)
      .expect(200)

    expect(response.body.job.id).toBe(jobId)
    expect(response.body.job.title).toBe('Specific Job')
  })
})
```

## 3. End-to-End Testing Examples

### User Registration Flow
```javascript
// e2e/auth.spec.js
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('user can register and login', async ({ page }) => {
    // Navigate to signup page
    await page.goto('/signup')

    // Fill registration form
    await page.fill('[placeholder="Your full name"]', 'Test User')
    await page.fill('[placeholder="you@example.com"]', 'test@example.com')
    await page.fill('[placeholder="Min 6 characters"]', 'password123')

    // Submit form
    await page.click('button:has-text("Create Account")')

    // Should redirect to login with success message
    await expect(page).toHaveURL('/login')
    await expect(page.locator('text=Account created!')).toBeVisible()

    // Login with new account
    await page.fill('[placeholder="you@example.com"]', 'test@example.com')
    await page.fill('[placeholder="••••••••"]', 'password123')
    await page.click('button:has-text("Sign In")')

    // Should redirect to home
    await expect(page).toHaveURL('/')
    await expect(page.locator('text=Welcome back!')).toBeVisible()
  })

  test('admin can access admin panel', async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('[placeholder="you@example.com"]', 'admin@newvacancy.com')
    await page.fill('[placeholder="••••••••"]', 'admin123')
    await page.click('button:has-text("Sign In")')

    // Navigate to admin
    await page.goto('/admin')

    // Should see admin dashboard
    await expect(page.locator('text=Admin Dashboard')).toBeVisible()
    await expect(page.locator('text=Total Users')).toBeVisible()
  })
})
```

### Job Management Flow
```javascript
// e2e/admin-jobs.spec.js
import { test, expect } from '@playwright/test'

test.describe('Admin Job Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('[placeholder="you@example.com"]', 'admin@newvacancy.com')
    await page.fill('[placeholder="••••••••"]', 'admin123')
    await page.click('button:has-text("Sign In")')
  })

  test('admin can create new job', async ({ page }) => {
    await page.goto('/admin/jobs')

    // Click add job button
    await page.click('button:has-text("Add Job")')

    // Fill job form
    await page.fill('[placeholder="Job Title"]', 'Senior Developer')
    await page.fill('[placeholder="Organization"]', 'Tech Corp')
    await page.selectOption('select', 'private')
    await page.fill('[placeholder="Apply URL"]', 'https://techcorp.com/careers')
    await page.fill('[type="date"]', '2024-12-31')

    // Submit form
    await page.click('button:has-text("Save Job")')

    // Should see success message and job in list
    await expect(page.locator('text=Job created successfully!')).toBeVisible()
    await expect(page.locator('text=Senior Developer')).toBeVisible()
  })

  test('admin can edit existing job', async ({ page }) => {
    await page.goto('/admin/jobs')

    // Click edit on first job
    await page.locator('[title="Edit"]').first().click()

    // Modify title
    await page.fill('[placeholder="Job Title"]', 'Senior Full Stack Developer')

    // Save changes
    await page.click('button:has-text("Save Job")')

    // Verify update
    await expect(page.locator('text=Job updated successfully!')).toBeVisible()
    await expect(page.locator('text=Senior Full Stack Developer')).toBeVisible()
  })

  test('admin can delete job', async ({ page }) => {
    await page.goto('/admin/jobs')

    // Get initial job count
    const initialCount = await page.locator('table tbody tr').count()

    // Click delete on first job
    page.on('dialog', dialog => dialog.accept())
    await page.locator('[title="Delete"]').first().click()

    // Verify deletion
    await expect(page.locator('text=Job deleted!')).toBeVisible()

    // Job count should decrease
    const finalCount = await page.locator('table tbody tr').count()
    expect(finalCount).toBeLessThan(initialCount)
  })
})
```

## 4. Testing Configuration

### Vitest Configuration
```javascript
// vitest.config.js
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-setup.js',
        '**/*.d.ts',
      ],
    },
  },
})
```

### Test Setup
```javascript
// src/test-setup.js
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend expect with jest-dom matchers
expect.extend(matchers)

// Clean up after each test
afterEach(() => {
  cleanup()
})
```

### Playwright Configuration
```javascript
// playwright.config.js
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
```

## 5. Running Tests

### Unit Tests
```bash
# Run all unit tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test Navbar.test.jsx

# Run in watch mode
npm run test:watch
```

### Integration Tests
```bash
# Run API tests
npm run test:integration

# Run with database setup
npm run test:integration -- --setup-db
```

### E2E Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test
npm run test:e2e auth.spec.js

# Run in headed mode (visible browser)
npm run test:e2e -- --headed

# Run on specific browser
npm run test:e2e -- --project=chromium
```

## 6. Test Data Management

### Test Database Setup
```sql
-- Create test database schema
CREATE SCHEMA IF NOT EXISTS test;

-- Test data fixtures
INSERT INTO test.profiles (id, email, full_name, role) VALUES
  ('test-user-1', 'user@test.com', 'Test User', 'user'),
  ('test-admin-1', 'admin@test.com', 'Test Admin', 'admin');

INSERT INTO test.jobs (title, organization, category, apply_url, last_date) VALUES
  ('Test Job 1', 'Test Corp', 'private', 'https://test.com', '2024-12-31'),
  ('Test Job 2', 'Govt Dept', 'govt', 'https://govt.com', '2024-12-31');
```

### Test Utilities
```javascript
// src/test-utils/testHelpers.js
export const createTestUser = async (overrides = {}) => {
  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'testpass123',
    full_name: 'Test User'
  }

  return { ...defaultUser, ...overrides }
}

export const createTestJob = async (overrides = {}) => {
  const defaultJob = {
    title: 'Test Job',
    organization: 'Test Corp',
    category: 'private',
    apply_url: 'https://test.com/apply',
    last_date: '2024-12-31'
  }

  return { ...defaultJob, ...overrides }
}

export const cleanupTestData = async () => {
  // Clean up test data after tests
  await supabase.from('profiles').delete().ilike('email', 'test-%')
  await supabase.from('jobs').delete().ilike('title', 'Test Job%')
}
```

## 7. CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:coverage

      - name: Run integration tests
        run: npm run test:integration
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BASE_URL: http://localhost:5173

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## 8. Performance Testing

### Lighthouse CI
```yaml
# .lighthouserc.js
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      startServerCommand: 'npm run dev',
      startServerReadyPattern: 'ready',
      url: ['http://localhost:5173']
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
}
```

## 9. Best Practices

### Test Organization
- Group related tests in `describe` blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests independent and isolated

### Mocking Strategy
- Mock external APIs and services
- Use factories for test data creation
- Avoid testing implementation details

### Coverage Goals
- Unit tests: 80%+ coverage
- Integration tests: Key user flows
- E2E tests: Critical business flows

### Performance Benchmarks
- Unit tests: < 100ms per test
- E2E tests: < 30 seconds per flow
- Bundle size: < 500KB gzipped

This testing guide ensures comprehensive coverage of the New_vacancy application, from unit tests to full E2E workflows, providing confidence in code quality and user experience.