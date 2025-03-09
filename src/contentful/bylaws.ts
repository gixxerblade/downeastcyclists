import { TypeBylawSkeleton } from '@/src/contentful/types/TypeBylaw';
import { Entry } from 'contentful';
import { client, getEntriesCached } from './contentfulClient';
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';
import { Document, BLOCKS, INLINES, MARKS } from '@contentful/rich-text-types';
import { bylaws as localBylaws } from '@/src/data/bylaws';
import React, { ReactNode } from 'react';

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
      if (typeof bylawEntry.fields.body === 'object' && 
          bylawEntry.fields.body !== null && 
          'nodeType' in bylawEntry.fields.body && 
          bylawEntry.fields.body.nodeType === 'document') {
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

  // Convert the rich text to HTML string
  const htmlContent = richTextDocument 
    ? documentToHtmlString(richTextDocument, {
        renderMark: {
          [MARKS.BOLD]: text => `<span class="font-bold">${text}</span>`,
          [MARKS.ITALIC]: text => `<span class="italic">${text}</span>`,
          [MARKS.UNDERLINE]: text => `<span class="underline">${text}</span>`,
        },
        renderNode: {
          [BLOCKS.PARAGRAPH]: (node, next) => `<p class="content my-2">${next(node.content)}</p>`,
          [BLOCKS.UL_LIST]: (node, next) => `<ul class="list-disc pl-6 my-4">${next(node.content)}</ul>`,
          [BLOCKS.OL_LIST]: (node, next) => `<ol class="list-decimal pl-6 my-4">${next(node.content)}</ol>`,
          [BLOCKS.LIST_ITEM]: (node, next) => `<li class="mb-2">${next(node.content)}</li>`,
          [BLOCKS.HEADING_1]: (node, next) => `<h1 class="text-2xl font-bold mt-6 mb-4">${next(node.content)}</h1>`,
          [BLOCKS.HEADING_2]: (node, next) => `<h2 class="text-xl font-bold mt-5 mb-3">${next(node.content)}</h2>`,
          [BLOCKS.HEADING_3]: (node, next) => `<h3 class="text-lg font-bold mt-4 mb-2">${next(node.content)}</h3>`,
          [BLOCKS.HEADING_4]: (node, next) => `<h4 class="text-base font-bold mt-3 mb-2">${next(node.content)}</h4>`,
          [BLOCKS.HEADING_5]: (node, next) => `<h5 class="text-sm font-bold mt-3 mb-1">${next(node.content)}</h5>`,
          [BLOCKS.HEADING_6]: (node, next) => `<h6 class="text-xs font-bold mt-3 mb-1">${next(node.content)}</h6>`,
          [INLINES.HYPERLINK]: (node, next) => {
            const { uri } = node.data;
            return `<a href="${uri}" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">${next(node.content)}</a>`;
          },
          [BLOCKS.EMBEDDED_ENTRY]: (node, next) => `<div class="embedded-entry my-4">${next(node.content)}</div>`,
          [BLOCKS.EMBEDDED_ASSET]: (node) => {
            const { target } = node.data;
            if (target?.fields?.file?.url) {
              return `<img src="${target.fields.file.url}" alt="${target.fields.description || target.fields.title}" class="max-w-full h-auto rounded my-4" />`;
            }
            return '';
          },
          [BLOCKS.QUOTE]: (node, next) => `<blockquote class="border-l-4 border-gray-300 pl-4 italic my-4">${next(node.content)}</blockquote>`,
          [BLOCKS.HR]: () => `<hr class="my-6 border-t border-gray-300" />`,
          [BLOCKS.TABLE]: (node, next) => `<table class="min-w-full border-collapse border border-gray-300 my-4">${next(node.content)}</table>`,
          [BLOCKS.TABLE_ROW]: (node, next) => `<tr class="border-b border-gray-300">${next(node.content)}</tr>`,
          [BLOCKS.TABLE_CELL]: (node, next) => `<td class="border border-gray-300 px-4 py-2">${next(node.content)}</td>`,
          [BLOCKS.TABLE_HEADER_CELL]: (node, next) => `<th class="border border-gray-300 px-4 py-2 bg-gray-100 font-bold">${next(node.content)}</th>`,
          // Add special handling for document
          [BLOCKS.DOCUMENT]: (node, next) => next(node.content),
        }
      })
    : '';

  return {
    id: bylawEntry?.fields.id || '',
    title: bylawEntry?.fields.title || '',
    // Use dangerouslySetInnerHTML to render the HTML string
    body: htmlContent 
      ? React.createElement('div', { dangerouslySetInnerHTML: { __html: htmlContent } }) 
      : null,
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
