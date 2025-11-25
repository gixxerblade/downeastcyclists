import { TypeBlogPostSkeleton } from "@/src/contentful/types";
import { Entry } from "contentful";
import { client, getEntriesCached } from "./contentfulClient";
import { ContentImage, parseContentfulContentImage } from "./contentImage";
import { PaginatedData } from "./types/PaginatedData";
import { Config } from "@/constants/Config";
import { Container } from "postcss";

type BlogPostEntry = Entry<TypeBlogPostSkeleton, undefined, string>;

const getPaginationInfo = (total: number, page: number = 0, limit: number = total) => ({
  total,
  page,
  lastPage: Math.max(Math.ceil(total / limit) - 1, 0),
});

export interface BlogPost {
  title: string;
  slug: string;
  body: string | null;
  image: ContentImage | null;
  publishDate: string | null;
  author: string | null;
}

export const parseContentfulBlogPost = (blogPostEntry?: BlogPostEntry): BlogPost => {
  return {
    title: blogPostEntry?.fields.postTitle || "",
    slug: blogPostEntry?.fields.slug || "",
    body: blogPostEntry?.fields.content || "",
    image: parseContentfulContentImage(blogPostEntry?.fields.featuredImage),
    publishDate: blogPostEntry?.fields.publishDate || null,
    author: blogPostEntry?.fields.author || null,
  };
};

export const fetchBlogPosts = async (page: number = 1): Promise<PaginatedData<BlogPost>> => {
  const blogPostsResult = await getEntriesCached<TypeBlogPostSkeleton>({
    content_type: "blogPost",
    limit: Config.LIMIT,
    order: ["-fields.publishDate"], // Sort by publishDate in descending order (newest first)
    skip: (page - 1) * Config.LIMIT,
  });
  if (!!blogPostsResult.items.length) {
    const paginationInfo = getPaginationInfo(blogPostsResult.total, page, Config.LIMIT);
    return {
      ...paginationInfo,
      data: blogPostsResult.items.map(parseContentfulBlogPost),
    };
  }
  return {
    total: 0,
    lastPage: 0,
    data: [],
    page: 0,
  };
};

export const fetchBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  const blogPostResult = await getEntriesCached<TypeBlogPostSkeleton>({
    content_type: "blogPost",
    "fields.slug": slug,
    limit: 1,
  });

  if (blogPostResult.items.length > 0) {
    return parseContentfulBlogPost(blogPostResult.items[0]);
  }

  return null;
};
