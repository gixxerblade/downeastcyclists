import React from 'react';
import { Container, Typography } from '@mui/material';
import Link from 'next/link';

// Force static generation since membership info rarely changes
export const dynamic = 'force-static';

export default function Membership () {
  return (
    <Container maxWidth="md" sx={{ paddingTop: 8, paddingBottom: 8 }}>
      <Typography variant="h3" component="h1" gutterBottom align="center">
        Membership
      </Typography>

      <div className="mt-8">
        <Typography variant="h4" component="h3" gutterBottom>
          Discounts
        </Typography>
        <Typography variant="body1" paragraph>
          10 percent discount at{' '}
          <Link
            href="https://www.thebicycle.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-blue-600 hover:underline"
          >
            The Bicycle Shop
          </Link>
          {' '}and{' '}
          <Link
            href="https://www.bicycle-gallery.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-blue-600 hover:underline"
          >
            The Bicycle Gallery
          </Link>
          {' '}after 30 days of paid membership begins and only available to
          active club members. Free supported Centuries, insured events,
          social gatherings, and Ad Hoc Holiday parties.
        </Typography>
      </div>

      <div className="mt-8">
        <Typography variant="h4" component="h3" gutterBottom>
          Club Events
        </Typography>
        <Typography variant="h6" component="h4" gutterBottom>
          Down East Cyclists has sponsored a number of events throughout the years:
        </Typography>
        <ul className="list-disc pl-6 mb-4">
          <li>Coastal Carolina Off-Road Series</li>
          <li>Centuries</li>
          <li>Group rides</li>
          <li>Mountain Bike Camping Trips</li>
          <li>Social Gatherings</li>
          <li>Community Involvement</li>
          <li>Wounded Warrior Battalion weekly rides</li>
          <li>Various charity events</li>
          <li>Croatan Buck Fifty aid station</li>
          <li>Hope for the Warriors&apos; Cyclist Support</li>
          <li>Trail cleanup days at Big Branch</li>
          <li>Take a Kid Moutain Biking</li>
          <li>Annual community New Year&apos;s Day Ride</li>
          <li>USO NC Coastal Team&apos;s Outdoor Adventures Program</li>
        </ul>
        <Typography variant="body1">...and more</Typography>
      </div>

      <div className="mt-8">
        <Typography variant="h4" component="h3" gutterBottom>
          Initial Dues / Membership Renewal
        </Typography>
        <Typography variant="body1" paragraph className="flex items-center">
          <span className="mr-2">👉👉👉</span>
          <Link
            href="https://www.bikereg.com/down-east-cyclists-membership0"
            target="_blank"
            rel="noreferrer noopener"
            className="font-bold underline text-blue-600 hover:text-blue-800"
          >
            Dues can be renewed online here
          </Link>
          <span className="ml-2">👈👈👈</span>
        </Typography>
        <Typography variant="body1" paragraph>
          Cost is $30 dollars per individual or $50 a year per family!
        </Typography>
        <Typography variant="body1" paragraph>
          Don&apos;t forget to provide your information and sign your online
          release. Additionally, forms are available at The Bicycle Shop, Bicycle Gallery, or
          club meetings.
        </Typography>
      </div>
    </Container>
  );
}
