import {Container, CircularProgress, Box} from '@mui/material';
import {Suspense} from 'react';

import {getMemberDashboard} from '@/src/actions/portal';
import {MemberDashboardClient} from '@/src/components/member/MemberDashboardClient';
import {PostCheckoutLoader} from '@/src/components/member/PostCheckoutLoader';

function DashboardLoading() {
  return (
    <Container maxWidth="md" sx={{py: 4}}>
      <Box
        sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh'}}
      >
        <CircularProgress />
      </Box>
    </Container>
  );
}

interface MemberDashboardPageProps {
  searchParams: Promise<{session_id?: string}>;
}

export default async function MemberDashboardPage({searchParams}: MemberDashboardPageProps) {
  const params = await searchParams;
  const sessionId = params.session_id;

  // If coming from Stripe checkout, show loading/polling state
  if (sessionId) {
    return <PostCheckoutLoader sessionId={sessionId} />;
  }

  // Normal dashboard flow
  const dashboardData = await getMemberDashboard();

  return (
    <Suspense fallback={<DashboardLoading />}>
      <MemberDashboardClient initialData={dashboardData} />
    </Suspense>
  );
}
