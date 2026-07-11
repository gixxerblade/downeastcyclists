import Image from 'next/image';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {fetchBlogPostBySlug} from '@/src/contentful/blogPosts';

import DecLogo from '../../../assets/images/hungry_toad-48.webp';

// Set a reasonable revalidation time (e.g., 1 hour)
export const revalidate = 3600;

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function BlogPostPage({params}: BlogPostPageProps) {
  const {slug} = await params;
  const post = await fetchBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="dec-page">
      <div className="dec-container max-w-5xl py-12 md:py-16">
        <Link
          href="/blog"
          className="inline-flex min-h-11 items-center text-sm font-bold text-[#F20E02]"
        >
          ← Back to all posts
        </Link>

        <h1 className="dec-display mt-8 max-w-4xl text-5xl md:text-[82px]">{post.title}</h1>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-semibold text-[var(--dec-muted-2)]">
          {post.publishDate && (
            <time dateTime={post.publishDate}>
              {new Date(post.publishDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          )}
          {post.author && <div>By {post.author}</div>}
        </div>

        {post.image && (
          <div className="relative my-8 h-[320px] w-full overflow-hidden rounded-[22px] border border-[var(--dec-border)] md:h-[520px]">
            <Image
              src={post.image.src || DecLogo}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 980px"
              priority
            />
          </div>
        )}

        <div className="dec-card mx-auto max-w-3xl p-6 md:p-9">
          <div className="prose prose-lg max-w-none dark:prose-invert prose-a:text-[#F20E02]">
            {post.body ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: (props) => <h1 className="font-[Anton] text-4xl" {...props} />,
                  h2: (props) => <h2 className="font-[Anton] text-3xl" {...props} />,
                  h3: (props) => <h3 className="text-xl font-bold" {...props} />,
                  img: ({src, alt}) => (
                    <div className="my-6 relative">
                      {typeof src === 'string' && (
                        <Image
                          src={src.startsWith('//') ? `https:${src}` : src}
                          alt={typeof alt === 'string' ? alt : ''}
                          width={800}
                          height={450}
                          className="max-w-full rounded-lg"
                        />
                      )}
                    </div>
                  ),
                }}
              >
                {post.body}
              </ReactMarkdown>
            ) : (
              <p>No content available for this post.</p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
