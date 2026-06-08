export const AppState = {
  currentState: 'active' as const,
  addEventListener: () => ({ remove: () => {} }),
};

export const Platform = {
  OS: 'ios' as const,
  Version: '17',
  select: <T>(spec: { ios?: T; android?: T; default?: T }) =>
    spec.ios ?? spec.default,
};

export const InteractionManager = {
  runAfterInteractions: (fn: () => void) => {
    fn();
  },
};

export const Linking = {
  openURL: async () => {},
};

export const Alert = {
  alert: () => {},
};

export const Dimensions = {
  get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
};

export const NativeModules = {};

const ReactNativeStub = {};
export default ReactNativeStub;
