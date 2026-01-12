# 06. トラブルシューティング (Troubleshooting)

うまく動かない場合のよくある原因と対処法です。

## 1. "ffmpeg not found" や "FileNotFoundError: [WinError 2]" エラー

**原因**: FFmpegがインストールされていないか、パス(Path)が通っていません。

**対処法**:
1. ターミナルで `ffmpeg -version` を実行してください。エラーになる場合はインストールされていません。
2. [02_Prerequisites.md](02_Prerequisites.md) を参照してFFmpegをインストールしてください。
3. Windowsの場合、環境変数 `Path` にFFmpegの `bin` フォルダが含まれているか確認し、追加後は**ターミナルを再起動**してください。

## 2. API関連のエラー (401 Unauthorized, 429 Too Many Requests)

**原因**: APIキーが間違っているか、利用枠（クォータ）を超えています。

**対処法**:
- **401 Unauthorized**: `.env` ファイルのAPIキーが正しいか確認してください。余計なスペースが入っていないか注意してください。
- **429 Too Many Requests**: 短時間にリクエストを送りすぎています。しばらく待ってから再実行するか、無料枠の上限に達していないか確認してください。

## 3. "ModuleNotFoundError"

**原因**: Node依存関係がインストールされていない、またはワークスペースのセットアップが不完全です。

**対処法**:
以下のコマンドを実行して依存関係をインストールしてください。
```bash
pnpm install
```

## 4. DB接続エラー（"DATABASE_URL" / "connection refused" など）

**原因**: PostgreSQLが起動していない、接続情報が間違っている、ポートが違う等。

**対処法**:
- PostgreSQLが起動しているか確認してください。
- `.env` の `DATABASE_URL` が正しいか確認してください。
- 他アプリが同じポートを使っていないか確認してください。

## 5. 動画が生成されない / 途中で止まる

**原因**: 処理に時間がかかっているか、予期せぬエラーが発生しています。

**対処法**:
- `logs` フォルダ内のログファイルを確認してください。詳細なエラーメッセージが記録されています。
- `--dev-mode` を付けて実行し、コンソール出力を確認してください。
- メモリ不足の可能性があります。他の重いアプリケーションを終了してみてください。

## 6. 文字化けする (Windows)

**原因**: コンソールのエンコーディング設定の問題です。

**対処法**:
PowerShellを使用している場合、以下を実行してからツールを起動してみてください。
```powershell
$OutputEncoding = [System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

## それでも解決しない場合

## 7. "node / npm / pnpm が見つかりません"（CommandNotFoundException）

**原因**: Node.js が未インストール、またはPathが通っていません。

**対処法**:
- Node.js（LTS）をインストールしてください（インストール後に新しいターミナルを開き直してください）。
- `pnpm` は任意ですが、使う場合は `corepack enable` → `corepack prepare pnpm@9.15.0 --activate` を試してください。

- エラーメッセージをコピーして、Web検索してみてください。
- プロジェクトの `docs` フォルダにある詳細な開発ドキュメントも参考にしてください。
