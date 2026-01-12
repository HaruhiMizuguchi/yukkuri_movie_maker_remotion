# 07. ディレクトリ構造 (Directory Structure)

このプロジェクトのファイル構成とその役割について説明します。

```
auto_yukkuri_movie_maker/
├── .env                      # 環境変数ファイル (APIキーなど)
├── requirements.txt          # 必要なPythonライブラリ一覧
├── main.py                   # 実行のエントリーポイント
│
├── config/                   # 設定ファイル群
│   ├── llm_config.yaml       # LLMの設定
│   ├── voice_config.yaml     # 音声合成の設定
│   └── ...
│
├── src/                      # ソースコード
│   ├── core/                 # システムの中核機能 (ワークフロー管理など)
│   ├── modules/              # 各工程の処理モジュール
│   │   ├── theme_selector.py     # テーマ選定
│   │   ├── script_generator.py   # 台本生成
│   │   ├── tts_processor.py      # 音声合成
│   │   ├── video_composer.py     # 動画合成
│   │   └── ...
│   ├── api/                  # 外部APIとの通信クライアント
│   └── utils/                # 便利機能 (ログ、ファイル操作など)
│
├── assets/                   # 素材ファイル置き場
│   ├── characters/           # 立ち絵素材 (霊夢、魔理沙など)
│   ├── audio/                # BGM、効果音
│   └── fonts/                # 字幕用フォント
│
├── projects/                 # 生成されたプロジェクトデータ
│   └── [Project_ID]/         # 各プロジェクトごとのフォルダ
│       ├── script.json       # 台本データ
│       ├── audio/            # 生成された音声
│       ├── images/           # 生成された画像
│       └── video/            # 中間動画ファイル
│
├── outputs/                  # 最終的な成果物 (完成動画)
│
├── logs/                     # 実行ログファイル
│
├── docs/                     # 開発者向けドキュメント
│
└── reproduction_kit/         # この再現キットドキュメント
```

## 重要なフォルダ

- **src/modules/**: 動画生成のロジックはここに集約されています。挙動をカスタマイズしたい場合はここを編集します。
- **config/**: コードを書き換えずに設定を変更したい場合はここを編集します。
- **projects/**: 生成途中のデータは全てここに保存されます。デバッグ時に中身を確認すると役立ちます。
