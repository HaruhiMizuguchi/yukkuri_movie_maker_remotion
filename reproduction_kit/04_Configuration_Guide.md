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

# APIサーバーのポート（省略時: 3001）
API_PORT=3001

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

# YouTube投稿を使う場合のみ
YOUTUBE_ACCESS_TOKEN=your_youtube_oauth_access_token_here
YOUTUBE_PRIVACY_STATUS=private
```

**注意**: `.env` ファイルはパスワードのようなものです。**絶対に他人と共有したり、GitHub等の公開リポジトリにアップロードしたりしないでください。**

## 2. アプリケーション設定ファイル (config/\*.yaml)

`config` フォルダ内には、将来の設定統合に向けたYAMLテンプレートがあります。現在のWeb/API/Worker実行経路が直接読む設定は、環境変数とプロジェクト単位の `settingsJson`（GUIから保存）です。YAMLだけを編集しても実行結果へ反映されない項目がある点に注意してください。

> 補足: 設定は「環境変数（秘密情報）+ YAML（挙動）」の2層を推奨します。将来的にWeb GUI上で編集できるようにする場合でも、YAML/JSONにシリアライズ可能な形を維持します。

### 主な設定ファイル

- **`config/llm_config.yaml`**:
  - 使用するLLMモデル（Gemini, GPT-4など）やプロンプトの設定。
  - デフォルトでは `gemini-3.5-flash` が設定されています。

- **`config/image_generation_config.yaml`**:
  - 画像生成に使用するモデルやサイズの設定。
  - 開発時はコストを抑えるため、枚数制限などが設定されている場合があります。

- **`config/development_config.yaml`**:
  - 開発モード時の挙動設定。
  - APIのモック（偽装）を使用するかどうかなどを制御できます。

## 3. 設定の確認

設定が正しく行われているか確認するために、以下のコマンドを実行してみましょう。

```bash
# API/DB/Worker readiness
pnpm cli health

# Gemini/AivisSpeech設定診断
pnpm cli config:test
```

JSONで各componentの状態が返り、コマンドが終了コード0なら接続確認は完了です。
