# yukkuri_movie_maker_remotion

テーマ決定、台本、音声、字幕、素材生成、Remotion合成、最終エンコード、任意のYouTube投稿までを扱う、ローカル単一ユーザー向けのゆっくり動画制作ツールです。自動化範囲を選び、途中から手動編集や再生成へ切り替えられます。

## 目的（入口の優先順位）

- **Web GUI（ローカル）**: 優先
- **CLI（ローカル）**
- **API（外部連携）**

## 必要なもの（Windows想定）

- **Node.js LTS**（インストールすると `node`/`npm` が使えるようになります）
- **PostgreSQL**（無料）
- **FFmpeg**
- **AivisSpeech**（音声合成エンジン。ローカルで起動しておく必要があります）
- （任意）**pnpm**（推奨。Nodeに同梱の `corepack` で有効化できます）

## セットアップ（最短）

1. Node.js をインストールし、PowerShellで確認:

```powershell
node -v
npm -v
```

2. 依存関係インストール（pnpm）:

```powershell
# pnpm を使う場合（推奨）
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm -v
pnpm install

```

3. `.env` を作成（`env.example` をコピーして作成してください）

4. DBスキーマ反映（新規DBはmigrationを適用）

```powershell
pnpm db:migrate:deploy
```

旧版の `db:push` で作成済みのDBを引き継ぐ場合は、先にバックアップを取り、現在のschemaへ更新したうえで初期migrationを適用済みとして登録します。新規DBではこの操作は不要です。

```powershell
pnpm db:push
corepack pnpm exec prisma migrate resolve --applied 20260711093000_init
```

5. AivisSpeech を起動（音声合成に必要）

```powershell
# ユーザーごとの標準インストールパス
& "$env:LOCALAPPDATA\Programs\AivisSpeech\AivisSpeech.exe"
```

> **Note**: AivisSpeech が起動すると `http://127.0.0.1:10101` でAPIサーバーが立ち上がります。`.env` の `AIVIS_SPEECH_BASE_URL` がこのURLを指している必要があります。

6. 開発起動（Web GUI + API + Worker）

```powershell
pnpm dev
```

Windowsでは `start_yukkuri_movie_maker.bat` をダブルクリックすると、DB起動、migration適用、AivisSpeech待機、Web/API/Worker起動、ブラウザ表示までをまとめて実行できます。デスクトップから使う場合は、このBATファイルのショートカットを作成してください。PowerShellから細かな起動オプションを指定する場合は `./start_yukkuri_movie_maker.ps1` も利用できます。

テーマ入力から完成動画の確認までの画面操作は、[スクリーンショット付き全自動操作手順](docs/user_guide/full_auto_operation_guide.html)を参照してください。

## 環境変数と設定テンプレート

### 必須の環境変数

- `DATABASE_URL`: PostgreSQL接続文字列

### 任意の環境変数

- `API_PORT`: APIサーバーのポート（省略時 3001）
- `ENVIRONMENT`: `development` / `production`
- `DEBUG`: `true` / `false`
- `GOOGLE_API_KEY`: Geminiの台本・画像生成を使う場合
- `OPENAI_API_KEY`: OpenAIの台本・画像生成を使う場合
- `ANTHROPIC_API_KEY`: Claudeの台本生成を使う場合
- `AIVIS_SPEECH_BASE_URL`: AIVIS SpeechサーバーURL
- `STABILITY_API_KEY`: 画像生成APIキー（任意）
- `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` / `YOUTUBE_REFRESH_TOKEN`: YouTube投稿・分析の長期運用向けOAuth情報
- `YOUTUBE_ACCESS_TOKEN`: 後方互換用の短期OAuthアクセストークン
- `YOUTUBE_PRIVACY_STATUS`: `private` / `unlisted` / `public`（既定 `private`）
- `YOUTUBE_PUBLISH_AT`: 予約公開するISO 8601日時。指定時はYouTube仕様によりprivateでアップロード
- `YMM_YOUTUBE_MOCK_ON_MISSING`: YouTube認証・クォータ制約時に理由付きモックで後続を継続（既定true）
- `YMM_AUTOMATION_POLL_INTERVAL_MS`: Workerが自動運用設定を確認する間隔（既定60000ms）

### YAML設定テンプレート

`config/` 配下にYAMLテンプレートを用意しています。用途は `config/README.md` を参照してください。

## 構成

- `apps/web`: Web GUI（Vite + React）
- `apps/api`: API（Fastify）
- `apps/worker`: ジョブ実行（pg-boss + Prisma）
- `apps/cli`: CLI（health、run、job、config:test）
- `packages/shared`: 共有型/スキーマ
- `packages/core`: fingerprintキャッシュと再試行を含むワークフロー中核
- `packages/remotion`: Remotionコンポジション
- `prisma/schema.prisma`: DBスキーマ

## CLI

API起動後に次のコマンドを利用できます。接続先は `YMM_API_URL`（既定 `http://127.0.0.1:3001`）で変更できます。

```powershell
pnpm cli health
pnpm cli run --theme "解説したいテーマ" --mode full
pnpm cli job <jobId>
pnpm cli config:test
pnpm cli automation status
pnpm cli automation collect
pnpm cli automation themes
pnpm cli automation run
pnpm cli automation config --enabled true --interval-hours 168 --topic-seed "AI技術"
```

YouTubeの投稿台帳、24/72/168時間後の指標収集、動画評価、テーマ改善、定期実行、安全策の詳細は [閉ループ自動運用](docs/closed_loop_automation.md) を参照してください。自動運用は安全のため初期状態では停止しています。

## 品質ゲート

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e:journey
pnpm test:real  # Gemini/AivisSpeech等を実際に呼ぶため、キー・起動状態・クォータが必要
```

通常テストと実外部接続テストは分離しています。アップロードはstreaming multipart、動画配信はHTTP Rangeに対応し、プロジェクト設定と入力revisionはJob作成時にsnapshot保存されます。

Job投入時の台本・素材・タイムラインは `projects/<projectId>/jobs/<jobId>/snapshot/` に固定し、Workerはハッシュ検証後にジョブ専用の `work/` で生成します。投入後の保存は次回のJobへ反映され、生成完了時も新しい編集内容を上書きしません。旧形式のJobは初回実行時に入力を固定します。保存先の起点は `YMM_WORKFLOW_OUTPUT_ROOT`（未指定時は既定outputRoot）です。

全体レビュー7件の修正と実API・実動画検証の記録は [修正報告](docs/review_fixes_20260918.md) を参照してください。

開発タスクの最終確認では、モックだけで終えず完成動画を最低1本生成します。詳しい完了条件は [docs/testing_policy.md](docs/testing_policy.md) を参照してください。

詳しい説明は `reproduction_kit/` を参照してください。
