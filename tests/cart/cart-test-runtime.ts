import { integrationSecureStore } from './stubs/expo-secure-store';
import { MockKokobayCartServer } from './mock-kokobay-cart-server';

export const cartIntegrationSecureStore = integrationSecureStore;
export const cartIntegrationServer = new MockKokobayCartServer();
