import {redirect} from 'next/navigation';

import {verifySession} from '@/src/actions/auth';
import {isPrimaryAdminEmail} from '@/src/lib/primary-admin';

export default async function MemberLayout({children}: {children: React.ReactNode}) {
  const session = await verifySession();

  if (!session.authenticated) {
    redirect('/login');
  }

  if (isPrimaryAdminEmail(session.email)) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
