export type RichNode = {
  type?: string;
  value?: string;
  children?: RichNode[];
  url?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  level?: number;
  listType?: string;
};

export function parseShopifyRichTextRoot(raw: unknown): RichNode | null {
  if (raw == null) return null;
  let node: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      node = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof node !== 'object' || node === null) return null;
  const root = node as RichNode;
  if (root.type === 'root' && Array.isArray(root.children)) return root;
  if (Array.isArray(root.children)) return { type: 'root', children: root.children };
  return null;
}

export function shopifyRichTextHasContent(raw: unknown): boolean {
  const root = parseShopifyRichTextRoot(raw);
  if (!root?.children?.length) return false;
  return root.children.some((child) => nodeHasText(child));
}

function nodeHasText(node: RichNode): boolean {
  if (node.type === 'text') return Boolean(node.value?.trim());
  if (!Array.isArray(node.children)) return false;
  return node.children.some((child) => nodeHasText(child));
}

export function plainTextFromShopifyRichText(raw: unknown): string {
  const root = parseShopifyRichTextRoot(raw);
  if (!root?.children?.length) return '';
  return root.children
    .map((child) => collectNodeText(child))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function collectNodeText(node: RichNode): string {
  if (node.type === 'text') return node.value ?? '';
  if (!Array.isArray(node.children)) return '';
  return node.children.map((child) => collectNodeText(child)).join('');
}
