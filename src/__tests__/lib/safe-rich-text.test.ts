import {BLOCKS, INLINES, type Document} from '@contentful/rich-text-types';
import {createElement, Fragment} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';

import {
  renderSafeContentfulDocument,
  safeContentfulAssetUrl,
  safeContentfulLink,
} from '@/src/contentful/safeRichText';

describe('safe Contentful rich text', () => {
  it('allows expected links and rejects active or protocol-relative URLs', () => {
    expect(safeContentfulLink('/membership')).toBe('/membership');
    expect(safeContentfulLink('https://example.com/path')).toBe('https://example.com/path');
    expect(safeContentfulLink('javascript:alert(1)')).toBeNull();
    expect(safeContentfulLink('//attacker.example/path')).toBeNull();
  });

  it('only permits HTTPS assets from Contentful hosts', () => {
    expect(safeContentfulAssetUrl('//images.ctfassets.net/photo.jpg')).toBe(
      'https://images.ctfassets.net/photo.jpg',
    );
    expect(safeContentfulAssetUrl('https://attacker.example/photo.jpg')).toBeNull();
    expect(safeContentfulAssetUrl('javascript:alert(1)')).toBeNull();
  });

  it('renders malicious hyperlink content as escaped, inert text', () => {
    const document: Document = {
      nodeType: BLOCKS.DOCUMENT,
      data: {},
      content: [
        {
          nodeType: BLOCKS.PARAGRAPH,
          data: {},
          content: [
            {
              nodeType: INLINES.HYPERLINK,
              data: {uri: 'javascript:alert(1)'},
              content: [
                {
                  nodeType: 'text',
                  value: '<img src=x onerror=alert(1)>',
                  marks: [],
                  data: {},
                },
              ],
            },
          ],
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(Fragment, undefined, renderSafeContentfulDocument(document)),
    );

    expect(markup).not.toContain('href=');
    expect(markup).not.toContain('<img');
    expect(markup).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
