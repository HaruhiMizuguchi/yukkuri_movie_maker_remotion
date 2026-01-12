# 09. API取得ガイド

このシステムで使用する主要なAPIキーの取得方法を詳しく説明します。

## 1. Google Gemini API (推奨・最優先)

**用途**: LLM（台本生成、テーマ選定）、画像生成  
**コスト**: 無料枠あり、開発に最適  
**推奨モデル**: `gemini-2.0-flash-preview-image-generation`

### 取得手順

1. **Google AI Studioにアクセス**
   - [https://aistudio.google.com/](https://aistudio.google.com/) にアクセスします。

2. **Googleアカウントでログイン**
   - お持ちのGoogleアカウントでログインします。

3. **APIキーを作成**
   - 左メニューから「Get API key」をクリック
   - 「Create API key」ボタンをクリック
   - 既存のGoogle Cloud Projectを選択するか、新規作成します。

4. **APIキーをコピー**
   - 生成されたAPIキーをコピーして、`.env` ファイルの `GOOGLE_API_KEY` に設定します。

### 料金について
- 無料枠が非常に充実しており、開発段階では無料で使用できます。
- 詳細: [Google AI Pricing](https://ai.google.dev/pricing)

---

## 2. AIVIS Speech (音声合成用)

**用途**: ゆっくりボイスの音声合成  
**コスト**: **無料（ローカルサーバー）**

### セットアップ手順

1. **AIVIS Speechをダウンロード**
   - [AIVIS Speech公式サイト](https://aivis.co.jp/) からソフトウェアをダウンロードします。

2. **ローカルサーバーを起動**
   - AIVIS Speechアプリケーションを起動し、ローカルサーバーモードで実行します。
   - デフォルトでは `http://127.0.0.1:10101` でサーバーが起動します。

3. **サーバーの動作確認**
   - ブラウザで `http://127.0.0.1:10101/speakers` にアクセスし、利用可能なスピーカー一覧が表示されることを確認します。

4. **`.env` に設定**
   ```
   # AIVIS Speechのローカルサーバーアドレス
   AIVIS_SPEECH_BASE_URL=http://127.0.0.1:10101
   ```

### 重要な注意事項
- **APIキーは不要**: ローカルサーバーとして動作するため、APIキーやユーザーIDは必要ありません。
- **サーバーの起動**: 動画生成を実行する前に、必ずAIVIS Speechサーバーを起動しておいてください。
- **無料で利用可能**: ローカルで動作するため、従量課金などの費用は発生しません。

---

## 3. OpenAI API (オプション)

**用途**: GPT-4によるLLM処理、DALL-E 3による画像生成  
**コスト**: 従量課金（Geminiより高額）

### 取得手順

1. **OpenAI Platformにアクセス**
   - [https://platform.openai.com/](https://platform.openai.com/) にアクセスします。

2. **アカウント作成・ログイン**
   - 新規アカウントを作成するか、既存アカウントでログインします。

3. **APIキーを生成**
   - 「API keys」セクションに移動
   - 「Create new secret key」をクリック
   - 生成されたキーをコピー（一度しか表示されないので注意！）

4. **`.env` に設定**
   ```
   OPENAI_API_KEY=sk-...
   ```

### 料金について
- GPT-4: 入力$0.03/1K tokens、出力$0.06/1K tokens
- DALL-E 3: $0.040/画像（1024x1024）
- 詳細: [OpenAI Pricing](https://openai.com/pricing)

---

## 4. Stable Diffusion API (オプション)

**用途**: 背景画像生成  
**コスト**: 従量課金

### 取得手順

1. **DreamStudioにアクセス**
   - [https://dreamstudio.ai/](https://dreamstudio.ai/) にアクセスします。

2. **アカウント作成**
   - 「Sign Up」からアカウントを作成します。

3. **APIキーを取得**
   - アカウント設定からAPIキーを生成します。

4. **`.env` に設定**
   ```
   STABILITY_API_KEY=sk-...
   ```

---

## 5. YouTube Data API (オプション・実装予定)

**用途**: 動画の自動アップロード  
**コスト**: 無料（1日10,000リクエストまで）

### 取得手順

1. **Google Cloud Consoleにアクセス**
   - [https://console.cloud.google.com/](https://console.cloud.google.com/) にアクセスします。

2. **新しいプロジェクトを作成**
   - 「プロジェクトを作成」から新規プロジェクトを作成します。

3. **YouTube Data API v3を有効化**
   - 「APIとサービス」→「ライブラリ」
   - 「YouTube Data API v3」を検索して有効化

4. **OAuth 2.0認証情報を作成**
   - 「APIとサービス」→「認証情報」
   - 「認証情報を作成」→「OAuth クライアント ID」
   - アプリケーションの種類を選択（デスクトップアプリ推奨）

5. **クライアントIDとシークレットをダウンロード**
   - JSON形式でダウンロードし、プロジェクトフォルダに配置します。

---

## APIキーの安全な管理

### 重要な注意事項

1. **絶対に公開しない**
   - `.env` ファイルはGitにコミットしないでください。
   - `.gitignore` に `.env` が含まれていることを確認してください。

2. **定期的にローテーション**
   - 定期的にAPIキーを再生成し、古いキーを無効化してください。

3. **使用量を監視**
   - 各APIプロバイダーのダッシュボードで使用量を定期的に確認してください。

4. **環境変数として管理**
   - 本番環境では、`.env` ファイルではなく、環境変数として設定してください。
