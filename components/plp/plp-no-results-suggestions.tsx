import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ALL_PRODUCTS_COLLECTION_HANDLE } from '@/constants/catalog';
import { useCollectionHref } from '@/hooks/use-collection-href';
import { getCollections } from '@/services/shopify';
import { collectionsWithCoverImage } from '@/utils/collection-text';
import type { Collection } from '@/types/shopify';

type Props = {
  variant?: 'filtered' | 'empty-search';
  onClearFilters?: () => void;
  /** Hide these collection handles from the rail (e.g. current PLP room). */
  excludeHandles?: string[];
};

function CollectionSuggestionTile({ collection }: { collection: Collection }) {
  const href = useCollectionHref(collection.handle);
  return (
    <Link href={href} asChild>
      <Pressable className="w-[132px] overflow-hidden rounded-sm border border-line/70 bg-surface active:opacity-90">
        <View className="relative aspect-[4/5] w-full bg-elevated">
          {collection.image?.url ? (
            <CatalogCoverImage
              uri={collection.image.url}
              recyclingKey={collection.id}
              priority="low"
            />
          ) : null}
        </View>
        <Text className="px-2.5 py-2 font-sans-md text-[13px] text-ink" numberOfLines={2}>
          {collection.title}
        </Text>
      </Pressable>
    </Link>
  );
}

export function PlpNoResultsSuggestions({
  variant = 'filtered',
  onClearFilters,
  excludeHandles = [],
}: Props) {
  const { data: collections } = useQuery({
    queryKey: ['plp', 'collection-suggestions'],
    queryFn: () => getCollections(48),
    staleTime: 4 * 60_000,
  });

  const picks = useMemo(() => {
    const skip = new Set([ALL_PRODUCTS_COLLECTION_HANDLE, ...excludeHandles]);
    return collectionsWithCoverImage(collections ?? [])
      .filter((c) => !skip.has(c.handle))
      .slice(0, 5);
  }, [collections, excludeHandles]);

  const subtitle =
    variant === 'filtered'
      ? 'Nothing matched those choices. Try clearing filters, or browse a collection below.'
      : 'Nothing matched that search. Try another phrase, or explore these collections.';

  return (
    <View className="px-5 py-12">
      <Text variant="title" className="mb-2 text-center text-[19px] text-ink">
        No results
      </Text>
      <Text variant="body" className="mb-6 text-center text-mist leading-6">
        {subtitle}
      </Text>
      {onClearFilters ? (
        <View className="mb-8 items-center">
          <Button title="Clear filters" variant="secondary" onPress={onClearFilters} />
        </View>
      ) : null}
      {picks.length > 0 ? (
        <>
          <Text
            variant="label"
            className="mb-3 text-center text-[11px] uppercase tracking-[0.18em] text-mist"
          >
            Try these collections
          </Text>
          <View className="-mx-5">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: 'row',
                gap: 12,
                paddingHorizontal: 20,
                paddingBottom: 4,
              }}
            >
              {picks.map((c) => (
                <CollectionSuggestionTile key={c.id} collection={c} />
              ))}
            </ScrollView>
          </View>
        </>
      ) : null}
    </View>
  );
}
