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

Windowsでは `./start_yukkuri_movie_maker.ps1` を使うと、DB起動、migration適用、AivisSpeech待機、Web/API/Worker起動、ブラウザ表示までをまとめて実行できます。

## 環境変数と設定テンプレート

### 必須の環境変数

- `DATABASE_URL`: PostgreSQL接続文字列

### 任意の環境変数

- `API_PORT`: APIサーバーのポート（省略時 3001）
- `ENVIRONMENT`: `development` / `production`
- `DEBUG`: `true` / `false`
- `GOOGLE_API_KEY`: Gemini APIキー（LLM利用時）
- `AIVIS_SPEECH_BASE_URL`: AIVIS SpeechサーバーURL
- `OPENAI_API_KEY`: OpenAI APIキー（任意）
- `STABILITY_API_KEY`: 画像生成APIキー（任意）
- `YOUTUBE_ACCESS_TOKEN`: YouTube Data API OAuthアクセストークン（投稿時のみ）
- `YOUTUBE_PRIVACY_STATUS`: `private` / `unlisted` / `public`（既定 `private`）

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
```

## 品質ゲート

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e:journey
pnpm test:real  # Gemini/AivisSpeech等を実際に呼ぶため、キー・起動状態・クォータが必要
```

通常テストと実外部接続テストは分離しています。アップロードはstreaming multipart、動画配信はHTTP Rangeに対応し、プロジェクト設定と入力revisionはJob作成時にsnapshot保存されます。

詳しい説明は `reproduction_kit/` を参照してください。
