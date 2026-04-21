import "dotenv/config";

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();
const OUTPUT_ROOT = path.join(WORKSPACE_ROOT, "outputs", "production_runs");
const MEDIA_ROOT = path.join(WORKSPACE_ROOT, ".kamui", "movie", "media");
const FRAME_RATE = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

const SCRIPT = {
  title: "今この環境で作れるAI動画生成フロー",
  theme: "AivisSpeech実音声とFFmpeg演出で作る一分台の自動生成デモ",
  lines: [
    {
      speaker: "霊夢",
      text: "今日は、この環境で今できる動画生成を、一本の完成品として見せます。",
    },
    {
      speaker: "魔理沙",
      text: "テスト用の確認じゃなく、台本、音声、字幕、映像、最終エンコードまで通すぜ。",
    },
    {
      speaker: "霊夢",
      text: "使える強みは、AivisSpeech、FFmpeg、そして既存の高解像度素材です。",
    },
    {
      speaker: "魔理沙",
      text: "外部LLMがクォータで止まっても、制作そのものは止めない構成にするんだ。",
    },
    {
      speaker: "霊夢",
      text: "台本は、結論、素材、音声、検証の順に並べ、視聴者が迷わない流れにします。",
    },
    {
      speaker: "魔理沙",
      text: "一画面一メッセージを守る。情報を詰め込みすぎないのがコツだぜ。",
    },
    {
      speaker: "霊夢",
      text: "音声はAivisSpeechへ実接続し、話者スタイルを自動で選んで生成します。",
    },
    {
      speaker: "魔理沙",
      text: "一つの話者でも、通常とテンション高めを使えば、掛け合いの役割を分けられるぜ。",
    },
    {
      speaker: "霊夢",
      text: "生成した音声は一行ごとに保存し、実測した長さを字幕タイミングへ反映します。",
    },
    {
      speaker: "霊夢",
      text: "映像はサイバーパンク都市と雨の路地を組み合わせ、ズームとカットでテンポを作ります。",
    },
    {
      speaker: "魔理沙",
      text: "背景音楽は小さく混ぜる。主役はナレーションだから、音量の優先順位を守るぜ。",
    },
    {
      speaker: "霊夢",
      text: "字幕は大きく、縁取りを厚くし、章タイトルで今の工程が分かるようにします。",
    },
    {
      speaker: "霊夢",
      text: "運用で重要なのは、完成動画だけでなく、中間成果物とログを残すことです。",
    },
    {
      speaker: "魔理沙",
      text: "失敗しても、どの音声行か、どの合成ステップか、後から追える状態にするわけだな。",
    },
    {
      speaker: "魔理沙",
      text: "最後はH.264とAACで再エンコードし、長さ、解像度、コーデックまで検証するぜ。",
    },
    {
      speaker: "霊夢",
      text: "結論です。今この環境だけでも、一分台の解説動画を実音声つきで最後まで生成できます。",
    },
    {
      speaker: "霊夢",
      text: "次は専用立ち絵と画像生成APIを足せば、さらに完成度を上げられます。",
    },
  ],
};

const CHAPTERS = [
  { lineIndex: 0, title: "現在の生成力" },
  { lineIndex: 4, title: "台本設計" },
  { lineIndex: 6, title: "実音声生成" },
  { lineIndex: 9, title: "映像と字幕" },
  { lineIndex: 12, title: "検証と運用" },
  { lineIndex: 15, title: "結論" },
];

const ASSETS = {
  cityVideo: path.join(MEDIA_ROOT, "cyberpunk-city-flight.mp4"),
  alleyVideo: path.join(MEDIA_ROOT, "japanese-alley-night.mp4"),
  cityImage: path.join(MEDIA_ROOT, "cyberpunk-cityscape.png"),
  alleyImage: path.join(MEDIA_ROOT, "japanese-alley-scene.png"),
  music: path.join(MEDIA_ROOT, "neon-dreams.mp3"),
};

const STEP_NAMES = [
  "script_generation",
  "tts_generation",
  "subtitle_generation",
  "video_composition",
  "final_encoding",
  "verification",
];

const args = new Set(process.argv.slice(2));

if (args.has("--dry-run")) {
  console.log(
    JSON.stringify(
      {
        title: SCRIPT.title,
        lineCount: SCRIPT.lines.length,
        targetDurationSec: { min: 60, max: 120 },
        steps: STEP_NAMES,
        requiredAssets: Object.values(ASSETS).map((assetPath) =>
          path.relative(WORKSPACE_ROOT, assetPath).replaceAll("\\", "/")
        ),
      },
      null,
      2
    )
  );
  process.exit(0);
}

const main = async () => {
  // 今回の実生成は、既存ワークフローと同じ粒度で中間成果物を保存する。
  const runId = createRunId();
  const projectId = `best-available-${runId}`;
  const projectRoot = path.join(OUTPUT_ROOT, runId, "projects", projectId);
  const summaryPath = path.join(OUTPUT_ROOT, runId, "run_summary.json");
  const logPath = path.join(projectRoot, "logs", "workflow.log");

  await ensureProjectLayout(projectRoot);
  await writeWorkflowLog(logPath, "run_start", { runId, projectId });
  await ensureAssetsExist(logPath);

  const scriptPath = await writeScript(projectRoot, runId, logPath);
  const ttsResult = await synthesizeNarration(projectRoot, runId, logPath);
  const subtitleResult = await writeSubtitles(projectRoot, runId, ttsResult.timestamps, logPath);
  const compositionResult = await composeVideo(projectRoot, runId, ttsResult, subtitleResult, logPath);
  const finalResult = await encodeFinal(projectRoot, runId, compositionResult.previewPath, logPath);
  const verification = await verifyFinal(finalResult.finalPath, logPath);

  const summary = {
    runId,
    projectId,
    title: SCRIPT.title,
    theme: SCRIPT.theme,
    scriptPath,
    ttsProvider: "aivis",
    audioPath: ttsResult.narrationPath,
    subtitlesPath: subtitleResult.assPath,
    previewPath: compositionResult.previewPath,
    finalPath: finalResult.finalPath,
    finalCopyPath: finalResult.finalCopyPath,
    workflowLogPath: logPath,
    durationSec: verification.durationSec,
    verification,
    generatedAt: new Date().toISOString(),
  };
  await writeJson(summaryPath, summary);
  await writeWorkflowLog(logPath, "run_completed", {
    finalPath: finalResult.finalPath,
    durationSec: verification.durationSec,
    sizeBytes: verification.sizeBytes,
  });

  console.log(JSON.stringify(summary, null, 2));
};

main().catch(async (error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

function createRunId() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ];
  return `run-${parts.join("")}-${String(now.getMilliseconds()).padStart(3, "0")}`;
}

async function ensureProjectLayout(projectRoot) {
  await Promise.all(
    ["input/assets", "output", "intermediate", "final", "logs", "tmp"].map((dir) =>
      fs.mkdir(path.join(projectRoot, dir), { recursive: true })
    )
  );
}

async function ensureAssetsExist(logPath) {
  for (const [name, assetPath] of Object.entries(ASSETS)) {
    await fs.stat(assetPath);
    await writeWorkflowLog(logPath, "asset_ready", {
      name,
      path: path.relative(WORKSPACE_ROOT, assetPath).replaceAll("\\", "/"),
    });
  }
}

async function writeScript(projectRoot, runId, logPath) {
  const runDir = await prepareStepDir(projectRoot, "script_generation", runId);
  const scriptPath = path.join(runDir, "script.json");
  await writeJson(scriptPath, SCRIPT);
  await syncLatest(runDir);
  await writeWorkflowLog(logPath, "step_completed", {
    stepName: "script_generation",
    scriptPath,
    lineCount: SCRIPT.lines.length,
  });
  return scriptPath;
}

async function synthesizeNarration(projectRoot, runId, logPath) {
  const runDir = await prepareStepDir(projectRoot, "tts_generation", runId);
  const clipsDir = path.join(runDir, "clips");
  await fs.mkdir(clipsDir, { recursive: true });

  const baseUrl = (process.env.AIVIS_SPEECH_BASE_URL || "http://127.0.0.1:10101").replace(
    /\/$/,
    ""
  );
  const speakers = await fetchJson(`${baseUrl}/speakers`);
  const catalog = speakers.flatMap((speaker) =>
    (speaker.styles || []).map((style) => ({
      speakerName: speaker.name,
      styleName: style.name,
      styleId: style.id,
    }))
  );
  if (catalog.length === 0) {
    throw new Error("AivisSpeech styles are unavailable.");
  }

  const timestamps = [];
  const concatEntries = [];
  const usedStyleIds = [];
  let cursorMs = 0;

  for (let index = 0; index < SCRIPT.lines.length; index += 1) {
    const line = SCRIPT.lines[index];
    const styleId = selectStyleId(catalog, line.speaker);
    const clipPath = path.join(clipsDir, `line-${String(index + 1).padStart(3, "0")}.wav`);
    const query = await fetchJson(
      `${baseUrl}/audio_query?speaker=${styleId}&text=${encodeURIComponent(line.text)}`,
      { method: "POST" }
    );

    const tunedQuery = {
      ...query,
      speedScale: line.speaker === "魔理沙" ? 1.08 : 1.02,
      intonationScale: line.speaker === "魔理沙" ? 1.12 : 1.0,
      volumeScale: 1.0,
      prePhonemeLength: 0.08,
      postPhonemeLength: 0.16,
    };
    const binary = await fetchBinary(`${baseUrl}/synthesis?speaker=${styleId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tunedQuery),
    });
    await fs.writeFile(clipPath, binary);

    const durationMs = Math.round((await probeDurationSec(clipPath)) * 1000);
    timestamps.push({
      index,
      speaker: line.speaker,
      text: line.text,
      startMs: cursorMs,
      endMs: cursorMs + durationMs,
      styleId,
    });
    cursorMs += durationMs;
    concatEntries.push(clipPath);
    usedStyleIds.push(styleId);
    await writeWorkflowLog(logPath, "tts_clip_completed", {
      index,
      speaker: line.speaker,
      styleId,
      durationMs,
    });
  }

  const concatPath = path.join(clipsDir, "concat.txt");
  await fs.writeFile(
    concatPath,
    `${concatEntries.map((clipPath) => `file '${toFfmpegPath(clipPath)}'`).join("\n")}\n`,
    "utf-8"
  );

  const rawNarrationPath = path.join(runDir, "narration.raw.wav");
  const narrationPath = path.join(runDir, "narration.wav");
  await runCommand(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", rawNarrationPath],
    runDir
  );
  await runCommand(
    "ffmpeg",
    ["-y", "-i", rawNarrationPath, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", narrationPath],
    runDir
  );

  const timestampsPath = path.join(runDir, "timestamps.json");
  await writeJson(timestampsPath, timestamps);
  await syncLatest(runDir);
  await writeWorkflowLog(logPath, "step_completed", {
    stepName: "tts_generation",
    provider: "aivis",
    durationMs: cursorMs,
    usedStyleIds: [...new Set(usedStyleIds)],
  });

  return {
    runDir,
    narrationPath,
    timestampsPath,
    timestamps,
    durationSec: cursorMs / 1000,
    usedStyleIds: [...new Set(usedStyleIds)],
  };
}

async function writeSubtitles(projectRoot, runId, timestamps, logPath) {
  const runDir = await prepareStepDir(projectRoot, "subtitle_generation", runId);
  const assPath = path.join(runDir, "subtitles.ass");
  const subtitlesJsonPath = path.join(runDir, "subtitles.json");
  const assText = createAss(timestamps);
  await fs.writeFile(assPath, assText, "utf-8");
  await writeJson(
    subtitlesJsonPath,
    timestamps.map(({ index, speaker, text, startMs, endMs }) => ({
      index,
      speaker,
      text,
      startMs,
      endMs,
    }))
  );
  await syncLatest(runDir);
  await writeWorkflowLog(logPath, "step_completed", {
    stepName: "subtitle_generation",
    assPath,
    lineCount: timestamps.length,
  });
  return { runDir, assPath, subtitlesJsonPath };
}

async function composeVideo(projectRoot, runId, ttsResult, subtitleResult, logPath) {
  const runDir = await prepareStepDir(projectRoot, "video_composition", runId);
  const targetDuration = Math.max(62, Math.ceil(ttsResult.durationSec + 2.5));
  if (targetDuration > 120) {
    throw new Error(
      `Narration is too long for a 1-2 minute deliverable: ${ttsResult.durationSec.toFixed(3)}s`
    );
  }
  const baseVisualPath = path.join(runDir, "base_visual.mp4");
  const previewPath = path.join(runDir, "preview.mp4");
  const segmentPaths = await createVisualSegments(runDir, targetDuration, logPath);
  const concatPath = path.join(runDir, "segments.txt");
  await fs.writeFile(
    concatPath,
    `${segmentPaths.map((segmentPath) => `file '${toFfmpegPath(segmentPath)}'`).join("\n")}\n`,
    "utf-8"
  );
  await runCommand(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", baseVisualPath],
    runDir
  );

  const assCopyPath = path.join(runDir, "subtitles.ass");
  await fs.copyFile(subtitleResult.assPath, assCopyPath);
  await fs.copyFile(ttsResult.narrationPath, path.join(runDir, "narration.wav"));

  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-i",
      baseVisualPath,
      "-i",
      "narration.wav",
      "-stream_loop",
      "-1",
      "-i",
      ASSETS.music,
      "-filter_complex",
      `[0:v]ass=subtitles.ass[v];[1:a]apad=pad_dur=2.2[narr];[2:a]volume=0.085,atrim=0:${targetDuration.toFixed(
        3
      )}[music];[narr][music]amix=inputs=2:duration=first:dropout_transition=1,alimiter=limit=0.95[a]`,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-t",
      targetDuration.toFixed(3),
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      previewPath,
    ],
    runDir
  );

  const compositionPath = path.join(runDir, "composition.json");
  await writeJson(compositionPath, {
    renderer: "ffmpeg",
    frameRate: FRAME_RATE,
    width: WIDTH,
    height: HEIGHT,
    targetDurationSec: targetDuration,
    assets: Object.fromEntries(
      Object.entries(ASSETS).map(([key, assetPath]) => [
        key,
        path.relative(WORKSPACE_ROOT, assetPath).replaceAll("\\", "/"),
      ])
    ),
  });
  await syncLatest(runDir);
  await writeWorkflowLog(logPath, "step_completed", {
    stepName: "video_composition",
    previewPath,
    targetDuration,
  });
  return { runDir, previewPath, baseVisualPath, compositionPath, targetDuration };
}

async function createVisualSegments(runDir, targetDuration, logPath) {
  const segmentPlan = buildSegmentPlan(targetDuration);
  const segmentPaths = [];
  for (let index = 0; index < segmentPlan.length; index += 1) {
    const segment = segmentPlan[index];
    const outputPath = path.join(runDir, `segment-${String(index + 1).padStart(2, "0")}.mp4`);
    if (segment.kind === "image") {
      const frames = Math.max(1, Math.round(segment.duration * FRAME_RATE));
      await runCommand(
        "ffmpeg",
        [
          "-y",
          "-loop",
          "1",
          "-i",
          segment.source,
          "-vf",
          `scale=${WIDTH}:${HEIGHT},zoompan=z='min(zoom+0.00065,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FRAME_RATE},format=yuv420p`,
          "-frames:v",
          String(frames),
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "18",
          "-pix_fmt",
          "yuv420p",
          outputPath,
        ],
        runDir
      );
    } else {
      await runCommand(
        "ffmpeg",
        [
          "-y",
          "-stream_loop",
          "-1",
          "-i",
          segment.source,
          "-t",
          segment.duration.toFixed(3),
          "-vf",
          `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},fps=${FRAME_RATE},format=yuv420p`,
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "18",
          "-pix_fmt",
          "yuv420p",
          outputPath,
        ],
        runDir
      );
    }
    segmentPaths.push(outputPath);
    await writeWorkflowLog(logPath, "visual_segment_completed", {
      index,
      kind: segment.kind,
      duration: segment.duration,
      outputPath,
    });
  }
  return segmentPaths;
}

function buildSegmentPlan(targetDuration) {
  const raw = [
    { kind: "image", source: ASSETS.cityImage, weight: 0.18 },
    { kind: "video", source: ASSETS.cityVideo, weight: 0.18 },
    { kind: "image", source: ASSETS.alleyImage, weight: 0.2 },
    { kind: "video", source: ASSETS.alleyVideo, weight: 0.18 },
    { kind: "image", source: ASSETS.cityImage, weight: 0.14 },
    { kind: "video", source: ASSETS.cityVideo, weight: 0.12 },
  ];
  const durations = raw.map((item) => Math.max(5, Math.round(targetDuration * item.weight)));
  const delta = targetDuration - durations.reduce((sum, duration) => sum + duration, 0);
  durations[durations.length - 1] += delta;
  return raw.map((item, index) => ({ ...item, duration: durations[index] }));
}

async function encodeFinal(projectRoot, runId, previewPath, logPath) {
  const runDir = await prepareStepDir(projectRoot, "final_encoding", runId);
  const finalPath = path.join(runDir, "final.mp4");
  const finalCopyPath = path.join(projectRoot, "final", "final.mp4");
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-i",
      previewPath,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-profile:v",
      "high",
      "-level:v",
      "4.2",
      "-pix_fmt",
      "yuv420p",
      "-b:v",
      "9000k",
      "-maxrate",
      "12000k",
      "-bufsize",
      "18000k",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      finalPath,
    ],
    runDir
  );
  await fs.copyFile(finalPath, finalCopyPath);
  await syncLatest(runDir);
  await writeWorkflowLog(logPath, "step_completed", {
    stepName: "final_encoding",
    finalPath,
    finalCopyPath,
  });
  return { runDir, finalPath, finalCopyPath };
}

async function verifyFinal(finalPath, logPath) {
  const durationSec = await probeDurationSec(finalPath);
  const media = await probeMedia(finalPath);
  const stat = await fs.stat(finalPath);
  const video = media.streams.find((stream) => stream.codec_type === "video");
  const audio = media.streams.find((stream) => stream.codec_type === "audio");
  const verification = {
    finalPath,
    durationSec: Number(durationSec.toFixed(3)),
    sizeBytes: stat.size,
    videoCodec: video?.codec_name,
    audioCodec: audio?.codec_name,
    width: video?.width,
    height: video?.height,
  };
  if (verification.durationSec < 60 || verification.durationSec > 120) {
    throw new Error(`Final duration is out of range: ${verification.durationSec}s`);
  }
  if (verification.videoCodec !== "h264" || verification.audioCodec !== "aac") {
    throw new Error(
      `Unexpected codecs: video=${verification.videoCodec}, audio=${verification.audioCodec}`
    );
  }
  if (verification.width !== WIDTH || verification.height !== HEIGHT) {
    throw new Error(`Unexpected resolution: ${verification.width}x${verification.height}`);
  }
  if (verification.sizeBytes < 5_000_000) {
    throw new Error(`Final video is too small: ${verification.sizeBytes} bytes`);
  }
  await writeWorkflowLog(logPath, "verification_completed", verification);
  return verification;
}

async function prepareStepDir(projectRoot, stepName, runId) {
  const runDir = path.join(projectRoot, "output", stepName, runId);
  await fs.mkdir(runDir, { recursive: true });
  return runDir;
}

async function syncLatest(runDir) {
  const latestDir = path.join(path.dirname(runDir), "latest");
  await fs.rm(latestDir, { recursive: true, force: true });
  await fs.cp(runDir, latestDir, { recursive: true });
}

function selectStyleId(catalog, speaker) {
  const preferred = speaker === "魔理沙" ? ["テンション高め", "上機嫌", "通常"] : ["ノーマル", "通常", "落ち着き"];
  for (const name of preferred) {
    const match = catalog.find((item) => item.styleName.includes(name));
    if (match) {
      return match.styleId;
    }
  }
  return catalog[0].styleId;
}

function createAss(timestamps) {
  // ASS字幕に章タイトルも同居させ、映像合成時の文字入れを一箇所で管理する。
  const events = [];
  events.push(
    dialogue({
      layer: 2,
      startMs: 250,
      endMs: 6400,
      style: "Title",
      text: `${SCRIPT.title}\\N{\\fs50}${SCRIPT.theme}`,
    })
  );
  events.push(
    dialogue({
      layer: 2,
      startMs: 800,
      endMs: 6400,
      style: "Note",
      text: "台本  音声  字幕  映像  検証",
    })
  );

  for (const chapter of CHAPTERS) {
    const startMs = Math.max(0, timestamps[chapter.lineIndex]?.startMs ?? 0);
    events.push(
      dialogue({
        layer: 1,
        startMs,
        endMs: startMs + 3600,
        style: "Chapter",
        text: chapter.title,
      })
    );
  }

  for (const item of timestamps) {
    events.push(
      dialogue({
        layer: 3,
        startMs: item.startMs,
        endMs: item.endMs,
        style: item.speaker === "魔理沙" ? "Marisa" : "Reimu",
        text: `${item.speaker}: ${wrapJapanese(item.text, 25)}`,
      })
    );
  }

  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${WIDTH}
PlayResY: ${HEIGHT}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Reimu,Yu Gothic UI Semibold,64,&H00FFFFFF,&H000000FF,&H002C7A33,&HAA000000,-1,0,0,0,100,100,0,0,1,5,1,2,90,90,72,1
Style: Marisa,Yu Gothic UI Semibold,64,&H00FFF2B8,&H000000FF,&H003C2A00,&HAA000000,-1,0,0,0,100,100,0,0,1,5,1,2,90,90,72,1
Style: Title,Yu Gothic UI Semibold,78,&H00FFFFFF,&H000000FF,&H00333333,&HAA000000,-1,0,0,0,100,100,0,0,1,4,2,8,70,70,78,1
Style: Note,Yu Gothic UI Semibold,42,&H00D8FFF6,&H000000FF,&H00402000,&H99000000,-1,0,0,0,100,100,0,0,1,3,1,8,70,70,228,1
Style: Chapter,Yu Gothic UI Semibold,48,&H00FFFFFF,&H000000FF,&H005D2B00,&HAA000000,-1,0,0,0,100,100,0,0,1,3,1,7,76,76,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
}

function dialogue({ layer, startMs, endMs, style, text }) {
  return `Dialogue: ${layer},${toAssTime(startMs)},${toAssTime(endMs)},${style},,0,0,0,,${escapeAss(text)}`;
}

function toAssTime(ms) {
  const centiseconds = Math.max(0, Math.floor(ms / 10));
  const cs = centiseconds % 100;
  const totalSeconds = Math.floor(centiseconds / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
    cs
  ).padStart(2, "0")}`;
}

function wrapJapanese(text, width) {
  const chars = [...text];
  if (chars.length <= width) {
    return text;
  }
  const lines = [];
  for (let index = 0; index < chars.length; index += width) {
    lines.push(chars.slice(index, index + width).join(""));
  }
  return lines.join("\\N");
}

function escapeAss(text) {
  return text.replaceAll("{", "\\{").replaceAll("}", "\\}").replaceAll("\r", " ").replaceAll("\n", "\\N");
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function fetchBinary(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function probeDurationSec(targetPath) {
  const stdout = await runCommand(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      targetPath,
    ],
    WORKSPACE_ROOT
  );
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not probe duration: ${targetPath}`);
  }
  return duration;
}

async function probeMedia(targetPath) {
  const stdout = await runCommand(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_streams", targetPath],
    WORKSPACE_ROOT
  );
  return JSON.parse(stdout);
}

async function writeWorkflowLog(logPath, event, data = {}) {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(
    logPath,
    `${JSON.stringify({ at: new Date().toISOString(), event, ...data })}\n`,
    "utf-8"
  );
}

async function writeJson(targetPath, payload) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

function toFfmpegPath(targetPath) {
  return targetPath.replaceAll("\\", "/").replaceAll("'", "'\\''");
}

async function runCommand(command, commandArgs, cwd) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(command, commandArgs, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      const elapsedMs = Date.now() - startedAt;
      reject(
        new Error(
          `${command} exited with code ${code} after ${elapsedMs}ms\nargs=${JSON.stringify(
            commandArgs
          )}\n${stderr}`
        )
      );
    });
  });
}
