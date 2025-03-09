import { fetchBlogPostBySlug } from '@/src/contentful/blogPosts';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DecLogo from '../../../assets/images/hungry_toad-48.webp';

// Set a reasonable revalidation time (e.g., 1 hour)
export const revalidate = 3600;

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = params;
  const post = await fetchBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="py-24 px-4 md:px-24 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/blog"
          className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-800"
        >
          ← Back to all posts
        </Link>
      </div>

      <h1 className="text-4xl font-bold mb-4">{post.title}</h1>

      <div className="flex items-center text-sm text-gray-600 mb-6">
        {post.publishDate && (
          <time dateTime={post.publishDate} className="mr-4">
            <span className="font-medium">Published: </span>
            {new Date(post.publishDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </time>
        )}
        {post.author && (
          <div>
            <span className="font-medium">Author: </span>
            {post.author}
          </div>
        )}
      </div>

      {post.image && (
        <div className="relative w-full h-[400px] mb-8 overflow-hidden rounded-lg">
          <Image
            src={post.image.src || DecLogo}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 800px"
            priority
          />
        </div>
      )}

      <div className="prose prose-lg max-w-none">
        {post.body ? (
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
              h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mt-6 mb-3" {...props} />,
              h3: ({ node, ...props }) => <h3 className="text-xl font-bold mt-5 mb-2" {...props} />,
              p: ({ node, ...props }) => <p className="my-4" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc pl-6 my-4" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal pl-6 my-4" {...props} />,
              li: ({ node, ...props }) => <li className="mb-1" {...props} />,
              a: ({ node, ...props }) => <a className="text-red-600 hover:text-red-800 underline" {...props} />,
              blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4" {...props} />,
              img: ({ node, src, alt, ...props }) => (
                <div className="my-6 relative">
                  {src && (
                    <Image 
                      src={src?.startsWith('//') ? `https:${src}` : src} 
                      alt={alt || ''} 
                      width={800}
                      height={450}
                      className="rounded-lg max-w-full"
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
    </article>
  );
}
