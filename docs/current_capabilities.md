# 現在このリポジトリでできること（2026-06-15時点）

## 1. 動画生成ワークフロー（縦串）
- `script_generation` で台本JSON（`script.json`）を生成
- `tts_generation` で音声（`audio.wav`）とタイムスタンプ（`timestamps.json`）を生成
- `subtitle_generation` で字幕（`subtitles.json` / `subtitles.ass`）を生成
- `video_composition` で背景・立ち絵・字幕・音声を合成して `preview.mp4` を生成
- `final_encoding` でYouTube向け設定の `final.mp4` を生成
- `video_composition` は Remotion 正規経路を優先し、ショット割り、字幕強調、章トランジション、BGM/SE/環境音のミックス計画を `composition.json` と各種 plan JSON に記録

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
- 実API/DB/Workerを通すPlaywright E2Eを実行可能（PostgreSQL起動が前提）
- 2026-04-26 に preflight、顧客導線E2E、実API/DB/Worker E2E は完走済み。Visual Regression は timeline desktop/mobile と preview mobile の3チェックポイントで差分検知

## 5. GUI/運用系
- Web GUI 初期版（ダッシュボード、プロジェクト作成、詳細、台本編集、素材管理、タイムライン、プレビュー、設定）
- タイムライン編集の基本機能（移動・リサイズ・再生範囲）
- 手動編集の仕上げ機能（手動テロップ追加、クリップ複製/削除、マーカー追加、音量/フェード調整）
- 視覚タイムライン編集（プレイヘッド、ズーム、クリップ選択インスペクタ、分割、100msナッジ）
- 手動編集サマリーをプレビュー画面と `composition.json` に表示し、トリム適用有無を観測可能
- リトライ方針、キャッシュ再利用、監視ログの基盤

## 6. 既知の前提・制約
- AivisSpeech を使う場合はローカルサーバー起動と `AIVIS_SPEECH_BASE_URL` が必要
- Gemini API を使う場合は `GOOGLE_API_KEY` が必要（クォータ不足時は失敗）
- GUIのAPIキー入力値はローカル設定ファイルへ保存しない。実API接続は `.env` の環境変数を使う
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
   - `corepack pnpm db:push`
4. AivisSpeech起動（TTSを使う場合）
   - `& "C:\Users\1120h\AppData\Local\Programs\AivisSpeech\AivisSpeech.exe"`
5. 開発サーバー起動（Web + API + Worker 同時）
   - `corepack pnpm dev`

## 8. GUIの使い方（最短フロー）
1. ブラウザで `http://127.0.0.1:3000` を開く
2. `作成ウィザード` でテーマとモード（`full` 推奨）を指定し、プロジェクトを作成
3. `プロジェクト詳細` でジョブを実行し、進捗とログを確認
4. 必要に応じて `台本編集` で台本を修正して保存
5. `素材管理` で立ち絵・背景などをアップロード/差し替え
6. `タイムライン` で再生範囲やクリップ位置・長さ、手動テロップ、マーカー、音量/フェードを調整し、必要ならプレイヘッド位置で分割
7. `プレビュー` で反映結果と手動編集サマリーを確認
8. ジョブ完了後、`output/final_encoding/.../final.mp4` を成果物として利用

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
- スキーマ反映は `corepack pnpm db:push`
- `corepack pnpm test:e2e:real` でWeb/API/Workerを起動し、ブラウザ操作から `final.mp4` 生成まで確認
- このE2EではWorkerを `YMM_TTS_PROVIDER=mock`、`YMM_DISABLE_REMOTION=true` で起動し、外部TTSなしでも成果物生成を通す
- 2026-04-26 にこの端末で preflight と実API E2Eの完走を確認済み
