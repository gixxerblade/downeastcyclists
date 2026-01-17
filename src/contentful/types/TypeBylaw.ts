import type {
  ChainModifiers,
  Entry,
  EntryFieldTypes,
  EntrySkeletonType,
  LocaleCode,
} from 'contentful';

export interface TypeBylawFields {
  id: EntryFieldTypes.Symbol;
  title: EntryFieldTypes.Symbol;
  body: EntryFieldTypes.RichText;
  order: EntryFieldTypes.Integer;
}

export type TypeBylawSkeleton = EntrySkeletonType<TypeBylawFields, 'bylaws'>;
export type TypeBylaw<Modifiers extends ChainModifiers, Locales extends LocaleCode> = Entry<
  TypeBylawSkeleton,
  Modifiers,
  Locales
>;
