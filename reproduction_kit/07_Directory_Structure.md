# 07. ディレクトリ構造 (Directory Structure)

このプロジェクトのファイル構成とその役割について説明します。

```
（想定）yukkuri_movie_maker_remotion/
├── .env                      # 環境変数ファイル (APIキーなど)
├── package.json              # Node/TSプロジェクト定義
├── pnpm-workspace.yaml       # モノレポ（workspaces）定義（想定）
│
├── config/                   # 設定ファイル群
│   ├── llm_config.yaml       # LLMの設定
│   ├── voice_config.yaml     # 音声合成の設定
│   └── ...
│
├── apps/
│   ├── web/                  # Web GUI（ローカル起動を優先。将来は別マシン配置も可能）
│   ├── api/                  # HTTP API（ジョブ投入/進捗/成果物）
│   └── worker/               # バックグラウンド実行（AI呼び出し/FFmpeg/Remotionレンダリング）
│
├── packages/
│   ├── core/                 # ワークフロー中核（ステップ管理/再開/成果物管理）
│   ├── remotion/             # Remotionプロジェクト（コンポジション、字幕、テンプレ）
│   └── shared/               # 型定義/ユーティリティ（Script/Timeline/Subtitle等）
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
└── reproduction_kit/         # この再現キットドキュメント
```

## 重要なフォルダ

- **apps/web/**: GUI（優先入口）。設定編集・実行・進捗・成果物確認を提供します。
- **apps/worker/**: 実処理の実行体。AI呼び出し・FFmpeg・Remotionレンダリングを担当します。
- **packages/remotion/**: 動画の「見た目とタイムライン」を実装する中心です。
- **config/**: コードを書き換えずに挙動を変更したい場合はここを編集します。
- **projects/**: 生成途中のデータは全てここに保存されます。デバッグ時に中身を確認すると役立ちます。
