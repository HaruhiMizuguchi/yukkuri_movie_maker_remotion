# 開発タスク分解（MVP〜拡張）

本ドキュメントは、開発を進める際のタスクを粒度細かく整理したものです。
**最短で「1本の動画が出力できる」縦串を作る**ことを優先しつつ、
将来の拡張や運用まで見失わない構成にしています。

## 更新メモ
- 2026-02-01: `master` の内容を `main` に統合（履歴が別扱いだったため `--allow-unrelated-histories` を使用。`README.md` の衝突を解消）
- 2026-02-01: 失敗時の再実行・スキップ設計を追加し、ProjectFile 登録ユーティリティの実装反映
- 2026-02-01: ワーカーのジョブペイロードに再実行/スキップ指定を追加
- 2026-02-13: MVP縦串（script/tts/subtitle/video/final encoding）を最小実装し、成果物の保存とDB登録まで接続
- 2026-02-13: Web GUI初期版の8画面とタイムライン編集（再生範囲/移動/リサイズ/同期）を実装
- 2026-02-13: AI拡張ステップと運用性（リトライ/キャッシュ/監視ログ）および将来拡張（YouTube/APIテンプレ/ユーザー分離）を最小実装
- 2026-02-16: タスク3の品質改善として、TTSをAivisSpeech実接続化・立ち絵素材優先合成化・モジュール別品質テストを追加
- 2026-02-16: タスク3の通し品質確認として `task3FullRunReal.test.ts` を追加し、Aivis実接続で `script_generation` から `final_encoding` まで通し生成（証跡: `outputs/test_evidence/task3_quality/full-run-1771242863439/`）を実行
- 2026-02-16: 現在の機能一覧を `docs/current_capabilities.md` に整理（ローカル運用資料として `.gitignore` 対象化）
- 2026-02-16: `docs/current_capabilities.md` に GUI の起動方法・画面別の最短利用フロー・起動確認ポイントを追記
- 2026-02-18: Windows環境で `corepack pnpm dev` 実行時に子プロセスの `pnpm` 解決が失敗する問題を修正（ルート `dev`/`cli` スクリプトを `corepack pnpm` 呼び出しへ統一）
- 2026-02-18: `pnpm dev` をログラッパー化し、PowerShell上の開発サーバー出力を `logs/dev/latest.log` と実行単位ログに同時保存
- 2026-04-16: カスタマージャーニーE2E/ビジュアル回帰の環境整備に着手
- 2026-04-16: PlaywrightでGUI顧客導線E2Eを追加し、スクリーンショット/AI視覚レビュー用マニフェストを `outputs/test_evidence/customer_journey/` に保存する構成を追加
- 2026-04-17: 良品スクリーンショットとの差分判定スクリプト、実API/DB/Worker用Playwright E2E、DB前提診断、Docker Compose定義、型検査ゲートを追加
- 2026-04-20: 現環境で利用可能な最高品質寄りの実生成として、AivisSpeech実接続・既存高解像度素材・FFmpeg合成/再エンコードを通す `scripts/generateBestAvailableVideo.mjs` を追加し、105秒の完成MP4を `outputs/production_runs/run-20260420-205959-832/` に生成
- 2026-04-21: リッチ動画化の設計メモを `docs/rich_video_enhancement_design.md` に追加し、Remotion優先の演出基盤・ショット割り・口パク/表情・字幕強調・音響演出・章トランジションの実装計画を定義
- 2026-04-21: `video_composition` の正規経路を Remotion 化し、`registerRoot`/動的duration/一時HTTP素材配信を追加して暗黙FFmpegフォールバックを廃止
- 2026-04-21: `shot-plan.json` を生成する自動ショット割りを追加し、話者交代・尺・連続セリフに応じた `wide/medium/close/insert` を Remotion 演出へ反映
- 2026-04-21: `character-performance.json` を追加し、口パクcue・瞬きcue・感情推定を Remotion 立ち絵演出へ反映
- 2026-04-21: `subtitle-presentation.json` を追加し、重要語・英字語・数字の強調表示とキーワードバッジを Remotion 字幕へ反映

---

## 0. 前提整備
- [x] `.env` と `config/` のテンプレ整理（必要キー一覧の明文化）
- [x] Prisma `schema.prisma` の見直し（成果物管理の拡張余地確認）
- [x] ローカル開発起動フローの整理（`pnpm dev` の役割確認）
- [x] Windowsでの `corepack pnpm dev` 起動互換性を確保（子プロセス側も `corepack pnpm` を使用）
- [x] `pnpm dev` の標準出力/標準エラーを `logs/dev/*.log` に記録し、PowerShell実行時のトラブル調査を容易化

## 1. データモデル / 共有型
- [x] `packages/shared` に台本（Script）型定義を追加
- [x] 生成物（音声/字幕/画像/動画）メタデータ型の追加
- [x] ワークフロー入出力の共通インターフェース定義

## 2. ワークフロー基盤（MVP）
- [x] `packages/core` のステップ実装フック整理
- [x] `projects/[id]/` の出力ディレクトリ規約の明文化
- [x] `ProjectFile` への成果物登録ユーティリティ
- [x] 失敗時の再実行・スキップの設計
- [x] ワーカーのジョブペイロードで再実行/スキップ指定を受け取る

---

## 3. MVPの縦串（まず動画が出る最小構成）

### 3-1. Script Generation（簡易実装）
- [x] 台本をLLM最小実装で作成
- [x] `script.json` を保存
- [x] DBに出力ファイルを登録

### 3-2. TTS Generation（簡易実装）
- [x] 台本JSONからセリフを読み込み
- [x] ダミー音声 or 既存音声を結合して出力
- [x] タイムスタンプJSONを作成（簡易で可）
- [x] DBに出力ファイルを登録

### 3-3. Subtitle Generation（簡易実装）
- [x] タイムスタンプ情報から字幕生成
- [x] ASSまたはJSON形式で出力
- [x] DBに登録

### 3-4. Video Composition（最低限）
- [x] Remotionで背景/立ち絵/字幕/音声を合成
- [x] MP4出力
- [x] DBに出力ファイルを登録

### 3-5. Final Encoding（最低限）
- [x] YouTube向け最小設定で再エンコード
- [x] 最終成果物の出力確認

---

## 4. Web GUI（初期版）
- [x] ダッシュボード（プロジェクト一覧）
- [x] プロジェクト作成ウィザード
- [x] プロジェクト詳細（進捗/ログ/成果物）
- [x] 台本編集画面（JSON編集/簡易UI）
- [x] 素材管理画面（アップロード/差し替え）
- [x] タイムライン編集画面（読み取り中心の表示から開始）
- [x] プレビュー & レンダリング画面
- [x] 設定画面（APIキー/出力プリセット）

---

## 5. タイムライン編集の段階的実装
- [x] タイムラインデータ構造の設計（Track / Clip / Marker）
- [x] 再生範囲の指定（in/out）
- [x] クリップのドラッグ移動（開始位置変更）
- [x] クリップのリサイズ（長さ変更）
- [x] 基本パラメータ編集（フェード、音量、字幕スタイル）
- [x] タイムライン → Remotion の同期

---

## 6. AI連携の拡張
- [x] Theme Selection（トレンド取得/評価ロジック）
- [x] Title Generation（CTR最適化）
- [x] Background / Illustration Generation
- [x] Character Synthesis（口パク/表情）

---

## 7. 運用性 / 安定性
- [x] ステップごとのリトライ方針
- [x] 生成物のキャッシュ/再利用
- [x] 監視ログ（失敗原因の集計）

---

## 8. 将来拡張（任意）
- [x] YouTube Upload（API連携）
- [x] プロジェクトのテンプレ化
- [x] 複数ユーザー対応（将来）

---

## 9. カスタマージャーニーE2E / ビジュアル回帰
- [x] Playwright を導入し、GUIの主要画面を顧客導線として通すE2Eを追加
- [x] 各導線チェックポイントのスクリーンショットとメタデータを `outputs/test_evidence/` に保存
- [x] AI視覚レビューに渡せるビジュアル回帰用マニフェストを生成
- [x] E2Eの実行方法とTDD上の不足要素をドキュメント化
- [x] 実API・DB・Workerを使ったブラウザE2Eを追加
- [x] 良品スクリーンショットとの自動差分しきい値管理を追加
- [x] ルート `typecheck` をTDDゲートとして通る状態に修正
- [x] PostgreSQL前提診断とDocker Compose起動手順を追加
- [ ] 実API E2Eをこの端末で完走確認（現状はPostgreSQL/Docker daemon未起動でpreflight停止）
- [ ] 実API E2E用DBのテストデータ破棄を自動化

---

## 10. 実生成ショーケース
- [x] 生成前に利用可能なAPI/素材/FFmpegを確認（AivisSpeechは手動起動後に `/speakers` がHTTP 200、GeminiはHTTP 429クォータ枯渇、OpenAIはHTTP 401）
- [x] 1〜2分の本番寄り動画を生成する `scripts/generateBestAvailableVideo.mjs` を追加
- [x] ドライラン計画のVitestを追加し、台本行数・縦串ステップ・必須素材を検証
- [x] AivisSpeech実接続で音声を生成し、実測尺から字幕を作成
- [x] 既存高解像度素材とBGMを使い、FFmpegで字幕焼き込み・BGMミックス・H.264/AAC最終エンコードを実行
- [x] `outputs/production_runs/run-20260420-205959-832/projects/best-available-run-20260420-205959-832/final/final.mp4` を検証済み成果物として生成（105秒、1920x1080、H.264/AAC、102,765,593 bytes）

---

## 11. リッチ動画化（Remotion優先）
- [x] リッチ動画化の設計メモを追加し、機能別の設計・テスト方針・実装順を整理
- [x] `video_composition` を Remotion 優先の正規経路へ移行し、演出ロジックを Remotion props 化
- [x] 台本と字幕タイミングから自動ショット割りを生成し、`shot-plan.json` として保存
- [x] 口パク・まばたき・表情切替の演技計画を生成し、立ち絵描画に反映
- [x] キーワード強調、補助ラベル、ポップ表現を含む字幕表示計画を追加
- [ ] SE・環境音・BGMダッキングを Remotion 側の音量カーブで実装
- [ ] 章見出しと短尺トランジションを追加
- [ ] 追加演出の observability を `composition.json` と `workflow.log` に記録
