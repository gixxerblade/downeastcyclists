import type { ChainModifiers, Entry, EntryFieldTypes, EntrySkeletonType, LocaleCode } from "contentful";

export interface TypeLeadersFields {
    order?: EntryFieldTypes.Integer;
    name?: EntryFieldTypes.Symbol;
    image?: EntryFieldTypes.AssetLink;
    position?: EntryFieldTypes.Symbol;
    link?: EntryFieldTypes.Object;
}

export type TypeLeadersSkeleton = EntrySkeletonType<TypeLeadersFields, "leaders">;
export type TypeLeaders<Modifiers extends ChainModifiers, Locales extends LocaleCode> = Entry<TypeLeadersSkeleton, Modifiers, Locales>;
