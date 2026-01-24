import {redirect} from 'next/navigation';

import {verifySession} from '@/src/actions/auth';

export default async function la({children}: {children: React.ReactNode}) {
  const session = await verifySession();

  if (!session.authenticated) {
    redirect('/login');
  }

  // Check if user is admin and redirect to dashboard
  const adminEmail = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL || 'info@downeastcyclists.com')
    .toLowerCase()
    .trim();
  const userEmail = (session.email || '').toLowerCase().trim();

  if (userEmail === adminEmail) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
