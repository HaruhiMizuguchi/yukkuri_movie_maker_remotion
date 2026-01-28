# projects/[id]/ の出力ディレクトリ規約

本ドキュメントは、`projects/<projectId>/` 配下で生成物を保存する際の
**ディレクトリ構成と命名ルール**を定義します。

## 1. ルート構成

```
projects/<projectId>/
  input/          # ユーザー投入素材・外部入力
  output/         # 各ステップの主要出力（再利用対象）
  intermediate/   # 途中生成物（破棄可能・再生成可能）
  final/          # 最終成果物
  logs/           # ワークフロー/ステップログ
  tmp/            # 一時ファイル
```

### 役割の違い
- `input/`: 手動で入れた素材、API から取得した素材など。
- `output/`: **再利用価値の高い成果物**（スクリプト、字幕、音声など）。
- `intermediate/`: **再生成前提**の成果物（Remotion 中間 JSON 等）。
- `final/`: 納品用の MP4 やエンコード済みファイル。

## 2. output/ の命名規約

`output/` の直下は **ワークフローステップ名**で分けます。
ワークフローの step 名は `packages/core` の `WORKFLOW_STEPS` と一致させます。

```
output/
  script_generation/
  tts_generation/
  subtitle_generation/
  video_composition/
  final_encoding/
  ...
```

ステップ内は `run-YYYYMMDD-HHMMSS/` を推奨します。
最新の成果物は `latest/` にコピー（またはシンボリックリンク）します。

```
output/
  script_generation/
    run-20260128-120000/
      script.json
    latest/ -> run-20260128-120000/
```

## 3. 代表的な成果物例

| ステップ | 代表的な出力ファイル | 保存先例 |
|---|---|---|
| script_generation | `script.json` | `output/script_generation/run-.../script.json` |
| tts_generation | `audio.wav`, `timestamps.json` | `output/tts_generation/run-.../` |
| subtitle_generation | `subtitles.ass` or `subtitles.json` | `output/subtitle_generation/run-.../` |
| video_composition | `preview.mp4`, `composition.json` | `output/video_composition/run-.../` |
| final_encoding | `final.mp4` | `final/run-.../final.mp4` |

## 4. intermediate/ の使い方

- 大きな中間ファイル（画像連番、Remotion 生成 JSON など）は `intermediate/` に保存します。
- 破棄/再生成を前提とするため、運用で容量が増えすぎる場合は削除対象です。

## 5. logs/ と tmp/

- `logs/` は `workflow.log` や `step-<name>.log` を想定します。
- `tmp/` はジョブ実行時の一時作業ディレクトリとして利用します。

