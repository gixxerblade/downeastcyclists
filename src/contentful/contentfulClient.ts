import { createClient } from 'contentful';
import { cache } from 'react';

// Create Contentful client
export const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID || '',
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN || '',
});

// Create cached version of the client's getEntries method
export const getEntriesCached = cache(client.getEntries.bind(client));

// Create cached version of the client's getAsset method
export const getAssetCached = cache(client.getAsset.bind(client));
