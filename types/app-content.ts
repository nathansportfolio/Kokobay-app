export type AppContent = {
  title: string;
  content: string;
  richContent?: unknown;
};

export type UseAppContentResult = {
  title: string;
  content: string;
  richContent?: unknown;
  loading: boolean;
  error?: string;
};
