import {vi, beforeEach} from 'vitest';

// Set test environment variables
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
process.env.STRIPE_PRICE_INDIVIDUAL = 'price_individual_test';
process.env.STRIPE_PRICE_FAMILY = 'price_family_test';
process.env.GOOGLE_PROJECT_ID = 'test-project';
process.env.GOOGLE_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com';
process.env.GOOGLE_PRIVATE_KEY = 'test-private-key';

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
