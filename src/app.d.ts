import type { Session } from '@auth/core/types';

declare global {
  namespace App {
    interface Locals {
      auth: () => Promise<Session | null>;
    }
    interface PageData {}
    interface PageState {}
    interface Platform {}
    interface Error {}
  }
}

export {};
