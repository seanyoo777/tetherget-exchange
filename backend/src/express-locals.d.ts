declare global {
  namespace Express {
    interface Locals {
      /** `correlation-middleware` 가 요청마다 설정. */
      correlationId: string;
    }
  }
}

export {};
