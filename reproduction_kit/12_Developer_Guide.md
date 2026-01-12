# 12. 開発者向けガイド

このシステムを拡張・改良したい開発者向けの情報をまとめています。

## 1. 開発環境のセットアップ

### 1.1 開発用ツールのインストール

```bash
# 開発用依存関係のインストール
pip install -r requirements-dev.txt
```

`requirements-dev.txt` には以下が含まれます：
- **pytest**: テストフレームワーク
- **pytest-cov**: カバレッジ測定
- **black**: コードフォーマッター
- **flake8**: リンター
- **mypy**: 型チェッカー

### 1.2 コード品質ツールの使用

```bash
# コードフォーマット
black src/

# リント（コード品質チェック）
flake8 src/

# 型チェック
mypy src/
```

---

## 2. プロジェクト構造の理解

### 2.1 主要ディレクトリ

```
src/
├── core/           # システムの中核機能
│   ├── project_manager.py      # プロジェクト管理
│   ├── workflow_engine.py      # ワークフロー実行エンジン
│   ├── database_manager.py     # データベース管理
│   └── error_handler.py        # エラーハンドリング
│
├── modules/        # 各処理ステップの実装
│   ├── theme_selector.py       # ステップ1: テーマ選定
│   ├── script_generator.py     # ステップ2: 台本生成
│   ├── tts_processor.py        # ステップ4: 音声生成
│   └── ...
│
├── api/            # 外部API通信クライアント
│   ├── llm_client.py           # LLM API
│   ├── tts_client.py           # TTS API
│   └── image_gen_client.py     # 画像生成API
│
└── utils/          # ユーティリティ関数
    ├── config_loader.py        # 設定読み込み
    ├── logger.py               # ロギング
    └── file_manager.py         # ファイル操作
```

### 2.2 データフロー

1. **ワークフローエンジン** (`workflow_engine.py`) が各ステップを順次実行
2. 各ステップは **モジュール** (`modules/`) として実装
3. モジュールは **APIクライアント** (`api/`) を使用して外部サービスと通信
4. 結果は **データベース** と **ファイルシステム** に保存

---

## 3. テスト駆動開発（TDD）

### 3.1 テストの実行

```bash
# 全テストを実行
pytest

# カバレッジ付きで実行
pytest --cov=src --cov-report=html

# 特定のテストファイルのみ実行
pytest tests/unit/test_theme_selector.py
```

### 3.2 テストの書き方

新しい機能を追加する際は、必ずテストを先に書きます（TDD）。

**例: 新しいモジュールのテスト**
```python
# tests/unit/test_new_module.py
import pytest
from src.modules.new_module import NewModule

def test_new_module_basic_functionality():
    """基本機能のテスト"""
    module = NewModule()
    result = module.process(input_data="test")
    assert result is not None
    assert result["status"] == "success"

def test_new_module_error_handling():
    """エラーハンドリングのテスト"""
    module = NewModule()
    with pytest.raises(ValueError):
        module.process(input_data=None)
```

---

## 4. 新しいステップの追加方法

### 4.1 モジュールの作成

`src/modules/` に新しいファイルを作成します。

```python
# src/modules/my_new_step.py
from typing import Dict, Any
from src.core.base_module import BaseModule

class MyNewStep(BaseModule):
    """新しい処理ステップ"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.step_name = "my_new_step"
    
    def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        メイン処理
        
        Args:
            input_data: 前のステップからの入力データ
        
        Returns:
            処理結果
        """
        # 処理ロジックをここに実装
        result = self._process(input_data)
        return result
    
    def _process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """実際の処理"""
        # TODO: 実装
        return {"status": "success", "data": data}
```

### 4.2 ワークフローへの登録

`docs/flow_definition.yaml` に新しいステップを追加します。

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

```python
from src.utils.logger import get_logger

logger = get_logger(__name__)

def my_function():
    logger.info("処理を開始します")
    logger.debug(f"デバッグ情報: {data}")
    logger.error("エラーが発生しました", exc_info=True)
```

ログファイルは `logs/` フォルダに保存されます。

### 5.2 ブレークポイントの使用

```python
# コード内にブレークポイントを設定
import pdb; pdb.set_trace()

# または Python 3.7+
breakpoint()
```

### 5.3 開発モードでの実行

```bash
# 詳細なログ出力
python src/main.py --dev-mode --log-level DEBUG
```

---

## 6. データベーススキーマ

### 6.1 主要テーブル

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

### 6.2 データベース操作

```python
from src.core.project_repository import ProjectRepository

repo = ProjectRepository()

# プロジェクト作成
project_id = repo.create_project(theme="テストテーマ")

# ステップ結果の保存
repo.save_step_result(
    project_id=project_id,
    step_name="theme_selection",
    output_data={"theme": "テストテーマ"}
)

# ステップ結果の取得
result = repo.get_step_output(project_id, "theme_selection")
```

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
# 処理時間の計測
python -m cProfile -o profile.stats src/main.py

# 結果の確認
python -m pstats profile.stats
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
