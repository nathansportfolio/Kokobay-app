export type SecureStoreMock = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
  clear: () => void;
  snapshot: () => Record<string, string>;
};

export function createSecureStoreMock(): SecureStoreMock {
  const data = new Map<string, string>();

  return {
    async getItemAsync(key: string) {
      return data.get(key) ?? null;
    },
    async setItemAsync(key: string, value: string) {
      data.set(key, value);
    },
    async deleteItemAsync(key: string) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
    snapshot() {
      return Object.fromEntries(data.entries());
    },
  };
}
