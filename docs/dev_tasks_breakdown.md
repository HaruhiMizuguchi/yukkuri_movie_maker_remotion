# 開発タスク分解（MVP〜拡張）

本ドキュメントは、開発を進める際のタスクを粒度細かく整理したものです。
**最短で「1本の動画が出力できる」縦串を作る**ことを優先しつつ、
将来の拡張や運用まで見失わない構成にしています。

## 更新メモ

- 2026-09-22: 初回pushは未送信履歴中の100MB超MP4が原因でGitHubのGH001拒否。元履歴を `codex/backup-before-push-20260922` に保持し、未送信39コミットから `outputs/production_runs` と `outputs/test_evidence` の生成物だけを除外。処理前後のHEADツリーが完全一致することと、リモートmainからfast-forward可能なことを確認して再送。ローカルの生成ファイルは保持
- 2026-09-22: ユーザー依頼により、全体レビュー修正と関連する編集UI・自動運用・テスト・資料の未コミット変更をコミットし、既存の未送信38コミットとともにGitHubの `main` へpushする作業を実施。リモート取得後に分岐なし・差分形式正常を確認。アプリ実装は変更せず、品質ゲートと実動画の検証結果は2026-09-18の記録を継続利用
- 2026-09-18: セクション29の7件を修正済み。単体189件、desktop/mobile E2E、実API/DB/Worker E2E、実PostgreSQL予約試験に成功。実AivisSpeechとRemotionで5.546秒の動画を生成・全デコード・ブラウザ確認済み。YouTube実投稿・実指標取得のみ認証未設定で未検証。詳細は `docs/review_fixes_20260918.md`
- 2026-09-17: 未コミット変更を含む全体レビューを実施。単体178件・型検査・lint・Webビルドと実Remotion動画の全デコードは成功。未保存タイムラインの消失、認証情報のログ混入、同時実行制限、入力revision、モデル継承、モック投稿、指標再収集の7件を確認し、セクション29と `docs/project_review_20260917.md` に記録。実API/DB E2EはPostgreSQL/Docker停止で前提未成立
- 2026-07-17: 人手運用を置き換える閉ループ自動化（YouTube投稿台帳、視聴データ収集、動画評価、テーマ改善、定期実行、安全策）をセクション28として完了。実PostgreSQLで閉ループを検証し、YouTube認証情報不足は構造化証跡へ記録してモックで後続処理を完走
- 2026-07-16: デスクトップランチャーでDocker Desktop停止時にPostgreSQL自動起動が失敗する問題を修正。Docker Desktopの自動起動・エンジン待機・外部コマンド出力のログ保存をTDDで追加し、実Docker/PostgreSQLとWindows PowerShell 5で検証
- 2026-07-16: 編集画面を編集モニター・フル幅タイムライン・クリップインスペクターの3領域へ再設計。重複していた全クリップ詳細フォームを撤去し、日本語ラベル、固定トラック見出し、Space/S/Delete/矢印/Undo/Redoショートカット、入力中の誤作動防止を追加。デスクトップ/モバイルE2E・ビジュアル回帰・全品質ゲートと、完成動画を2区間へ分割して再合成する実Remotion経路を検証
- 2026-07-16: 作成ウィザードがプロジェクト作成だけで生成ジョブを投入していなかった不具合を修正。選択モードで即座にジョブを開始し、失敗時は作成済みプロジェクトを保持して理由を表示する。実ブラウザからGoogle AI・AivisSpeech・Remotionの全自動13工程を完走し、5枚の実画面スクリーンショットを使ったHTML操作手順書を追加
- 2026-07-16: デスクトップショートカットから起動できる `start_yukkuri_movie_maker.bat` を追加。任意の作業フォルダーから既存PowerShellランチャーを呼び出し、引数転送に対応。AivisSpeech・DB・migration・サーバー・ブラウザの5段階を表示し、起動後はサーバー終了まで、早期終了時はキー入力までウィンドウを保持。全起動出力を `logs/launcher/` に保存し、Web/API起動済みの場合の二重起動と即時終了を防止。BATのASCII限定、Windows PowerShell 5向けUTF-8 BOM、ViteのIPv6 localhost待受に対応
- 2026-07-15: タスク17-5の最終品質ゲートを完了。lint・型検査・単体テスト107件・Webビルド・デスクトップ/モバイルE2Eを通し、101.461秒の実動画 `outputs/test_evidence/task3_quality/full-run-1784054236671/projects/project-1784054236671/output/final_encoding/latest/final.mp4` を生成。字幕/音声11区間の最終終了時刻は双方101.386秒（差0ms）、末尾余白0.075秒、H.264/AACを確認。実AI成果物・使用量証跡と設定/接続診断UIも別途実ブラウザで確認
- 2026-07-15: タスク17-4として台本/画像モデル選択、通常設定と分離したGoogle APIキー秘密ストア、値を返さない登録/削除/実接続診断UI、Job snapshot/Worker反映を実装。実APIで台本JSON・背景PNG・使用量証跡を `outputs/test_evidence/task17_ai_real/run-1784053894377/` に生成
- 2026-07-15: タスク17-3としてGeminiの実レスポンスからLLM入出力トークンを記録し、画像枚数を含むモデル別料金計算、直近実行/プロジェクト累計の概算USD・JPY表示を追加
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
- 2026-07-15: タスク17-2を実装。新規作成への切替時に以前のプロジェクト選択と編集ドラフトを解除し、ヘッダーと作成画面でコンテキストを明示
- 2026-07-15: OpenAI・Anthropic Claudeを既存のGemini生成基盤へ追加するタスク18に着手。プロバイダー別APIキー、モデル選択、実生成、使用量・料金、接続診断を同じUXで扱う

---

## 0. 前提整備

- [x] `.env` と `config/` のテンプレ整理（必要キー一覧の明文化）
- [x] Prisma `schema.prisma` の見直し（成果物管理の拡張余地確認）
- [x] ローカル開発起動フローの整理（`pnpm dev` の役割確認）
- [x] Windowsでの `corepack pnpm dev` 起動互換性を確保（子プロセス側も `corepack pnpm` を使用）
- [x] `pnpm dev` の標準出力/標準エラーを `logs/dev/*.log` に記録し、PowerShell実行時のトラブル調査を容易化
- [x] デスクトップショートカットから利用できるWindows BATランチャーを追加

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

- [x] 「新しい動画を作る」で以前のプロジェクト選択・台本・素材・タイムライン・プレビューを明示的に解除する
- [x] ヘッダーで「既存動画を編集中」と「新しい動画を作成中」を区別する
- [x] 他画面から新規作成へ移動しても以前のテーマが残らないE2Eを追加する

### 17-3. AI使用量と概算料金

- [x] LLMの入力/出力トークン数と画像生成枚数を各WorkflowStepの出力へ記録する
- [x] モデル別単価に基づく概算料金をジョブ・プロジェクト単位で集計する
- [x] GUIで今回/累計の使用量、概算USD/JPY、料金が概算である理由を表示する

### 17-4. モデル選択とAPIキー登録

- [x] 台本生成モデルと画像生成モデルをGUIから選択し、Job snapshotと実生成へ反映する
- [x] Google APIキーを成果物・通常設定と分離したローカル秘密情報ストアへ保存し、読取APIから値を返さない
- [x] APIキーの登録状態、接続診断、更新操作をGUIへ追加する
- [x] APIキーが利用可能な環境では実API接続から成果物生成まで検証し、未設定時は理由を明記して該当テストをskipする

### 17-5. 最終検証

- [x] lint・型検査・単体テスト・Webビルド・主要E2Eを通す
- [x] 実動画と実AI成果物をそれぞれ生成し、`final.mp4` の媒体情報・抽出フレーム・字幕音声同期、AI使用量・料金記録、設定/接続診断UIを確認する

---

## 18. OpenAI・Claudeプロバイダー対応（2026-07-15）

- [x] 台本モデルからプロバイダーを判定し、Gemini・OpenAI Responses API・Claude Messages APIを同じWorkflow境界で実行する
- [x] Gemini/OpenAIの画像生成モデルを選択でき、画像出力非対応のClaudeはUIと検証で誤選択を防ぐ
- [x] OpenAI/Anthropic APIキーを既存秘密ストアへ追加し、値を返さない登録・削除・実接続診断を提供する
- [x] OpenAI/Claudeの実トークン使用量と公式単価に基づく概算料金を既存集計へ反映する
- [x] プロバイダー分岐・秘密情報・API DTO・UI導線をTDDで検証する
- [x] 利用可能なGoogle APIキーで台本・画像成果物を実生成し、OpenAIは登録キーのHTTP 401、Anthropicはキー未設定を理由付きで証跡化する
- [x] lint・型検査・単体テスト・Webビルド・主要E2Eを通し、実動画経路で再生可能な `final.mp4` を最低1本生成・検証する

### 18-1. 最終検証結果

- `corepack pnpm test`: 37ファイル・118件成功
- `corepack pnpm typecheck` / `corepack pnpm lint` / Web本番ビルド: 成功
- `corepack pnpm test:e2e:journey`: Chromium desktop/mobileの2件成功
- Google実API: `gemini-3.1-flash-lite` の台本と `gemini-3.1-flash-lite-image` の画像を生成し、使用量証跡を確認
- OpenAI実API: `gpt-5.6-luna` へ接続したが登録キーがHTTP 401。`generationError=openai_api_http_401` を構造化ログへ記録
- Anthropic実API: `ANTHROPIC_API_KEY` 未設定のため理由付きskip。モックのClaude Messages API分岐は単体テストで確認
- 完成動画: `outputs/test_evidence/task3_quality/full-run-1784088565002/.../final.mp4`（14,214,844 bytes、150.549秒、1920x1080 H.264 + AAC）
- 字幕・音声同期: TTSタイムスタンプ終端150.472秒、動画終端との差77ms

---

## 19. 全自動開始導線の修正・HTML操作手順書（2026-07-16）

- [x] ウィザードの制作開始操作で、選択した自動化モードの生成ジョブが即座に投入される回帰E2Eを追加する
- [x] プロジェクト作成後に生成ジョブを開始し、生成状況とエラーを画面上で明確に確認できるようにする
- [x] 実ブラウザで主要操作を再現し、実画面スクリーンショットを取得する
- [x] スクリーンショット付きHTML操作手順書を作成し、ブラウザで表示品質とリンク切れを確認する
- [x] lint・型検査・全単体テスト・Webビルド・主要E2Eを通す
- [x] 実動画生成経路で再生可能な `final.mp4` を1本生成し、FFprobeで検証する

### 19-1. 最終検証結果

- 回帰E2E: 修正前はdesktop/mobileともジョブPOST待機がタイムアウトし、修正後は選択モード `full` / `runMode: resume` の投入、生成モニター表示まで成功
- 実ブラウザ: 「生成AIを安全に使う3つのポイント」を全自動で作成し、待機→台本生成→13/13工程完了→動画プレイヤー表示→ダウンロード導線まで確認
- 実接続: Google AIで台本1件・画像2件、AivisSpeechで音声4区間を生成し、Remotionで合成・最終エンコード
- 完成動画: `projects/93309c31-ecf7-4139-89fd-0609e3c743c5/output/final_encoding/latest/final.mp4`（9,622,486 bytes、14.229秒、1920x1080 H.264 + AAC）
- 字幕・音声同期: TTSタイムスタンプ終端14.162秒、動画終端との差67ms
- HTML手順書: `docs/user_guide/full_auto_operation_guide.html`。実画面JPEG 5枚を参照し、ブラウザ表示と画像形式を検証
- 品質ゲート: Vitest 39ファイル・122件、型検査、lint、Web本番ビルド、Chromium desktop/mobile E2E 2件すべて成功

---

## 20. 完成動画編集（AviUtlライク第1段階）（2026-07-16）

- [x] 最新の完成動画を編集タイムラインへ1クリックで取り込めるAPIとUIを追加する
- [x] 映像クリップの分割・移動・複製・削除・トリムを再レンダリングへ反映する
- [x] トラックの表示/ミュートと映像クリップの音量を編集できるようにする
- [x] 完成動画取り込み時に焼き込み済み字幕・音声との二重再生を防ぐ
- [x] 操作状態、未保存、取り込み元、再出力の案内を初見ユーザー向けに明示する
- [x] 単体・API・実ブラウザ操作をTDDで検証する
- [x] 実際の完成動画を再編集し、再生可能な `final.mp4` を最低1本生成・検証する

### 20-1. 最終検証結果

- Vitest: 40ファイル・130件成功。完成動画モード、二重レイヤー防止、分割時のsource trim、リップル削除、メディア長解析を回帰テスト化
- Remotion実動画: 3秒のH.264/AAC素材から2区間を切り出し、追加テロップと音量0.7を反映して再合成
- 完成動画: `outputs/test_evidence/remotion_video/final-video-editor-1784172544179/.../final/final.mp4`（861,685 bytes、2.048秒、640x360、24fps、H.264 + AAC）
- ブラウザE2E: Chromium desktop/mobileの2件成功。完成動画取り込み、分割、削除して詰める、表示/ミュート状態を画面証跡で確認
- 品質ゲート: lint、型検査、Web本番ビルドに成功
- アプリ内ブラウザはこの実行環境に接続先がなく利用不可だったため、プロジェクト付属Playwright Chromiumと保存スクリーンショットで代替確認

---

## 21. 編集ワークスペース第2段階（2026-07-16）

- [x] プレビュー、タイムライン、選択クリップ設定の関係が一目で分かる3領域の編集ワークスペースへ再構成する
- [x] 重複していた全クリップ詳細フォームを整理し、選択中クリップへ編集操作を集約する
- [x] 再生位置・表示範囲・入出力点・音量・フェードの単位と日本語ラベルを明示する
- [x] Space再生、S分割、Delete削除、矢印移動、Undo/Redoのショートカットと入力中の誤作動防止を追加する
- [x] デスクトップ・モバイルのレスポンシブ表示、キーボード操作、主要顧客導線をTDDで検証する
- [x] lint・型検査・単体テスト・Webビルド・主要E2Eを通す
- [x] 実動画生成経路で再生可能な `final.mp4` を最低1本生成し、編集反映とメディア情報を検証する

### 21-1. 最終検証結果

- Vitest: 41ファイル・134件成功。ショートカット解決、入力中の抑止、トラック種別の日本語表示を単体テスト化
- ブラウザE2E: Chromium desktop/mobileの2件成功。3領域レイアウト、矢印移動直後のS分割、モバイル横スクロール時の固定トラック見出しを確認
- ビジュアル回帰: desktop/mobile各9画面の基準を更新し、再比較に成功
- アプリ内ブラウザ: ローカルViteへ接続し、ホームから作成ウィザードへの実操作、DOM、ラベル、無効状態を確認。Docker Desktop停止のためDBを要する編集状態はプロジェクト付属Playwrightで検証
- 品質ゲート: lint、型検査、Web本番ビルドに成功
- 実動画: `outputs/test_evidence/remotion_video/final-video-editor-1784176632364/projects/project-1784176632365/output/final_encoding/latest/final.mp4`（860,737 bytes、2.048秒、640x360、24fps、H.264 + AAC 48kHz stereo）
- 編集反映: 元動画の0.4〜1.4秒と1.8〜2.8秒を音量0.7で再合成し、0.25〜1.0秒へ追加テロップを重ねた。FFprobeと全フレームデコードに成功

---

## 22. 台本エディター第2段階（2026-07-16）

- [x] 自動ポーリング中も未保存の台本ドラフトを上書きしない
- [x] 未保存状態を明示し、別画面へ移動する前に破棄確認を行う
- [x] 行数・文字数・話者バランス・読み上げ時間目安をリアルタイム表示する
- [x] セリフ行の複製・上下移動・削除と、最後の1行を保持する安全策を追加する
- [x] タイトル・テーマ・空セリフを保存前に検証し、修正箇所を人間向けに表示する
- [x] 台本編集画面そのものをdesktop/mobileのビジュアル回帰対象へ追加する
- [x] lint・型検査・単体テスト・Webビルド・主要E2Eを通す
- [x] 実動画生成経路で再生可能な `final.mp4` を最低1本生成・検証する

### 22-1. 最終検証結果

- TDD: 台本集計・保存前検証・複製・並べ替え・削除・最終1行保持を単体テスト化し、ポーリング中の入力保持・未保存離脱確認・保存後遷移をE2Eで回帰検証
- Vitest: 42ファイル・138件成功。型検査、lint、Web本番ビルドも成功
- ブラウザE2E: Chromium desktop/mobileの2件成功。台本ワークスペースの操作とレスポンシブ表示を実スクリーンショットで確認
- ビジュアル回帰: desktop/mobile各10画面へ台本編集中の画面を追加し、基準更新後の再比較に成功
- アプリ内ブラウザ: ローカルViteへ接続し、ホームから企画画面への遷移、入力、ナビゲーションのラベルと無効状態を実DOMで確認。DB/APIを要する台本状態はプロジェクト付属Playwrightで検証
- 実動画: `outputs/test_evidence/remotion_video/final-video-editor-1784178336735/projects/project-1784178336735/output/final_encoding/latest/final.mp4`（861,390 bytes、2.048秒、640x360、24fps、H.264 + AAC 48kHz stereo）
- 動画検証: FFprobe、全フレーム・音声デコードに成功。SHA-256は `6DD659226039A7FC8D71296B16D4A090EAE19DCFD4CEA5548825E3B7237A141F`

---

## 23. 素材ライブラリ第2段階（2026-07-16）

- [x] 日本語化したドラッグ＆ドロップ領域と対応形式・上限サイズの案内を追加する
- [x] 選択ファイルから素材種別・用途・表示名を推定し、非対応形式を送信前に検証する
- [x] 素材数・用途別内訳・自動生成との関係が分かるサマリーと空状態を追加する
- [x] サムネイル・人間向け種別・ファイル名・詳細パスを整理した素材カードへ再構成する
- [x] 誤操作確認付きで素材をライブラリから外せるAPIとUIを追加する
- [x] 推定・検証・集計・削除をTDDで検証し、desktop/mobileのビジュアル回帰を更新する
- [x] lint・型検査・全単体テスト・Web本番ビルド・主要E2Eを通す
- [x] 実動画生成経路で再生可能な `final.mp4` を最低1本生成・検証する

### 23-1. 最終検証結果

- TDD: ファイル名からの素材種別・用途・表示名推定、拡張子/MIME/250MB上限検証、種別・用途別集計、素材登録解除の実ファイル永続化を単体テスト化
- API/UI: プロジェクト認可付き `DELETE /api/projects/:projectId/assets/:assetId`、削除監査ログ、元ファイルを残す確認文、送信前検証、登録後カードを追加
- Vitest: 43ファイル・141件成功。型検査、lint、Web本番ビルドも成功
- ブラウザE2E: Chromium desktop/mobileの2件成功。非対応EXEの拒否、PNGからの自動推定、追加、削除取消、削除確定を確認
- ビジュアル回帰: desktop/mobile各10画面の空状態・登録済み状態を更新し、再比較に成功。モバイル素材カードの縦積みも実画像で確認
- 実動画: `outputs/test_evidence/remotion_video/final-video-editor-1784179394886/projects/project-1784179394886/output/final_encoding/latest/final.mp4`（861,818 bytes、2.048秒、640x360、24fps、H.264 + AAC 48kHz stereo）
- 動画検証: FFprobe、全フレーム・音声デコードに成功。SHA-256は `C5FA1FEE98812F7DCFC9987945F84B4DBAA0A83CD4EF23E11C7ED842153BC0FC`

---

## 24. 最終確認・書き出しワークスペース第2段階（2026-07-16）

- [x] プレビュー、品質チェック、書き出し操作、完成ファイルの関係が一目で分かる画面へ再構成する
- [x] 長さ・解像度・字幕・音声の自動チェックと、人が確認する映像・字幕・音量・権利チェックを分けて表示する
- [x] 未確認項目がある生成操作では確認を挟み、生成中の二重ジョブ投入を防ぐ
- [x] 新版生成中の完成ファイルを「前回版」と明示し、生成中・準備完了・完成の状態文言を整理する
- [x] レビュー状態判定と品質チェックをTDDで検証する
- [x] タイムライン画面そのもののビジュアル証跡を保存前に取得し、確認・出力画面と分離する
- [x] desktop/mobileの主要E2Eとビジュアル回帰を更新する
- [x] lint・型検査・全単体テスト・Web本番ビルドを通し、実 `final.mp4` を生成・検証する

### 24-1. 最終検証結果

- TDD: 長さ・出力設定・字幕・音声の自動チェック、手動レビュー件数、プレビュー待ち・生成準備・生成中・前回版あり・完成の状態判定を単体テスト化
- ブラウザE2E: desktop/mobileとも、未確認4項目の警告取消、4/4確認後の生成、生成中CTA無効、前回版ダウンロードを確認
- ポーリング回帰: 新版を長時間pendingに固定したまま設定画面まで進み、2秒更新が編集中・保存済み設定を上書きしないことを確認
- ビジュアル回帰: 保存前の実タイムライン画面と最終確認画面を別々に取得し、desktop/mobile各10画面の基準を更新・再比較
- Vitest: 44ファイル・145件成功。型検査、lint、Web本番ビルドも成功
- 実動画: `outputs/test_evidence/remotion_video/final-video-editor-1784180659490/projects/project-1784180659490/output/final_encoding/latest/final.mp4`（860,562 bytes、2.048秒、640x360、24fps、H.264 + AAC 48kHz stereo）
- 動画検証: FFprobe、全フレーム・音声デコードに成功。SHA-256は `84617FA3AF4E842038A9B38A4AA3B7B8E1E227AFFE491FF752F8F3C9B062CA4F`

---

## 25. 設定ワークスペース第2段階（2026-07-16）

- [x] モデル・出力設定の未保存状態を明示し、画面移動・ブラウザ終了前に破棄確認する
- [x] ポーリング中も設定ドラフトを保持し、保存時に基準値を更新する
- [x] 幅・高さ・FPSの範囲と整数を保存前に検証し、修正理由を表示する
- [x] フルHD・HD・縦型ショートの用途別プリセットを1クリックで適用できるようにする
- [x] 選択中モデル・出力比率・接続状況をまとめた設定サマリーを追加する
- [x] dirty判定・検証・プリセットをTDDで検証する
- [x] desktop/mobileの離脱確認・保存・ビジュアル回帰を更新する
- [x] lint・型検査・全単体テスト・Web本番ビルドを通し、実 `final.mp4` を生成・検証する

### 25-1. 最終検証結果

- TDD: 保存基準との設定比較、幅320〜7680・高さ240〜4320・FPS 1〜120の整数検証、フルHD・HD・縦型ショート適用、16:9・9:16・1:1比率表示を単体テスト化
- 未保存保護: モデル/出力変更をdirty表示し、画面移動の破棄確認とbeforeunload警告を追加。値を保存基準へ戻した場合は自動で保存済みへ戻る
- ブラウザE2E: desktop/mobileとも不正FPSで保存無効、HDプリセット適用、離脱取消、pendingポーリング中のドラフト保持、保存済み復帰を確認
- ビジュアル回帰: モデル・画像・出力・API接続の概要、用途別プリセット、保存状態を含むdesktop/mobile各10画面を更新・再比較
- Vitest: 45ファイル・148件成功。型検査、lint、Web本番ビルドも成功
- 実動画: `outputs/test_evidence/remotion_video/final-video-editor-1784181408119/projects/project-1784181408119/output/final_encoding/latest/final.mp4`（861,807 bytes、2.048秒、640x360、24fps、H.264 + AAC 48kHz stereo）
- 動画検証: FFprobe、全フレーム・音声デコードに成功。SHA-256は `23360BFB3A2685F2B182C3F970728350761F3AABD965DA8FA64025CAD23722E4`

---

## 26. ビジュアルデザイン刷新（見た目のみ）（2026-07-16）

- [x] 現行の制作系SaaSと公式デザインガイドを調査し、採用する視覚方針を根拠付きで整理する
- [x] 機能・文言・画面遷移・API挙動を変えず、配色・タイポグラフィ・余白・階層・面表現だけを刷新する
- [x] シアン枠とカードの過剰な強調を抑え、制作ツールとして落ち着いたニュートラル基調と単一アクセントへ統一する
- [x] デザイントークンの回帰テストを先に追加し、実装前の失敗と実装後の成功を確認する
- [x] desktop/mobileの主要10画面を実描画し、可読性・レスポンシブ・操作状態をビジュアル回帰で確認する
- [x] lint・型検査・全単体テスト・Web本番ビルド・主要E2Eを通す
- [x] 実動画生成経路で再生可能な `final.mp4` を最低1本生成し、FFprobeと全デコードで検証する

### 26-1. 最終検証結果

- デザイン調査: Apple HIGのタイポグラフィ・ダークモード、Material 3の色役割、Descriptの編集ワークスペース構成を参照し、グラファイト4段階の面、紫1色の主要アクセント、状態専用の成功・警告・危険色へ整理
- TDD: `visualTheme.test.ts` を先に追加し、旧テーマで3件失敗、新テーマ実装後に3件成功。旧シアンの主アクセントが残らず、面・入力・主要ボタンが共通トークンを使うことを固定
- 変更範囲: 機能・文言・API・画面遷移を変えず、`styles.ts` の配色・書体・余白・角丸・影・フォーカス・操作状態だけを変更
- ブラウザ確認: in-app Browserでdesktop/mobileのホームを実描画し、mobileの横あふれなしを確認。Playwright顧客導線はChromium desktop/mobileの2件成功
- ビジュアル回帰: desktop/mobile各10画面を目視し、20枚の基準画像を更新後、差分0件で再比較に成功
- 品質ゲート: Vitest 46ファイル・151件、型検査、lint、Web本番ビルドに成功
- 実動画: `outputs/test_evidence/remotion_video/final-video-editor-1784192815378/projects/project-1784192815378/output/final_encoding/latest/final.mp4`（860,610 bytes、2.048秒、640x360、24fps、H.264 + AAC 48kHz stereo）
- 接続条件: 見た目だけの変更なので外部AI/TTS APIは不使用・フォールバックなし。FFmpeg生成のH.264/AAC素材をRemotionで分割・トリム・追加テロップ合成し、実際の最終エンコード経路を通した
- 動画検証: FFprobeと全フレーム・音声デコードに成功。ブラウザの `<video>` でも `readyState=4`、2.048秒、640x360、エラーなしを確認。SHA-256は `42015EC1F07BC82DBEE7FCDF5CA5E5B9F123CAB3D73ED94ED0BBCD11E71948A3`

---

## 27. デスクトップランチャーのDocker自動起動修正（2026-07-16）

- [x] ユーザーのランチャーログと同一環境でPostgreSQL起動失敗を再現し、Docker CLIではなくDockerエンジン停止が原因と特定する
- [x] Docker Desktop停止時の自動起動・準備待ちを回帰テストへ追加する
- [x] Docker Desktopの一般的なインストール先を検出して自動起動し、エンジン準備後にDocker Composeを実行する
- [x] ネイティブコマンド出力を画面とTranscriptへ転記し、Docker障害の詳細をログへ残す
- [x] 実Docker Desktop・Docker Compose・PostgreSQL疎通を確認する
- [x] lint・型検査・全単体テストを通し、実 `final.mp4` を生成・検証する

### 27-1. 最終検証結果

- 原因: Docker CLIとComposeはインストール済みだったが、Docker Desktopエンジンが停止し、`dockerDesktopLinuxEngine` の名前付きパイプが存在しなかった
- 実起動: 停止状態からDocker Desktopを約14秒で起動し、PostgreSQLコンテナを約6秒でhealthyにした。`localhost:5432` 疎通とmigration適用済みを確認
- TDD: ランチャー回帰テストを2件追加し、修正前2件失敗、修正後4件成功。Windows PowerShell 5の構文解析とUTF-8 BOMも成功
- 品質ゲート: Vitest 46ファイル・153件、型検査、lintに成功
- 実動画: `outputs/test_evidence/remotion_video/final-video-editor-1784209195172/projects/project-1784209195172/output/final_encoding/run-20260716-224003-490-833e4fcc/final.mp4`（860,775 bytes、2.048秒、640x360、24fps、H.264 + AAC 48kHz stereo）
- 動画検証: FFprobeと全フレーム・音声デコードに成功。SHA-256は `DDA5CC052BB8D87DF96F0B179EA478AE89BA729B595BF4B261594299B364A082`

---

## 28. YouTube運用の閉ループ自動化（2026-07-17）

### 28-1. 投稿認証・投稿台帳・予約/重複防止

- [x] OAuth更新トークンから短期アクセストークンを取得し、従来の直接アクセストークンも後方互換として利用できるようにする
- [x] 投稿結果、公開状態、予約日時、冪等キーをDBへ保存し、同じ成果物の重複投稿を防ぐ
- [x] 公開前の既定をprivateとし、予約公開はYouTube仕様に合わせてprivate + `publishAt` で送信する
- [x] YouTube認証情報がない場合は理由を構造化証跡へ残し、モック投稿で後続の分析・改善検証を継続できるようにする

### 28-2. 視聴データ収集

- [x] YouTube Data APIとYouTube Analytics APIから投稿動画の再生・反応・視聴時間指標を収集する
- [x] 投稿後24時間・72時間・7日を評価窓としてスナップショット保存し、再収集を冪等にする
- [x] API未認証・指標未確定・クォータ不足を成功値0と混同せず、収集状態と理由を保存する

### 28-3. 動画評価・テーマ改善

- [x] 公開後経過時間とチャンネル内基準値を考慮した動画評価スコアを算出する
- [x] トレンド、過去テーマ成績、新規性を組み合わせて次回テーマ候補を説明可能な形で順位付けする
- [x] 選定理由と入力指標をテーマ判断履歴へ保存し、次回プロジェクトへ反映する

### 28-4. 定期オーケストレーションと安全策

- [x] 実行間隔、次回実行日時、投稿上限、既定公開状態を設定できる自動運用設定を追加する
- [x] 定期的に「指標収集→テーマ選定→プロジェクト/Job作成→生成→投稿」を開始するWorker処理を追加する
- [x] 停止スイッチ、日次投稿上限、同時実行防止、失敗分類、監査ログを追加する
- [x] APIとCLIから状態確認、手動収集、テーマ提案、手動サイクル実行を操作できるようにする

### 28-5. 検証

- [x] 各モジュールをTDDで実装し、APIモックだけでなく利用可能な認証情報で実接続診断・成果物生成を行う
- [x] API制約時は不足条件とモック使用を `outputs/test_evidence/task28_closed_loop/` に記録する
- [x] lint・型検査・全単体テスト・Webビルド・主要E2Eを通す
- [x] 実動画生成経路で再生可能な `final.mp4` を最低1本生成し、FFprobeと全デコードで検証する

### 28-6. 最終検証結果

- 実接続診断: YouTube OAuth認証情報が未設定のため、実アップロードと実Analytics取得は実行不可。`youtube_credentials_missing` を `outputs/test_evidence/task28_closed_loop/run-1784246431763/youtube-api-status.json` に保存し、指定どおりモックへ切り替えた
- 実DB閉ループ: PostgreSQLへ投稿台帳、24/72/168時間スナップショット、評価、テーマ判断を永続化。モック累積再生数は448/981/1391で単調増加し、次回テーマに「次世代AIニュース」を選定
- 品質ゲート: Vitest 50ファイル・178件、型検査、lint、Webビルド、Playwright主要導線（desktop/mobile）に成功。閉ループ実PostgreSQL試験は2件成功
- 実動画: `outputs/test_evidence/remotion_video/final-video-editor-1784246048550/projects/project-1784246048550/output/final_encoding/run-20260717-085412-692-691034bb/final.mp4`（861,755 bytes、2.048秒、640x360、24fps、H.264 + AAC 48kHz stereo）
- 動画検証: FFprobeと全フレーム・音声デコードに成功。SHA-256は `DD7886EB47A907094F3A55D336D2CF46C099A831B21E2AE70153C36B8B929473`

---

## 29. 全体レビューで確認した改善項目（2026-09-17）

レビュー時点の再現条件は `docs/project_review_20260917.md`、2026-09-18の修正・最終検証は `docs/review_fixes_20260918.md` を参照。

- [x] API・Worker・生成処理・編集UI・自動運用・テスト方針をレビューする
- [x] 既存品質ゲートと不具合の局所再現を行い、実動画を生成・全デコード検証する
- [x] P1: YouTube認証トークンをHTTP応答・ログ・DB・証跡へ含めない診断型へ分離する
- [x] P1: ポーリング中に未保存タイムライン、Undo/Redo、選択クリップ、再生位置を保持する
- [x] P1: 自動運用の同時実行枠と日次投稿枠をDBで原子的に予約する
- [x] P1: Job投入時の入力revisionに対応する台本・素材・タイムラインを固定し、実行中の編集混入を防ぐ
- [x] P2: 新規Projectがグローバルの台本・画像モデル設定を引き継ぐようにする
- [x] P2: モック投稿から同じ完成動画の実投稿へ移行できる重複判定を実装する
- [x] P2: FAILED/NO_DATA/代替MOCKEDの指標を再収集し、評価まで補完する
- [x] PostgreSQL/Dockerを稼働させ、専用DBで実API/DB/Worker E2Eと別DB接続の同時予約試験を通す
- [ ] YouTube OAuth認証を用意して実投稿・実Analytics取得を検証する（`youtube_credentials_missing` を記録済み。コード修正の未完了ではなく外部接続の未検証範囲）
