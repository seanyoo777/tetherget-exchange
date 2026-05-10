import type { ReactNode } from "react";

/** 검색어와 일치하는 부분만 마크업(대소문자 무시). 체결 목록 검색 등에 사용. */
export function highlightSearchQuery(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return parts.map((part, idx) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark key={`${part}-${idx}`} className="fillMark">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${idx}`}>{part}</span>
    )
  );
}
