# 設定テンプレート一覧

`config/` 配下には、挙動をYAMLで調整するためのテンプレートを配置しています。
環境変数は秘密情報、YAMLは挙動設定という役割分担を想定しています。

## テンプレート

- `llm_config.yaml`: LLMプロバイダー/モデル/プロンプト設定
- `voice_config.yaml`: キャラクターごとの音声合成設定
- `image_generation_config.yaml`: 画像生成のプロバイダー/画質/枚数制限
- `development_config.yaml`: 開発時のモックや制限
- `character_config.yaml`: キャラクター定義（立ち絵の配置等）
- `audio_config.yaml`: BGMや効果音のパス/音量
- `subtitle_config.yaml`: 字幕スタイル
- `encoding_config.yaml`: エンコード品質

> 注意: これらの設定は将来的に `packages/core` から読み込む想定の雛形です。
