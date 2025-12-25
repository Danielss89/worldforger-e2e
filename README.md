# WorldForger E2E Tests

End-to-end tests for WorldForger API and Client using Playwright.

## Features

- **Cross-browser testing**: Chromium, Firefox, and mobile Chrome
- **Page Object Model**: Organized test structure with reusable page objects
- **GitHub Actions Integration**: Automatic PR comments and tag notifications
- **Test Reports**: HTML reports with screenshots and videos on failure

## Setup

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run install:browsers

# Copy environment file
cp .env.example .env
```

## Configuration

Edit `.env` with your test environment:

```env
CLIENT_URL=http://localhost:5173
API_URL=http://localhost:8000
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=password123
```

## Running Tests

```bash
# Run all tests
npm test

# Run with UI mode
npm run test:ui

# Run in headed mode (see browser)
npm run test:headed

# Debug mode
npm run test:debug

# Generate test code
npm run test:codegen

# View last report
npm run test:report
```

## Project Structure

```
worldforger-e2e/
├── tests/                  # Test files
│   ├── auth/              # Authentication tests
│   ├── worlds/            # World management tests
│   └── api/               # API-level tests
├── page-objects/          # Page Object classes
├── fixtures/              # Test fixtures and utilities
├── .github/workflows/     # GitHub Actions
└── playwright.config.ts   # Playwright configuration
```

## GitHub Actions

The workflow runs on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Tags matching `v*`
- Manual trigger with custom URLs

### PR Comments

When tests run on a PR, results are automatically commented:

| Metric | Value |
|--------|-------|
| Passed | 10    |
| Failed | 0     |
| Duration | 45s |

### Secrets Required

Set these in your repository secrets:
- `TEST_USER_EMAIL`: Test user email
- `TEST_USER_PASSWORD`: Test user password

## Writing Tests

### Using Page Objects

```typescript
import { LoginPage } from '../page-objects/login.page';

test('should login successfully', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login('user@example.com', 'password');
});
```

### Using Fixtures

```typescript
import { test, expect } from '../fixtures/auth.fixture';

test('should access dashboard', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  await expect(authenticatedPage).toHaveURL(/dashboard/);
});
```

## License

MIT
