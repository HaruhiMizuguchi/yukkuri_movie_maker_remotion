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
- 2026-04-21: `audio-mix-plan.json` と簡易BGM/環境音/SE生成を追加し、Remotion 側でダッキングとSE差し込みを実装
- 2026-04-21: `chapter-plan.json` を追加し、章見出し帯と短尺フラッシュ/スライドのトランジションを Remotion 演出へ反映
- 2026-04-21: 実生成ショーケース `scripts/generateBestAvailableVideo.mjs` を Remotion 正規経路へ移行し、`visual-plan.json` と AivisSpeech 実接続の smoke 実生成テストを追加
- 2026-04-21: Remotion 版ショーケースの本番プロファイルを実行し、`outputs/production_runs/run-20260421-214420-055/` に 101秒・1920x1080・H.264/AAC の完成MP4を生成
- 2026-04-22: 台本生成LLM用の疎通確認スクリプト `scripts/checkScriptGenerationLlm.mjs` と実接続テストを追加し、現在の Gemini 失敗要因が HTTP 429 / `RESOURCE_EXHAUSTED`（free tier `generateContent` クォータ 0）であることを確認
- 2026-04-24: 完成動画の仕上げ調整向けに、手動テロップ追加・クリップ複製/削除・マーカー追加・再生範囲トリムを行える手動編集UIを追加
- 2026-04-24: `timeline.json` の字幕/音声/再生範囲を `video_composition` の Remotion 正規経路へ反映し、`composition.json` に `manualEditSummary` を記録
- 2026-04-24: 手動編集UIをさらにリッチ化し、視覚タイムライン、プレイヘッド/ズーム、選択インスペクタ、クリップ分割、100ms単位ナッジを追加
- 2026-04-26: 実 API E2E の起動レースを解消するため `3001/health` とレンダージョブ作成メッセージの待機を追加し、`/api/jobs/:jobId` ほか Prisma `BigInt` を含む API 応答を JSON 安全化
- 2026-04-26: E2E 一式をこの端末で再実行し、preflight 成功、顧客導線 E2E 成功、実 API/DB/Worker E2E 完走、visual regression はタイムライン/モバイルプレビューの 3 チェックポイント差分を検知
- 2026-04-27: `scripts/generateBestAvailableVideo.mjs` を Gemini 実台本生成 + Gemini Imagen 実画像生成 + AivisSpeech 実音声生成を通す完全版経路へ拡張し、`outputs/production_runs/run-20260427-082324-289/` に 62秒・1920x1080・H.264/AAC の完成MP4を生成
- 2026-04-27: ローカル起動を一発で行う `start_yukkuri_movie_maker.ps1` を追加し、AivisSpeech起動待ち・DB疎通確認・`db:push`・`pnpm dev` の順で開始できるようにした
- 2026-04-27: `apps/worker` / `apps/api` 直起動時に `process.cwd()` が各アプリ配下になることで、Remotion entry point と `projects/` 出力先が repo ルートからずれていたため、両アプリで module URL ベースの `workspaceRoot` 解決へ修正し、worker では `outputRoot` も repo ルート既定へ統一、失敗ジョブ `2156b7ed-02ed-41b4-bc57-8a87c994408f` を `resume` で復旧
- 2026-06-14: プロジェクト全体の目的・進捗・構成レビューを実施。`corepack pnpm typecheck` と代表 Vitest 21件の成功を確認し、生成物管理/API入力検証/ドキュメント同期/キャッシュ時ProjectFile再登録を改善候補として整理
- 2026-06-15: Worker の pg-boss ペイロード処理を `renderJobHandler` に分離し、不正 `skipSteps` などでも `jobId` が読める場合は Job を `FAILED` へ更新するよう修正
- 2026-06-15: Production Workflow の cache hit 時にも `latest` 成果物を現在の Job の `ProjectFile` として再登録するよう修正
- 2026-06-15: `docs/e2e_customer_journey.md` と `docs/current_capabilities.md` の実API E2E未実行記述を2026-04-26完走結果へ更新し、旧 `docs/dev_tasks_breadown.md` を正規台帳への案内に変更
- 2026-06-15: `apps/web/src/ui/App.tsx` から API client、画面定義、styles、timeline editor ロジックを分離し、タイムライン編集ロジックの単体テストを追加
- 2026-06-16: 目的「カスタマイズ性が高く、自動化の段階を選べる、自動ゆっくり動画生成」に対するユーザーストーリー適合性を再調査。GUI導線E2Eは成功したが、モード選択の実行反映、成果物プレビュー/ダウンロード、設定と実レンダリングの接続、ステップ単位の再実行/スキップUIが不足
- 2026-06-16: ユーザーストーリー適合性レビューの課題を実装。自動化モードをWorkerペイロードへ反映し、ステップ単位再実行/skip、成果物配信、プレビュー動画/ダウンロード、接続診断、素材アップロード/用途割当、テンプレート拡張、出力プリセットの実レンダリング反映、顧客導線E2E拡張を追加
- 2026-07-11: 設計・実装・セキュリティ・UX・テスト・運用性の全体レビューを実施。型検査/Webビルド/モックGUI E2Eは成功、lint設定欠落、既定Vitestの失敗、実API E2E前提未充足、依存脆弱性18件を確認し、優先改善項目をセクション14へ追加
- 2026-07-11: セクション14を実装。パス境界、fingerprint cache、全ステップ接続、YouTube実投稿、Job snapshot/排他/原子的latest、per-project設定、migration、multipart/Range、依存更新、UI自動更新/Undo/Redo/エラー回復、readiness/heartbeat、CLI、テスト分離とリポジトリ衛生を整備
- 2026-07-13: 初見ユーザー向けUI/UX再設計に着手。最終テストで完成動画を最低1本生成する受け入れ条件を `AGENTS.md` と `docs/testing_policy.md` に明文化
- 2026-07-13: UIを5工程ガイドへ再設計し、ホーム/次アクション/詳細折りたたみ/モバイル表示を改善。実API・AivisSpeech・Remotion経路で56.256秒の `final.mp4` を生成し、FFprobeとブラウザ表示を確認
- 2026-07-14: 実音声と字幕の同期ずれを調査。TTS実測タイムスタンプは音声と一致する一方、TTS前に作成された推定尺タイムライン（56.2秒）が実音声（97.412秒）より優先されることを原因として特定し、セクション16の修正に着手
- 2026-07-14: 自動生成クリップをTTS実測尺へ同期し、GUI手動編集を保持する `timingMode` と同期メタデータを追加。実API/DB/Worker/AivisSpeech/Remotion経路で97.258秒の `final.mp4` を再生成し、字幕13件の開始・終了差0ms、ブラウザ読込、H.264/AACを確認
- 2026-07-15: 全自動生成の進捗、プロジェクト選択状態、AI使用量・概算料金、モデル/APIキー設定のUX改善をセクション17へ分割して着手
- 2026-07-15: タスク17-1を実装。全画面共通の生成モニターで待機/実行/完了/失敗、現在工程、工程数、進捗率、自動更新状態、次アクションを表示

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
- [x] 手動テロップ追加・クリップ複製/削除・マーカー追加をGUIから行えるようにする
- [x] 手動編集済みタイムラインの尺/字幕/音声トリムを Remotion 実レンダリングへ反映する
- [x] 視覚タイムライン上でクリップ選択・プレイヘッド基準分割・ナッジ編集を行えるようにする

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
- [x] 実API E2Eをこの端末で完走確認（2026-04-26: PostgreSQL 起動後に preflight/実 API E2E 完走、`final.mp4` 生成まで確認）
- [ ] 実API E2E用DBのテストデータ破棄を自動化

---

## 10. 実生成ショーケース

- [x] 生成前に利用可能なAPI/素材/FFmpegを確認（AivisSpeechは手動起動後に `/speakers` がHTTP 200、GeminiはHTTP 429クォータ枯渇、OpenAIはHTTP 401）
- [x] 1〜2分の本番寄り動画を生成する `scripts/generateBestAvailableVideo.mjs` を追加
- [x] ドライラン計画のVitestを追加し、台本行数・縦串ステップ・必須素材を検証
- [x] AivisSpeech実接続で音声を生成し、実測尺から字幕を作成
- [x] 既存高解像度素材とBGMを使い、FFmpegで字幕焼き込み・BGMミックス・H.264/AAC最終エンコードを実行
- [x] `outputs/production_runs/run-20260420-205959-832/projects/best-available-run-20260420-205959-832/final/final.mp4` を検証済み成果物として生成（105秒、1920x1080、H.264/AAC、102,765,593 bytes）
- [x] ショーケース経路の `video_composition` を Remotion 正規経路へ移行し、`visual-plan.json` とショット単位の素材切り替えを追加
- [x] `tests/generateBestAvailableVideo.test.ts` に AivisSpeech 実接続の smoke 実生成を追加し、Remotion `composition.json` / `workflow.log` / 最終MP4を検証
- [x] `outputs/production_runs/run-20260421-214420-055/projects/best-available-run-20260421-214420-055/final/final.mp4` を Remotion 版ショーケース成果物として生成（101秒、1920x1080、H.264/AAC、110,903,245 bytes）

---

## 11. リッチ動画化（Remotion優先）

- [x] リッチ動画化の設計メモを追加し、機能別の設計・テスト方針・実装順を整理
- [x] `video_composition` を Remotion 優先の正規経路へ移行し、演出ロジックを Remotion props 化
- [x] 台本と字幕タイミングから自動ショット割りを生成し、`shot-plan.json` として保存
- [x] 口パク・まばたき・表情切替の演技計画を生成し、立ち絵描画に反映
- [x] キーワード強調、補助ラベル、ポップ表現を含む字幕表示計画を追加
- [x] SE・環境音・BGMダッキングを Remotion 側の音量カーブで実装
- [x] 章見出しと短尺トランジションを追加
- [x] 追加演出の observability を `composition.json` と `workflow.log` に記録

---

## 12. プロジェクト全体レビュー改善候補（2026-06-14）

- [x] 目的・進捗・構成レビューを実施
- [x] `outputs/production_runs/`、`outputs/diagnostics/`、`projects/`、`apps/*/projects/` の追跡/ignore 方針を整理
- [x] API の素材アップロードと設定保存で、パストラバーサル対策・APIキー保存先・権限チェックを強化
- [x] API の `skipSteps` を Worker と同じ step enum で検証し、不正ペイロード時も DB 上の Job を失敗状態にする
- [x] Production Workflow のキャッシュヒット時に、現在の Job へ `ProjectFile` を再登録する
- [x] `docs/e2e_customer_journey.md`、`docs/current_capabilities.md`、`docs/dev_tasks_breadown.md` の古い記述や重複を整理
- [x] `apps/web/src/ui/App.tsx` を画面・API client・timeline editor・styles に分割

---

## 13. ユーザーストーリー適合性レビュー改善候補（2026-06-16）

- [x] `full` / `scriptOnly` / `renderOnly` を実際の `skipSteps`・再開条件・必要入力に変換し、GUI上で「どこまで自動化するか」を選べるようにする
- [x] プロジェクト詳細の主操作を初回実行・再実行・失敗ステップ再実行に分け、ステップ単位のスキップ/再生成をGUIから指定できるようにする
- [x] プレビュー画面で実際の `preview.mp4` / `final.mp4` を再生・確認・ダウンロードできるようにし、レンダリング実行後もプレビューサマリーを保持する
- [x] 設定画面のAPIキー欄を `.env` 前提の接続診断に変更するか、安全な秘密情報保存方式を用意し、出力プリセットを実レンダリング設定へ接続する
- [x] 素材管理を手入力の `relativePath` だけでなく、アップロード、サムネイル、用途割当（背景/立ち絵/BGM/SE）、差し替え確認まで扱えるようにする
- [x] テンプレートに台本シードとタイムラインだけでなく、素材セット、出力プリセット、声/話者、ステップ自動化プロファイルを含める
- [x] 顧客導線E2Eを、モード別実行、成果物再生/ダウンロード、API接続診断、失敗ジョブ復旧、テンプレート再利用まで拡張する

---

## 14. プロジェクト全体レビュー改善候補（2026-07-11）

### P0: 安全性・生成結果の正しさ

- [x] テンプレートIDを安全なトークンへ制限し、`outputs/system/templates` 外へ書き込めないことを実パス検証とテストで保証する
- [x] 既存素材の `relativePath` を対象プロジェクト配下または明示許可した素材領域に限定し、`.env` や別プロジェクトのファイルを配信・複製できないようにする
- [x] 成果物の存在だけで判定するキャッシュを廃止し、台本・素材・タイムライン・設定・依存成果物のfingerprintで無効化する
- [x] Theme/Title/Background/Character/Audio Enhancement/Illustrationの各出力を後続合成へ実際に接続し、未接続ステップを完了扱いにしない
- [x] `youtube_upload` を実アップロードとして実装するか、現状の認証確認を別名へ変更して「投稿完了」と誤認させない

### P1: 実行モデル・データ整合性

- [x] Job作成時に自動化モード、skip、入力revision、出力プリセット、音声設定をsnapshot保存し、「同じ設定で再実行」を再現可能にする
- [x] `Project.status` をJob状態から導出するかWorkerで同期し、GUIでジョブをポーリング/SSE購読して完了・失敗・成果物を自動更新する
- [x] 同一プロジェクトの同時レンダリングを直列化し、`latest` 更新を原子的にして削除→コピー競合を防ぐ
- [x] Job投入をDB状態と整合するoutbox/補償処理にし、キュー送信失敗でPENDING Jobが残らないようにする
- [x] 設定をグローバルJSONではなくプロジェクト単位にし、テンプレート適用やジョブ待機中の設定変更が他プロジェクトへ波及しないようにする
- [x] 所有者情報をDBへ移し、認証済み主体を必須化する。ローカル単一ユーザー専用なら未実装の複数ユーザー対応表記を外す
- [x] Prisma migrationと削除時cascade/保持期間を整備し、`db push` 依存と無制限のrun成果物蓄積を解消する

### P1: 品質ゲート・セキュリティ保守

- [x] ESLint 9用 `eslint.config.*` を追加し、`pnpm lint` を実際に成功する品質ゲートへ戻す
- [x] VitestからPlaywright specと実API/実動画生成テストを分離し、既定テストを決定的・高速にする。実接続テストは未接続時に黙って成功させずskip理由を記録する
- [x] 5秒でタイムアウトする動画品質テストと、404になったGeminiモデル既定値/実生成テストを更新する
- [x] `pnpm audit --prod` で検出した high 7 / moderate 8 / low 3件を、Fastify・Remotion・Prisma・pg-bossを中心に解消する
- [x] base64 JSONアップロードをmultipart/streamingへ変更し、1MiB body limit、MIME/拡張子不一致、サイズ上限、保存途中失敗を扱う
- [x] MP4配信でHTTP Range、Content-Length、Content-Dispositionを扱い、プレビューのシークと大容量ダウンロードを安定させる

### P2: UX・保守性・可観測性

- [x] Web/API/Workerで重複するworkflow step・mode・API DTOを共有schemaへ統合し、1694行の`App.tsx`と1444行の`defaultWorkflow.ts`を責務別に分割する
- [x] タイムラインへドラッグ移動/リサイズ、スナップ、Undo/Redo、キーボード操作、未保存表示、動画プレビューとの再生ヘッド同期を追加する
- [x] APIエラーを画面内に表示し、処理中disable、再試行、破壊操作確認、空状態の次アクション、技術ステータスの日本語化を行う
- [x] health checkへDB/queue/Worker/Aivis/Gemini readinessを追加し、job/stepの構造化ログ、所要時間、cache fingerprint、retry backoff、失敗分類を記録する
- [x] `projects/` 配下で追跡済みの生成物約238MBを追跡対象から外し、repository hygieneテストで再混入を検出する（共有済みGit履歴の書き換えは行わない）
- [x] `start_yukkuri_movie_maker.ps1` をUTF-8化し、ユーザー名固定パス、サーバー起動前のブラウザ表示、DB手動起動前提を解消する
- [x] README・reproduction kit・完了チェックを実装実態に合わせ、CLI、AI拡張、YouTube投稿の実装状態を明示する

---

## 15. 初見ユーザー向けUI/UX改善（2026-07-13）

- [x] 最終テストで実際の `final.mp4` を最低1本生成・検証する運用ルールを明文化する
- [x] 8画面の並列ナビゲーションを、企画→台本→素材→編集→確認・出力の制作ガイドへ再構成する
- [x] ホームに新規作成、続きから再開、制作の流れ、生成状態を人間向けの言葉で表示する
- [x] UUID・内部成果物・工程単位の再実行を通常導線から外し、必要時だけ開く詳細表示へ移す
- [x] 各画面に目的説明、推奨操作、保存後の次工程CTA、素材なし等の空状態を追加する
- [x] デスクトップ/モバイルの実ブラウザで視認性、キーボードフォーカス、主要顧客導線を確認する
- [x] 最終品質ゲート後に実動画を1本生成し、FFprobeとブラウザ再生で検証する

---

## 16. 字幕・音声同期の修正（2026-07-14）

- [x] 推定尺で作成された自動タイムラインを、TTS実測タイムスタンプへ同期する回帰テストを追加する
- [x] 自動生成クリップと手動編集クリップを区別し、手動調整を保持したまま字幕・音声尺を同期する
- [x] 同期結果と補正件数を composition metadata / workflow log へ記録する
- [x] lint・型検査・単体テスト・ビルドを通す
- [x] 実API・AivisSpeech・Remotion経路で完成動画を1本生成し、字幕・音声同期とメディア情報を検証する

---

## 17. 生成状況・AI設定のUX改善（2026-07-15）

### 17-1. 全自動生成の進捗表示

- [x] 全画面で現在工程、完了工程数、進捗率、自動更新状態を確認できる生成モニターを追加する
- [x] 待機中・実行中・完了・失敗の表示を人間向けの言葉と次アクションへ変換する
- [x] 進捗計算の単体テストとGUI顧客導線テストを追加する

### 17-2. 新規作成時の選択状態

- [ ] 「新しい動画を作る」で以前のプロジェクト選択・台本・素材・タイムライン・プレビューを明示的に解除する
- [ ] ヘッダーで「既存動画を編集中」と「新しい動画を作成中」を区別する
- [ ] 他画面から新規作成へ移動しても以前のテーマが残らないE2Eを追加する

### 17-3. AI使用量と概算料金

- [ ] LLMの入力/出力トークン数と画像生成枚数を各WorkflowStepの出力へ記録する
- [ ] モデル別単価に基づく概算料金をジョブ・プロジェクト単位で集計する
- [ ] GUIで今回/累計の使用量、概算USD/JPY、料金が概算である理由を表示する

### 17-4. モデル選択とAPIキー登録

- [ ] 台本生成モデルと画像生成モデルをGUIから選択し、Job snapshotと実生成へ反映する
- [ ] Google APIキーを成果物・通常設定と分離したローカル秘密情報ストアへ保存し、読取APIから値を返さない
- [ ] APIキーの登録状態、接続診断、更新操作をGUIへ追加する
- [ ] APIキーが利用可能な環境では実API接続から成果物生成まで検証し、未設定時は理由を明記して該当テストをskipする

### 17-5. 最終検証

- [ ] lint・型検査・単体テスト・Webビルド・主要E2Eを通す
- [ ] 実生成経路で `final.mp4` を最低1本生成し、AI使用量・料金記録・ブラウザ再生を確認する
