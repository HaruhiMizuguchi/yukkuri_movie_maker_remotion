# リッチ動画化設計メモ（2026-04-21）

## 目的
- 動画合成の主導権を FFmpeg から Remotion へ移し、演出ロジックを TypeScript/React で表現できる状態にする
- 現在の MVP 縦串を壊さずに、ショット割り、キャラクター演技、字幕強調、音響演出、章トランジションを段階的に追加する
- 各機能の中間成果物と判断根拠を JSON/ログに残し、失敗時の原因追跡を容易にする

## 今回追加する機能
1. Remotion 優先の映像演出基盤
2. 台本・字幕タイミングからの自動ショット割り
3. 口パク、まばたき、表情切替
4. キーワード強調付き字幕
5. SE・環境音・BGM ダッキング
6. 章切り替えトランジション

## 全体方針
- `video_composition` は Remotion を正規経路にし、Remotion で表現可能な映像・字幕・音響演出はすべて Remotion 側で実装する
- 各演出は「生成計画 JSON」と「Remotion 入力 props」に分ける
- 生成計画は `packages/core` で作成し、描画は `packages/remotion` に閉じ込める
- フォールバックはテスト都合の `disableRemotion` に限定し、通常実行での暗黙 FFmpeg フォールバックは避ける

## アーキテクチャ

### 1. Core 側
- `packages/core` に演出計画生成モジュールを追加する
- `video_composition` では以下を出力する
  - `shot-plan.json`
  - `character-performance.json`
  - `subtitle-presentation.json`
  - `audio-mix-plan.json`
  - `chapter-plan.json`
  - `composition.json`
- `composition.json` には、どの演出が有効だったか、Remotion の入力 props、素材の相対パス、観測用サマリを残す

### 2. Remotion 側
- `packages/remotion/src/yukkuri/YmmComposition.tsx` をリッチ化し、次を描画する
  - 背景のズーム/パン
  - キャラクターの位置・スケール・口パク・まばたき・表情
  - 字幕の色替え・ハイライト・ポップ表示
  - 章トランジションの帯・フラッシュ・見出し
  - BGM/SE/環境音とナレーションの同時再生

### 3. Observability
- `logs/workflow.log` と `logs/step-video_composition.log` に以下を記録する
  - renderer
  - shot 数
  - chapter 数
  - emphasis token 数
  - audio cue 数
  - キャラクター演技 cue 数
- `composition.json` にも同じ要約値を残し、成果物の見た目と内部計画を突き合わせ可能にする

## 機能別設計

### A. Remotion 優先の映像演出基盤
#### 設計
- `video_composition` の正式 renderer を `remotion` にする
- `disableRemotion` 指定時のみ FFmpeg 合成を許可する
- Remotion 入力 props を組み立てる純関数を用意し、描画ロジックと I/O を分離する

#### テスト設計
- Unit: Remotion 入力 props に必要な各計画が統合されること
- Integration: `video_composition` 実行で `composition.json.renderer === "remotion"` になること
- Regression: `preview.mp4` が生成され、`ffprobe` で映像・音声ストリームが確認できること

### B. 自動ショット割り
#### 設計
- 台本行、字幕長、話者交代、章開始位置からショット境界を決める
- ショット種別は `wide`, `medium`, `close`, `insert` を持つ
- 背景が 1 枚でも、ズーム率・パン位置・字幕帯の余白を変えて単調さを減らす

#### テスト設計
- Unit: 話者交代や章切り替え時にショットが分割されること
- Unit: 合計ショット尺がナレーション尺と整合すること
- Integration: `shot-plan.json` が生成され、`composition.json` に要約値が載ること

### C. 口パク・まばたき・表情切替
#### 設計
- 字幕タイミングから発話区間を取り、開閉パターンを生成する
- まばたきは自然に見える固定間隔 + ジッタで生成する
- 表情は `emotion`、句読点、強調語から `normal`, `happy`, `serious`, `surprised` を推定する

#### テスト設計
- Unit: 発話区間から mouth cue が生成されること
- Unit: 長尺区間で blink cue が複数入ること
- Unit: 強調文で surprised/serious が選ばれること
- Integration: `character-performance.json` が生成されること

### D. 字幕強調
#### 設計
- 文中から重要語を抽出し、`emphasis` と `secondary` に分類する
- 強調語は色、拡大、ハイライト帯、ポップアニメーションで表現する
- 字幕全体と別に、短いキーワードカードを上部または中段に出せるようにする

#### テスト設計
- Unit: 数字、カタカナ語、括弧内、長文末尾の結論語を強調対象として抽出できること
- Unit: 1 行あたりの強調数が過剰にならないこと
- Integration: `subtitle-presentation.json` に token 情報が出ること

### E. SE・環境音・BGM ダッキング
#### 設計
- ナレーション音声を主軸にし、BGM は発話中に減衰、無音寄り区間で少し戻す
- 章切り替えに `whoosh`、強調語に `hit`、背景に軽い環境音を差し込む
- 音量カーブは Remotion の `volume` コールバックで制御する

#### テスト設計
- Unit: 発話区間に重なる BGM volume が下がること
- Unit: chapter cue から SE cue が生成されること
- Integration: `audio-mix-plan.json` に narration/bgm/se の cue 数が残ること

### F. 章トランジション
#### 設計
- 章ごとに見出し、帯、短い発光/スライドを入れる
- 章トランジションは 12〜20 フレーム程度の短尺に抑え、テンポを崩さない
- 冒頭タイトルと章見出しを同じ視覚系譜で統一する

#### テスト設計
- Unit: 章開始位置から transition cue が生成されること
- Unit: 章タイトルの重なり時間が過剰でないこと
- Integration: `chapter-plan.json` に title/transition 情報が残ること

## 実装順
1. Remotion 優先の映像演出基盤
2. 自動ショット割り
3. 口パク・まばたき・表情切替
4. 字幕強調
5. SE・環境音・BGM ダッキング
6. 章トランジション

## コミット方針
- 各機能で以下を 1 コミットにまとめる
  - 先に failing test を追加
  - 実装
  - `docs/dev_tasks_breakdown.md` の進捗更新
  - 必要なら本ドキュメントの仕様追記

## リスク
- Remotion 側の依存解決が崩れると `video_composition` の正規経路が停止する
- 音響演出は素材不在時に見た目だけ豪華で音が破綻する可能性があるため、フォールバック素材生成が必要
- 字幕強調やトランジションを盛りすぎると可読性が落ちるため、上限値を設ける
