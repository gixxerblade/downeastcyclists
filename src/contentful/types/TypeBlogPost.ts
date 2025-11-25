import type {
  ChainModifiers,
  Entry,
  EntryFieldTypes,
  EntrySkeletonType,
  LocaleCode,
} from "contentful";

export interface TypeBlogPostFields {
  id?: EntryFieldTypes.Integer;
  type?: EntryFieldTypes.Integer;
  postTitle: EntryFieldTypes.Symbol;
  author: EntryFieldTypes.Symbol;
  slug: EntryFieldTypes.Symbol;
  content: EntryFieldTypes.Text;
  publishDate: EntryFieldTypes.Date;
  featuredImage?: EntryFieldTypes.AssetLink;
  tags: EntryFieldTypes.Object;
  categories: EntryFieldTypes.Object;
  contentImages?: EntryFieldTypes.Array<EntryFieldTypes.AssetLink>;
}

export type TypeBlogPostSkeleton = EntrySkeletonType<TypeBlogPostFields, "blogPost">;
export type TypeBlogPost<Modifiers extends ChainModifiers, Locales extends LocaleCode> = Entry<
  TypeBlogPostSkeleton,
  Modifiers,
  Locales
>;
