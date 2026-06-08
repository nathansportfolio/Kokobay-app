import { createSecureStoreMock } from '../mock-secure-store';

/** Shared in-memory SecureStore for cart integration tests. */
export const integrationSecureStore = createSecureStoreMock();

export const getItemAsync = integrationSecureStore.getItemAsync.bind(integrationSecureStore);
export const setItemAsync = integrationSecureStore.setItemAsync.bind(integrationSecureStore);
export const deleteItemAsync = integrationSecureStore.deleteItemAsync.bind(integrationSecureStore);
