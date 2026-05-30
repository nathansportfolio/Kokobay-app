type Reader<T> = () => T | null | undefined;

let screenReader: Reader<string> | null = null;
let userIdReader: Reader<string> | null = null;

export function registerAppErrorScreenReader(reader: Reader<string>): void {
  screenReader = reader;
}

export function registerAppErrorUserIdReader(reader: Reader<string>): void {
  userIdReader = reader;
}

export function getAppErrorScreen(): string | undefined {
  const value = screenReader?.()?.trim();
  return value || undefined;
}

export function getAppErrorUserId(): string | undefined {
  const value = userIdReader?.()?.trim();
  return value || undefined;
}
