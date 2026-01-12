# はじめにお読みください - ゆっくり動画自動生成ツール 再現キット

このフォルダ（`reproduction_kit`）は、**「どんな人でも同じシステムを再現できるように」** 作成されたドキュメント群です。
このプロジェクトのソースコードや設定を使って、ご自身の環境で「ゆっくり動画自動生成ツール」を構築・実行するための手順をまとめています。

## ドキュメント構成

以下の順序でドキュメントを読み進めてください。

1. **[01_System_Overview.md](01_System_Overview.md)**
   - システムの全体像、何ができるのか、どのような技術が使われているかを解説します。

2. **[02_Prerequisites.md](02_Prerequisites.md)**
   - システムを動かすために必要な事前準備（PC環境、ソフトウェア、APIキーなど）について説明します。

3. **[03_Installation_Guide.md](03_Installation_Guide.md)**
   - ソフトウェアのインストール手順、プロジェクトのセットアップ方法をステップバイステップで解説します。

4. **[04_Configuration_Guide.md](04_Configuration_Guide.md)**
   - 必要な設定ファイル（`.env` や `config/*.yaml`）の作成と設定方法について詳しく説明します。

5. **[05_Usage_Guide.md](05_Usage_Guide.md)**
   - 実際にツールを実行して動画を生成する方法を説明します。

6. **[06_Troubleshooting.md](06_Troubleshooting.md)**
   - よくあるエラーとその対処法をまとめています。困ったときはこちらをご覧ください。

7. **[07_Directory_Structure.md](07_Directory_Structure.md)**
   - プロジェクト内のファイルやフォルダがどのような役割を持っているかを解説します。

---

## クイックスタート（慣れている方向け）

すでに環境が整っている開発者の方は、以下の手順で素早く開始できます。

1. リポジトリをクローンまたはダウンロード
2. Python 3.11+ と FFmpeg をインストール
3. 依存関係をインストール: `pip install -r requirements.txt`
4. `.env` を作成し API キーを設定（`env_template.txt` 参照）
5. 実行: `python src/main.py --dev-mode`
