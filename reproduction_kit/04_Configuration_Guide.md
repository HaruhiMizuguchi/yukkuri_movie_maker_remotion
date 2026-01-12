# 04. 設定ガイド (Configuration)

インストールが完了したら、システムがAPIを利用できるように設定ファイルを作成します。

## 1. 環境変数ファイル (.env) の作成

プロジェクトのルートディレクトリ（`yukkuri_movie_maker_remotion`フォルダの直下）に、`.env` という名前のファイルを作成します。
このファイルにはAPIキーなどの機密情報を記述します。

> 本ドキュメントは TypeScript（Node.js）版を前提にしています。`.env` は Web GUI / API / Worker / CLI で共通利用します。

`env.example` というファイルが同梱されている場合は、それをコピーして `.env` にリネームしても構いません。

### .env ファイルの記述例

以下をコピーして、`.env` ファイルに貼り付け、`your_...` の部分を取得した実際のキーに書き換えてください。

```ini
# ===========================================
# 基本設定
# ===========================================
# 動作環境 (development または production)
ENVIRONMENT=development
# デバッグモード (true または false)
DEBUG=true

# ===========================================
# Google Gemini API (推奨・必須)
# ===========================================
# AI Studio等で取得したAPIキー
GOOGLE_API_KEY=your_google_gemini_api_key_here

# ===========================================
# AIVIS Speech (音声合成用・ローカルサーバー)
# ===========================================
# AIVIS Speechのローカルサーバーアドレス（デフォルト: http://127.0.0.1:10101）
AIVIS_SPEECH_BASE_URL=http://127.0.0.1:10101

# ===========================================
# Database (推奨: PostgreSQL)
# ===========================================
# 例: postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/yukkuri_movie_maker?schema=public

# ===========================================
# その他のAPI (オプション)
# ===========================================
# OpenAIを使用する場合
OPENAI_API_KEY=your_openai_api_key_here

# Stable Diffusionを使用する場合
STABILITY_API_KEY=your_stability_api_key_here
```

**注意**: `.env` ファイルはパスワードのようなものです。**絶対に他人と共有したり、GitHub等の公開リポジトリにアップロードしたりしないでください。**

## 2. アプリケーション設定ファイル (config/*.yaml)

`config` フォルダ内には、アプリケーションの挙動を制御するYAMLファイルがあります。
初期状態ではデフォルト設定が使われますが、必要に応じて変更できます。

> 補足: 設定は「環境変数（秘密情報）+ YAML（挙動）」の2層を推奨します。将来的にWeb GUI上で編集できるようにする場合でも、YAML/JSONにシリアライズ可能な形を維持します。

### 主な設定ファイル

- **`config/llm_config.yaml`**: 
  - 使用するLLMモデル（Gemini, GPT-4など）やプロンプトの設定。
  - デフォルトでは `gemini-2.0-flash-preview-image-generation` などが設定されています。

- **`config/image_generation_config.yaml`**:
  - 画像生成に使用するモデルやサイズの設定。
  - 開発時はコストを抑えるため、枚数制限などが設定されている場合があります。

- **`config/development_config.yaml`**:
  - 開発モード時の挙動設定。
  - APIのモック（偽装）を使用するかどうかなどを制御できます。

## 3. 設定の確認

設定が正しく行われているか確認するために、以下のコマンドを実行してみましょう。

```bash
# CLI（現時点は雛形）
pnpm cli
```

エラーが表示されなければ、設定は完了です。
