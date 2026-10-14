import {createHmac, randomUUID} from 'node:crypto';
import type {IncomingMessage, ServerResponse} from 'node:http';

import {PGlite, types} from '@electric-sql/pglite';
import {z} from 'zod';

import {LOCAL_TEST_DATABASE_URL} from '../../src/lib/local-testing';

import {
  appUrl,
  supportUrl,
  emulatorUrl,
  localAccounts,
  localPassword,
  localProject,
  webhookSecret,
} from './fixtures';

const sqlRequest = z.object({query: z.string(), params: z.array(z.unknown()).default([])});
const mailRequest = z.object({
  to: z.union([z.string(), z.array(z.string())]),
  subject: z.string(),
  html: z.string().optional(),
  text: z.string().optional(),
});
type Mail = z.infer<typeof mailRequest> & {id: string};
type LocalCheckout = {
  id: string;
  email: string;
  userId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
};

export function escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function htmlPage(title: string, content: string): string {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
  <style>body{font:16px/1.6 system-ui;max-width:940px;margin:40px auto;padding:0 24px;color:#18212c}a{color:#ae1820}table{border-collapse:collapse;width:100%}td,th{padding:10px;text-align:left;border-bottom:1px solid #ccc}article{border:1px solid #ccc;padding:20px;margin:20px 0}button{padding:12px 20px;font:inherit}iframe{width:100%;height:260px;border:0}.notice{background:#fff2cc;padding:18px}code{background:#eee;padding:4px}</style>
  <h1>${escape(title)}</h1><p class="notice">LOCAL TEST ONLY — fake accounts, captured email, simulated payments. No real member records or charges.</p>${content}</html>`;
}

export function json(response: ServerResponse, value: unknown, status = 200) {
  response.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  response.end(JSON.stringify(value));
}

async function body(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += data.length;
    if (size > 2_000_000) throw new Error('Local request exceeds limit');
    chunks.push(data);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createLocalProviders(pg: PGlite) {
  const mail: Mail[] = [];
  const idempotency = new Map<string, {id: string; payload: string}>();
  const checkouts = new Map<string, LocalCheckout>();
  const completed = new Set<string>();
  const rawParsers = Object.fromEntries(
    Object.values(types)
      .filter((value) => typeof value === 'number')
      .map((value) => [value, (text: string) => text]),
  );

  async function sql(value: z.infer<typeof sqlRequest>, connection: Pick<PGlite, 'query'> = pg) {
    const result = await connection.query(value.query, value.params, {
      rowMode: 'array',
      parsers: rawParsers,
    });
    return {...result, rowCount: result.affectedRows || result.rows.length};
  }

  return async (request: IncomingMessage, response: ServerResponse) => {
    const origin = request.headers.origin;
    if (
      !['127.0.0.1:4311'].includes(request.headers.host ?? '') ||
      (origin && ![appUrl, supportUrl].includes(origin))
    ) {
      return json(response, {error: 'Local access only'}, 403);
    }
    const url = new URL(request.url ?? '/', supportUrl);
    if (request.method === 'POST' && url.pathname === '/sql') {
      if (request.headers['neon-connection-string'] !== LOCAL_TEST_DATABASE_URL || origin)
        return json(response, {error: 'Local SQL client required'}, 403);
      const input = z
        .union([sqlRequest, z.object({queries: z.array(sqlRequest)})])
        .parse(JSON.parse(await body(request)));
      if ('queries' in input) {
        const results = await pg.transaction(async (transaction) => {
          const batch = [];
          for (const query of input.queries) batch.push(await sql(query, transaction));
          return batch;
        });
        return json(response, {results});
      }
      return json(response, await sql(input));
    }
    if (request.method === 'POST' && url.pathname === '/emails') {
      if (request.headers.authorization !== 'Bearer re_local_waiver_test_only')
        return json(response, {message: 'Local email key required'}, 403);
      const payload = await body(request);
      const parsed = mailRequest.parse(JSON.parse(payload));
      const key = String(request.headers['idempotency-key'] ?? randomUUID());
      const previous = idempotency.get(key);
      if (previous)
        return json(
          response,
          previous.payload === payload
            ? {id: previous.id}
            : {message: 'Idempotency payload changed'},
          previous.payload === payload ? 200 : 409,
        );
      const id = randomUUID();
      mail.push({...parsed, id});
      idempotency.set(key, {id, payload});
      return json(response, {id});
    }
    if (request.method === 'GET' && url.pathname === '/mailbox.json') return json(response, mail);
    if (request.method === 'GET' && url.pathname === '/health')
      return json(response, {localOnly: true});
    if (request.method === 'GET' && url.pathname.startsWith('/v1/prices/')) {
      const id = url.pathname.split('/').at(-1);
      if (!['price_local_individual', 'price_local_family'].includes(id ?? ''))
        return json(response, {error: {message: 'Unknown local price'}}, 404);
      const family = id === 'price_local_family';
      return json(response, {
        id,
        object: 'price',
        active: true,
        currency: 'usd',
        unit_amount: family ? 4000 : 2500,
        recurring: {interval: 'year'},
        product: {
          id: `prod_${id}`,
          object: 'product',
          name: family ? 'Family Annual Membership' : 'Individual Annual Membership',
          description: 'Local test membership',
          active: true,
        },
      });
    }
    if (request.method === 'POST' && url.pathname === '/v1/checkout/sessions') {
      const form = new URLSearchParams(await body(request));
      const item = {
        id: `cs_local_${randomUUID()}`,
        email: form.get('customer_email') ?? '',
        userId: form.get('metadata[userId]') ?? '',
        priceId: form.get('line_items[0][price]') ?? '',
        successUrl: form.get('success_url') ?? '',
        cancelUrl: form.get('cancel_url') ?? '',
      };
      if (![item.successUrl, item.cancelUrl].every((value) => new URL(value).origin === appUrl))
        throw new Error('Checkout destinations must remain local');
      checkouts.set(item.id, item);
      return json(response, {
        id: item.id,
        object: 'checkout.session',
        url: `${supportUrl}/checkout/${item.id}`,
      });
    }
    if (request.method === 'GET' && url.pathname.startsWith('/v1/subscriptions/')) {
      const id = url.pathname.slice('/v1/subscriptions/'.length);
      const checkout = checkouts.get(id.replace('sub_', ''));
      if (!checkout) return json(response, {error: {message: 'Unknown local subscription'}}, 404);
      const start = Math.floor(Date.now() / 1000);
      return json(response, {
        id,
        status: 'active',
        customer: `cus_${checkout.id}`,
        cancel_at_period_end: false,
        items: {
          data: [
            {
              id: `si_${checkout.id}`,
              price: {id: checkout.priceId},
              current_period_start: start,
              current_period_end: start + 365 * 86400,
            },
          ],
        },
      });
    }
    if (url.pathname.startsWith('/checkout/')) {
      const checkout = checkouts.get(url.pathname.slice('/checkout/'.length));
      if (!checkout) return json(response, {error: 'Unknown checkout'}, 404);
      if (request.method === 'POST') {
        if (!completed.has(checkout.id)) {
          const payload = JSON.stringify({
            id: `evt_${checkout.id}`,
            object: 'event',
            type: 'checkout.session.completed',
            data: {
              object: {
                id: checkout.id,
                customer: `cus_${checkout.id}`,
                subscription: `sub_${checkout.id}`,
                customer_email: checkout.email,
                customer_details: {email: checkout.email},
                metadata: {userId: checkout.userId, priceId: checkout.priceId},
              },
            },
          });
          const timestamp = Math.floor(Date.now() / 1000);
          const signature = createHmac('sha256', webhookSecret)
            .update(`${timestamp}.${payload}`)
            .digest('hex');
          const delivered = await fetch(`${appUrl}/api/webhooks/stripe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'stripe-signature': `t=${timestamp},v1=${signature}`,
            },
            body: payload,
          });
          if (!delivered.ok)
            throw new Error(`Local checkout webhook failed: ${await delivered.text()}`);
          completed.add(checkout.id);
        }
        response.writeHead(303, {
          Location: checkout.successUrl.replace('{CHECKOUT_SESSION_ID}', checkout.id),
        });
        return response.end();
      }
      response.setHeader('Content-Type', 'text/html');
      return response.end(
        htmlPage(
          'Simulated checkout',
          `<p>No card details are needed. This exercises the website’s checkout and webhook flow, not Stripe’s hosted payment UI.</p><p>${escape(checkout.email)}</p><form method="post"><button>Simulate successful payment</button></form><p><a href="${escape(checkout.cancelUrl)}">Cancel checkout</a></p>`,
        ),
      );
    }
    if (request.method === 'GET' && url.pathname === '/auth-links') {
      const result = await fetch(`${emulatorUrl}/emulator/v1/projects/${localProject}/oobCodes`);
      const {oobCodes} = z
        .object({oobCodes: z.array(z.object({email: z.string(), oobLink: z.string()})).default([])})
        .parse(await result.json());
      response.setHeader('Content-Type', 'text/html');
      return response.end(
        htmlPage(
          'Local sign-in links',
          oobCodes
            .map((link) => `<p><a href="${escape(link.oobLink)}">${escape(link.email)}</a></p>`)
            .join('') || '<p>No sign-in links requested yet.</p>',
        ),
      );
    }
    if (request.method === 'GET' && url.pathname === '/') {
      response.setHeader('Content-Type', 'text/html');
      return response.end(
        htmlPage(
          'Waiver test desk',
          `<p><a href="${appUrl}/login">Sign in</a> · <a href="${appUrl}/join">New member signup</a> · <a href="/auth-links">Email sign-in links</a> · <a href="/">Refresh inbox</a></p>
      <h2>Test accounts</h2><p>Password for each: <code>${localPassword}</code>. Use a private window when switching members.</p><table><tr><th>Email</th><th>Scenario</th></tr>${localAccounts.map((account) => `<tr><td>${account.email}</td><td>${account.name} (${account.plan})</td></tr>`).join('')}</table>
      <h2>Test checklist</h2><ol><li>Sign in as admin and open Waivers. Send the one-time invitation. The emails appear below.</li><li>Sign in as family and enter the household roster. Submit once, then print the saved copy.</li><li>Sign in as returning, leave without submitting, then return. It must still be pending.</li><li>Register a new example.test email, sign, and test simulated checkout or cancellation.</li><li>Return as admin to verify completion and view the exact family record.</li></ol>
      <p>Known gaps under test: receipt email and invitation routing for staff accounts are not yet implemented. Reloading an unfinished form clears its draft.</p><h2>Captured outgoing emails (${mail.length})</h2>${mail.map((item) => `<article><h3>${escape(item.subject)}</h3><p>To: ${escape(String(item.to))}</p><iframe sandbox="allow-popups allow-top-navigation-by-user-activation" title="Email preview" srcdoc="${escape(item.html ?? `<pre>${escape(item.text ?? '')}</pre>`)}"></iframe></article>`).join('') || '<p>No outgoing email yet.</p>'}`,
        ),
      );
    }
    return json(response, {error: 'This provider operation is not simulated'}, 501);
  };
}
