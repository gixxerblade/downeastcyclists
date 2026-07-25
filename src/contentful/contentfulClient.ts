import {createClient, EntrySkeletonType} from 'contentful';
import {cache} from 'react';

const hasContentfulConfig = Boolean(
  process.env.CONTENTFUL_SPACE_ID && process.env.CONTENTFUL_ACCESS_TOKEN,
);

// Create Contentful client
export const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID || 'missing-space',
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN || 'missing-token',
});

// Create cached version of the client's getEntries method
export const getEntriesCached = cache(
  <T extends EntrySkeletonType>(query: Parameters<typeof client.getEntries<T>>[0]) => {
    if (!hasContentfulConfig) {
      return Promise.resolve({items: [], total: 0});
    }

    return client.getEntries<T>(query);
  },
);

// Create cached version of the client's getAsset method
export const getAssetCached = cache((assetId: string) => {
  if (!hasContentfulConfig) {
    return Promise.resolve(null);
  }

  return client.getAsset(assetId);
});
