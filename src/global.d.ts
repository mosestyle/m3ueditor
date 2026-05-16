export {};

declare global {
  interface Window {
    electronAPI?: {
      openInVlc: (url: string) => Promise<{
        ok: boolean;
        message: string;
      }>;
    };
  }
}
