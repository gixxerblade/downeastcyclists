import { fetchBlogPosts } from '@/src/contentful/blogPosts';
import Link from 'next/link';
import Image from 'next/image'
import clsx from 'clsx'
import Skeleton from './skeleton';
import { Suspense } from 'react';
import DecLogo from '../../assets/images/hungry_toad-48.webp'

// Set a reasonable revalidation time (e.g., 1 hour)
export const revalidate = 3600;

export default async function Blog ({ searchParams }: { searchParams: { page: string } }) {
  const page =
    typeof searchParams.page === 'string' ? Number(searchParams.page) : 1
  
  const { data: posts, lastPage } = await fetchBlogPosts(page);
  return (
    <section className='py-24 px-4 md:px-24'>
      <div className="container">
        <div className="mb-12 flex items-center justify-between gap-x-16">
          <h1 className='text-3xl'>News</h1>
          <div className='flex space-x-6'>
            <Link
              href={{
                pathname: '/blog',
                query: {
                  page: page > 1 ? page - 1 : 1
                }
              }}
              className={clsx(
                'rounded border bg-gray-100 px-3 py-1 text-sm text-gray-800 hover:bg-gray-300',
                page <= 1 && 'pointer-events-none opacity-50'
              )}
            >
              Previous
            </Link>
            <Link
              href={{
                pathname: '/blog',
                query: {
                  page: page + 1
                }
              }}
              className={clsx(
                'rounded border bg-gray-100 px-3 py-1 text-sm text-gray-800 hover:bg-gray-300',
                page >= lastPage && 'pointer-events-none opacity-50'
              )}
            >
              Next
            </Link>
          </div>
        </div>
      </div>
      <Suspense fallback={<Skeleton />}>
        <ul
          role='list'
          className='grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4 xl:gap-x-8'
        >
          {posts.map((post) => (
            <li key={post.title} className='relative'>
              <Link href={`/blog/${post.slug}`} className="block">
                <div className='group block aspect-square w-full overflow-hidden rounded-lg bg-gray-100 relative'>
                  <Image
                    src={post.image?.src || DecLogo}
                    alt=''
                    className='object-cover group-hover:opacity-75'
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                </div>
                <p className='mt-2 block truncate font-medium'>{post.title}</p>
                <div className='flex items-center text-xs text-gray-500 mt-1 mb-2'>
                  {post.publishDate && (
                    <time dateTime={post.publishDate}>
                      {new Date(post.publishDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </time>
                  )}
                  {post.author && post.publishDate && (
                    <span className="mx-1">•</span>
                  )}
                  {post.author && (
                    <span>By {post.author}</span>
                  )}
                </div>
                <p className='block text-sm font-medium text-gray-500'>
                  {post.body?.slice(0, 30)}...
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Suspense>
    </section>
  )
}
