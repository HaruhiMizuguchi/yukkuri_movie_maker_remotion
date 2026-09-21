# 全体レビュー7件の修正と検証（2026-09-18）

[レビュー記録](project_review_20260917.md) の7件を修正した。既存の未コミット変更を保持し、修正前に失敗する回帰テストを追加してから実装を変更した。

## 修正内容

| 課題 | 修正後の動作 | 主な確認 |
| --- | --- | --- |
| 認証情報の出力 | 公開診断を許可フィールドに限定。状態APIは過去の秘密フィールドも除外 | sentinelトークンがHTTP応答・ログ・証跡・収集summaryに現れない |
| ポーリングによる編集消失 | dirty refと編集revisionで未保存内容を保持。選択・再生位置・ズームを保持し、古い詳細応答も棄却 | desktop/mobileで編集中に実際のポーリング応答を待ち、値と選択を検証 |
| 自動運用の枠競合 | PostgreSQL advisory lock内で同時実行数・投稿済み数・未投稿予約数を検査しRunを作成 | 別Prisma接続の同時投入で同時上限1・日次上限1を超過しない |
| Job入力の変動 | 台本・素材・タイムライン・直近成果物をJob別に固定し、ハッシュ検証後に専用workで生成 | 台本Aで投入後にBを保存しても生成物はA、編集データはB。改変したsnapshotは拒否 |
| モデル継承の欠落 | 新規Projectがグローバルのmodels設定を引き継ぐ | 設定保存→Project作成→Jobの設定JSONを実APIでも検証 |
| モック履歴による実投稿阻止 | 実投稿成功だけを重複対象にし、昇格時に公開情報・旧モック指標・評価を整合 | 投稿API代替応答による回帰テスト。実YouTube投稿は認証未設定で未検証 |
| 指標の再収集欠落 | FAILED/NO_DATA/実投稿の代替MOCKEDを15分後に再収集。COMPLETEDは保持 | 失敗状態別の再試行、待機時間、評価更新を検証 |

Job成果物は `outputRoot/projects/<projectId>/jobs/<jobId>/work/` に保存する。生成後のlatest公開は入力保存と排他し、投入時から編集されていない場合だけ自動尺補正をタイムラインへ戻す。従来形式のJobは最初の実行時に固定するため、この修正以前の投入時点へ遡って復元するものではない。

## 品質ゲート

| 検証 | 結果 |
| --- | --- |
| `corepack pnpm test` | 52ファイル・189件成功（実Remotion生成テストを含む） |
| `corepack pnpm typecheck` | 成功 |
| `corepack pnpm lint` | 成功 |
| `corepack pnpm -C apps/web build` | 成功 |
| `corepack pnpm test:e2e:journey` | desktop/mobile 2件成功 |
| `corepack pnpm exec playwright test -c playwright.real.config.ts` | 実API/DB/Worker 2件成功（2.8分） |
| 実PostgreSQL予約・閉ループ試験 | 2ファイル・3件成功 |
| `git diff --check` | 成功 |

実DB検証は通常データベースと分離した `ymm_review_20260918` で実行した。実E2Eはプロジェクト詳細IDの到着と初回Job完了を待つよう更新し、PENDING/RUNNINGのデータを終了処理で削除しない。共有設定を使う実E2Eは1 workerで実行する。

実PostgreSQL予約試験の再実行は、migration適用済みの専用DB（名前 `ymm_review_*`）を `DATABASE_URL` に指定して行う。専用DBが指定されなければ予約試験は理由を表示してスキップする。

```powershell
corepack pnpm exec vitest run -c vitest.real.config.ts packages/core/src/reviewReservation.real.test.ts packages/core/src/task28ClosedLoop.real.test.ts
```

## 実動画の受け入れ証跡

実API→PostgreSQL/キュー→Worker→実AivisSpeech HTTP→Remotion→final_encodingを通した。手動台本を使い、背景生成・背景演出・挿絵工程はスキップした。外部LLM・画像APIを使った検証とは扱わない。音声モックへのフォールバックは無効、Remotionは有効。

- 閲覧用コピー: `outputs/test_evidence/review_fixes_20260918/final.mp4`
- 元の生成先: `outputs/test_evidence/review_fixes_20260918/journey/projects/ce65ef09-aa54-4dc0-9c93-dabf63a26c4e/jobs/ac4dd7cf-6065-4215-9d74-a40ca35c1fa3/work/output/final_encoding/run-20260918-122745-864-d38a130c/final.mp4`
- 動画尺: 5.546秒、解像度: 640×360、映像H.264、音声AAC、431,141 bytes
- FFprobe、FFmpeg全映像・音声デコードに成功。実ChromiumのプレビューでreadyStateが2以上、動画エラーなしを確認
- SHA-256: `04CE31BDC60B335ECA0F887D252779F28EF3ACA38DF58E9409EAF403D0531B9D`
- メディア情報: `outputs/test_evidence/review_fixes_20260918/journey/snapshot-video-evidence.json`
- ブラウザ画面: `outputs/test_evidence/review_fixes_20260918/journey/snapshot-video-browser.png`
- 起動・API・Workerログ: `logs/e2e-real/latest.log`

YouTube OAuth認証情報が未設定のため、実投稿と実Analytics取得は実行できていない。実接続診断は `youtube_credentials_missing` を `outputs/test_evidence/task28_closed_loop/` へ記録した。YouTube関連の回帰テストと実DB永続化は成功しているが、YouTubeへの実接続成功を意味しない。
