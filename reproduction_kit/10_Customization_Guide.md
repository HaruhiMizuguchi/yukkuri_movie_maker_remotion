# 10. カスタマイズガイド

システムの挙動をカスタマイズする方法を説明します。

## 1. 設定ファイルによるカスタマイズ

`config` フォルダ内のYAMLファイルを編集することで、コードを変更せずに多くの設定を変更できます。

### 1.1 LLM設定 (`config/llm_config.yaml`)

使用するLLMモデルやプロンプトを変更できます。

```yaml
# 使用するLLMプロバイダー
primary_provider: "google"  # google, openai, anthropic

# モデル設定
models:
  google:
    model_name: "gemini-2.0-flash-preview-image-generation"
    temperature: 0.7
    max_tokens: 2000
  
  openai:
    model_name: "gpt-4"
    temperature: 0.7
    max_tokens: 2000

# プロンプトテンプレート
prompts:
  theme_selection: |
    あなたはYouTubeの企画担当者です。
    以下の条件で動画のテーマを提案してください：
    - ジャンル: {genre}
    - ターゲット: {target_audience}
```

### 1.2 音声合成設定 (`config/voice_config.yaml`)

キャラクターごとの声の設定を変更できます。

```yaml
characters:
  reimu:
    voice_id: "reimu_voice_001"
    pitch: 1.0
    speed: 1.0
    volume: 1.0
  
  marisa:
    voice_id: "marisa_voice_001"
    pitch: 0.9
    speed: 1.1
    volume: 1.0
```

### 1.3 画像生成設定 (`config/image_generation_config.yaml`)

背景画像の生成方法を変更できます。

```yaml
# 使用する画像生成プロバイダー
primary_provider: "google"  # google, openai, stability

# 画像設定
image_settings:
  resolution: "1920x1080"
  quality: "high"
  style: "anime"  # anime, realistic, artistic

# 開発時制限
development:
  max_images_per_day: 20
```

---

## 2. キャラクターのカスタマイズ

### 2.1 新しいキャラクターの追加

1. **立ち絵素材の準備**
   - `assets/characters/[キャラクター名]/` フォルダを作成
   - 以下の画像を配置：
     - `base.png` (基本立ち絵)
     - `mouth_open.png` (口を開けた状態)
     - `mouth_closed.png` (口を閉じた状態)
     - `expression_*.png` (各種表情)

2. **設定ファイルに追加**
   `config/character_config.yaml` に新しいキャラクターを追加：
   ```yaml
   characters:
     new_character:
       name: "新キャラ"
       display_name: "新しいキャラクター"
       voice_id: "voice_id_here"
       position: "left"  # left, center, right
   ```

---

## 3. BGM・効果音のカスタマイズ

### 3.1 BGMの追加

1. **BGMファイルの配置**
   - `assets/audio/bgm/` フォルダにMP3またはWAVファイルを配置

2. **設定ファイルで指定**
   `config/audio_config.yaml` (存在しない場合は作成):
   ```yaml
   bgm:
     default: "assets/audio/bgm/default_bgm.mp3"
     volume: 0.3  # 0.0 ~ 1.0
   ```

### 3.2 効果音の追加

1. **効果音ファイルの配置**
   - `assets/audio/sound_effects/` フォルダに配置

2. **トリガーポイントの設定**
   スクリプト生成時に効果音を挿入したいポイントを指定できます（高度な設定）。

---

## 4. 字幕スタイルのカスタマイズ

`config/subtitle_config.yaml` で字幕の見た目を変更できます。

```yaml
# 字幕スタイル
styles:
  reimu:
    font_name: "Yu Gothic"
    font_size: 48
    primary_color: "&H00FFFFFF"  # 白
    outline_color: "&H00000000"  # 黒
    position: "bottom"
  
  marisa:
    font_name: "Yu Gothic"
    font_size: 48
    primary_color: "&H0000FFFF"  # 黄色
    outline_color: "&H00000000"
    position: "bottom"
```

---

## 5. 動画品質のカスタマイズ

`config/encoding_config.yaml` で最終動画の品質を調整できます。

```yaml
# エンコード設定
encoding:
  resolution: "1920x1080"  # 1280x720, 1920x1080, 3840x2160
  fps: 30
  video_codec: "libx264"
  video_bitrate: "5000k"
  audio_codec: "aac"
  audio_bitrate: "192k"
  preset: "medium"  # ultrafast, fast, medium, slow, veryslow
```

**品質とファイルサイズのバランス**:
- `preset: "fast"` + `video_bitrate: "3000k"` → 軽量・高速
- `preset: "slow"` + `video_bitrate: "8000k"` → 高品質・低速

---

## 6. ワークフローのカスタマイズ

特定のステップをスキップしたり、順序を変更したりすることも可能です（上級者向け）。

`src/core/workflow_engine.py` を編集することで、ワークフローをカスタマイズできます。

---

## 7. プロンプトのカスタマイズ

LLMに送るプロンプトを変更することで、生成される台本やテーマの傾向を変えられます。

`config/llm_config.yaml` の `prompts` セクションを編集してください。

**例: より面白い台本を生成する**
```yaml
prompts:
  script_generation: |
    あなたは人気YouTuberの台本作家です。
    以下のテーマで、視聴者を飽きさせない面白い台本を作成してください。
    - 冗談やユーモアを適度に入れる
    - 視聴者に問いかける形式を使う
    - 意外性のある展開を入れる
    
    テーマ: {theme}
```

---

## カスタマイズ時の注意事項

1. **設定ファイルのバックアップ**
   - 変更前に必ずバックアップを取ってください。

2. **YAML形式の厳守**
   - インデント（スペース2個）を正確に守ってください。
   - タブ文字は使用しないでください。

3. **テスト実行**
   - 設定変更後は必ず `--dev-mode` でテスト実行してください。
