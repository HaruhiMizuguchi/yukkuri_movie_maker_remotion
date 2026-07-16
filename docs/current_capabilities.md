# 現在このリポジトリでできること（2026-07-11時点）

## 1. 動画生成ワークフロー（縦串）

- `script_generation` で台本JSON（`script.json`）を生成
- `tts_generation` で音声（`audio.wav`）とタイムスタンプ（`timestamps.json`）を生成
- `subtitle_generation` で字幕（`subtitles.json` / `subtitles.ass`）を生成
- `video_composition` で背景・立ち絵・字幕・音声を合成して `preview.mp4` を生成
- `final_encoding` でYouTube向け設定の `final.mp4` を生成
- `video_composition` は Remotion 正規経路を優先し、ショット割り、字幕強調、章トランジション、BGM/SE/環境音のミックス計画を `composition.json` と各種 plan JSON に記録
- プロジェクト作成時の推定タイムラインは、TTS完了後に実測音声尺・字幕タイムスタンプへ自動同期。手動で移動・リサイズしたクリップと明示的な再生範囲は保持
- GUIの自動化モード（全自動、台本まで、編集済み素材から、カスタムskip）をWorkerペイロードへ反映可能
- 設定画面の出力プリセット（width/height/fps）をRemotion合成、FFmpeg合成、最終エンコード、成果物メタデータへ反映可能
- 台本・素材・タイムライン・設定・依存成果物のfingerprintでキャッシュ有効性を判定し、「ここから再実行」では強制的に再生成可能
- `YOUTUBE_ACCESS_TOKEN` がある場合はYouTube Data APIへ実動画をmultipart upload。未設定時は理由付きSKIPPED

## 2. 音声合成（Task3品質）

- AivisSpeech 実接続で音声生成が可能
- `/speakers` の style 一覧から話者スタイルを動的選択
- モックTTSへの切替も可能（テスト/開発向け）

## 3. 立ち絵・背景の扱い

- プロジェクト配下 `input/assets/...` の素材を優先して利用
- 素材が無い場合はフォールバック画像を生成（設定で立ち絵必須にもできる）

## 4. テストと証跡

- モジュール別品質テスト（script/tts/subtitle/video/final）を実行可能
- AivisSpeech 実接続テストを実行可能
- `script` から `final.mp4` までの通し実接続E2Eテストを実行可能
- 実行証跡は `outputs/test_evidence/...` に保存可能（生成物は `.gitignore` 対象）
- PlaywrightでGUIのカスタマージャーニーE2Eを実行可能
- GUI導線の各チェックポイントをスクリーンショットとAI視覚レビュー用マニフェストとして保存可能
- 良品スクリーンショットとの差分率を自動判定し、差分画像とJSONレポートを生成可能
- 実API/DB/Workerを通すPlaywright E2Eを実行可能（PostgreSQL起動が前提、E2Eプロジェクトは終了時に自動削除）
- 2026-04-26 に preflight、顧客導線E2E、実API/DB/Worker E2E は完走済み。Visual Regression は timeline desktop/mobile と preview mobile の3チェックポイントで差分検知

## 5. GUI/運用系

- 初見ユーザー向けに、企画→台本→素材→編集→確認・出力の5工程で案内するWeb GUI
- ホームから「新しい動画を作る」「続きから編集する」を選べ、各画面に目的説明と次工程へのCTAを表示
- UUID、全成果物、工程単位の再実行、調査ログは通常導線から外し、必要時だけ開く詳細欄に集約
- デスクトップとモバイルで全制作工程を見失わないレスポンシブナビゲーション
- 作成ウィザードで自動化モードを選択し、カスタムではステップ単位のskipを指定可能
- プロジェクト詳細で初回生成/再実行、ステップ単位の「ここから再実行」/skip指定、ジョブ成果物リンク確認が可能
- 素材管理でファイルアップロード、用途割当（背景/立ち絵/BGM/SE/参考素材/その他）、画像サムネイル確認が可能
- タイムライン編集の基本機能（移動・リサイズ・再生範囲）
- 手動編集の仕上げ機能（手動テロップ追加、クリップ複製/削除、マーカー追加、音量/フェード調整）
- 視覚タイムライン編集（プレイヘッド、ズーム、クリップ選択インスペクタ、分割、100msナッジ）
- 最新の完成動画を編集専用映像トラックへ取り込み、分割・移動・トリム・複製・削除・リップル削除（後続を詰める）・内蔵音声の音量調整・トラック表示/ミュート・追加テロップを再出力へ反映可能
- 完成動画編集モードでは焼き込み済みの自動字幕・生成音声・装飾レイヤーを自動的に無効化し、二重表示・二重再生を防止
- プレビュー画面で `preview.mp4` の再生要素、`final.mp4` のダウンロードリンク、手動編集サマリー、出力プリセットを確認可能
- 設定画面でGemini/OpenAI/Claudeのモデル選択、値を再表示しないAPIキー登録・削除・実接続診断、AivisSpeech診断、出力プリセット保存が可能
- テンプレートに素材セット、出力プリセット、自動化プロファイルを含めて再利用可能
- エラー表示/再試行、処理中操作抑止、ジョブ自動ポーリング、Undo/Redo、ドラッグ移動と100msスナップ、未保存表示、動画とプレイヘッド同期
- ジョブ設定snapshot、同一プロジェクト直列化、原子的latest更新、Worker heartbeat、DB/queue/Worker/Aivis/Gemini/OpenAI/Claude health、構造化ログ
- CLIからhealth、ジョブ作成、状態確認、接続診断を実行可能

## 6. 既知の前提・制約

- AivisSpeech を使う場合はローカルサーバー起動と `AIVIS_SPEECH_BASE_URL` が必要
- Gemini API を使う場合は `GOOGLE_API_KEY` が必要（クォータ不足時は失敗）
- OpenAI API を使う場合は `OPENAI_API_KEY`、Claude APIを使う場合は `ANTHROPIC_API_KEY` が必要
- GUIのAPIキー入力値は通常設定・成果物から分離したローカル秘密情報ストアへ保存し、読取APIや画面へ値を返さない
- 認証機構は実装しておらず、APIはローカル単一ユーザー専用。インターネットへ直接公開しない
- PowerShell環境によって削除系コマンドがポリシーでブロックされる場合がある

## 7. GUIの起動方法

1. 依存インストール
   - `corepack enable`
   - `corepack prepare pnpm@9.15.0 --activate`
   - `corepack pnpm install`
2. 環境変数を用意
   - `.env` に最低限 `DATABASE_URL` を設定
   - 音声合成を使う場合は `AIVIS_SPEECH_BASE_URL` も設定
3. DB反映
   - `corepack pnpm db:migrate:deploy`
4. AivisSpeech起動（TTSを使う場合）
   - `& "$env:LOCALAPPDATA\Programs\AivisSpeech\AivisSpeech.exe"`
5. 開発サーバー起動（Web + API + Worker 同時）
   - `corepack pnpm dev`

## 8. GUIの使い方（最短フロー）

1. ブラウザで `http://127.0.0.1:3000` を開く
2. `作成ウィザード` でテーマと自動化モード（全自動/台本まで/編集済み素材から/カスタム）を指定し、プロジェクトを作成
3. `プロジェクト詳細` でジョブを実行し、進捗、ログ、ステップ単位の再実行/skip、成果物リンクを確認
4. 必要に応じて `台本編集` で台本を修正して保存
5. `素材管理` で立ち絵・背景などをアップロード/差し替えし、用途とサムネイルを確認
6. `タイムライン` で通常編集を行う。完成済みMP4をカットし直す場合は `完成動画をカット編集する` で取り込み、プレイヘッド分割後に `削除して詰める`、移動、元動画の開始位置、音量、追加テロップを調整する
7. `プレビュー` で動画再生、出力プリセット、反映結果、手動編集サマリーを確認
8. ジョブ完了後、GUIの `final.mp4` リンクまたは `output/final_encoding/.../final.mp4` を成果物として利用

## 9. 起動時の確認ポイント

- Web GUI: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:3001/health` が `{ "ok": true }` を返す
- Worker: `pnpm dev` のログに致命エラーが出ていないこと
- WebからAPIが呼べない場合は、`apps/web` のViteプロキシ（`/api -> 127.0.0.1:3001`）と API ポート設定（`API_PORT`）の不一致を確認

## 10. カスタマージャーニーE2E

- 初回のみ `corepack pnpm exec playwright install chromium` を実行
- `corepack pnpm test:e2e:journey` でデスクトップ/モバイルの顧客導線を検証
- `corepack pnpm test:e2e:visual:update` で現在のスクリーンショットを良品ベースラインへ反映
- `corepack pnpm test:e2e:visual` で顧客導線E2Eとビジュアル差分判定を実行
- `corepack pnpm test:e2e:report` でHTMLレポートを確認
- 証跡は `outputs/test_evidence/customer_journey/` と `outputs/test_evidence/playwright/` に保存（Git追跡対象外）
- 詳細は `docs/e2e_customer_journey.md` を参照

## 11. 実API/DB/Worker E2E

- `corepack pnpm test:e2e:real:preflight` でDB/ffmpeg/corepack/Dockerの前提を診断
- PostgreSQLをDockerで使う場合は `corepack pnpm db:up`
- スキーマ反映は `corepack pnpm db:migrate:deploy`
- `corepack pnpm test:e2e:real` でWeb/API/Workerを起動し、ブラウザ操作から `final.mp4` 生成まで確認
- このE2EではWorkerを `YMM_TTS_PROVIDER=mock`、`YMM_DISABLE_REMOTION=true` で起動し、外部TTSなしでも成果物生成を通す
- 2026-04-26 にこの端末で preflight と実API E2Eの完走を確認済み
