# クイックスタートガイド

**このシステムを最速で動かすための最短手順です。**

## 前提条件
- Python 3.8+ がインストール済み
- FFmpeg がインストール済み
- Google Gemini API キーを取得済み
- AIVIS Speech をダウンロード済み（ローカルサーバーとして起動可能）

---

## 5ステップで動画生成

### ステップ 1: プロジェクトの配置
```bash
# Gitでクローンする場合
git clone [repository-url]
cd auto_yukkuri_movie_maker

# またはZIPをダウンロードして解凍
```

### ステップ 2: 依存関係のインストール
```bash
# 仮想環境の作成（推奨）
python -m venv venv

# 仮想環境の有効化
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 依存関係のインストール
pip install -r requirements.txt
```

### ステップ 3: 環境変数の設定
プロジェクトルートに `.env` ファイルを作成：

```ini
# 最小限の設定
GOOGLE_API_KEY=your_google_gemini_api_key_here
AIVIS_SPEECH_BASE_URL=http://127.0.0.1:10101

ENVIRONMENT=development
DEBUG=true
```

### ステップ 4: ディレクトリの作成
```bash
# Windows (PowerShell):
mkdir -p temp,projects,assets,config

# Mac/Linux:
mkdir -p {temp,projects,assets,config}
```

### ステップ 5: 実行！
```bash
python src/main.py --dev-mode
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
