# クイックスタートガイド

**このシステムを最速で動かすための最短手順です。**

## 前提条件
- Node.js（LTS）がインストール済み（`node` / `npm` が使える状態）
- パッケージマネージャ（推奨: `pnpm`。無ければ `npm` でも可）が利用可能
- FFmpeg がインストール済み（Remotionの出力・素材整形で利用）
- PostgreSQL が利用可能（無料。ローカル単体運用を想定）
- Google Gemini API キーを取得済み
- AIVIS Speech をダウンロード済み（ローカルサーバーとして起動可能）

---

## 5ステップで動画生成

### ステップ 1: プロジェクトの配置
```bash
# Gitでクローンする場合
git clone [repository-url]
cd yukkuri_movie_maker_remotion

# またはZIPをダウンロードして解凍
```

### ステップ 2: 依存関係のインストール
```bash
# 依存関係のインストール（推奨: pnpm）
pnpm install

# pnpm が無い場合（npm）
# npm install
```

### ステップ 3: 環境変数の設定
プロジェクトルートに `.env` ファイルを作成：

```ini
# 最小限の設定
GOOGLE_API_KEY=your_google_gemini_api_key_here
AIVIS_SPEECH_BASE_URL=http://127.0.0.1:10101

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/yukkuri_movie_maker?schema=public

ENVIRONMENT=development
DEBUG=true
```

### ステップ 4: ディレクトリの作成
```bash
# 初回は起動時に自動作成される想定ですが、必要なら作成してください
mkdir -p projects outputs logs assets config
```

### ステップ 5: 実行！
```bash
# まずは Web GUI（優先）で実行
pnpm dev
```

これで動画生成が開始されます！

---

## 次のステップ

動作確認ができたら、以下のドキュメントを読んでカスタマイズしましょう：

1. **[04_Configuration_Guide.md](04_Configuration_Guide.md)** - 詳細な設定方法
2. **[10_Customization_Guide.md](10_Customization_Guide.md)** - カスタマイズ方法
3. **[11_Cost_Estimation.md](11_Cost_Estimation.md)** - コスト最適化

---

## トラブルが起きたら

- **[06_Troubleshooting.md](06_Troubleshooting.md)** を確認
- **[13_FAQ.md](13_FAQ.md)** でよくある質問を確認
