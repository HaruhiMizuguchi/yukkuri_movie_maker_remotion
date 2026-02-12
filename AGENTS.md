# AGENTS

- 日本語で返答すること
- タスクを始める際は、必ずdocs/dev_tasks_breakdown.mdを確認すること
- タスクを進めた時は、docs/dev_tasks_breakdown.mdを更新すること
- テスト駆動で開発すること
- apiを利用する系のテストは、モックだけでなく、実際にapi接続→成果物生成を行うこと
- コード中には、日本語でコメントを書くと
- 開発中に「今後の開発で役立つ知見」や「一般的には正しいがこのプロジェクト／環境では失敗した事例」を得たら、内容を要約して本ファイルに追記すること
- Observabilityに注意して開発すること

## 知見・失敗事例メモ
- Windows PowerShell では環境によって `cmd1 && cmd2` のような `&&` 連結が構文エラーになることがある。連続実行は `;` と `$LASTEXITCODE` で制御する。
- `remotion` パッケージだけでは `remotion` CLI コマンドは使えない。CLI 実行には `@remotion/cli` か `@remotion/renderer` を別途導入する必要がある。
- `pnpm add --filter ...` 実行時に `node_modules is present. Lockfile only installation` と表示された場合、実体の依存が展開されないことがある。続けて `pnpm install` を実行すると不足依存が解決される。
- Gemini API の疎通テストでは、認証が正常でもクォータ枯渇時に HTTP 429 (`RESOURCE_EXHAUSTED`) が返る。接続可否とクォータ不足は別扱いで判定する。
