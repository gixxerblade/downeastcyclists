import {documentToReactComponents, type Options} from '@contentful/rich-text-react-renderer';
import {BLOCKS, INLINES, MARKS, type Document} from '@contentful/rich-text-types';
import {createElement, type ReactNode} from 'react';

const CONTENTFUL_ASSET_HOSTS = new Set(['images.ctfassets.net', 'images.contentful.com']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringProperty(value: unknown, property: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const propertyValue = value[property];
  return typeof propertyValue === 'string' ? propertyValue : undefined;
}

export function safeContentfulLink(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function safeContentfulAssetUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const normalized = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;

  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:' || !CONTENTFUL_ASSET_HOSTS.has(url.hostname)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function resolvedAsset(nodeData: unknown): {
  readonly url: string;
  readonly alt: string;
} | null {
  if (!isRecord(nodeData)) return null;
  const target = nodeData.target;
  if (!isRecord(target) || !isRecord(target.fields)) return null;

  const file = target.fields.file;
  const rawUrl = stringProperty(file, 'url');
  const url = safeContentfulAssetUrl(rawUrl);
  if (!url) return null;

  const alt =
    stringProperty(target.fields, 'description') ||
    stringProperty(target.fields, 'title') ||
    'Content image';
  return {url, alt};
}

const safeRichTextOptions: Options = {
  renderMark: {
    [MARKS.BOLD]: (text) => createElement('span', {className: 'font-bold'}, text),
    [MARKS.ITALIC]: (text) => createElement('span', {className: 'italic'}, text),
    [MARKS.UNDERLINE]: (text) => createElement('span', {className: 'underline'}, text),
  },
  renderNode: {
    [BLOCKS.PARAGRAPH]: (_node, children) =>
      createElement('p', {className: 'content my-2'}, children),
    [BLOCKS.UL_LIST]: (_node, children) =>
      createElement('ul', {className: 'list-disc pl-6 my-4'}, children),
    [BLOCKS.OL_LIST]: (_node, children) =>
      createElement('ol', {className: 'list-decimal pl-6 my-4'}, children),
    [BLOCKS.LIST_ITEM]: (_node, children) => createElement('li', {className: 'mb-2'}, children),
    [BLOCKS.HEADING_1]: (_node, children) =>
      createElement('h1', {className: 'text-2xl font-bold mt-6 mb-4'}, children),
    [BLOCKS.HEADING_2]: (_node, children) =>
      createElement('h2', {className: 'text-xl font-bold mt-5 mb-3'}, children),
    [BLOCKS.HEADING_3]: (_node, children) =>
      createElement('h3', {className: 'text-lg font-bold mt-4 mb-2'}, children),
    [BLOCKS.HEADING_4]: (_node, children) =>
      createElement('h4', {className: 'text-base font-bold mt-3 mb-2'}, children),
    [BLOCKS.HEADING_5]: (_node, children) =>
      createElement('h5', {className: 'text-sm font-bold mt-3 mb-1'}, children),
    [BLOCKS.HEADING_6]: (_node, children) =>
      createElement('h6', {className: 'text-xs font-bold mt-3 mb-1'}, children),
    [INLINES.HYPERLINK]: (node, children) => {
      const uri = isRecord(node.data) ? safeContentfulLink(node.data.uri) : null;
      if (!uri) return createElement('span', undefined, children);
      return createElement(
        'a',
        {
          href: uri,
          className: 'text-blue-600 hover:underline',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        children,
      );
    },
    [BLOCKS.EMBEDDED_ENTRY]: (_node, children) =>
      createElement('div', {className: 'embedded-entry my-4'}, children),
    [BLOCKS.EMBEDDED_ASSET]: (node) => {
      const asset = resolvedAsset(node.data);
      if (!asset) return null;
      return createElement('img', {
        src: asset.url,
        alt: asset.alt,
        className: 'max-w-full h-auto rounded my-4',
      });
    },
    [BLOCKS.QUOTE]: (_node, children) =>
      createElement(
        'blockquote',
        {className: 'border-l-4 border-gray-300 pl-4 italic my-4'},
        children,
      ),
    [BLOCKS.HR]: () => createElement('hr', {className: 'my-6 border-t border-gray-300'}),
    [BLOCKS.TABLE]: (_node, children) =>
      createElement(
        'table',
        {className: 'min-w-full border-collapse border border-gray-300 my-4'},
        children,
      ),
    [BLOCKS.TABLE_ROW]: (_node, children) =>
      createElement('tr', {className: 'border-b border-gray-300'}, children),
    [BLOCKS.TABLE_CELL]: (_node, children) =>
      createElement('td', {className: 'border border-gray-300 px-4 py-2'}, children),
    [BLOCKS.TABLE_HEADER_CELL]: (_node, children) =>
      createElement(
        'th',
        {className: 'border border-gray-300 px-4 py-2 bg-gray-100 font-bold'},
        children,
      ),
  },
};

export function renderSafeContentfulDocument(document: Document): ReactNode {
  return documentToReactComponents(document, safeRichTextOptions);
}
