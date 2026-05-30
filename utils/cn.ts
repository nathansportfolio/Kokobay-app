export function cn(...parts: (string | undefined | null | false)[]): string {
  return parts.filter(Boolean).join(' ');
}
