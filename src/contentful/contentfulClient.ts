import { createClient } from 'contentful';
import { cache } from 'react';

// Create Contentful client
export const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID || '',
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN || '',
});
