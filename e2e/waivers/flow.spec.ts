import {test, expect, type Page} from '@playwright/test';
import {z} from 'zod';

import {localPassword, supportUrl} from '../../scripts/waiver-local/fixtures';

// This is one rollout rehearsal against a fresh database: invite only after signing a household.
test.describe.configure({mode: 'serial'});

const statusSchema = z.object({
  waivers: z.array(
    z.object({
      id: z.string(),
      signatureId: z.string().nullable(),
      isSigned: z.boolean(),
      participants: z.array(z.object({name: z.string(), birthDate: z.string()})).nullable(),
      history: z.array(z.object({id: z.string()})),
    }),
  ),
});

async function login(page: Page, email: string, url = '/login') {
  await page.goto(url);
  await page.getByRole('textbox', {name: 'Email', exact: true}).fill(email);
  await page.getByLabel('Password', {exact: true}).fill(localPassword);
  await page.getByRole('button', {name: 'Sign In', exact: true}).click();
  await expect(page).toHaveURL(/\/(member|dashboard)$/);
}

async function fillSigner(page: Page, name: string) {
  await page.getByLabel(/^Your full legal name/).fill(name);
  await page.getByLabel(/^Your birth date/).fill('1985-01-01');
  await page.getByLabel(/^Phone/).fill('555-555-0100');
  await page.getByLabel(/^Street address/).fill('1 Test Street');
  await page.getByLabel(/^City/).fill('Jacksonville');
  await page.getByLabel(/^State/).fill('NC');
  await page.getByLabel(/^ZIP code/).fill('28540');
  await page.getByLabel(/^Type your full legal name to sign/).fill(name);
}

test.beforeEach(async ({request}) => {
  const response = await request.get(`${supportUrl}/health`);
  expect(await response.json()).toEqual({localOnly: true});
});

test('published waiver is available, but signing and records require login', async ({request}) => {
  const waiver = await request.get('/api/waivers/required');
  expect(waiver.status()).toBe(200);
  expect(await waiver.json()).toMatchObject({version: 2});
  const unauthorized = await request.post(
    '/api/member/waivers/00000000-0000-4000-8000-000000000001/sign',
    {data: {}},
  );
  expect(unauthorized.status()).toBe(401);
  const record = await request.get('/api/waivers/records/00000000-0000-4000-8000-000000000001');
  expect(record.status()).toBe(401);
});

test('existing family signs once, retries safely, prints the roster, and preserves earlier copies', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({width: 390, height: 844});
  await login(page, 'family@example.test');
  await expect(page.getByRole('heading', {name: 'Family members', exact: true})).toBeVisible();
  const consent = page.getByRole('checkbox');
  await expect(consent).not.toBeChecked();
  await expect(page.getByRole('button', {name: 'Sign for my household'})).toBeDisabled();
  await fillSigner(page, 'Jordan Family');
  await page.getByRole('button', {name: 'Add family member', exact: true}).click();
  await page.getByLabel('Family member 1 full name').fill('Taylor Family');
  await page.getByLabel('Family member 1 birth date').fill('2015-07-10');
  await consent.check();
  const submitted = page.waitForRequest(
    (request) => request.url().endsWith('/sign') && request.method() === 'POST',
  );
  await page.getByRole('button', {name: 'Sign for my household'}).click();
  const signatureRequest = await submitted;
  await expect(page.getByText('Family waiver complete · 2 people listed')).toBeVisible();
  await page.screenshot({path: 'test-results/family-mobile.png', fullPage: true});
  const payload: unknown = signatureRequest.postDataJSON();
  const retry = await page.request.post(signatureRequest.url(), {data: payload});
  expect(retry.status()).toBe(200);
  expect(await retry.json()).toMatchObject({alreadySigned: true});
  const invalidConsent = await page.request.post(signatureRequest.url(), {
    data: {...z.record(z.unknown()).parse(payload), consent: false},
  });
  expect(invalidConsent.status()).toBe(400);
  const firstStatus = statusSchema.parse(
    await (await page.request.get('/api/member/waivers')).json(),
  ).waivers[0];
  expect(firstStatus?.participants).toHaveLength(2);
  expect(firstStatus?.history).toHaveLength(1);
  const firstRecordUrl = `/api/waivers/records/${firstStatus?.signatureId}`;
  const record = await page.request.get(firstRecordUrl);
  expect(record.status()).toBe(200);
  expect(await record.text()).toContain('Taylor Family</td><td>2015-07-10');

  const outsider = await browser.newContext();
  const outsiderPage = await outsider.newPage();
  await login(outsiderPage, 'outsider@example.test');
  expect((await outsiderPage.request.get(`http://127.0.0.1:3000${firstRecordUrl}`)).status()).toBe(
    404,
  );
  await outsider.close();

  await page.getByRole('button', {name: 'Update family details'}).click();
  await expect(page.getByLabel('Family member 1 full name')).toHaveValue('Taylor Family');
  await expect(page.getByLabel(/^Type your full legal name to sign/)).toHaveValue('');
  await expect(consent).not.toBeChecked();
  await page.getByRole('button', {name: 'Add family member', exact: true}).click();
  await page.getByLabel('Family member 2 full name').fill('Riley Family');
  await page.getByLabel('Family member 2 birth date').fill('1986-03-02');
  await page.getByLabel(/^Type your full legal name to sign/).fill('Jordan Family');
  await consent.check();
  await page.getByRole('button', {name: 'Sign for my household'}).click();
  await expect(page.getByText('Family waiver complete · 3 people listed')).toBeVisible();
  const current = statusSchema.parse(await (await page.request.get('/api/member/waivers')).json())
    .waivers[0];
  expect(current?.history).toHaveLength(2);
  expect(await (await page.request.get(firstRecordUrl)).text()).not.toContain('Riley Family');
  const stale = await page.request.post(signatureRequest.url(), {data: payload});
  expect(stale.status()).toBe(400);
  expect(await stale.json()).toMatchObject({field: 'previousSignatureId'});
});

test('abandoned family form remains unsigned after reload and can be completed later', async ({
  page,
}) => {
  await login(page, 'returning@example.test');
  await fillSigner(page, 'Morgan Returning');
  await page.getByRole('button', {name: 'Add family member', exact: true}).click();
  await page.getByLabel('Family member 1 full name').fill('Unsubmitted Child');
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Family members', exact: true})).toBeVisible();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  const status = statusSchema.parse(await (await page.request.get('/api/member/waivers')).json())
    .waivers[0];
  expect(status?.isSigned).toBe(false);
  expect(status?.signatureId).toBeNull();
});

test('current-member invitation is captured locally and the one-time send does not repeat', async ({
  page,
  request,
}) => {
  await login(page, 'admin@example.test');
  await page.getByRole('button', {name: 'Waivers', exact: true}).click();
  const button = page.getByRole('button', {name: 'Email unsigned members once'});
  await expect(button).toBeVisible();
  const first = page.waitForResponse((response) =>
    response.url().endsWith('/api/admin/waivers/notifications'),
  );
  await button.click();
  expect((await first).status()).toBe(200);
  const mailSchema = z.array(
    z.object({
      id: z.string(),
      to: z.union([z.string(), z.array(z.string())]),
      subject: z.string(),
      html: z.string(),
    }),
  );
  const firstMail = mailSchema.parse(
    await (await request.get(`${supportUrl}/mailbox.json`)).json(),
  );
  expect(firstMail.length).toBeGreaterThan(0);
  expect(firstMail.every((item) => item.subject.includes('liability waiver'))).toBe(true);
  expect(firstMail.some((item) => String(item.to).includes('family@example.test'))).toBe(false);
  expect(firstMail.every((item) => item.html.includes('http://127.0.0.1:3000/login'))).toBe(true);
  const second = page.waitForResponse((response) =>
    response.url().endsWith('/api/admin/waivers/notifications'),
  );
  await button.click();
  expect((await second).status()).toBe(200);
  const secondMail = mailSchema.parse(
    await (await request.get(`${supportUrl}/mailbox.json`)).json(),
  );
  expect(secondMail).toEqual(firstMail);
});

test('new family signs, cancels payment, then resumes checkout without signing again', async ({
  page,
}) => {
  await page.goto('/join');
  await page.getByLabel(/^Email Address/).fill(`new-${Date.now()}@example.test`);
  await page.getByLabel(/^Password/).fill(localPassword);
  await page.getByLabel(/^Confirm Password/).fill(localPassword);
  await fillSigner(page, 'Jamie New');
  await page.getByRole('button', {name: 'Add family member', exact: true}).click();
  await page.getByLabel('Family member 1 full name').fill('Jamie Junior');
  await page.getByLabel('Family member 1 birth date').fill('2016-02-01');
  await page.getByRole('checkbox', {name: /I have read and understand/}).check();
  await page.getByRole('button', {name: /Continue to/}).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:4311\/checkout\/cs_local_/);
  await page.getByRole('link', {name: 'Cancel checkout'}).click();
  await page.goto('/member');
  await expect(page.getByText('Family waiver complete · 2 people listed')).toBeVisible();
  const status = statusSchema.parse(await (await page.request.get('/api/member/waivers')).json())
    .waivers[0];
  expect(status?.isSigned).toBe(true);
  expect(status?.history).toHaveLength(1);
  await page.getByRole('link', {name: 'Complete Membership'}).click();
  await page.getByRole('button', {name: 'Select', exact: true}).click();
  await page.getByRole('button', {name: 'Renew with Stripe'}).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:4311\/checkout\/cs_local_/);
  await page.getByRole('button', {name: 'Simulate successful payment'}).click();
  await expect(page).toHaveURL('http://127.0.0.1:3000/member');
  await expect(page.getByText('Family waiver complete · 2 people listed')).toBeVisible();
  const dashboard: unknown = await (await page.request.get('/api/member/dashboard')).json();
  expect(dashboard).toMatchObject({membership: {status: 'active', planType: 'family'}});
  const finalStatus = statusSchema.parse(
    await (await page.request.get('/api/member/waivers')).json(),
  ).waivers[0];
  expect(finalStatus?.signatureId).toBe(status?.signatureId);
  expect(finalStatus?.history).toHaveLength(1);
});

test('an existing individual follows the captured invitation, signs, and opens their copy', async ({
  page,
  request,
}) => {
  const messages = z
    .array(z.object({to: z.union([z.string(), z.array(z.string())]), html: z.string()}))
    .parse(await (await request.get(`${supportUrl}/mailbox.json`)).json());
  const invitation = messages.find((message) =>
    String(message.to).includes('individual@example.test'),
  );
  expect(invitation).toBeDefined();
  const inviteUrl = invitation?.html.match(/href="(http:\/\/127\.0\.0\.1:3000\/login)"/)?.[1];
  expect(inviteUrl).toBeDefined();
  await login(page, 'individual@example.test', inviteUrl);
  await fillSigner(page, 'Alex Individual');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', {name: 'Sign waiver', exact: true}).click();
  await expect
    .poll(async () => {
      const result = statusSchema.parse(
        await (await page.request.get('/api/member/waivers')).json(),
      );
      return result.waivers[0]?.isSigned;
    })
    .toBe(true);
  const signed = statusSchema.parse(await (await page.request.get('/api/member/waivers')).json())
    .waivers[0];
  expect(signed?.participants).toHaveLength(1);
  expect((await page.request.get(`/api/waivers/records/${signed?.signatureId}`)).status()).toBe(
    200,
  );
});
