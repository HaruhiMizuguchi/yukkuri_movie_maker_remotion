import type { ProjectAsset } from "./apiTypes";

export type SelectableAssetType = "image" | "audio" | "video" | "subtitle";
export type SelectableAssetUsage =
  | "background"
  | "character"
  | "bgm"
  | "se"
  | "reference"
  | "other";

export type AssetFileLike = {
  name: string;
  type: string;
  size: number;
};

export const MAX_ASSET_FILE_BYTES = 250 * 1024 * 1024;
export const ASSET_FILE_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.wav,.mp3,.m4a,.mp4,.webm,.ass,.srt,.vtt";

const assetFormatByExtension: Record<
  string,
  { type: SelectableAssetType; mimeTypes: string[] }
> = {
  png: { type: "image", mimeTypes: ["image/png"] },
  jpg: { type: "image", mimeTypes: ["image/jpeg"] },
  jpeg: { type: "image", mimeTypes: ["image/jpeg"] },
  webp: { type: "image", mimeTypes: ["image/webp"] },
  wav: { type: "audio", mimeTypes: ["audio/wav", "audio/x-wav"] },
  mp3: { type: "audio", mimeTypes: ["audio/mpeg"] },
  m4a: { type: "audio", mimeTypes: ["audio/mp4", "audio/x-m4a"] },
  mp4: { type: "video", mimeTypes: ["video/mp4"] },
  webm: { type: "video", mimeTypes: ["video/webm"] },
  ass: {
    type: "subtitle",
    mimeTypes: ["text/plain", "application/octet-stream"],
  },
  srt: {
    type: "subtitle",
    mimeTypes: ["text/plain", "application/x-subrip"],
  },
  vtt: { type: "subtitle", mimeTypes: ["text/vtt", "text/plain"] },
};

const getExtension = (name: string): string => {
  const matched = name
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  return matched?.[1] ?? "";
};

const inferUsage = (
  type: SelectableAssetType,
  normalizedName: string,
): SelectableAssetUsage => {
  if (type === "image") {
    return /(立ち絵|キャラ|character|chara|avatar|portrait|reimu|marisa)/i.test(
      normalizedName,
    )
      ? "character"
      : "background";
  }
  if (type === "audio") {
    return /(効果音|(^|[\s_-])(se|sfx)($|[\s_-])|sound[\s_-]?effect|button|click)/i.test(
      normalizedName,
    )
      ? "se"
      : "bgm";
  }
  return "reference";
};

export const inferAssetSelection = (
  file: AssetFileLike,
): {
  type: SelectableAssetType;
  usage: SelectableAssetUsage;
  name: string;
} => {
  const extension = getExtension(file.name);
  const type = assetFormatByExtension[extension]?.type ?? "image";
  const name =
    file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "素材";
  return { type, usage: inferUsage(type, name), name };
};

export const getAssetFileValidationMessage = (
  file: AssetFileLike | null,
): string | null => {
  if (!file) return null;
  if (file.size > MAX_ASSET_FILE_BYTES) {
    return "ファイルサイズが250MBを超えています。小さくしてから選び直してください。";
  }
  const format = assetFormatByExtension[getExtension(file.name)];
  if (!format) {
    return "対応していないファイル形式です。画像・音声・動画・字幕ファイルを選んでください。";
  }
  if (!format.mimeTypes.includes(file.type.toLowerCase())) {
    return "拡張子とファイル内容の種類が一致しません。元の形式を確認してください。";
  }
  return null;
};

export const formatAssetFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getAssetFileName = (relativePath: string): string =>
  relativePath.replaceAll("\\", "/").split("/").at(-1) ?? relativePath;

export const summarizeAssetLibrary = (
  assets: ProjectAsset[],
): {
  total: number;
  typeCounts: Record<string, number>;
  usageCounts: Record<string, number>;
} => {
  const typeCounts: Record<string, number> = {};
  const usageCounts: Record<string, number> = {};
  assets.forEach((asset) => {
    typeCounts[asset.type] = (typeCounts[asset.type] ?? 0) + 1;
    const usage = asset.usage ?? "other";
    usageCounts[usage] = (usageCounts[usage] ?? 0) + 1;
  });
  return { total: assets.length, typeCounts, usageCounts };
};
