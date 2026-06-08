import { Fragment, type ReactNode } from 'react';
import { Linking, View } from 'react-native';

import { Text } from '@/components/ui/text';

import {
  parseShopifyRichTextRoot,
  plainTextFromShopifyRichText,
  type RichNode,
} from '@/utils/shopify-rich-text';
import { stripSimpleHtml } from '@/utils/strip-html';

type Props = {
  richContent?: unknown;
  plainText?: string;
  className?: string;
  tone?: 'default' | 'inverse';
};

type RichTextTone = NonNullable<Props['tone']>;

const BODY_CLASS = 'text-[15px] leading-7 text-muted';

function toneClasses(tone: RichTextTone) {
  if (tone === 'inverse') {
    return {
      body: 'text-[14px] leading-6 text-canvas/92',
      heading: 'text-[14px] font-sans-md text-canvas',
      link: 'text-[14px] leading-6 text-canvas underline',
    };
  }
  return {
    body: BODY_CLASS,
    heading: 'text-[15px] font-sans-md text-ink',
    link: `${BODY_CLASS} text-accent underline`,
  };
}

export function RichTextRenderer({
  richContent,
  plainText = '',
  className,
  tone = 'default',
}: Props) {
  const classes = toneClasses(tone);
  const root = parseShopifyRichTextRoot(richContent);
  if (root?.children?.length) {
    return (
      <View className={className}>
        {root.children.map((node, index) => (
          <Fragment key={`${node.type ?? 'node'}-${index}`}>
            {renderBlock(node, classes)}
          </Fragment>
        ))}
      </View>
    );
  }

  const fallback = plainText.trim() || plainTextFromShopifyRichText(richContent);
  if (!fallback) return null;

  const looksLikeHtml = /<[^>]+>/.test(fallback);
  const copy = looksLikeHtml ? stripSimpleHtml(fallback) : fallback;

  return (
    <Text variant="body" className={classes.body}>
      {copy}
    </Text>
  );
}

function renderBlock(node: RichNode, classes: ReturnType<typeof toneClasses>): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return (
        <Text variant="body" className={`${classes.body} mb-3`}>
          {renderInlineChildren(node.children, classes)}
        </Text>
      );
    case 'heading': {
      const level = node.level ?? 2;
      const sizeClass = classes.body.includes('canvas')
        ? classes.heading
        : level <= 2
          ? 'text-[15px] font-sans-md text-ink'
          : level <= 4
            ? 'text-[14px] font-sans-md text-ink'
            : 'text-[13px] font-sans-md text-ink';
      return (
        <Text className={`${sizeClass} mb-2 mt-1 tracking-wide`}>
          {renderInlineChildren(node.children, classes)}
        </Text>
      );
    }
    case 'list':
      return (
        <View className="mb-3 gap-1.5">
          {node.children?.map((item, index) => (
            <View key={`item-${index}`} className="flex-row gap-2">
              <Text variant="body" className={`${classes.body} w-4`}>
                {node.listType === 'ordered' ? `${index + 1}.` : '•'}
              </Text>
              <Text variant="body" className={`${classes.body} flex-1`}>
                {renderInlineChildren(item.children, classes)}
              </Text>
            </View>
          ))}
        </View>
      );
    default:
      return null;
  }
}

function renderInlineChildren(
  children: RichNode[] | undefined,
  classes: ReturnType<typeof toneClasses>,
): ReactNode {
  if (!children?.length) return null;
  return children.map((child, index) => (
    <Fragment key={`inline-${child.type ?? 't'}-${index}`}>
      {renderInline(child, classes)}
    </Fragment>
  ));
}

function renderInline(node: RichNode, classes: ReturnType<typeof toneClasses>): ReactNode {
  if (node.type === 'text') {
    const value = node.value ?? '';
    if (!value) return null;
    return (
      <Text
        className={[
          classes.body,
          node.bold ? 'font-sans-md' : '',
          node.italic ? 'italic' : '',
          node.underline ? 'underline' : '',
        ]
          .filter(Boolean)
          .join(' ')}>
        {value}
      </Text>
    );
  }

  if (node.type === 'link' && node.url) {
    const label = node.children?.map((c) => c.value ?? '').join('') || node.url;
    return (
      <Text
        className={classes.link}
        accessibilityRole="link"
        onPress={() => void Linking.openURL(node.url!)}
      >
        {label}
      </Text>
    );
  }

  if (node.children?.length) {
    return renderInlineChildren(node.children, classes);
  }

  return null;
}
