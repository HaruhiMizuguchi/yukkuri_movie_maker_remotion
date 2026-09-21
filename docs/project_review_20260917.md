# プロジェクト全体レビュー（2026-09-17）

追記（2026-09-18）: 以下の7件は修正済み。[修正内容と最終検証](review_fixes_20260918.md) を参照。本文は修正前のレビュー記録として保持する。

対象はレビュー開始時点の作業ツリー全体（既存の未コミット変更・新規ファイルを含む）。API、Worker、ワークフロー、動画合成、設定・編集UI、自動運用、Prismaモデル、既存テストと運用資料を確認した。実装の修正は行わず、以下の不具合と再現証跡を整理した。

P1は優先修正、P2は通常運用上の不具合として扱う。外部APIの現行モデル提供状況・料金・依存脆弱性の最新情報は今回の検証範囲外。

## 1. [P1] YouTubeアクセストークンが診断結果・ログ・DBへ流れる

- 箇所: `packages/core/src/closedLoopAutomation.ts:49-58`
- `resolveYoutubeAccessToken()` の成功結果には生の `accessToken` が含まれる。そのオブジェクトをそのまま `summary.auth` に代入している。
- `apps/api/src/closedLoopRoutes.ts` は収集結果をレスポンス、`request.log.info()`、証跡JSONへ渡す。サイクル実行では `AutomationRun.detailsJson.collection` とWorkerの標準出力にも到達し、状態取得APIからも参照できる。BigIntのJSON変換は秘密情報を除去しない。
- 再現: 実在しない固定トークンを渡し、返却summaryのJSONに値が含まれることを確認。実際の秘密情報の漏えい履歴を調査したという意味ではない。
- 修正案: 公開する認証診断型を `available/source/expiresInSeconds/reason` に限定し、トークンはAPI呼び出しのローカル変数だけに保持する。ログ・証跡・DB・HTTP応答それぞれで秘密値が出ない回帰テストを追加する。

## 2. [P1] ポーリングが未保存タイムラインと編集位置を消す

- 箇所: `apps/web/src/ui/App.tsx:706-709`、同724-725行
- ポーリングeffectは `projectDetail.jobs` と `selectedProjectId` に依存する一方、詳細読込関数はクロージャ内の `timelineDirty` を参照する。ポーリング登録後の編集が判定へ反映されず、サーバー側タイムラインでドラフトとUndo/Redo履歴を初期化する。
- さらに選択クリップ、プレイヘッド、ズームはdirty状態にかかわらず毎回初期化される。
- 再現: JobをPENDINGに保った実Chromium画面で終了位置を5000msから9999msへ編集。2回の詳細取得応答を確認した後、入力値が5000msへ戻り、保持を期待する独立E2Eが失敗した。
- 既存のデスクトップ顧客導線E2Eも、完成動画を分割した直後に選択クリップが消える失敗を1回検出。デスクトップ単独再実行は成功しており、タイミング依存の失敗として扱う。
- 修正案: 台本と同様にdirty状態をrefで同期管理する。ポーリングで編集ドラフト・選択・再生位置を保持し、プロジェクト切替時だけ再初期化する。遅延応答のプロジェクト識別も必要。

## 3. [P1] 自動運用の同時実行制限を複数リクエストが通過できる

- 箇所: `packages/core/src/closedLoopAutomation.ts:317-340`
- 稼働数の取得、上限判定、`AutomationRun.create()` が独立しており、トランザクションやロックで予約されていない。手動実行2件、またはAPI手動実行とWorker定期実行が重なると、どちらも同じ空き枠を使用する。
- Worker内の `running` フラグはそのプロセス内のtimerだけを保護する。生成Projectが異なるため、既存のproject advisory lockでも防げない。
- 再現: DB操作を代替した局所テストで `maxConcurrentRuns=1` に対して `Promise.all([cycle(), cycle()])` が2件とも開始成功した。
- 日次投稿数も投稿済み件数だけで判定するため、生成中の予約枠を数えない構成では上限保証が弱い。
- 修正案: 共通DBロックまたは直列化トランザクションで稼働・投稿枠の検査と予約を原子的にする。異なる呼び出し元から同時投入する実DB回帰テストを追加する。

## 4. [P1] Jobの入力revisionを保存しても生成入力は固定されない

- 箇所: `apps/api/src/index.ts:866-884`、`packages/core/src/defaultWorkflow.ts:122-130`、同1636行付近
- APIは `inputRevision` をJobへ記録するが、Worker/coreに照合処理がない。台本・素材・タイムラインは各工程で共有Projectディレクトリから読むため、投入後の編集が待機中／実行中Jobへ入る。
- APIの台本保存は `script_generation/latest/script.json` も更新する。生成中に保存すると、先に生成した音声と後から読み込む台本・タイムラインが別の版になる可能性がある。
- 再現: 台本AのrevisionをJobへ保持し、その後共有台本をBへ変更して `script_generation` を実行。revision不一致の検出はなく、台本Bが成果物になった。
- 修正案: Job別の変更不可入力ディレクトリを作成して全工程から参照するか、編集中更新を制御し、revision不一致を明示的な再投入として処理する。設定JSONだけの固定では不足する。

## 5. [P2] 新規プロジェクトが保存済みモデル設定を引き継がない

- 箇所: `apps/api/src/index.ts:279-283`
- `/api/projects` はグローバル設定を読みながら、Projectの設定へ `outputPreset` しかコピーせず `models` を落としている。ジョブ投入時のスキーマはmodels欠落を正常扱いし、組込のGemini既定モデルを補う。
- 再現: グローバルを `gpt-5.6-luna` / `gpt-image-2` に設定し、APIと同じmodels欠落設定をWorkerへ渡すと、`gemini-3.5-flash` / `gemini-3.1-flash-lite-image` が選択された。
- 影響: ユーザーが選んだプロバイダー・モデルで制作が始まらず、Googleキーがない環境では生成に失敗する。既存の `/api/jobs` 直接作成経路とは挙動が異なる。
- 修正案: `defaultProjectSettings.models` を新規Projectへコピーし、設定保存→新規作成→Job設定→Worker使用モデルを一連のテストで確認する。

## 6. [P2] モック投稿履歴が後の実投稿を重複扱いで止める

- 箇所: `packages/core/src/productionWorkflow.ts:661-664`
- 既定の認証不足フォールバックは `status=MOCKED` と `youtubeVideoId=mock-...` を保存する。重複チェックは実／モックを区別せず、認証を設定する前にその履歴だけでreturnする。
- 再現: `MOCKED/isMock=true` の既存レコードに対して `youtube_upload` を実行すると `status=duplicate` となり、API呼び出し回数は0だった。
- 影響: 同じプロジェクト・同じ完成動画は、後で正しい認証を登録して工程を再実行しても投稿できない。force指定でもこの重複チェックは通る。
- 修正案: 実投稿成功だけを重複対象とする。モックから実投稿へ移行する際は、実動画ID・公開日時・関連するモック指標を整合させる。

## 7. [P2] 視聴指標の取得失敗・未確定を永久に収集済み扱いする

- 箇所: `packages/core/src/closedLoopAutomation.ts:109-116`
- 既存snapshotをstatusで絞らず、すべての `windowHours` を収集済み集合へ渡す。その一方で、認証不足・HTTP失敗・NO_DATAもsnapshotとして保存する。
- 再現: 認証不足で24時間窓が `FAILED` として保存された後、同じ収集処理を再実行すると処理対象は0件。期限判定関数へstatusを渡していないため、NO_DATAも同様に除外される。
- 影響: 一時的な認証・クォータ・データ確定待ちから復旧しても、その評価窓の実指標と評価が補完されない。実投稿の代替モック結果も後から実データへ更新できない。
- 修正案: 完了した実指標だけを確定済みにし、FAILED/NO_DATA/代替MOCKEDの再試行条件・間隔・更新ルールを定義する。

## 検証結果

| 検証 | 結果 |
| --- | --- |
| `corepack pnpm test` | 50ファイル・178件成功（125.64秒）。実Remotion生成テストも含む |
| `corepack pnpm typecheck` | 成功 |
| `corepack pnpm lint` | 成功 |
| `corepack pnpm -C apps/web build` | 成功 |
| 顧客導線E2E | 初回desktop失敗、mobile成功。desktop単独再実行は成功 |
| タイムライン保持の独立E2E | 期待どおり失敗を再現。9999msが5000msへ戻る |
| 局所再現プローブ | 認証情報混入、失敗窓の再試行欠落、同時上限突破、モック重複、モデル継承欠落、入力revision不使用を確認 |
| 実API/DB E2E前提確認 | 不成立。PostgreSQL `localhost:5432` 接続不可、Dockerエンジン停止 |

局所再現のDB・YouTube応答は代替実装を使用し、実ブラウザと実ファイル操作で確認した。外部AI/TTS/YouTubeの実接続・実投稿は今回実施していない。局所再現をAPI結合試験の成功とは扱わない。

レビュー証跡: `outputs/test_evidence/review_20260917/`

- `probe.mts` / `probe-results.json`: 局所再現スクリプトと結果。認証値は実在しないsentinelのみ。
- `prepare-ui-probe.mjs` / `timeline-poll.spec.ts` / `playwright.config.ts` / `ui-results.json`: 既存fixtureを流用したブラウザ再現。
- `ui-evidence/`: 失敗スクリーンショットと画面状態。
- `duplicate/` のダミーMP4は投稿重複分岐の検証用プレースホルダーであり、動画生成の受け入れ成果物ではない。

再実行:

```powershell
corepack pnpm -C apps/api exec tsx ../../outputs/test_evidence/review_20260917/probe.mts
corepack pnpm exec playwright test -c outputs/test_evidence/review_20260917/playwright.config.ts
```

## 実動画の生成・検証

完成動画編集テストがFFmpegで作成した3秒の映像・音声素材をRemotionへ渡し、2区間のトリム・分割・追加テロップを合成した後、正規の `final_encoding` を実行した。外部AI/TTSは不使用、Remotion失敗時のFFmpeg代替合成は使用していない。DB登録部分はモック。

- 生成先: `outputs/test_evidence/remotion_video/final-video-editor-1789637657655/projects/project-1789637657655/output/final_encoding/run-20260917-183421-922-d5854e2c/final.mp4`
- 2.048秒、640×360、24fps、H.264映像・AAC音声、861,398 bytes
- FFprobe成功、FFmpegによる全映像・音声デコード成功
- SHA-256: `199F144EC456FA0D62AE56195BDD3CD140DC1C3787968DF935ED9AEB473BA36B`

## 総合評価

動画生成・編集の機能範囲は広く、型検査・lint・実レンダリングを伴うテスト基盤も動作している。一方で、既存テストは成功分岐が中心で、非同期編集、再試行、モックから実運用への移行、並行実行、機密情報の出力境界に穴がある。まずP1のデータ保持・認証情報・実行整合性を修正し、その後P2の設定継承と投稿／指標収集の復旧経路を整える。
