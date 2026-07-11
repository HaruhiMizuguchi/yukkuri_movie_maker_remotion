import "dotenv/config";

import { spawn } from "node:child_process";
import { createReadStream, promises as fs } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WORKSPACE_ROOT = process.cwd();
const DEFAULT_OUTPUT_ROOT = path.join(
  WORKSPACE_ROOT,
  "outputs",
  "production_runs",
);
const MEDIA_ROOT = path.join(WORKSPACE_ROOT, ".kamui", "movie", "media");
const FRAME_RATE = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

const BASE_SCRIPT = {
  title: "今この環境で作れるAI動画生成フロー",
  theme: "AivisSpeech実音声とRemotion演出で作る自動生成デモ",
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
      text: "使える強みは、AivisSpeech、Remotion、そして既存の高解像度素材です。",
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
      text: "映像はサイバーパンク都市と雨の路地を切り替え、ショット単位でテンポを作ります。",
    },
    {
      speaker: "魔理沙",
      text: "BGMは小さく混ぜる。主役はナレーションだから、ダッキングの優先順位を守るぜ。",
    },
    {
      speaker: "霊夢",
      text: "字幕はキーワードを強調し、章タイトルで今の工程が分かるようにします。",
    },
    {
      speaker: "霊夢",
      text: "運用で重要なのは、完成動画だけでなく、中間成果物とログを残すことです。",
    },
    {
      speaker: "魔理沙",
      text: "失敗しても、どの音声行か、どのショットか、後から追える状態にするわけだな。",
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

const BASE_CHAPTERS = [
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

const PLAN_ARTIFACTS = [
  "video_composition/composition.json",
  "video_composition/shot-plan.json",
  "video_composition/visual-plan.json",
  "video_composition/subtitle-presentation.json",
  "video_composition/audio-mix-plan.json",
  "video_composition/chapter-plan.json",
];

const RICH_FEATURES = [
  "remotion_rendering",
  "shot_planning",
  "visual_asset_rotation",
  "subtitle_emphasis",
  "audio_ducking",
  "chapter_transition",
];

const PROFILE_PRESETS = {
  production: {
    id: "production",
    lineCount: BASE_SCRIPT.lines.length,
    durationRangeSec: { min: 60, max: 120 },
    narrationPaddingMs: 2200,
    maxShotDurationMs: 4400,
    minimumSizeBytes: 5_000_000,
  },
  smoke: {
    id: "smoke",
    lineCount: 6,
    durationRangeSec: { min: 15, max: 60 },
    narrationPaddingMs: 1200,
    maxShotDurationMs: 3600,
    minimumSizeBytes: 1_000_000,
  },
};

const cliOptions = parseCliOptions(process.argv.slice(2));
const profile = createProfile(cliOptions.profile);

if (cliOptions.dryRun) {
  console.log(
    JSON.stringify(
      {
        profile: profile.id,
        title: profile.script.title,
        lineCount: profile.script.lines.length,
        renderer: "remotion",
        targetDurationSec: profile.durationRangeSec,
        steps: STEP_NAMES,
        planArtifacts: PLAN_ARTIFACTS,
        richFeatures: RICH_FEATURES,
        requiredAssets: Object.values(ASSETS).map((assetPath) =>
          toRelativeWorkspacePath(assetPath),
        ),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const main = async () => {
  const runId = createRunId();
  const outputRoot = cliOptions.outputRoot ?? DEFAULT_OUTPUT_ROOT;
  const projectId = `best-available-${runId}`;
  const projectRoot = path.join(outputRoot, runId, "projects", projectId);
  const summaryPath = path.join(outputRoot, runId, "run_summary.json");
  const logPath = path.join(projectRoot, "logs", "workflow.log");

  await ensureProjectLayout(projectRoot);
  await writeWorkflowLog(logPath, "run_start", {
    runId,
    projectId,
    profile: profile.id,
    renderer: "remotion",
  });
  await prepareCreativeInputs({
    projectRoot,
    runId,
    logPath,
    profileConfig: profile,
  });
  await ensureAssetsExist(logPath);

  const scriptPath = await writeScript(projectRoot, runId, logPath, profile);
  const ttsResult = await synthesizeNarration(
    projectRoot,
    runId,
    logPath,
    profile,
  );
  const subtitleResult = await writeSubtitles(
    projectRoot,
    runId,
    ttsResult.timestamps,
    logPath,
    profile,
  );
  const compositionResult = await composeVideo(
    projectRoot,
    runId,
    ttsResult,
    subtitleResult,
    logPath,
    profile,
  );
  const finalResult = await encodeFinal(
    projectRoot,
    runId,
    compositionResult.previewPath,
    logPath,
  );
  const verification = await verifyFinal(
    finalResult.finalPath,
    logPath,
    profile,
  );

  const summary = {
    runId,
    projectId,
    profile: profile.id,
    renderer: compositionResult.renderer,
    title: profile.script.title,
    theme: profile.script.theme,
    scriptPath,
    ttsProvider: "aivis",
    audioPath: ttsResult.narrationPath,
    subtitlesPath: subtitleResult.assPath,
    previewPath: compositionResult.previewPath,
    finalPath: finalResult.finalPath,
    finalCopyPath: finalResult.finalCopyPath,
    compositionPath: compositionResult.compositionPath,
    shotPlanPath: compositionResult.shotPlanPath,
    visualPlanPath: compositionResult.visualPlanPath,
    subtitlePresentationPath: compositionResult.subtitlePresentationPath,
    audioMixPlanPath: compositionResult.audioMixPlanPath,
    chapterPlanPath: compositionResult.chapterPlanPath,
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
    renderer: compositionResult.renderer,
  });

  console.log(JSON.stringify(summary, null, 2));
};

main().catch(async (error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exit(1);
});

function parseCliOptions(argv) {
  const options = {
    dryRun: false,
    profile: "production",
    outputRoot: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--profile") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--profile requires a value.");
      }
      options.profile = value;
      index += 1;
      continue;
    }
    if (arg === "--output-root") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--output-root requires a value.");
      }
      options.outputRoot = path.isAbsolute(value)
        ? value
        : path.resolve(WORKSPACE_ROOT, value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function createProfile(profileName) {
  const preset = PROFILE_PRESETS[profileName];
  if (!preset) {
    throw new Error(`Unknown profile: ${profileName}`);
  }

  const lines = BASE_SCRIPT.lines.slice(0, preset.lineCount);
  return {
    ...preset,
    script: {
      ...BASE_SCRIPT,
      lines,
    },
    chapters: BASE_CHAPTERS.filter(
      (chapter) => chapter.lineIndex < lines.length,
    ),
  };
}

async function prepareCreativeInputs({
  projectRoot,
  runId,
  logPath,
  profileConfig,
}) {
  const generatedScript = await generateGeminiScript(
    profileConfig.script.theme,
    profileConfig.script,
  );
  profileConfig.script = generatedScript;
  profileConfig.chapters = buildGeneratedChapters(generatedScript.lines.length);
  await writeWorkflowLog(logPath, "script_generated_with_gemini", {
    title: generatedScript.title,
    lineCount: generatedScript.lines.length,
  });

  const generatedImages = await generateGeminiImages({
    projectRoot,
    runId,
    theme: generatedScript.theme,
    title: generatedScript.title,
    logPath,
  });
  ASSETS.cityImage = generatedImages.cityImagePath;
  ASSETS.alleyImage = generatedImages.alleyImagePath;
}

function buildGeneratedChapters(lineCount) {
  const titles = BASE_CHAPTERS.map((chapter) => chapter.title);
  const indexes = titles.map((_, index) =>
    Math.min(
      lineCount - 1,
      Math.floor((lineCount * index) / Math.max(1, titles.length)),
    ),
  );
  const uniqueIndexes = indexes.map((value, index) =>
    index === 0 ? 0 : Math.max(value, indexes[index - 1] + 1),
  );
  return titles
    .map((title, index) => ({
      lineIndex: Math.min(lineCount - 1, uniqueIndexes[index]),
      title,
    }))
    .filter(
      (chapter, index, array) =>
        chapter.lineIndex >= 0 &&
        chapter.lineIndex < lineCount &&
        (index === 0 || chapter.lineIndex > array[index - 1].lineIndex),
    );
}

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
    ["input/assets", "output", "intermediate", "final", "logs", "tmp"].map(
      (dir) => fs.mkdir(path.join(projectRoot, dir), { recursive: true }),
    ),
  );
}

async function ensureAssetsExist(logPath) {
  for (const [name, assetPath] of Object.entries(ASSETS)) {
    await fs.stat(assetPath);
    await writeWorkflowLog(logPath, "asset_ready", {
      name,
      path: toRelativeWorkspacePath(assetPath),
    });
  }
}

async function generateGeminiScript(theme, fallbackScript) {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY is required for the complete video generation flow.",
    );
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
  const prompt = [
    "あなたはYouTube向けのゆっくり解説動画の脚本家です。",
    "JSONのみを返してください。",
    'schema={"title":string,"theme":string,"lines":[{"speaker":"霊夢"|"魔理沙","text":string}]}',
    "条件:",
    "- 16〜18行の掛け合いにする",
    "- 1行は25〜48文字程度の自然な日本語にする",
    "- テーマは画像生成、音声合成、字幕、映像合成、最終出力までの完全版デモ",
    "- 動画を見た人が『このシステムでここまで作れる』と分かる構成にする",
    `テーマ: ${theme}`,
    `参考タイトル: ${fallbackScript.title}`,
  ].join("\n");

  const response = await fetch(
    `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini script generation failed: HTTP ${response.status}`);
  }

  const body = await response.json();
  const text =
    body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("") ?? "";
  const parsed = JSON.parse(extractJson(text));
  if (!Array.isArray(parsed.lines) || parsed.lines.length < 12) {
    throw new Error("Gemini script response did not contain enough lines.");
  }

  return {
    title: String(parsed.title ?? fallbackScript.title),
    theme: String(parsed.theme ?? theme),
    lines: parsed.lines
      .map((line, index) => ({
        speaker:
          line.speaker === "魔理沙"
            ? "魔理沙"
            : index % 2 === 0
              ? "霊夢"
              : "魔理沙",
        text: String(line.text ?? "").trim(),
      }))
      .filter((line) => line.text.length > 0),
  };
}

async function generateGeminiImages({
  projectRoot,
  runId,
  theme,
  title,
  logPath,
}) {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is required for Gemini image generation.");
  }

  const imageDir = path.join(
    projectRoot,
    "input",
    "assets",
    "generated",
    runId,
  );
  await fs.mkdir(imageDir, { recursive: true });

  const prompts = [
    {
      key: "city",
      fileName: "gemini-city.png",
      prompt: `Cinematic wide-angle futuristic Tokyo skyline at blue hour, neon reflections, rain-soaked streets, photorealistic, no text, 16:9, theme: ${theme}, title mood: ${title}`,
    },
    {
      key: "alley",
      fileName: "gemini-alley.png",
      prompt: `Moody Japanese back alley at night with holographic signage, drifting rain mist, dramatic lighting, photorealistic, no text, 16:9, theme: ${theme}, title mood: ${title}`,
    },
  ];

  const output = {};
  for (const item of prompts) {
    const imageBase64 = await requestGeminiImageBase64(apiKey, item.prompt);
    const targetPath = path.join(imageDir, item.fileName);
    await fs.writeFile(targetPath, Buffer.from(imageBase64, "base64"));
    output[`${item.key}ImagePath`] = targetPath;
    await writeWorkflowLog(logPath, "gemini_image_generated", {
      key: item.key,
      path: toRelativeWorkspacePath(targetPath),
    });
  }

  return output;
}

async function requestGeminiImageBase64(apiKey, prompt) {
  const response = await fetch(
    `${GEMINI_API_BASE}/imagen-4.0-generate-001:predict?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "16:9",
          personGeneration: "allow_adult",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Gemini image generation failed: HTTP ${response.status} ${await response.text()}`,
    );
  }

  const body = await response.json();
  const imageBase64 =
    body.predictions?.[0]?.bytesBase64Encoded ??
    body.generatedImages?.[0]?.image?.imageBytes ??
    null;
  if (!imageBase64) {
    throw new Error(
      "Gemini image generation response did not contain image bytes.",
    );
  }
  return imageBase64;
}

function extractJson(text) {
  const trimmed = String(text ?? "").trim();
  if (trimmed.startsWith("{")) {
    return trimmed;
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || first >= last) {
    throw new Error("JSON block was not found in Gemini response.");
  }
  return trimmed.slice(first, last + 1);
}

async function writeScript(projectRoot, runId, logPath, profileConfig) {
  const runDir = await prepareStepDir(projectRoot, "script_generation", runId);
  const scriptPath = path.join(runDir, "script.json");
  await writeJson(scriptPath, profileConfig.script);
  await syncLatest(runDir);
  await writeWorkflowLog(logPath, "step_completed", {
    stepName: "script_generation",
    scriptPath,
    lineCount: profileConfig.script.lines.length,
  });
  return scriptPath;
}

async function synthesizeNarration(projectRoot, runId, logPath, profileConfig) {
  const runDir = await prepareStepDir(projectRoot, "tts_generation", runId);
  const clipsDir = path.join(runDir, "clips");
  await fs.mkdir(clipsDir, { recursive: true });

  const baseUrl = (
    process.env.AIVIS_SPEECH_BASE_URL || "http://127.0.0.1:10101"
  ).replace(/\/$/, "");
  await waitForAivisReady(baseUrl, logPath);
  const speakers = await fetchJson(`${baseUrl}/speakers`);
  const catalog = speakers.flatMap((speaker) =>
    (speaker.styles || []).map((style) => ({
      speakerName: speaker.name,
      styleName: style.name,
      styleId: style.id,
    })),
  );
  if (catalog.length === 0) {
    throw new Error("AivisSpeech styles are unavailable.");
  }

  const timestamps = [];
  const concatEntries = [];
  const usedStyleIds = [];
  let cursorMs = 0;

  for (let index = 0; index < profileConfig.script.lines.length; index += 1) {
    const line = profileConfig.script.lines[index];
    const styleId = selectStyleId(catalog, line.speaker);
    const clipPath = path.join(
      clipsDir,
      `line-${String(index + 1).padStart(3, "0")}.wav`,
    );
    const query = await fetchJson(
      `${baseUrl}/audio_query?speaker=${styleId}&text=${encodeURIComponent(line.text)}`,
      { method: "POST" },
    );

    const tunedQuery = {
      ...query,
      speedScale: line.speaker === "魔理沙" ? 1.08 : 1.02,
      intonationScale: line.speaker === "魔理沙" ? 1.12 : 1.0,
      volumeScale: 1.0,
      prePhonemeLength: 0.08,
      postPhonemeLength: 0.16,
    };
    const binary = await fetchBinary(
      `${baseUrl}/synthesis?speaker=${styleId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tunedQuery),
      },
    );
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
    "utf-8",
  );

  const rawNarrationPath = path.join(runDir, "narration.raw.wav");
  const narrationPath = path.join(runDir, "narration.wav");
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatPath,
      "-c",
      "copy",
      rawNarrationPath,
    ],
    runDir,
  );
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-i",
      rawNarrationPath,
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      narrationPath,
    ],
    runDir,
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

async function writeSubtitles(
  projectRoot,
  runId,
  timestamps,
  logPath,
  profileConfig,
) {
  const runDir = await prepareStepDir(
    projectRoot,
    "subtitle_generation",
    runId,
  );
  const assPath = path.join(runDir, "subtitles.ass");
  const subtitlesJsonPath = path.join(runDir, "subtitles.json");
  const assText = createAss(timestamps, profileConfig);
  await fs.writeFile(assPath, assText, "utf-8");
  await writeJson(
    subtitlesJsonPath,
    timestamps.map(({ index, speaker, text, startMs, endMs }) => ({
      index,
      speaker,
      text,
      startMs,
      endMs,
    })),
  );
  await syncLatest(runDir);
  await writeWorkflowLog(logPath, "step_completed", {
    stepName: "subtitle_generation",
    assPath,
    lineCount: timestamps.length,
  });
  return { runDir, assPath, subtitlesJsonPath };
}

async function composeVideo(
  projectRoot,
  runId,
  ttsResult,
  subtitleResult,
  logPath,
  profileConfig,
) {
  const runDir = await prepareStepDir(projectRoot, "video_composition", runId);
  const durationMs = Math.max(
    profileConfig.durationRangeSec.min * 1000,
    Math.ceil(ttsResult.durationSec * 1000 + profileConfig.narrationPaddingMs),
  );
  if (durationMs > profileConfig.durationRangeSec.max * 1000) {
    throw new Error(
      `Narration is too long for ${profileConfig.id}: ${ttsResult.durationSec.toFixed(3)}s`,
    );
  }

  const audioCopyPath = path.join(runDir, "narration.wav");
  const assCopyPath = path.join(runDir, "subtitles.ass");
  const shotPlanPath = path.join(runDir, "shot-plan.json");
  const visualPlanPath = path.join(runDir, "visual-plan.json");
  const subtitlePresentationPath = path.join(
    runDir,
    "subtitle-presentation.json",
  );
  const audioMixPlanPath = path.join(runDir, "audio-mix-plan.json");
  const chapterPlanPath = path.join(runDir, "chapter-plan.json");
  const compositionPath = path.join(runDir, "composition.json");
  const previewPath = path.join(runDir, "preview.mp4");

  await Promise.all([
    fs.copyFile(ttsResult.narrationPath, audioCopyPath),
    fs.copyFile(subtitleResult.assPath, assCopyPath),
  ]);

  const chapterPlan = createChapterPlan({
    timestamps: ttsResult.timestamps,
    chapters: profileConfig.chapters,
    durationMs,
  });
  const shotPlan = createShotPlan({
    timestamps: ttsResult.timestamps,
    chapters: profileConfig.chapters,
    maxShotDurationMs: profileConfig.maxShotDurationMs,
  });
  const visualPlan = await createVisualPlan({
    shotPlan,
    chapterPlan,
  });
  const subtitlePresentation = createSubtitlePresentation(ttsResult.timestamps);
  const audioMixAssets = await prepareRemotionAudioAssets({
    runDir,
    durationMs,
  });
  const audioMixPlan = createAudioMixPlan({
    durationMs,
    timestamps: ttsResult.timestamps,
    chapters: chapterPlan.chapters,
    subtitlePresentation,
    audioMixAssets,
  });

  await Promise.all([
    writeJson(shotPlanPath, shotPlan),
    writeJson(visualPlanPath, {
      assets: visualPlan.assets.map((asset) => ({
        ...asset,
        path: toRelativeWorkspacePath(asset.path),
      })),
      tracks: visualPlan.tracks,
    }),
    writeJson(subtitlePresentationPath, subtitlePresentation),
    writeJson(audioMixPlanPath, {
      ...audioMixPlan,
      assets: {
        bgmPath: toRelativeWorkspacePath(audioMixPlan.assets.bgmPath),
        ambientPath: toRelativeWorkspacePath(audioMixPlan.assets.ambientPath),
        accentPath: toRelativeWorkspacePath(audioMixPlan.assets.accentPath),
        transitionPath: toRelativeWorkspacePath(
          audioMixPlan.assets.transitionPath,
        ),
      },
    }),
    writeJson(chapterPlanPath, chapterPlan),
  ]);

  await renderWithRemotion({
    outputPath: previewPath,
    title: profileConfig.script.title,
    theme: profileConfig.script.theme,
    durationMs,
    audioPath: audioCopyPath,
    subtitleTracks: ttsResult.timestamps,
    shotPlan,
    visualPlan,
    subtitlePresentation,
    audioMixPlan,
    chapterPlan,
  });

  const composition = {
    renderer: "remotion",
    profile: profileConfig.id,
    frameRate: FRAME_RATE,
    width: WIDTH,
    height: HEIGHT,
    targetDurationSec: Number((durationMs / 1000).toFixed(3)),
    assets: Object.fromEntries(
      Object.entries(ASSETS).map(([key, assetPath]) => [
        key,
        toRelativeWorkspacePath(assetPath),
      ]),
    ),
    shotCount: shotPlan.length,
    visualTrackCount: visualPlan.tracks.length,
    emphasisCount: subtitlePresentation.emphasisCount,
    audioCueCount: audioMixPlan.seCues.length + audioMixPlan.bgmWindows.length,
    chapterCount: chapterPlan.chapters.length,
    lineCount: ttsResult.timestamps.length,
  };
  await writeJson(compositionPath, composition);
  await syncLatest(runDir);
  await writeWorkflowLog(logPath, "step_completed", {
    stepName: "video_composition",
    renderer: "remotion",
    shotCount: shotPlan.length,
    visualTrackCount: visualPlan.tracks.length,
    emphasisCount: subtitlePresentation.emphasisCount,
    audioCueCount: audioMixPlan.seCues.length + audioMixPlan.bgmWindows.length,
    chapterCount: chapterPlan.chapters.length,
    previewPath,
  });

  return {
    runDir,
    renderer: "remotion",
    previewPath,
    compositionPath,
    shotPlanPath,
    visualPlanPath,
    subtitlePresentationPath,
    audioMixPlanPath,
    chapterPlanPath,
  };
}

function createChapterPlan({ timestamps, chapters, durationMs }) {
  return {
    chapters: chapters.map((chapter, index) => {
      const startMs = timestamps[chapter.lineIndex]?.startMs ?? 0;
      const nextChapterStartMs =
        chapters[index + 1] && timestamps[chapters[index + 1].lineIndex]
          ? timestamps[chapters[index + 1].lineIndex].startMs
          : durationMs;
      return {
        id: `chapter-${String(index + 1).padStart(2, "0")}`,
        title: chapter.title,
        startMs,
        endMs: nextChapterStartMs,
        lineIndexes: [chapter.lineIndex],
        transitionDurationMs: 560,
      };
    }),
  };
}

function createShotPlan({ timestamps, chapters, maxShotDurationMs }) {
  const chapterStartIndexes = new Set(
    chapters.map((chapter) => chapter.lineIndex),
  );
  const shots = [];

  for (const item of timestamps) {
    const segmentCount = Math.max(
      1,
      Math.ceil((item.endMs - item.startMs) / maxShotDurationMs),
    );
    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const startMs =
        item.startMs +
        Math.floor(((item.endMs - item.startMs) * segmentIndex) / segmentCount);
      const endMs =
        segmentIndex === segmentCount - 1
          ? item.endMs
          : item.startMs +
            Math.floor(
              ((item.endMs - item.startMs) * (segmentIndex + 1)) / segmentCount,
            );
      const type = pickShotType({
        text: item.text,
        speaker: item.speaker,
        segmentIndex,
        segmentCount,
        chapterStart: chapterStartIndexes.has(item.index) && segmentIndex === 0,
      });
      const motion = getShotMotion(type, shots.length);
      shots.push({
        id: `shot-${String(shots.length + 1).padStart(3, "0")}`,
        type,
        startMs,
        endMs,
        lineIndexes: [item.index],
        focusSpeaker: item.speaker,
        zoomStart: motion.zoomStart,
        zoomEnd: motion.zoomEnd,
        panX: motion.panX,
        panY: motion.panY,
      });
    }
  }

  if (shots.length > 0) {
    shots[0].startMs = 0;
    shots[shots.length - 1].endMs =
      timestamps[timestamps.length - 1]?.endMs ?? shots[shots.length - 1].endMs;
  }

  return shots;
}

function pickShotType({
  text,
  speaker,
  segmentIndex,
  segmentCount,
  chapterStart,
}) {
  if (chapterStart) {
    return "wide";
  }
  if (/[0-9]+|AivisSpeech|Remotion|FFmpeg|H\.264|AAC|API/i.test(text)) {
    return "insert";
  }
  if (segmentCount > 1 && segmentIndex === segmentCount - 1) {
    return "close";
  }
  if (speaker === "魔理沙") {
    return segmentIndex % 2 === 0 ? "close" : "medium";
  }
  return segmentIndex % 2 === 0 ? "medium" : "wide";
}

function getShotMotion(type, index) {
  if (type === "wide") {
    return {
      zoomStart: 1.02,
      zoomEnd: 1.08,
      panX: index % 2 === 0 ? -0.05 : 0.05,
      panY: -0.03,
    };
  }
  if (type === "close") {
    return {
      zoomStart: 1.08,
      zoomEnd: 1.13,
      panX: index % 2 === 0 ? 0.04 : -0.04,
      panY: 0.02,
    };
  }
  if (type === "insert") {
    return {
      zoomStart: 1.04,
      zoomEnd: 1.1,
      panX: index % 2 === 0 ? 0.03 : -0.03,
      panY: -0.01,
    };
  }
  return {
    zoomStart: 1.04,
    zoomEnd: 1.09,
    panX: index % 2 === 0 ? -0.02 : 0.02,
    panY: 0,
  };
}

async function createVisualPlan({ shotPlan, chapterPlan }) {
  const assetCatalog = await buildVisualAssetCatalog();
  const cycle = ["cityImage", "alleyImage", "cityImage", "alleyImage"];
  const useCounts = new Map();
  const chapterStarts = new Map(
    chapterPlan.chapters.map((chapter) => [chapter.startMs, chapter.id]),
  );

  const tracks = shotPlan.map((shot, index) => {
    const preferredAssetId =
      shot.type === "insert"
        ? index % 2 === 0
          ? "cityImage"
          : "alleyImage"
        : cycle[index % cycle.length];
    const asset = assetCatalog[preferredAssetId];
    const useCount = useCounts.get(asset.id) ?? 0;
    useCounts.set(asset.id, useCount + 1);
    const trackDurationMs = shot.endMs - shot.startMs;
    const availableStartMs = Math.max(
      0,
      (asset.durationMs ?? 0) - trackDurationMs - 80,
    );
    const sourceStartMs =
      asset.sourceType === "video" && availableStartMs > 0
        ? (useCount * 700) % availableStartMs
        : 0;
    return {
      id: `visual-${String(index + 1).padStart(3, "0")}`,
      shotId: shot.id,
      assetId: asset.id,
      sourceType: asset.sourceType,
      startMs: shot.startMs,
      endMs: shot.endMs,
      sourceStartMs,
      zoomStart: shot.zoomStart,
      zoomEnd: shot.zoomEnd,
      panX: shot.panX,
      panY: shot.panY,
      accentColor: chapterStarts.has(shot.startMs)
        ? "rgba(245,158,11,0.85)"
        : asset.accentColor,
    };
  });

  return {
    assets: Object.values(assetCatalog),
    tracks,
  };
}

async function buildVisualAssetCatalog() {
  const [cityVideoDurationMs, alleyVideoDurationMs] = await Promise.all([
    probeMediaDurationMs(ASSETS.cityVideo),
    probeMediaDurationMs(ASSETS.alleyVideo),
  ]);

  return {
    cityVideo: {
      id: "cityVideo",
      sourceType: "video",
      path: ASSETS.cityVideo,
      durationMs: cityVideoDurationMs,
      accentColor: "rgba(59,130,246,0.62)",
    },
    alleyVideo: {
      id: "alleyVideo",
      sourceType: "video",
      path: ASSETS.alleyVideo,
      durationMs: alleyVideoDurationMs,
      accentColor: "rgba(16,185,129,0.56)",
    },
    cityImage: {
      id: "cityImage",
      sourceType: "image",
      path: ASSETS.cityImage,
      durationMs: null,
      accentColor: "rgba(96,165,250,0.5)",
    },
    alleyImage: {
      id: "alleyImage",
      sourceType: "image",
      path: ASSETS.alleyImage,
      durationMs: null,
      accentColor: "rgba(45,212,191,0.46)",
    },
  };
}

function createSubtitlePresentation(timestamps) {
  let emphasisCount = 0;
  const items = timestamps.map((item) => {
    const tokens = createSubtitleTokens(item.text);
    emphasisCount += tokens.filter((token) => token.kind === "emphasis").length;
    return {
      speaker: item.speaker,
      text: item.text,
      startMs: item.startMs,
      endMs: item.endMs,
      keywordBadge: pickKeywordBadge(tokens),
      tokens,
    };
  });

  return {
    items,
    emphasisCount,
  };
}

function createSubtitleTokens(text) {
  const emphasisPattern =
    /(AivisSpeech|Remotion|FFmpeg|H\.264|AAC|API|[0-9]+(?:\.[0-9]+)?|[ァ-ヶー]{2,})/g;
  const tokens = [];
  let cursor = 0;

  for (const match of text.matchAll(emphasisPattern)) {
    const value = match[0];
    const index = match.index ?? 0;
    if (cursor < index) {
      tokens.push({ text: text.slice(cursor, index), kind: "plain" });
    }
    const kind = /^[0-9]/.test(value) ? "secondary" : "emphasis";
    tokens.push({ text: value, kind });
    cursor = index + value.length;
  }

  if (cursor < text.length) {
    tokens.push({ text: text.slice(cursor), kind: "plain" });
  }

  return tokens.length > 0 ? tokens : [{ text, kind: "plain" }];
}

function pickKeywordBadge(tokens) {
  const candidate = tokens.find(
    (token) => token.kind === "emphasis" && token.text.length >= 2,
  );
  return candidate?.text ?? null;
}

function createAudioMixPlan({
  durationMs,
  timestamps,
  chapters,
  subtitlePresentation,
  audioMixAssets,
}) {
  const bgmWindows = [];
  let cursor = 0;
  for (const item of timestamps) {
    if (cursor < item.startMs) {
      bgmWindows.push({ startMs: cursor, endMs: item.startMs, volume: 0.14 });
    }
    bgmWindows.push({
      startMs: item.startMs,
      endMs: item.endMs,
      volume: 0.075,
    });
    cursor = item.endMs;
  }
  if (cursor < durationMs) {
    bgmWindows.push({ startMs: cursor, endMs: durationMs, volume: 0.14 });
  }

  const ambientWindows = [{ startMs: 0, endMs: durationMs, volume: 0.03 }];
  const seCues = [];

  for (const chapter of chapters) {
    seCues.push({
      id: `se-transition-${chapter.id}`,
      kind: "transition",
      assetKey: "transition",
      startMs: Math.max(0, chapter.startMs - 120),
      durationMs: 420,
      volume: 0.26,
    });
  }

  const emphasisItems = subtitlePresentation.items
    .filter((item) => item.keywordBadge)
    .slice(0, 4);
  for (const [index, item] of emphasisItems.entries()) {
    seCues.push({
      id: `se-accent-${String(index + 1).padStart(2, "0")}`,
      kind: "accent",
      assetKey: "accent",
      startMs: Math.min(durationMs - 380, item.startMs + 180),
      durationMs: 320,
      volume: 0.2,
    });
  }

  return {
    bgmWindows,
    ambientWindows,
    seCues,
    assets: {
      bgmPath: ASSETS.music,
      ambientPath: audioMixAssets.ambientPath,
      accentPath: audioMixAssets.accentPath,
      transitionPath: audioMixAssets.transitionPath,
    },
  };
}

async function prepareRemotionAudioAssets({ runDir, durationMs }) {
  const durationSec = Math.max(1, durationMs / 1000);
  const ambientPath = path.join(runDir, "ambient.wav");
  const accentPath = path.join(runDir, "accent.wav");
  const transitionPath = path.join(runDir, "transition.wav");

  // Remotion での多層ミックス用に短いSEと環境音を生成する。
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `anoisesrc=color=pink:sample_rate=48000:duration=${durationSec.toFixed(3)}`,
      "-af",
      "highpass=f=120,lowpass=f=1800",
      "-c:a",
      "pcm_s16le",
      ambientPath,
    ],
    runDir,
  );
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=960:sample_rate=48000:duration=0.320",
      "-af",
      "afade=t=out:st=0.12:d=0.20",
      "-c:a",
      "pcm_s16le",
      accentPath,
    ],
    runDir,
  );
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=420:sample_rate=48000:duration=0.420",
      "-af",
      "afade=t=in:st=0:d=0.06,afade=t=out:st=0.22:d=0.20",
      "-c:a",
      "pcm_s16le",
      transitionPath,
    ],
    runDir,
  );

  return { ambientPath, accentPath, transitionPath };
}

async function renderWithRemotion({
  outputPath,
  title,
  theme,
  durationMs,
  audioPath,
  subtitleTracks,
  shotPlan,
  visualPlan,
  subtitlePresentation,
  audioMixPlan,
  chapterPlan,
}) {
  const assetRoutes = {
    "/audio.wav": audioPath,
    "/bgm.mp3": audioMixPlan.assets.bgmPath,
    "/ambient.wav": audioMixPlan.assets.ambientPath,
    "/accent.wav": audioMixPlan.assets.accentPath,
    "/transition.wav": audioMixPlan.assets.transitionPath,
  };
  for (const asset of visualPlan.assets) {
    assetRoutes[`/visual/${asset.id}${path.extname(asset.path)}`] = asset.path;
  }

  const assetServer = await startAssetServer(assetRoutes);
  try {
    const [{ bundle }, { selectComposition, renderMedia }] = await Promise.all([
      importWorkspacePackage("@remotion/bundler"),
      importWorkspacePackage("@remotion/renderer"),
    ]);
    const entryPoint = path.join(
      WORKSPACE_ROOT,
      "packages",
      "remotion",
      "src",
      "index.tsx",
    );
    const serveUrl = await bundle({
      entryPoint,
      onProgress: () => undefined,
    });
    const inputProps = {
      title,
      theme,
      durationMs,
      audioPath: assetServer.urls["/audio.wav"],
      subtitleTracks,
      shotPlan,
      visualPlan: {
        assets: visualPlan.assets.map((asset) => ({
          ...asset,
          path: assetServer.urls[
            `/visual/${asset.id}${path.extname(asset.path)}`
          ],
        })),
        tracks: visualPlan.tracks,
      },
      subtitlePresentation,
      audioMixPlan: {
        ...audioMixPlan,
        assets: {
          bgmPath: assetServer.urls["/bgm.mp3"],
          ambientPath: assetServer.urls["/ambient.wav"],
          accentPath: assetServer.urls["/accent.wav"],
          transitionPath: assetServer.urls["/transition.wav"],
        },
      },
      chapterPlan,
    };
    const composition = await selectComposition({
      serveUrl,
      id: "YmmComposition",
      inputProps,
    });
    await renderMedia({
      codec: "h264",
      serveUrl,
      composition,
      outputLocation: outputPath,
      inputProps,
      logLevel: "error",
    });
  } finally {
    await assetServer.close();
  }
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
    runDir,
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

async function verifyFinal(finalPath, logPath, profileConfig) {
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
  if (
    verification.durationSec < profileConfig.durationRangeSec.min ||
    verification.durationSec > profileConfig.durationRangeSec.max
  ) {
    throw new Error(
      `Final duration is out of range: ${verification.durationSec}s`,
    );
  }
  if (verification.videoCodec !== "h264" || verification.audioCodec !== "aac") {
    throw new Error(
      `Unexpected codecs: video=${verification.videoCodec}, audio=${verification.audioCodec}`,
    );
  }
  if (verification.width !== WIDTH || verification.height !== HEIGHT) {
    throw new Error(
      `Unexpected resolution: ${verification.width}x${verification.height}`,
    );
  }
  if (verification.sizeBytes < profileConfig.minimumSizeBytes) {
    throw new Error(
      `Final video is too small: ${verification.sizeBytes} bytes`,
    );
  }
  await writeWorkflowLog(logPath, "verification_completed", verification);
  return verification;
}

async function waitForAivisReady(baseUrl, logPath) {
  const startedAt = Date.now();
  const deadlineMs = 90_000;
  while (Date.now() - startedAt < deadlineMs) {
    try {
      const response = await fetch(`${baseUrl}/speakers`);
      if (response.ok) {
        await writeWorkflowLog(logPath, "aivis_ready", {
          baseUrl,
          elapsedMs: Date.now() - startedAt,
        });
        return;
      }
    } catch {
      // 起動途中は接続エラーが返るため、一定時間は待機する。
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(
    `AivisSpeech did not become ready within ${deadlineMs}ms: ${baseUrl}`,
  );
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
  const preferred =
    speaker === "魔理沙"
      ? ["テンション高め", "上機嫌", "通常"]
      : ["ノーマル", "通常", "落ち着き"];
  for (const name of preferred) {
    const match = catalog.find((item) => item.styleName.includes(name));
    if (match) {
      return match.styleId;
    }
  }
  return catalog[0].styleId;
}

function createAss(timestamps, profileConfig) {
  const events = [];
  events.push(
    dialogue({
      layer: 2,
      startMs: 250,
      endMs: 5400,
      style: "Title",
      text: `${profileConfig.script.title}\\N{\\fs50}${profileConfig.script.theme}`,
    }),
  );
  events.push(
    dialogue({
      layer: 2,
      startMs: 800,
      endMs: 5400,
      style: "Note",
      text: "台本  音声  字幕  Remotion  検証",
    }),
  );

  for (const chapter of profileConfig.chapters) {
    const startMs = Math.max(0, timestamps[chapter.lineIndex]?.startMs ?? 0);
    events.push(
      dialogue({
        layer: 1,
        startMs,
        endMs: startMs + 3200,
        style: "Chapter",
        text: chapter.title,
      }),
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
      }),
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
    cs,
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
  return text
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("\r", " ")
    .replaceAll("\n", "\\N");
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
    WORKSPACE_ROOT,
  );
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not probe duration: ${targetPath}`);
  }
  return duration;
}

async function probeMediaDurationMs(targetPath) {
  const durationSec = await probeDurationSec(targetPath);
  return Math.max(1, Math.round(durationSec * 1000));
}

async function probeMedia(targetPath) {
  const stdout = await runCommand(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_streams", targetPath],
    WORKSPACE_ROOT,
  );
  return JSON.parse(stdout);
}

async function writeWorkflowLog(logPath, event, data = {}) {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(
    logPath,
    `${JSON.stringify({ at: new Date().toISOString(), event, ...data })}\n`,
    "utf-8",
  );
}

async function writeJson(targetPath, payload) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(
    targetPath,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf-8",
  );
}

function toFfmpegPath(targetPath) {
  return targetPath.replaceAll("\\", "/").replaceAll("'", "'\\''");
}

function toRelativeWorkspacePath(targetPath) {
  return path.relative(WORKSPACE_ROOT, targetPath).replaceAll("\\", "/");
}

async function importWorkspacePackage(packageName) {
  const pnpmRoot = path.join(WORKSPACE_ROOT, "node_modules", ".pnpm");
  const packagePrefix = `${packageName.replace("/", "+")}@`;
  const entries = await fs.readdir(pnpmRoot, { withFileTypes: true });
  const matched = entries.find(
    (entry) => entry.isDirectory() && entry.name.startsWith(packagePrefix),
  );
  if (!matched) {
    throw new Error(`Package was not found in pnpm store: ${packageName}`);
  }
  const entryPath = path.join(
    pnpmRoot,
    matched.name,
    "node_modules",
    ...packageName.split("/"),
    "dist",
    "index.js",
  );
  return import(pathToFileURL(entryPath).href);
}

async function startAssetServer(assetRoutes) {
  const server = createServer((request, response) => {
    const requestPath = request.url ? request.url.split("?")[0] : "/";
    const targetPath = assetRoutes[requestPath];
    if (!targetPath) {
      response.statusCode = 404;
      response.end("not found");
      return;
    }

    serveStaticAsset({ request, response, targetPath }).catch(() => {
      response.statusCode = 500;
      response.end("failed to read asset");
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine temporary asset server address.");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    urls: Object.fromEntries(
      Object.keys(assetRoutes).map((routePath) => [
        routePath,
        `${baseUrl}${routePath}`,
      ]),
    ),
    close: async () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

async function serveStaticAsset({ request, response, targetPath }) {
  const stat = await fs.stat(targetPath);
  const contentType = guessContentType(targetPath);
  const rangeHeader = request.headers.range;
  response.setHeader("Content-Type", contentType);
  response.setHeader("Accept-Ranges", "bytes");

  if (!rangeHeader) {
    response.statusCode = 200;
    response.setHeader("Content-Length", stat.size);
    createReadStream(targetPath).pipe(response);
    return;
  }

  const match = /^bytes=(\d+)-(\d+)?$/.exec(rangeHeader);
  if (!match) {
    response.statusCode = 416;
    response.end();
    return;
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : stat.size - 1;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > end ||
    end >= stat.size
  ) {
    response.statusCode = 416;
    response.end();
    return;
  }

  response.statusCode = 206;
  response.setHeader("Content-Length", end - start + 1);
  response.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
  createReadStream(targetPath, { start, end }).pipe(response);
}

function guessContentType(targetPath) {
  const extension = path.extname(targetPath).toLowerCase();
  if (extension === ".wav") {
    return "audio/wav";
  }
  if (extension === ".mp3") {
    return "audio/mpeg";
  }
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  if (extension === ".mp4") {
    return "video/mp4";
  }
  return "application/octet-stream";
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
            commandArgs,
          )}\n${stderr}`,
        ),
      );
    });
  });
}
