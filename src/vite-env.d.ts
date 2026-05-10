/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  /** 헬스·레디 UI 폴링 주기(ms). 숫자 문자열, 생략 시 20000 */
  readonly VITE_API_PROBE_INTERVAL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
