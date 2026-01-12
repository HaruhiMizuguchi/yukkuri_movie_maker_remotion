# 02. 事前準備 (Prerequisites)

このシステムを動作させるために必要なハードウェア、ソフトウェア、およびAPIキーについて説明します。

## 1. ハードウェア要件

- **OS**: Windows 10/11, macOS, または Linux (Ubuntu推奨)
- **CPU**: 一般的なPCスペックで動作可能（動画エンコードを行うため、Core i5/Ryzen 5以上推奨）
- **メモリ**: 8GB以上推奨
- **ストレージ**: 動画ファイルや素材を保存するため、数GB〜数十GBの空き容量

## 2. ソフトウェア要件

以下のソフトウェアを事前にインストールしてください。

### Python
- **バージョン**: Python 3.8 以上 (3.11 推奨)
- **ダウンロード**: [Python公式サイト](https://www.python.org/downloads/)
- **確認方法**: ターミナル(コマンドプロンプト)で `python --version` を実行

### FFmpeg (必須)
動画の合成や変換に使用する非常に重要なツールです。必ずインストールし、パスを通してください。

- **Windows**:
  1. [FFmpeg公式サイト](https://ffmpeg.org/download.html) からビルド済みバイナリをダウンロード (gyan.dev などから)
  2. 解凍したフォルダ内の `bin` フォルダへのパスを、Windowsの環境変数 `Path` に追加する。
  3. ターミナルで `ffmpeg -version` を実行して表示されればOK。

- **macOS**:
  ```bash
  brew install ffmpeg
  ```

- **Linux (Ubuntu)**:
  ```bash
  sudo apt update
  sudo apt install ffmpeg
  ```

## 3. 必要なAPIキー

このツールは外部のAIサービスを利用するため、各サービスのAPIキーが必要です。
開発段階では、コストパフォーマンスの良い **Google Gemini API** の利用を強く推奨します。

### 必須のAPIキー

1. **Google Gemini API Key** (LLM & 画像生成用)
   - **取得先**: [Google AI Studio](https://aistudio.google.com/)
   - **用途**: 台本作成、プロンプト作成、画像生成
   - **特徴**: 無料枠があり、開発に最適です。

2. **AIVIS Speech** (音声合成用)
   - **取得先**: [AIVIS Speech](https://aivis.co.jp/) からソフトウェアをダウンロード
   - **用途**: ゆっくりボイスの生成
   - **注意**: ローカルサーバーとして動作します（無料）。動画生成前にサーバーを起動する必要があります。代替としてAzure Speech Servicesなども設定可能です。

### オプションのAPIキー (本番運用時など)

- **OpenAI API Key**: GPT-4やDALL-E 3を使用する場合
- **Stable Diffusion API Key**: 画像生成にStable Diffusionを使用する場合
- **YouTube Data API Key**: 動画の自動投稿を行う場合

## 4. 準備完了チェックリスト

- [ ] Python 3.8+ がインストールされている
- [ ] FFmpeg がインストールされ、コマンドラインから実行できる
- [ ] Google Gemini API キーを取得した
- [ ] AIVIS Speech をダウンロードし、ローカルサーバーとして起動できることを確認した (または代替手段を用意した)
