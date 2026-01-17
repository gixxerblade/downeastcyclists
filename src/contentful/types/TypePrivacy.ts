import type {
  ChainModifiers,
  Entry,
  EntryFieldTypes,
  EntrySkeletonType,
  LocaleCode,
} from 'contentful';

export interface TypePrivacyFields {
  id: EntryFieldTypes.Symbol;
  title: EntryFieldTypes.Symbol;
  body: EntryFieldTypes.RichText;
  order: EntryFieldTypes.Integer;
}

export type TypePrivacySkeleton = EntrySkeletonType<TypePrivacyFields, 'privacy'>;
export type TypePrivacy<Modifiers extends ChainModifiers, Locales extends LocaleCode> = Entry<
  TypePrivacySkeleton,
  Modifiers,
  Locales
>;
