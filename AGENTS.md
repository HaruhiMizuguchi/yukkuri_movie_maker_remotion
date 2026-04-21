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
- AivisSpeech は環境によって話者が1種類のみ（例: Anneli）でも稼働する。`speaker` 文字列を固定IDに決め打ちせず、`/speakers` の style 一覧から動的選択する実装が安全。
- PowerShell のコマンド長制限で巨大な here-string 一括書き込みが失敗することがある。大きな編集は `apply_patch` か分割書き込みを優先する。
- 実行ポリシーによっては `git restore` や `Remove-Item` など削除系コマンドがブロックされる。作業ツリー整理は `.gitignore` 追加や、意図した削除をコミットで確定する運用に切り替えると止まりにくい。
- `corepack pnpm dev` 配下で `concurrently` が子プロセスを起動する場合、`pnpm -C ...` だと Windows 環境で `pnpm` 未解決になることがある。ルート `package.json` の子コマンドは `corepack pnpm -C ...` に統一する。
- Windows で Node.js から `corepack.cmd` を `spawn` 直呼びすると `EINVAL` になる場合がある。`corepack ...` の実行は `shell: true` のコマンド文字列実行にすると安定する。
- pnpm ワークスペースルートへ開発依存を追加する場合、`corepack pnpm add -Dw <package>` のように `-w` を明示しないと `ERR_PNPM_ADDING_TO_ROOT` で止まる。
- Playwright の `webServer` がタイムアウトした場合でも、起動途中の Vite/Node プロセスがポートを掴んだまま残ることがある。再実行前に `Get-NetTCPConnection -LocalPort 3000` で確認すると原因切り分けが早い。
- Windows のESM CLI判定は `file://${process.argv[1]}` の手組みだと `file:///C:/...` と一致せず実行本体が走らない。`pathToFileURL(process.argv[1]).href` で比較する。
- Playwrightを複数project並列で動かすと、ワーカーごとの `Date` 由来runIdが1秒ずれて別ディレクトリになることがある。ビジュアル回帰の最新マニフェスト探索は「最新runディレクトリ1個」ではなくprojectごとの最新を拾う。
- Prisma schema がリポジトリルートにある場合、ルートに `prisma` が無いと `prisma generate` が自己インストールを試み、Windows環境で `pnpm` 未解決により失敗することがある。ルートdevDependencyに `prisma` と `@prisma/client` を置くと安定する。
- AivisSpeechを `Start-Process` で起動した直後は、プロセスが立ち上がっていても `/speakers` が数十秒 `fetch failed` になることがある。実接続生成ではHTTP 200になるまでポーリングしてからTTSを開始する。
- Remotion Renderer は `file://` の音声・画像をそのまま `Audio` / `Img` に渡すと Windows の headless Chrome で `Not allowed to load local resource` になりやすい。生成物を描画する場合は一時HTTPサーバー経由で配信すると安定する。
