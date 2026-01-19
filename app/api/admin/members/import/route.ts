import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import type {BulkImportRow} from '@/src/types/admin';

// POST - Bulk import members from CSV
export async function POST(request: NextRequest) {
  const body: {rows: BulkImportRow[]; execute?: boolean} = await request.json();

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const adminUser = yield* admin.verifyAdmin(sessionCookie);
        return yield* admin.bulkImportMembers(body.rows, adminUser.uid, adminUser.email);
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'FirestoreError',
      'ImportError',
      'CardError',
      'QRError',
    ],
  });
}
