# 03. インストールガイド

システムをあなたのPCにインストールする手順です。

## 手順 1: プロジェクトの配置

まず、このプロジェクトのファイルを任意のフォルダに配置します。
Gitを使用している場合はクローンし、そうでない場合はZIPファイルをダウンロードして解凍してください。

```bash
# Gitを使用する場合の例（URLは適宜置き換えてください）
git clone [repository-url]
cd yukkuri_movie_maker_remotion
```

## 手順 2: 依存関係のインストール

このプロジェクトはTypeScript（Node.js）で実装する前提です。パッケージマネージャは `pnpm` を推奨します（`npm` でも可）。

```bash
pnpm install
```

> 補足: 将来的にWeb/Worker/共有パッケージを分けるため、モノレポ運用（workspaces）を想定します。

## 手順 3: PostgreSQL の準備（ローカル）

DBは無料で、後々別マシンへ分離しやすい **PostgreSQL** を標準とします。

- PostgreSQLをインストールし、ローカルで起動できるようにしてください。
- DB名は任意ですが、例として `yukkuri_movie_maker` を使います。

## 手順 4: 環境変数（.env）の作成

プロジェクトルートに `.env` を作成し、最低限以下を設定します（値は環境に合わせて変更）。

```ini
GOOGLE_API_KEY=your_google_gemini_api_key_here
AIVIS_SPEECH_BASE_URL=http://127.0.0.1:10101
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/yukkuri_movie_maker?schema=public
ENVIRONMENT=development
DEBUG=true
```

## 手順 5: ディレクトリ構造の初期化（必要に応じて）

基本的には起動時に自動作成される想定ですが、必要なら作成してください。

```powershell
mkdir projects,outputs,logs,assets,config -ErrorAction SilentlyContinue
```

これでインストールの基本作業は完了です。次は設定ファイルの作成に進みます。
