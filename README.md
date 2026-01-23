# yukkuri_movie_maker_remotion（TS + Remotion 雛形）

このリポジトリは「ゆっくり動画自動生成ツール」を **TypeScript単独**で再実装していくための雛形です。

## 目的（入口の優先順位）
- **Web GUI（ローカル）**: 優先
- **CLI（ローカル）**
- **API（外部連携）**

## 必要なもの（Windows想定）
- **Node.js LTS**（インストールすると `node`/`npm` が使えるようになります）
- **PostgreSQL**（無料）
- **FFmpeg**
- （任意）**pnpm**（推奨。Nodeに同梱の `corepack` で有効化できます）

## セットアップ（最短）
1) Node.js をインストールし、PowerShellで確認:

```powershell
node -v
npm -v
```

2) 依存関係インストール（pnpm推奨。無ければ npm でもOK）:

```powershell
# pnpm を使う場合（推奨）
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm -v
pnpm install

# npm を使う場合
# npm install
```

3) `.env` を作成（`env.example` をコピーして作成してください）

4) DBスキーマ反映（Prisma）

```powershell
pnpm db:push
```

5) 開発起動（Web GUI + API + Worker）

```powershell
pnpm dev
```

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

### YAML設定テンプレート
`config/` 配下にYAMLテンプレートを用意しています。用途は `config/README.md` を参照してください。

## 構成
- `apps/web`: Web GUI（Vite + React）
- `apps/api`: API（Fastify）
- `apps/worker`: ジョブ実行（pg-boss + Prisma）
- `apps/cli`: CLI（現時点は雛形）
- `packages/shared`: 共有型/スキーマ
- `packages/core`: ワークフロー中核（雛形）
- `packages/remotion`: Remotionコンポジション（雛形）
- `prisma/schema.prisma`: DBスキーマ

詳しい説明は `reproduction_kit/` を参照してください。

