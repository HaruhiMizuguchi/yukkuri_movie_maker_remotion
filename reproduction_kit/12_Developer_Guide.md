# 12. 開発者向けガイド

このシステムを拡張・改良したい開発者向けの情報をまとめています。

## 1. 開発環境のセットアップ

### 1.1 開発用ツールのインストール

```bash
# 依存関係のインストール
pnpm install
```

（想定）主要な開発ツール:
- **TypeScript**: 型チェック
- **ESLint**: リント
- **Prettier**: フォーマット
- **Vitest**: テスト
- **Prisma**: DBスキーマ/マイグレーション

### 1.2 コード品質ツールの使用

```bash
# フォーマット
pnpm format

# リント
pnpm lint

# 型チェック
pnpm typecheck
```

---

## 2. プロジェクト構造の理解

### 2.1 主要ディレクトリ

```
apps/
├── web/            # Web GUI（優先入口）
├── api/            # HTTP API（ジョブ投入/進捗/成果物）
└── worker/         # バックグラウンド処理（AI/FFmpeg/Remotion）

packages/
├── core/           # ワークフロー中核（ステップ管理/再開/状態）
├── remotion/       # Remotionコンポジション（動画の見た目とタイムライン）
└── shared/         # 型/ユーティリティ（Script/Timeline/Subtitle等）
```

### 2.2 データフロー

1. **Web GUI** または **CLI/API** からジョブを作成
2. **Worker** がジョブを取得し、**packages/core** のワークフローを実行
3. 外部サービス（LLM/TTS/画像生成）を呼び出し、FFmpeg/Remotionで素材生成・レンダリング
4. 結果は **PostgreSQL（メタデータ/状態）** と **ファイルシステム（大容量ファイル）** に保存

---

## 3. テスト駆動開発（TDD）

### 3.1 テストの実行

```bash
# 全テストを実行
pnpm test

# カバレッジ付きで実行
pnpm test -- --coverage

# 特定のテストのみ実行（例）
pnpm test -- -t "theme"
```

### 3.2 テストの書き方

新しい機能を追加する際は、必ずテストを先に書きます（TDD）。

**例: 新しいステップのテスト（概念）**
```ts
import { describe, it, expect } from "vitest";

describe("myNewStep", () => {
  it("basic functionality", async () => {
    const result = await myNewStep({ input: "test" });
    expect(result.status).toBe("success");
  });
});
```

---

## 4. 新しいステップの追加方法

### 4.1 モジュールの作成

（想定）`packages/core/src/steps/` に新しいステップを追加します。

```ts
export const myNewStep: WorkflowStep = {
  name: "my_new_step",
  async run(ctx) {
    // TODO: 実装
    return { status: "success", data: ctx.input };
  },
};
```

### 4.2 ワークフローへの登録

設定（YAML/JSON）にステップを追加し、Workerがそれを読み込んで実行する想定です。

```yaml
workflows:
  my_new_step:
    step_id: 14
    step_name: "my_new_step"
    display_name: "新しいステップ"
    description: "新しい処理の説明"
    
    inputs:
      method: "database_query"
      sources:
        previous_step:
          source_type: "database"
          table: "workflow_steps"
    
    outputs:
      method: "database_with_files"
      file_outputs:
        output_file:
          file_type: "output"
          relative_path: "files/output/result.json"
```

---

## 5. デバッグ方法

### 5.1 ログの活用

システムは詳細なログを出力します。

```ts
logger.info("処理を開始します");
logger.debug({ data }, "デバッグ情報");
logger.error({ err }, "エラーが発生しました");
```

ログファイルは `logs/` フォルダに保存されます。

### 5.2 ブレークポイントの使用

```ts
// Node.js / TypeScript では、以下のいずれかでデバッグします
// - debugger; を仕込んでVS Code等でアタッチ
// - もしくは --inspect / --inspect-brk で起動
debugger;
```

### 5.3 開発モードでの実行

```bash
# 詳細なログ出力
pnpm dev
```

---

## 6. データベーススキーマ

### 6.1 主要テーブル（概念）

#### projects テーブル
```sql
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    theme TEXT,
    status TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    config_json TEXT
);
```

#### workflow_steps テーブル
```sql
CREATE TABLE workflow_steps (
    id INTEGER PRIMARY KEY,
    project_id TEXT,
    step_name TEXT,
    status TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    output_summary_json TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### 6.2 DB操作（想定）
Prisma等のORMで `projects` / `workflow_steps` 等を管理します。

---

## 7. コントリビューション（貢献）

### 7.1 ブランチ戦略

- `main`: 安定版
- `develop`: 開発版
- `feature/xxx`: 新機能開発
- `bugfix/xxx`: バグ修正

### 7.2 コミットメッセージ

```
[種類] 簡潔な説明

詳細な説明（必要に応じて）

例:
[feat] テーマ選定モジュールを追加
[fix] 音声生成時のエラーを修正
[docs] READMEを更新
[test] ユニットテストを追加
```

---

## 8. パフォーマンス最適化

### 8.1 プロファイリング

```bash
# 例: Nodeのプロファイリング（概念）
node --prof apps/worker/dist/index.js
```

### 8.2 並列処理

```python
from concurrent.futures import ThreadPoolExecutor

def process_items(items):
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = executor.map(process_single_item, items)
    return list(results)
```

---

## 9. よくある開発タスク

### 9.1 新しいLLMプロバイダーの追加

1. `src/api/llm_client.py` に新しいクライアントクラスを追加
2. `config/llm_config.yaml` に設定を追加
3. テストを作成

### 9.2 新しい画像生成APIの追加

1. `src/api/image_gen_client.py` に新しいクライアントを追加
2. `config/image_generation_config.yaml` に設定を追加
3. テストを作成

---

## 10. リソース

- **公式ドキュメント**: `docs/` フォルダ内
- **フロー定義**: `docs/flow_definition.yaml`
- **開発ガイド**: `docs/development_guide.md`
- **タスク分割**: `docs/task_breakdown.md`
