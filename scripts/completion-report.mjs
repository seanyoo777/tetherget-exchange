#!/usr/bin/env node
/**
 * completion-status.json 기준으로 통합 완성도(%) 출력.
 * 사용: node scripts/completion-report.mjs  또는  npm run report:completion
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const raw = readFileSync(join(root, "completion-status.json"), "utf8");
const data = JSON.parse(raw);

const { weights, scores, updatedAt, notes } = data;
const wSum =
  weights.frontend + weights.backend + weights.database + weights.devops;
if (Math.abs(wSum - 1) > 0.001) {
  console.error("가중치 합이 1이 아닙니다:", wSum);
  process.exit(1);
}

const composite =
  weights.frontend * scores.frontend +
  weights.backend * scores.backend +
  weights.database * scores.database +
  weights.devops * scores.devops;

const pct = Math.round(composite * 10) / 10;

console.log("");
console.log("=== Tetherget / TGX — 서비스 완성도 리포트 ===");
console.log(`기준 시각: ${updatedAt}`);
console.log("");
console.log(`  프론트엔드     ${scores.frontend}%`);
console.log(`  백엔드         ${scores.backend}%`);
console.log(`  데이터베이스   ${scores.database}%`);
console.log(`  배포·운영      ${scores.devops}%`);
console.log("");
console.log(`  가중 통합      ${pct}%  (실오픈 가능 수준 대비 추정)`);
console.log("");
if (notes) console.log(`  비고: ${notes}`);
console.log("");
console.log("※ 자동 시간 알림은 불가. 정각마다 completion-status.json 갱신 후 이 스크립트 실행을 권장.");
console.log("");
