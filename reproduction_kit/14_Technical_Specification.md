# 技術仕様書

このドキュメントでは、システムの技術的な詳細を説明します。

## 1. システムアーキテクチャ

### 1.1 全体構成

```
┌─────────────────────────────────────────────────────┐
│                  CLI Interface                       │
│              (src/cli/main_cli.py)                   │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              Workflow Engine                         │
│          (src/core/workflow_engine.py)               │
│  - ステップ管理                                        │
│  - 並列処理制御                                        │
│  - エラーハンドリング                                  │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐   ┌────────▼────────┐
│  Data Layer    │   │  Module Layer   │
│                │   │                 │
│ - Database     │   │ - Theme         │
│ - File System  │   │ - Script        │
│ - Repository   │   │ - TTS           │
│                │   │ - Video         │
└────────────────┘   └─────────┬───────┘
                               │
                     ┌─────────▼─────────┐
                     │   API Layer       │
                     │                   │
                     │ - LLM Client      │
                     │ - TTS Client      │
                     │ - Image Gen       │
                     └───────────────────┘
```

### 1.2 レイヤー構成

#### CLI Layer (`src/cli/`)
- ユーザーインターフェース
- コマンドライン引数の解析
- 進捗表示

#### Core Layer (`src/core/`)
- **WorkflowEngine**: ワークフロー実行制御
- **ProjectManager**: プロジェクト管理
- **DatabaseManager**: データベース操作
- **ErrorHandler**: エラーハンドリング

#### Module Layer (`src/modules/`)
- 各処理ステップの実装
- ビジネスロジック

#### API Layer (`src/api/`)
- 外部APIとの通信
- レート制限対応
- リトライ処理

#### Data Layer (`src/dao/`, `src/utils/`)
- データアクセス
- ファイル操作
- 設定管理

---

## 2. データ管理

### 2.1 ハイブリッドデータ管理

**原則**: メタデータはDB、大容量ファイルはファイルシステム

#### データベース管理（SQLite）
- プロジェクト基本情報
- ワークフロー実行状況
- ステップ間のデータ受け渡し
- API使用履歴

#### ファイルシステム管理
- 音声ファイル（WAV、MP3）
- 動画ファイル（MP4）
- 画像ファイル（PNG、JPG）
- ログファイル

### 2.2 データベーススキーマ

#### projects テーブル
```sql
CREATE TABLE projects (
    id TEXT PRIMARY KEY,              -- UUID
    theme TEXT,                        -- 動画テーマ
    status TEXT,                       -- PENDING/RUNNING/COMPLETED/FAILED
    target_length_minutes INTEGER,     -- 目標尺（分）
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    config_json TEXT                   -- プロジェクト固有設定（JSON）
);
```

#### workflow_steps テーブル
```sql
CREATE TABLE workflow_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,
    step_name TEXT,                    -- theme_selection, script_generation, etc.
    status TEXT,                       -- PENDING/RUNNING/COMPLETED/FAILED/SKIPPED
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    output_summary_json TEXT,          -- ステップ出力データ（JSON）
    error_message TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

#### project_files テーブル
```sql
CREATE TABLE project_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,
    step_name TEXT,
    file_type TEXT,                    -- audio/video/image/script/metadata
    file_category TEXT,                -- input/output/intermediate/final
    relative_path TEXT,                -- プロジェクトルートからの相対パス
    file_size_bytes INTEGER,
    created_at TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

---

## 3. ワークフローエンジン

### 3.1 ステップ実行フロー

```python
class WorkflowEngine:
    def execute_workflow(self, project_id: str):
        """ワークフロー全体を実行"""
        steps = self._load_workflow_definition()
        
        for step in steps:
            # ステップ状態確認
            if self._is_step_completed(project_id, step.name):
                continue  # スキップ
            
            # 入力データ取得
            input_data = self._get_step_input(project_id, step)
            
            # ステップ実行
            try:
                output_data = step.execute(input_data)
                self._save_step_output(project_id, step.name, output_data)
            except Exception as e:
                self._handle_error(project_id, step.name, e)
```

### 3.2 エラーハンドリング

#### エラー分類
1. **Recoverable Error**: リトライ可能（API一時エラーなど）
2. **Fatal Error**: リトライ不可（設定エラーなど）
3. **User Intervention Required**: 手動対応が必要

#### リトライ戦略
```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type(RecoverableError)
)
def call_api():
    # API呼び出し
    pass
```

---

## 4. API統合

### 4.1 LLM API Client

**対応プロバイダー**:
- Google Gemini
- OpenAI GPT
- Anthropic Claude

**主要機能**:
- プロンプト送信
- レスポンス解析
- レート制限対応
- エラーハンドリング

```python
class LLMClient:
    def generate_text(self, prompt: str, config: Dict) -> str:
        """テキスト生成"""
        provider = config.get("provider", "google")
        
        if provider == "google":
            return self._call_gemini(prompt, config)
        elif provider == "openai":
            return self._call_openai(prompt, config)
```

### 4.2 TTS API Client

**対応プロバイダー**:
- AIVIS Speech
- Azure Speech Services

**主要機能**:
- 音声生成
- タイムスタンプ取得
- 音声品質制御

### 4.3 Image Generation API Client

**対応プロバイダー**:
- Google Gemini Image Generation
- OpenAI DALL-E 3
- Stability AI (Stable Diffusion)

---

## 5. 動画処理パイプライン

### 5.1 FFmpeg統合

**使用ライブラリ**: `ffmpeg-python`

**主要処理**:
1. **動画合成**: 背景 + 立ち絵 + 字幕
2. **音声合成**: 音声 + BGM + 効果音
3. **エンコード**: 最終動画の品質最適化

```python
import ffmpeg

# 動画合成の例
(
    ffmpeg
    .input('background.mp4')
    .overlay(ffmpeg.input('character.mp4'))
    .output('composed.mp4', vcodec='libx264', acodec='aac')
    .run()
)
```

### 5.2 字幕処理

**フォーマット**: ASS (Advanced SubStation Alpha)

**特徴**:
- 話者別スタイル
- 位置・色・サイズのカスタマイズ
- アニメーション効果

---

## 6. パフォーマンス最適化

### 6.1 並列処理

```python
from concurrent.futures import ThreadPoolExecutor

def process_segments_parallel(segments):
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = executor.map(process_segment, segments)
    return list(results)
```

### 6.2 キャッシュ機構

- LLM応答のキャッシュ
- 画像生成結果のキャッシュ
- 有効期限: 24時間（設定可能）

---

## 7. セキュリティ

### 7.1 APIキー管理

- 環境変数（`.env`）で管理
- Gitにコミットしない（`.gitignore`）
- 暗号化保存（本番環境）

### 7.2 入力検証

- 全ユーザー入力のバリデーション
- SQLインジェクション対策
- パストラバーサル対策

---

## 8. テスト戦略

### 8.1 テストピラミッド

```
        ┌─────────────┐
        │  E2E Tests  │  ← 少数
        ├─────────────┤
        │Integration  │  ← 中程度
        │   Tests     │
        ├─────────────┤
        │    Unit     │  ← 多数
        │   Tests     │
        └─────────────┘
```

### 8.2 テストカバレッジ目標

- **ユニットテスト**: 80%以上
- **統合テスト**: 主要フロー100%
- **E2Eテスト**: 全ワークフロー

---

## 9. 拡張性

### 9.1 プラグインアーキテクチャ

新しいモジュールの追加が容易：

```python
class BaseModule(ABC):
    @abstractmethod
    def execute(self, input_data: Dict) -> Dict:
        """実装必須"""
        pass
```

### 9.2 設定駆動

コード変更なしで挙動を変更可能：
- YAML設定ファイル
- 環境変数
- データベース設定

---

## 10. 依存関係

### 10.1 主要ライブラリ

| ライブラリ | 用途 | バージョン |
|-----------|------|-----------|
| pydantic | データ検証 | ≥2.0.0 |
| pyyaml | 設定ファイル | ≥6.0 |
| ffmpeg-python | 動画処理 | ≥0.2.0 |
| opencv-python | 画像処理 | ≥4.8.0 |
| pillow | 画像操作 | ≥9.0.0 |
| requests | HTTP通信 | ≥2.28.0 |
| sqlalchemy | ORM | ≥2.0.0 |

### 10.2 システム要件

- **Python**: 3.8以上（3.11推奨）
- **FFmpeg**: 4.0以上
- **メモリ**: 8GB以上推奨
- **ストレージ**: 10GB以上の空き容量
