import {Document} from '@contentful/rich-text-types';
import {Entry} from 'contentful';
import {ReactNode} from 'react';

import {TypeBylawSkeleton} from '@/src/contentful/types/TypeBylaw';
import {bylaws as localBylaws} from '@/src/data/bylaws';

import {getEntriesCached} from './contentfulClient';
import {renderSafeContentfulDocument} from './safeRichText';

type BylawEntry = Entry<TypeBylawSkeleton, undefined, string>;

export interface Bylaw {
  id: string;
  title: string | ReactNode;
  body: ReactNode;
  order: number;
}

export const parseContentfulBylaw = (bylawEntry?: BylawEntry): Bylaw => {
  // Ensure we're working with a valid Document object
  let richTextDocument: Document | null = null;

  if (bylawEntry?.fields.body) {
    try {
      // If it's already a Document object, use it directly
      if (
        typeof bylawEntry.fields.body === 'object' &&
        bylawEntry.fields.body !== null &&
        'nodeType' in bylawEntry.fields.body &&
        bylawEntry.fields.body.nodeType === 'document'
      ) {
        richTextDocument = bylawEntry.fields.body as Document;
      }
      // If it's a string (JSON), parse it
      else if (typeof bylawEntry.fields.body === 'string') {
        richTextDocument = JSON.parse(bylawEntry.fields.body) as Document;
      }
    } catch (error) {
      console.error('Error parsing rich text document:', error);
    }
  }

  return {
    id: bylawEntry?.fields.id || '',
    title: bylawEntry?.fields.title || '',
    body: richTextDocument ? renderSafeContentfulDocument(richTextDocument) : null,
    order: bylawEntry?.fields.order || 0,
  };
};

export const fetchBylaws = async (): Promise<Bylaw[]> => {
  try {
    const bylawsResult = await getEntriesCached<TypeBylawSkeleton>({
      content_type: 'bylaws',
      order: ['fields.order'], // Sort by order field
    });

    if (bylawsResult.items.length > 0) {
      return bylawsResult.items.map(parseContentfulBylaw);
    }

    // If no Contentful data, fall back to local data
    return localBylaws.map((bylaw, index) => ({
      id: bylaw.id,
      title: typeof bylaw.title === 'function' ? bylaw.title() : bylaw.title,
      body: typeof bylaw.body === 'function' ? bylaw.body() : bylaw.body,
      order: index + 1,
    }));
  } catch (error) {
    console.error('Error fetching bylaws from Contentful:', error);

    // Fall back to local data in case of error
    return localBylaws.map((bylaw, index) => ({
      id: bylaw.id,
      title: typeof bylaw.title === 'function' ? bylaw.title() : bylaw.title,
      body: typeof bylaw.body === 'function' ? bylaw.body() : bylaw.body,
      order: index + 1,
    }));
  }
};
