# 技術仕様書

このドキュメントでは、システムの技術的な詳細を説明します。

## 1. システムアーキテクチャ

### 1.1 全体構成

```
┌──────────────────────────────────────────────────────────┐
│                     Web GUI (優先)                        │
│                      (apps/web)                           │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│                         HTTP API                          │
│                        (apps/api)                         │
│  - ジョブ投入/進捗/成果物                                 │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│                          Worker                           │
│                        (apps/worker)                      │
│  - ワークフロー実行（packages/core）                      │
│  - 外部API呼び出し（LLM/TTS/画像生成）                    │
│  - FFmpeg（素材整形/音声ミックス/エンコード）             │
│  - Remotion（動画レンダリング）                           │
└───────────────────────────┬──────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
┌─────────────▼─────────────┐  ┌─────────▼───────────────┐
│ PostgreSQL (メタデータ/状態) │  │ File System（大容量ファイル）│
└───────────────────────────┘  └─────────────────────────┘
```

### 1.2 レイヤー構成

#### Web/UI Layer (`apps/web/`)
- ローカルWeb GUI（優先入口）
- プロジェクト作成・設定編集・実行・進捗・成果物閲覧

#### API Layer (`apps/api/`)
- APIエンドポイント（ジョブ投入/状態取得/成果物管理）
- 認証（将来）・入力バリデーション

#### Worker Layer (`apps/worker/`)
- ジョブ処理（バックグラウンド）
- ステップ実行、並列制御、リトライ

#### Core/Shared (`packages/*`)
- `packages/core`: ワークフロー中核（ステップ定義/再開/成果物）
- `packages/remotion`: Remotionコンポジション（動画の見た目・字幕・テンプレ）
- `packages/shared`: 型/ユーティリティ

#### Data Layer
- PostgreSQL（メタデータ/状態）
- File System（音声・画像・動画・ログ）

---

## 2. データ管理

### 2.1 ハイブリッドデータ管理

**原則**: メタデータはDB、大容量ファイルはファイルシステム

#### データベース管理（SQLite）
#### データベース管理（PostgreSQL）
- プロジェクト基本情報
- ワークフロー実行状況（ジョブ/ステップ）
- ステップ間のデータ受け渡し（メタデータ）
- API使用履歴（任意）

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

```ts
// 概念例（TypeScript）
export async function runWorkflow(jobId: string) {
  const steps = await loadWorkflowDefinition();

  for (const step of steps) {
    if (await isStepCompleted(jobId, step.name)) continue;

    const input = await getStepInput(jobId, step);
    try {
      const output = await step.run({ jobId, input });
      await saveStepOutput(jobId, step.name, output);
    } catch (err) {
      await handleError(jobId, step.name, err);
      throw err;
    }
  }
}
```

### 3.2 エラーハンドリング

#### エラー分類
1. **Recoverable Error**: リトライ可能（API一時エラーなど）
2. **Fatal Error**: リトライ不可（設定エラーなど）
3. **User Intervention Required**: 手動対応が必要

#### リトライ戦略
```ts
// 概念例: リトライ可能なエラーだけ指数バックオフで再試行
await retry(async () => {
  return await callExternalApi();
}, { retries: 3, minTimeout: 4000, maxTimeout: 10000 });
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

**主な利用方法**: FFmpegを外部プロセスとして実行（Nodeから呼び出し）

**主要処理**:
1. **動画合成**: 背景 + 立ち絵 + 字幕
2. **音声合成**: 音声 + BGM + 効果音
3. **エンコード**: 最終動画の品質最適化

```bash
# 例: 音声の結合（概念）
ffmpeg -i a.wav -i b.wav -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1" out.wav
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

### 10.1 主要ライブラリ（想定）

| ライブラリ | 用途 |
|-----------|------|
| remotion | 動画レンダリング（React） |
| prisma | DB/マイグレーション |
| zod | 入力/設定の検証 |
| pino | ログ |
| undici/axios | HTTP通信 |

### 10.2 システム要件

- **Node.js**: LTS（推奨: 20以上）
- **FFmpeg**: 4.0以上
- **メモリ**: 8GB以上推奨
- **ストレージ**: 10GB以上の空き容量
