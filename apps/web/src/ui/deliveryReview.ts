import type { PreviewResponse } from "./apiTypes";

export type PreviewQualityCheck = {
  id: "duration" | "output" | "subtitle" | "audio";
  label: string;
  detail: string;
  passed: boolean;
};

export const DELIVERY_MANUAL_REVIEW_ITEMS = [
  {
    id: "picture",
    label: "映像を最初から最後まで確認した",
    detail: "見切れ、黒画面、不要なカットがないか確認します。",
  },
  {
    id: "subtitle",
    label: "字幕の誤字と表示タイミングを確認した",
    detail: "読みやすさと音声とのずれを確認します。",
  },
  {
    id: "audio",
    label: "声・BGM・効果音のバランスを確認した",
    detail: "声が聞き取りやすく、音割れがないか確認します。",
  },
  {
    id: "rights",
    label: "素材の利用条件と公開内容を確認した",
    detail: "画像・音源の権利と機密情報の映り込みを確認します。",
  },
] as const;

export type DeliveryManualReviewId =
  (typeof DELIVERY_MANUAL_REVIEW_ITEMS)[number]["id"];
export type DeliveryManualReviews = Record<DeliveryManualReviewId, boolean>;

export const getPreviewQualityChecks = (
  preview: PreviewResponse,
): PreviewQualityCheck[] => {
  const durationMs = preview.remotionProps.durationMs;
  const output = preview.outputPreset;
  const subtitleCount = preview.remotionProps.subtitleTracks.length;
  const audioCount = preview.remotionProps.audioTracks.length;
  return [
    {
      id: "duration",
      label: "動画の長さ",
      passed: durationMs > 0,
      detail:
        durationMs > 0
          ? `${(durationMs / 1000).toFixed(1)}秒の動画です。`
          : "再生できる長さがありません。",
    },
    {
      id: "output",
      label: "出力設定",
      passed: Boolean(
        output && output.width > 0 && output.height > 0 && output.fps > 0,
      ),
      detail: output
        ? `${output.width}×${output.height} / ${output.fps}fps`
        : "出力設定がありません。",
    },
    {
      id: "subtitle",
      label: "字幕トラック",
      passed: subtitleCount > 0,
      detail:
        subtitleCount > 0
          ? `${subtitleCount}件の字幕があります。`
          : "字幕がありません。",
    },
    {
      id: "audio",
      label: "音声トラック",
      passed: audioCount > 0,
      detail:
        audioCount > 0
          ? `${audioCount}件の音声があります。`
          : "音声がありません。",
    },
  ];
};

export const countCompletedManualReviews = (
  reviews: DeliveryManualReviews,
): number => Object.values(reviews).filter(Boolean).length;

export type DeliveryState = {
  key:
    | "needs-preview"
    | "ready"
    | "rendering"
    | "rendering-with-previous"
    | "complete";
  headline: string;
  detail: string;
  renderLabel: string;
  downloadLabel?: string;
};

export const getDeliveryState = ({
  hasPreview,
  hasRunningJob,
  hasFinalVideo,
}: {
  hasPreview: boolean;
  hasRunningJob: boolean;
  hasFinalVideo: boolean;
}): DeliveryState => {
  if (hasRunningJob) {
    return hasFinalVideo
      ? {
          key: "rendering-with-previous",
          headline: "新しい完成版を生成中",
          detail:
            "生成が終わるまでは、前回の完成動画を確認・ダウンロードできます。",
          renderLabel: "完成動画を生成中…",
          downloadLabel: "前回版をダウンロード",
        }
      : {
          key: "rendering",
          headline: "完成動画を生成中",
          detail: "進捗は画面上部へ自動反映されます。",
          renderLabel: "完成動画を生成中…",
        };
  }
  if (hasFinalVideo) {
    return {
      key: "complete",
      headline: "完成動画を利用できます",
      detail: "必要なら現在の編集内容でもう一度生成できます。",
      renderLabel: "現在の内容で再生成",
      downloadLabel: "完成動画をダウンロード",
    };
  }
  if (hasPreview) {
    return {
      key: "ready",
      headline: "書き出し準備ができました",
      detail: "自動チェックと目視確認を終えて、完成動画を生成します。",
      renderLabel: "完成動画を生成",
    };
  }
  return {
    key: "needs-preview",
    headline: "まず最新の編集情報を読み込みます",
    detail: "長さ・字幕・音声・出力設定を確認してから書き出します。",
    renderLabel: "完成動画を生成",
  };
};
