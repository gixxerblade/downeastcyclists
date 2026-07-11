import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import {Suspense} from 'react';

import {fetchBlogPosts} from '@/src/contentful/blogPosts';

import Skeleton from './skeleton';

export const revalidate = 3600;

const filters = ['All', 'Ride reports', 'Trails', 'Club news'];

function getPostExcerpt(body: string | null, maxLength = 220) {
  if (!body) return '';

  const excerpt = body
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#*_>`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return excerpt.length > maxLength ? `${excerpt.slice(0, maxLength).trim()}...` : excerpt;
}

export default async function Blog({searchParams}: {searchParams: Promise<{page: string}>}) {
  const resolvedParams = await searchParams;
  const page = typeof resolvedParams.page === 'string' ? Number(resolvedParams.page) : 1;
  const {data: posts, lastPage} = await fetchBlogPosts(page);
  const [featured, ...rest] = posts;

  return (
    <main className="dec-page">
      <section className="dec-container py-16 md:py-20">
        <div className="mb-4 text-sm font-bold tracking-[.1em] text-[#F20E02]">CLUB NEWS</div>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h1 className="dec-display text-6xl md:text-[92px]">Latest from DEC</h1>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <span
                key={filter}
                className={clsx(
                  'rounded-full border px-4 py-2 text-sm font-bold',
                  filter === 'All'
                    ? 'border-[#F20E02] bg-[#F20E02] text-white'
                    : 'border-[var(--dec-border)] text-[var(--dec-muted)]',
                )}
              >
                {filter}
              </span>
            ))}
          </div>
        </div>
      </section>

      <Suspense fallback={<Skeleton />}>
        <section className="dec-container pb-20">
          {featured && (
            <Link
              href={`/blog/${featured.slug}`}
              className="dec-card mb-10 grid overflow-hidden transition hover:border-[#F20E02] md:grid-cols-[1.1fr_.9fr]"
            >
              <div className="relative min-h-[280px] md:min-h-[420px]">
                <Image
                  src={featured.image?.src || '/redesign-assets/hero-poster.png'}
                  alt={featured.image?.alt || ''}
                  className="object-cover"
                  fill
                  sizes="(max-width: 768px) 100vw, 55vw"
                />
              </div>
              <div className="flex flex-col justify-center p-7 md:p-10">
                <div className="mb-4 text-sm font-bold tracking-[.1em] text-[#F20E02]">
                  FEATURED POST
                </div>
                <h2 className="font-[Anton] text-4xl leading-none md:text-6xl">{featured.title}</h2>
                <div className="mt-4 text-sm text-[var(--dec-muted-2)]">
                  {featured.publishDate && (
                    <time dateTime={featured.publishDate}>
                      {new Date(featured.publishDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                  )}
                  {featured.author && <span> · By {featured.author}</span>}
                </div>
                <p className="mt-5 line-clamp-3 leading-7 text-[var(--dec-muted)]">
                  {getPostExcerpt(featured.body, 260)}
                </p>
              </div>
            </Link>
          )}

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <Link
                key={post.slug || post.title}
                href={`/blog/${post.slug}`}
                className="dec-card overflow-hidden transition hover:border-[#F20E02]"
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={post.image?.src || '/redesign-assets/hero-poster.png'}
                    alt={post.image?.alt || ''}
                    className="object-cover"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold">{post.title}</h3>
                  <div className="mt-2 text-xs text-[var(--dec-muted-2)]">
                    {post.publishDate && (
                      <time dateTime={post.publishDate}>
                        {new Date(post.publishDate).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </time>
                    )}
                    {post.author && <span> · By {post.author}</span>}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--dec-muted)]">
                    {getPostExcerpt(post.body)}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-10 flex items-center justify-center gap-3 sm:gap-5">
            <Link
              href={{pathname: '/blog', query: {page: page > 1 ? page - 1 : 1}}}
              className={clsx('dec-secondary-button', page <= 1 && 'pointer-events-none opacity-50')}
            >
              Previous
            </Link>
            <span className="min-w-20 text-center text-sm font-bold text-[var(--dec-muted)]">
              Page {page}
            </span>
            <Link
              href={{pathname: '/blog', query: {page: page + 1}}}
              className={clsx('dec-secondary-button', page >= lastPage && 'pointer-events-none opacity-50')}
            >
              Next
            </Link>
          </div>
        </section>
      </Suspense>
    </main>
  );
}
