import {Alert, Button, Container} from '@mui/material';
import Link from 'next/link';
import {redirect} from 'next/navigation';

import {verifySession} from '@/src/actions/auth';
import {MemberWaiverGate} from '@/src/components/waivers/MemberWaiverGate';
import {waiverReturnPath, waiverSigningPath} from '@/src/lib/waivers/navigation';

export const metadata = {title: 'Sign your waiver - Down East Cyclists'};

export default async function WaiversPage({
  searchParams,
}: {
  searchParams: Promise<{household?: string; templateId?: string; returnTo?: string}>;
}) {
  const params = await searchParams;
  const session = await verifySession();
  const path = waiverSigningPath({
    household: params.household === '1',
    templateId: params.templateId,
    returnTo: params.returnTo,
  });
  if (!session.authenticated) redirect(`/login?returnTo=${encodeURIComponent(path)}`);
  return (
    <MemberWaiverGate
      requireHousehold={params.household === '1'}
      requestedTemplateId={params.templateId}
    >
      <Container sx={{py: 4}}>
        <Alert severity="success">
          Your required waivers are complete. Your signed copies are available above.
        </Alert>
        <Button
          component={Link}
          href={waiverReturnPath(params.returnTo)}
          sx={{mt: 2}}
          variant="contained"
        >
          {params.returnTo === '/renew'
            ? 'Continue membership checkout'
            : 'Continue to your account'}
        </Button>
      </Container>
    </MemberWaiverGate>
  );
}
