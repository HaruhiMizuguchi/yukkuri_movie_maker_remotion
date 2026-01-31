# 05. 使用ガイド (Usage Guide)

設定が完了したら、実際に動画を自動生成してみましょう。

## 実行方法（優先順位: Web GUI → CLI → API）

このシステムは、同じワークフロー（台本→音声→素材→字幕→Remotionレンダリング）を、次の3つの入口から実行できる設計を目指します。

### 1) Web GUI（優先）
ローカルPC上でWebアプリを起動し、GUIからプロジェクト作成・設定編集・実行・進捗確認・成果物DLを行います。

```bash
pnpm dev
```

起動後、ブラウザで表示されるURL（例: `http://localhost:3000`）を開いて操作します。

### 2) CLI
ローカルで同じワークフローを実行します。Web GUIと同じ「プロジェクト/ジョブ定義」を使い回せる想定です。

```bash
pnpm cli
```

### 3) API（外部連携向け / 優先度低）
外部システムからジョブ投入したい場合はAPIで実行します（Web GUIも内部的にはAPIを叩く想定です）。

```bash
# 例: ジョブ投入（実装に合わせて更新）
curl -X POST http://localhost:3001/api/jobs -H "Content-Type: application/json" -d "{\"mode\":\"full\"}"
```

## 開発モードでの実行（将来拡張）

現時点の雛形では `--dev-mode` は未実装です。以下は将来の拡張案として記載しています。

**開発モードの特徴（想定）:**
- 詳細なログが表示されます。
- APIのコストを抑えるための制限が適用される場合があります。
- 一部処理がキャッシュされ、再実行が高速になります。

## 生成プロセスの流れ

現時点の雛形では `packages/core/src/index.ts` の `WORKFLOW_STEPS` を順に記録し、各ステップは未実装のため `SKIPPED` になります。

1. **theme_selection**: 動画のテーマを決定します。
2. **script_generation**: 台本を生成します。
3. **title_generation**: 動画のタイトルを決定します。
4. **tts_generation**: 台本を音声データに変換します。
5. **character_synthesis**: 立ち絵/キャラクターを合成します。
6. **background_generation**: 背景画像を生成します。
7. **background_animation**: 背景に簡易アニメーションを適用します。
8. **subtitle_generation**: 字幕データを作成します。
9. **video_composition**: すべての素材を合成します。
10. **audio_enhancement**: BGMや効果音を追加します。
11. **illustration_insertion**: イラスト素材を挿入します。
12. **final_encoding**: 完成した動画ファイルを出力します。
13. **youtube_upload**: YouTube へアップロードします（任意）。

## 成果物の確認

現時点の雛形では実際の生成処理は行われないため、`outputs` や `projects` に成果物は作成されません（ディレクトリのみ）。
実装が進むと、生成された動画や中間ファイルが `outputs` フォルダ（または `projects` フォルダ内の各プロジェクトフォルダ）に保存される想定です。

- **完成動画**: `outputs/final_video.mp4` (設定により異なります)
- **台本**: `projects/[プロジェクトID]/script.json`
- **音声**: `projects/[プロジェクトID]/audio/`

## 実行の中断と再開

処理はステップごとに保存（チェックポイント作成）されます。
エラーなどで途中で止まった場合でも、再度同じコマンドを実行すると、完了したステップをスキップして続きから再開しようとします。
完全に最初からやり直したい場合は、新しいプロジェクトとして実行するか、生成されたプロジェクトフォルダを削除してください。
