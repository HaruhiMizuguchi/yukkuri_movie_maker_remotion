# YouTube閉ループ自動運用

## 目的

人が行っていた「テーマ決定→動画生成→投稿→視聴データ確認→次回テーマ改善」を、停止可能で説明可能な定期処理として実行する。

## 処理の流れ

1. Workerが `AutomationConfig.nextRunAt` を定期確認する
2. 完了した自動運用RunをJob状態と同期する
3. 既存投稿の24時間・72時間・168時間後の指標を収集する
4. 同じ評価窓の過去動画を基準に、再生・平均視聴率・反応率・登録転換率を評価する
5. Google Trends候補、類似テーマの過去成績、直近テーマとの重複を合成して次回テーマを順位付けする
6. 選定理由を `ThemeDecision` へ保存し、新規Projectと全自動Jobを作成する
7. `final.mp4` 完成後、YouTube投稿工程が投稿台帳を作成する

## 安全策

- 初期状態は `enabled=false`
- `dailyUploadLimit` で日次投稿上限を設定
- `maxConcurrentRuns` と自動運用Run状態で同時実行を防止
- 同じプロジェクト・同じ動画内容からSHA-256冪等キーを作り、再実行時の重複投稿を防止
- 既定公開状態はprivate
- 予約公開はYouTube仕様に合わせ、privateと `publishAt` を組み合わせる
- API認証がない場合は外部投稿を行わず、`MOCKED` 投稿・分析として理由をDBと証跡へ保存する
- CLIから `--enabled false` を指定して停止可能

実行枠の判定とRun作成は、共通のPostgreSQL advisory lockを持つトランザクション内で行う。日次枠にはUTC当日の投稿済み件数に加え、生成中で未投稿の予約枠も含めるため、API手動実行とWorker定期実行が重なっても同じ空き枠を予約しない。

重複判定は実投稿に成功した動画だけを対象とする。`MOCKED` から実投稿へ切り替える際は、公開情報を更新し、旧モックの指標・評価を同時に削除する。実投稿の `FAILED` / `NO_DATA` / 代替 `MOCKED` 指標は15分の待機後に再収集し、実データと評価を補完する。`COMPLETED` は再収集しない。

公開する認証診断は `available/source/expiresInSeconds/reason` に限定し、アクセストークンを収集結果・ログ・DB・証跡へ渡さない。状態APIでも過去の保存結果に含まれ得る秘密フィールドを除外する。

## OAuth

長期運用では `YOUTUBE_CLIENT_ID`、`YOUTUBE_CLIENT_SECRET`、`YOUTUBE_REFRESH_TOKEN` を設定する。WorkerはGoogle OAuth token endpointから短期アクセストークンを取得する。従来の `YOUTUBE_ACCESS_TOKEN` も利用できるが、失効後の自動更新はできない。

必要な権限は、投稿用のYouTube権限と、チャンネル・分析読取権限である。YouTube Data APIはサービスアカウントに対応しないため、チャンネル所有者によるOAuth同意が必要になる。

参考:

- https://developers.google.com/youtube/v3/guides/authentication
- https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
- https://developers.google.com/youtube/analytics/reference/reports/query
- https://developers.google.com/youtube/v3/docs/videos

## 収集指標

YouTube Analytics APIの対象動画レポートから次を収集する。

- views
- estimatedMinutesWatched
- averageViewDuration
- averageViewPercentage
- likes / comments / shares
- subscribersGained / subscribersLost

サムネイルのimpression/CTRはYouTube Reporting APIの一括レポート側で提供され、対象動画を即時照会するAnalytics queryとは取得方式が異なる。この実装では未取得値を0とみなさず、現在の評価には上記の即時照会可能な指標だけを使う。

## API

- `GET /api/automation/config`: 設定取得
- `PUT /api/automation/config`: 設定更新
- `GET /api/automation/status`: Run、投稿、分析、判断履歴の確認
- `POST /api/automation/collect`: 今すぐ指標収集
- `POST /api/automation/themes`: 今すぐテーマ提案
- `POST /api/automation/run`: 今すぐ1サイクル開始

## CLI

```powershell
corepack pnpm cli automation status
corepack pnpm cli automation collect
corepack pnpm cli automation themes
corepack pnpm cli automation run
corepack pnpm cli automation config --enabled true --interval-hours 168 --daily-upload-limit 1 --topic-seed "AI技術"
corepack pnpm cli automation config --enabled false
```

## API制約時の証跡

実接続またはモック切替の結果は `outputs/test_evidence/task28_closed_loop/` に保存する。`youtube_credentials_missing`、HTTPステータス、モック利用有無を区別し、認証失敗を視聴数0として扱わない。
