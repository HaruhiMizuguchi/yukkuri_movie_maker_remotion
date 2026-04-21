import type { Script } from "@ymm/shared";

import type { ScriptTimestamp } from "./task3Quality";

export type SubtitleToken = {
  text: string;
  kind: "plain" | "emphasis" | "secondary";
};

export type SubtitlePresentationItem = {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
  tokens: SubtitleToken[];
  keywordBadge: string | null;
};

export type SubtitlePresentationPlan = {
  items: SubtitlePresentationItem[];
  emphasisCount: number;
};

const KEYWORD_PATTERNS = [
  /\d+(?:\.\d+)?/g,
  /[A-Z][A-Za-z0-9.+-]{2,}/g,
  /[ァ-ヶー]{4,}/g,
  /(結論|重要|要点|最短|比較|注意|動画|字幕|Remotion|AI|TTS)/g,
];

export const createSubtitlePresentationPlan = ({
  script,
  timestamps,
}: {
  script: Script;
  timestamps: ScriptTimestamp[];
}): SubtitlePresentationPlan => {
  const items = timestamps.map((timestamp) => {
    const line = script.lines[timestamp.index];
    const text = line?.text ?? timestamp.text;
    const keywords = extractKeywords(text)
      .sort((left, right) => compareKeywordPriority(text, left, right))
      .slice(0, 3);
    const tokens = buildTokens(text, keywords);

    return {
      speaker: line?.speaker ?? timestamp.speaker,
      text,
      startMs: timestamp.startMs,
      endMs: timestamp.endMs,
      tokens,
      keywordBadge: keywords[0] ?? null,
    };
  });

  return {
    emphasisCount: items.reduce(
      (sum, item) => sum + item.tokens.filter((token) => token.kind === "emphasis").length,
      0
    ),
    items,
  };
};

const extractKeywords = (text: string): string[] => {
  const keywords: string[] = [];
  for (const pattern of KEYWORD_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const keyword = match[0]?.trim();
      if (!keyword || keyword.length <= 1) {
        continue;
      }
      if (!keywords.includes(keyword)) {
        keywords.push(keyword);
      }
    }
  }
  return keywords;
};

const compareKeywordPriority = (text: string, left: string, right: string): number => {
  const priorityDiff = keywordPriority(left) - keywordPriority(right);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }
  return text.indexOf(left) - text.indexOf(right);
};

const keywordPriority = (keyword: string): number => {
  if (/^(結論|重要|要点|最短|比較|注意|Remotion|AI|TTS)$/.test(keyword)) {
    return 0;
  }
  if (/[A-Z]/.test(keyword) || /[ァ-ヶー]{4,}/.test(keyword)) {
    return 1;
  }
  if (/\d/.test(keyword)) {
    return 2;
  }
  if (/^(動画|字幕)$/.test(keyword)) {
    return 3;
  }
  return 4;
};

const buildTokens = (text: string, keywords: string[]): SubtitleToken[] => {
  if (keywords.length === 0) {
    return [{ text, kind: "plain" }];
  }

  const sortedKeywords = [...keywords].sort((left, right) => right.length - left.length);
  const tokens: SubtitleToken[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchedKeyword = sortedKeywords.find((keyword) => text.startsWith(keyword, cursor));
    if (matchedKeyword) {
      const kind = tokens.filter((token) => token.kind === "emphasis").length === 0
        ? "emphasis"
        : "secondary";
      tokens.push({ text: matchedKeyword, kind });
      cursor += matchedKeyword.length;
      continue;
    }

    let nextCursor = cursor + 1;
    while (
      nextCursor < text.length &&
      !sortedKeywords.some((keyword) => text.startsWith(keyword, nextCursor))
    ) {
      nextCursor += 1;
    }
    tokens.push({ text: text.slice(cursor, nextCursor), kind: "plain" });
    cursor = nextCursor;
  }

  return tokens;
};
