'use client';

import {Box, Card, CardContent, Typography, Chip, Skeleton, Button} from '@mui/material';
import {toPng} from 'html-to-image';
import {QRCodeCanvas} from 'qrcode.react';
import {useRef} from 'react';

import type {MembershipCard} from '@/src/lib/effect/schemas';
import {downloadStringAsFile} from '@/src/utils/download';

interface DigitalCardProps {
  card: MembershipCard;
  loading?: boolean;
}

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success',
  trialing: 'success',
  past_due: 'warning',
  canceled: 'error',
  incomplete: 'error',
  incomplete_expired: 'error',
  unpaid: 'error',
};

export function DigitalCard({card, loading}: DigitalCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  async function onDownloadClick() {
    const node = cardRef.current;
    if (!node) return;

    const dataUrl = await toPng(node, {pixelRatio: 2});
    downloadStringAsFile(dataUrl, `${card.memberName.split(' ').join('-')}-membership-card.png`);
  }

  if (loading) {
    return (
      <Card
        sx={{
          background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
          color: 'white',
          maxWidth: 400,
          mx: 'auto',
        }}
      >
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Skeleton
              variant="text"
              width={180}
              height={32}
              sx={{bgcolor: 'rgba(255,255,255,0.2)'}}
            />
            <Skeleton
              variant="rounded"
              width={60}
              height={24}
              sx={{bgcolor: 'rgba(255,255,255,0.2)'}}
            />
          </Box>
          <Skeleton variant="text" width={80} sx={{bgcolor: 'rgba(255,255,255,0.2)'}} />
          <Skeleton
            variant="text"
            width={200}
            height={36}
            sx={{bgcolor: 'rgba(255,255,255,0.2)'}}
          />
          <Skeleton variant="text" width={120} sx={{bgcolor: 'rgba(255,255,255,0.2)'}} />
          <Skeleton
            variant="text"
            width={180}
            height={28}
            sx={{bgcolor: 'rgba(255,255,255,0.2)'}}
          />
          <Box display="flex" justifyContent="center" my={2}>
            <Skeleton
              variant="rounded"
              width={150}
              height={150}
              sx={{bgcolor: 'rgba(255,255,255,0.2)'}}
            />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{maxWidth: 400, mx: 'auto'}}>
      <Card
        ref={cardRef}
        sx={{
          background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
          color: 'white',
        }}
      >
        <CardContent>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight="bold">
              Down East Cyclists
            </Typography>
            <Chip label={card.status} color={statusColors[card.status] || 'default'} size="small" />
          </Box>

          {/* Member Info */}
          <Typography variant="body2" sx={{opacity: 0.8}}>
            Member
          </Typography>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            {card.memberName}
          </Typography>

          {/* Membership Number */}
          <Typography variant="body2" sx={{opacity: 0.8}}>
            Membership #
          </Typography>
          <Typography variant="h6" fontFamily="monospace" gutterBottom>
            {card.membershipNumber}
          </Typography>

          {/* Plan & Validity */}
          <Box display="flex" justifyContent="space-between" mb={2}>
            <Box>
              <Typography variant="body2" sx={{opacity: 0.8}}>
                Plan
              </Typography>
              <Typography variant="body1">
                {card.planType === 'family' ? 'Family' : 'Individual'}
              </Typography>
            </Box>
            <Box textAlign="right">
              <Typography variant="body2" sx={{opacity: 0.8}}>
                Valid Until
              </Typography>
              <Typography variant="body1">
                {new Date(card.validUntil).toLocaleDateString()}
              </Typography>
            </Box>
          </Box>

          {/* QR Code */}
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            bgcolor="white"
            borderRadius={2}
            p={2}
          >
            <QRCodeCanvas value={card.qrCodeData} size={250} level="M" />
          </Box>
        </CardContent>
      </Card>

      <Box display="flex" justifyContent="center" mt={2}>
        <Button variant="contained" onClick={onDownloadClick} size="large">
          Download Card
        </Button>
      </Box>
    </Box>
  );
}
