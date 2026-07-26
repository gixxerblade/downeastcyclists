import {Document} from '@contentful/rich-text-types';
import {Entry} from 'contentful';
import {ReactNode} from 'react';

import {TypePrivacySkeleton} from '@/src/contentful/types/TypePrivacy';
import {privacy as localPrivacy} from '@/src/data/privacy';

import {getEntriesCached} from './contentfulClient';
import {renderSafeContentfulDocument} from './safeRichText';

type PrivacyEntry = Entry<TypePrivacySkeleton, undefined, string>;

export interface Privacy {
  id: string;
  title: string | ReactNode;
  body: ReactNode;
  order: number;
}

export const parseContentfulPrivacy = (privacyEntry?: PrivacyEntry): Privacy => {
  // Ensure we're working with a valid Document object
  let richTextDocument: Document | null = null;

  if (privacyEntry?.fields.body) {
    try {
      // If it's already a Document object, use it directly
      if (
        typeof privacyEntry.fields.body === 'object' &&
        privacyEntry.fields.body !== null &&
        'nodeType' in privacyEntry.fields.body &&
        privacyEntry.fields.body.nodeType === 'document'
      ) {
        richTextDocument = privacyEntry.fields.body as Document;
      }
      // If it's a string (JSON), parse it
      else if (typeof privacyEntry.fields.body === 'string') {
        richTextDocument = JSON.parse(privacyEntry.fields.body) as Document;
      }
    } catch (error) {
      console.error('Error parsing rich text document:', error);
    }
  }

  return {
    id: privacyEntry?.fields.id || '',
    title: privacyEntry?.fields.title || '',
    body: richTextDocument ? renderSafeContentfulDocument(richTextDocument) : null,
    order: privacyEntry?.fields.order || 0,
  };
};

export const fetchPrivacy = async (): Promise<Privacy[]> => {
  try {
    const privacyResult = await getEntriesCached<TypePrivacySkeleton>({
      content_type: 'privacy',
      order: ['fields.order'], // Sort by order field
    });

    if (privacyResult.items.length > 0) {
      return privacyResult.items.map(parseContentfulPrivacy);
    }

    // If no Contentful data, fall back to local data
    return localPrivacy.map((privacy, index) => ({
      id: privacy.id,
      title: typeof privacy.title === 'function' ? privacy.title() : privacy.title,
      body: typeof privacy.body === 'function' ? privacy.body() : privacy.body,
      order: index + 1,
    }));
  } catch (error) {
    console.error('Error fetching privacy from Contentful:', error);

    // Fall back to local data in case of error
    return localPrivacy.map((privacy, index) => ({
      id: privacy.id,
      title: typeof privacy.title === 'function' ? privacy.title() : privacy.title,
      body: typeof privacy.body === 'function' ? privacy.body() : privacy.body,
      order: index + 1,
    }));
  }
};
