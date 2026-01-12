# 03. インストールガイド

システムをあなたのPCにインストールする手順です。

## 手順 1: プロジェクトの配置

まず、このプロジェクトのファイルを任意のフォルダに配置します。
Gitを使用している場合はクローンし、そうでない場合はZIPファイルをダウンロードして解凍してください。

```bash
# Gitを使用する場合の例
git clone https://github.com/your-repo/auto_yukkuri_movie_maker.git
cd auto_yukkuri_movie_maker
```

## 手順 2: 仮想環境の作成 (推奨)

Pythonのライブラリが他のプロジェクトと競合しないように、仮想環境を作成することをお勧めします。

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

仮想環境が有効になると、ターミナルの行頭に `(venv)` と表示されます。

## 手順 3: 依存ライブラリのインストール

`requirements.txt` に記載されている必要なライブラリを一括でインストールします。

```bash
pip install -r requirements.txt
```

開発用の追加ツール（テストツールなど）もインストールしたい場合は、以下も実行してください：

```bash
pip install -r requirements-dev.txt
```

## 手順 4: ディレクトリ構造の初期化

動画生成に必要なフォルダ（一時ファイル置き場や成果物置き場）を作成します。
以下のコマンドを実行してください。

**Windows (PowerShell):**
```powershell
mkdir -p temp,projects,assets,config
mkdir -p assets/characters/reimu,assets/characters/marisa,assets/characters/common
mkdir -p assets/audio/bgm,assets/audio/sound_effects,assets/audio/jingles
```

**macOS / Linux:**
```bash
mkdir -p {temp,projects,assets,config}
mkdir -p assets/{characters,audio,fonts,templates}
mkdir -p assets/characters/{reimu,marisa,common}
mkdir -p assets/audio/{bgm,sound_effects,jingles}
```

これでインストールの基本作業は完了です。次は設定ファイルの作成に進みます。
