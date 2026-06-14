# カスタマージャーニーE2E / ビジュアル回帰

## 目的
GUIの主要導線を「制作を始めるユーザーの一連の体験」としてPlaywrightで通し、各画面の状態をスクリーンショット証跡として保存する。
これにより、単体テストでは拾いにくい画面遷移、入力保存、成果物確認、設定保存の破綻を早く見つける。

## 現在の対象導線
`e2e/customerJourney.spec.ts` は以下を1本の導線として検証する。

1. ダッシュボードを開く
2. 作成ウィザードでテーマとモードを指定する
3. プロジェクト詳細で作成結果を確認する
4. 台本を編集して保存する
5. 素材を登録する
6. タイムラインの再生範囲を調整して保存する
7. プレビュー情報を取得し、レンダリングジョブを作成する
8. 設定画面でAPIキー入力欄と出力プリセット保存を確認する

このE2EはGUIの顧客導線を安定して検証するため、APIレスポンスはPlaywrightの `page.route` で固定している。
実API/DB/Workerを使う成果物生成は `e2e/realApiWorkerJourney.spec.ts` が担う。
APIキーはローカル設定ファイルへ永続化せず、実API利用時は `.env` の環境変数を使う。

## 実行方法
初回のみChromiumを導入する。

```powershell
corepack pnpm exec playwright install chromium
```

顧客導線E2Eを実行する。

```powershell
corepack pnpm test:e2e:journey
```

顧客導線E2Eを実行し、最新スクリーンショットを良品ベースラインとして更新する。

```powershell
corepack pnpm test:e2e:visual:update
```

顧客導線E2Eを実行し、良品ベースラインとの差分を判定する。

```powershell
corepack pnpm test:e2e:visual
```

HTMLレポートを開く。

```powershell
corepack pnpm test:e2e:report
```

## 証跡
Playwrightの標準成果物は以下に出力される。

- `outputs/test_evidence/playwright/raw/`
- `outputs/test_evidence/playwright/html-report/`
- `outputs/test_evidence/playwright/results.json`

顧客導線ごとのビジュアル証跡は以下に出力される。

- `outputs/test_evidence/customer_journey/<runId>/<projectName>/01-dashboard.png`
- `outputs/test_evidence/customer_journey/<runId>/<projectName>/visual-regression-manifest.json`
- `outputs/test_evidence/customer_journey/<runId>/<projectName>/ai-visual-review-prompt.md`
- `outputs/test_evidence/visual_regression/visual-regression-report.json`

`visual-regression-manifest.json` は、AI視覚レビューに渡すチェックポイント、画像パス、期待観察点、失敗候補をまとめる。
`ai-visual-review-prompt.md` は、画像比較時にそのまま使えるレビュー指示である。
`visual-regression-report.json` は、良品画像との差分率、差分ピクセル数、差分画像パスをまとめる。

## AI視覚レビューから下位テストへ落とす流れ
1. Playwrightで顧客導線を実行し、スクリーンショットとマニフェストを保存する。
2. AI視覚レビューで、主要ボタンの消失、文字はみ出し、空画面、状態メッセージ欠落を確認する。
3. 見つかった退行を、再現可能な結合テストまたは単体テストへ落とす。
4. API契約やタイムライン計算など画面外の原因がある場合は、Vitest側により小さいテストを追加する。

## TDD上の不足要素
現在の不足は以下。

- CIでPlaywrightブラウザ導入とE2E実行を行う設定がまだない
- AI視覚レビュー結果を機械判定としてCIの合否へ反映する仕組みはまだない
- 実API E2Eの実行にはPostgreSQLまたはDocker daemonの起動が必要
- E2E用DBのテストデータ破棄はまだ自動化していない

## 実API/DB/Worker E2E
実API、PostgreSQL、PgBoss、Workerを通して、ブラウザ操作から `final.mp4` 生成まで確認するE2Eを追加している。
テスト時は安定性のため、Workerは `YMM_TTS_PROVIDER=mock`、`YMM_DISABLE_REMOTION=true` で起動し、TTS音声と動画はffmpegで実生成する。

前提診断を実行する。

```powershell
corepack pnpm test:e2e:real:preflight
```

PostgreSQLをDockerで起動する。

```powershell
corepack pnpm db:up
```

DBスキーマを反映する。

```powershell
corepack pnpm db:push
```

実API E2Eを実行する。

```powershell
corepack pnpm test:e2e:real
```

診断結果は `outputs/test_evidence/real_api_e2e/preflight.json` に保存される。

2026-04-26 にこの端末で以下を確認済み。

- Preflight: 成功
- 顧客導線E2E: 成功（desktop/mobile 2 project）
- 実API/DB/Worker E2E: 成功（`final.mp4` 生成まで確認）
- Visual Regression: 3チェックポイントで差分検知（timeline desktop/mobile、preview mobile）

実行証跡は `outputs/test_evidence/` 配下に出力される。生成物ディレクトリは `.gitignore` 対象で、必要な要約はコミット対象ドキュメントへ転記する。

## 次の拡張候補
- `visual-regression-manifest.json` と前回良品を比較するAIレビュー用スクリプトを追加する
- ジョブ完了後の成果物ダウンロード、プレビュー動画確認、ログ確認まで顧客導線を拡張する
- CIで `corepack pnpm test:e2e:visual` と `corepack pnpm test:e2e:real` を段階実行する
