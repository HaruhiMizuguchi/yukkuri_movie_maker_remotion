import React from "react";

export const styleText = `
:root {
  color-scheme: dark;
  --bg: #0b0b0f;
  --surface-base: #101116;
  --surface: #14151b;
  --surface-raised: #1a1b22;
  --surface-high: #20212a;
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.14);
  --fg: #f4f4f5;
  --fg-secondary: #a1a1aa;
  --fg-tertiary: #71717a;
  --accent: #8b5cf6;
  --accent-strong: #7c3aed;
  --accent-soft: rgba(139, 92, 246, 0.14);
  --accent-fg: #ede9fe;
  --success: #34d399;
  --warning: #fbbf24;
  --danger: #fb7185;
  --shadow-panel: 0 18px 54px rgba(0, 0, 0, 0.22);
}
* {
  box-sizing: border-box;
}
html {
  background: var(--bg);
}
body {
  margin: 0;
  min-width: 320px;
  background:
    radial-gradient(circle at 48% -16%, rgba(124, 58, 237, 0.13), transparent 36rem),
    linear-gradient(180deg, #0d0d12 0%, var(--bg) 42%, #09090c 100%);
  color: var(--fg);
  font-family: Inter, "Noto Sans JP", "Yu Gothic UI", "Hiragino Kaku Gothic ProN", system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
button, input, textarea, select {
  font: inherit;
}
button, a, summary {
  -webkit-tap-highlight-color: transparent;
}
::selection {
  background: rgba(139, 92, 246, 0.34);
  color: #fff;
}
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  background-clip: padding-box;
}
.home-tab, .home-tab-active {
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 10px 14px;
  background: transparent;
  color: var(--fg-secondary);
  cursor: pointer;
  transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
  white-space: nowrap;
}
.home-tab:hover, .home-tab-active:hover, .stage-tab:hover, .stage-tab-active:hover {
  color: var(--fg);
}
.home-tab-active {
  border-color: rgba(167, 139, 250, 0.2);
  background: var(--accent-soft);
  color: var(--accent-fg);
  font-weight: 650;
}
.stage-tab, .stage-tab-active {
  flex: 1 1 150px;
  min-width: 136px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 9px 10px;
  display: flex;
  gap: 9px;
  align-items: center;
  text-align: left;
  background: rgba(255, 255, 255, 0.025);
  color: var(--fg-secondary);
  cursor: pointer;
  transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
}
.stage-tab-active {
  border-color: rgba(167, 139, 250, 0.28);
  background: var(--surface-raised);
  color: var(--fg);
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.06) inset;
}
.stage-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--fg-secondary);
  background: var(--surface-high);
  font-weight: 750;
}
.stage-tab-active .stage-number {
  color: #fff;
  background: var(--accent);
}
.stage-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}
.stage-copy small {
  opacity: .7;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
button:disabled {
  opacity: .38;
  cursor: not-allowed;
  transform: none !important;
}
button:not(:disabled) {
  transition: transform 150ms ease, border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}
button:not(:disabled):active {
  transform: translateY(1px);
}
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, summary:focus-visible, a:focus-visible {
  outline: 3px solid rgba(167, 139, 250, 0.82);
  outline-offset: 3px;
}
@keyframes generationPulse {
  0%, 100% { transform: scale(.9); opacity: .68; }
  50% { transform: scale(1.08); opacity: 1; }
}
.generation-pulse {
  animation: generationPulse 1.25s ease-in-out infinite;
}
summary {
  cursor: pointer;
  color: var(--fg-secondary);
}
@media (max-width: 1100px) {
  .timeline-studio-top, .timeline-editor-grid, .script-editor-workspace, .asset-upload-workspace, .delivery-review-workspace {
    grid-template-columns: 1fr !important;
  }
  .timeline-inspector, .script-summary, .asset-library-summary, .delivery-publish-panel {
    position: static !important;
    max-height: none !important;
  }
}
@media (max-width: 900px) {
  .welcome-panel {
    grid-template-columns: 1fr !important;
  }
  .stage-copy small {
    display: none;
  }
  .stage-tab, .stage-tab-active {
    min-width: 104px;
    flex-basis: 104px;
  }
}
@media (max-width: 640px) {
  .main-navigation {
    display: grid !important;
    grid-template-columns: 1fr 1fr;
  }
  .main-navigation .stage-navigation {
    grid-column: 1 / -1;
    grid-row: 2;
    display: grid !important;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    overflow: visible !important;
  }
  .welcome-panel {
    padding: 22px !important;
  }
  .stage-tab, .stage-tab-active {
    min-width: 0;
    padding: 8px 4px;
    gap: 4px;
    flex-direction: column;
    justify-content: center;
    text-align: center;
  }
  .stage-number {
    width: 24px;
    height: 24px;
    font-size: 11px;
  }
  .stage-copy strong {
    font-size: 10px;
  }
  .generation-monitor {
    grid-template-columns: auto minmax(0, 1fr) !important;
    top: 6px !important;
  }
  .generation-monitor > button {
    grid-column: 1 / -1;
    width: 100%;
  }
  .timeline-time-fields {
    grid-template-columns: 1fr !important;
  }
  .timeline-editor-footer {
    align-items: stretch !important;
    flex-direction: column;
  }
  .script-metadata-grid, .script-line-fields {
    grid-template-columns: 1fr !important;
  }
  .asset-form-grid, .asset-library-card {
    grid-template-columns: 1fr !important;
  }
}
`;

export const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "18px 18px 52px",
    position: "relative",
    overflow: "hidden",
  },
  shell: {
    width: "min(1440px, 100%)",
    margin: "0 auto",
    position: "relative",
    zIndex: 2,
  },
  backgroundShapeOne: {
    position: "absolute",
    top: -180,
    right: -120,
    width: 420,
    height: 420,
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(124,58,237,0.1), rgba(124,58,237,0) 70%)",
    filter: "blur(24px)",
    pointerEvents: "none",
  },
  backgroundShapeTwo: {
    position: "absolute",
    bottom: -220,
    left: -120,
    width: 480,
    height: 480,
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(139,92,246,0.06), rgba(139,92,246,0) 70%)",
    filter: "blur(28px)",
    pointerEvents: "none",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
    position: "relative",
    zIndex: 2,
  },
  brandButton: {
    border: 0,
    padding: 0,
    background: "transparent",
    color: "inherit",
    display: "flex",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    cursor: "pointer",
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 13,
    display: "grid",
    placeItems: "center",
    fontSize: 22,
    fontWeight: 850,
    color: "#fff",
    background: "linear-gradient(145deg, #9f7aea, var(--accent-strong))",
    border: "1px solid rgba(255,255,255,.16)",
    boxShadow: "0 10px 26px rgba(76,29,149,.2)",
  },
  kicker: {
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--fg-tertiary)",
    fontSize: 10,
    fontWeight: 650,
  },
  title: {
    display: "block",
    margin: "2px 0 0",
    fontSize: "clamp(21px, 3vw, 30px)",
    fontWeight: 720,
    letterSpacing: "-0.025em",
  },
  brandDescription: {
    display: "block",
    marginTop: 3,
    color: "var(--fg-secondary)",
    fontSize: 12,
  },
  statusCard: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 13,
    padding: "12px 16px",
    minWidth: 260,
    background: "rgba(255,255,255,.025)",
    display: "grid",
    gap: 4,
    color: "var(--fg)",
    textAlign: "left",
    cursor: "pointer",
  },
  statusCardLabel: {
    color: "var(--accent-fg)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: ".08em",
  },
  navBar: {
    marginTop: 16,
    display: "flex",
    alignItems: "stretch",
    gap: 6,
    padding: 5,
    border: "1px solid var(--border-subtle)",
    borderRadius: 14,
    background: "rgba(16,17,22,.78)",
    backdropFilter: "blur(18px)",
    position: "relative",
    zIndex: 2,
  },
  stageNavigation: {
    display: "flex",
    flex: "1 1 760px",
    gap: 7,
    overflowX: "auto",
    padding: "2px",
  },
  currentStepBar: {
    marginTop: 10,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    color: "var(--fg-secondary)",
    fontSize: 12,
  },
  message: {
    marginTop: 14,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(167,139,250,.25)",
    background: "var(--accent-soft)",
    color: "var(--accent-fg)",
  },
  errorMessage: {
    marginTop: 14,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(251,113,133,.48)",
    background: "rgba(69,10,10,.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  busyMessage: {
    marginTop: 10,
    color: "var(--accent-fg)",
  },
  main: {
    marginTop: 18,
    position: "relative",
    zIndex: 2,
  },
  screenStack: {
    display: "grid",
    gap: 18,
  },
  welcomePanel: {
    border: "1px solid var(--border-subtle)",
    background:
      "radial-gradient(circle at 12% 0%, rgba(139,92,246,.16), transparent 45%), var(--surface)",
    borderRadius: 20,
    padding: "clamp(22px, 4vw, 44px)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.3fr) minmax(280px, .7fr)",
    gap: 28,
    alignItems: "center",
    boxShadow: "var(--shadow-panel)",
  },
  welcomeCopy: {
    display: "grid",
    gap: 12,
  },
  eyebrow: {
    color: "#c4b5fd",
    fontSize: 10,
    fontWeight: 750,
    letterSpacing: ".1em",
  },
  welcomeTitle: {
    margin: 0,
    fontSize: "clamp(30px, 5vw, 52px)",
    lineHeight: 1.12,
    letterSpacing: "-0.045em",
    fontWeight: 720,
    maxWidth: 780,
  },
  leadText: {
    margin: 0,
    maxWidth: 760,
    color: "var(--fg-secondary)",
    lineHeight: 1.75,
  },
  quickSteps: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 8,
  },
  quickStep: {
    display: "grid",
    gridTemplateColumns: "32px 1fr",
    gap: 10,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 10,
    background: "rgba(255,255,255,.03)",
  },
  quickStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    color: "var(--accent-fg)",
    background: "var(--accent-soft)",
    border: "1px solid rgba(167,139,250,.2)",
    fontWeight: 750,
  },
  quickStepNumberText: {},
  primaryButtonLarge: {
    border: "none",
    borderRadius: 11,
    padding: "13px 20px",
    background: "linear-gradient(135deg, #9569f8, var(--accent-strong))",
    color: "#fff",
    fontSize: 15,
    fontWeight: 720,
    cursor: "pointer",
    width: "fit-content",
  },
  sectionHeadingRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "end",
    flexWrap: "wrap",
  },
  quietButton: {
    border: 0,
    background: "transparent",
    color: "#c4b5fd",
    cursor: "pointer",
    padding: "8px 0",
  },
  metricStrip: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    fontSize: 12,
    color: "var(--fg-secondary)",
  },
  dangerText: {
    color: "#fca5a5",
  },
  projectGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
  },
  projectCard: {
    minHeight: 150,
    textAlign: "left",
    border: "1px solid var(--border-subtle)",
    background: "var(--surface)",
    color: "var(--fg)",
    borderRadius: 14,
    padding: 16,
    display: "grid",
    gap: 12,
    cursor: "pointer",
  },
  projectCardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "var(--fg-tertiary)",
  },
  statusPill: {
    width: "fit-content",
    borderRadius: 999,
    padding: "3px 8px",
    color: "var(--accent-fg)",
    background: "var(--accent-soft)",
    fontSize: 11,
    fontWeight: 700,
  },
  projectCardTitle: {
    fontSize: 18,
    lineHeight: 1.45,
  },
  projectCardAction: {
    alignSelf: "end",
    color: "#c4b5fd",
    fontWeight: 700,
  },
  emptyState: {
    minHeight: 220,
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 9,
    textAlign: "center",
    border: "1px dashed var(--border-strong)",
    borderRadius: 14,
    color: "var(--fg-secondary)",
  },
  emptyStateCompact: {
    padding: 18,
    textAlign: "center",
    border: "1px dashed var(--border-strong)",
    borderRadius: 12,
    color: "var(--fg-secondary)",
  },
  emptyStateIcon: {
    fontSize: 32,
  },
  panel: {
    border: "1px solid var(--border-subtle)",
    background: "var(--surface)",
    borderRadius: 16,
    padding: 20,
    display: "grid",
    gap: 12,
  },
  panelTitle: {
    margin: 0,
    fontSize: 23,
    letterSpacing: "-0.025em",
    fontWeight: 700,
  },
  settingsWorkspaceToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-raised)",
  },
  settingsOverview: {
    display: "grid",
    gap: 12,
    padding: 15,
    borderRadius: 14,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-base)",
  },
  settingsOverviewHeading: {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    color: "var(--fg-secondary)",
  },
  settingsOverviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 8,
  },
  settingsOverviewCard: {
    minWidth: 0,
    display: "grid",
    gap: 3,
    padding: "10px 11px",
    borderRadius: 11,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface)",
    color: "var(--fg-secondary)",
    fontSize: 10,
  },
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 12,
  },
  settingsCard: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 14,
    padding: 16,
    display: "grid",
    gap: 12,
    alignContent: "start",
    background: "var(--surface)",
  },
  settingsPresetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 8,
  },
  settingsPresetButton: {
    minWidth: 0,
    display: "grid",
    gap: 3,
    padding: "10px 11px",
    borderRadius: 11,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-base)",
    color: "var(--fg-secondary)",
    textAlign: "left",
    cursor: "pointer",
  },
  settingsPresetButtonActive: {
    minWidth: 0,
    display: "grid",
    gap: 3,
    padding: "10px 11px",
    borderRadius: 11,
    border: "1px solid rgba(167,139,250,.38)",
    background: "var(--accent-soft)",
    color: "var(--accent-fg)",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 0 0 1px rgba(139,92,246,.06) inset",
  },
  settingsValidationWarning: {
    display: "grid",
    gap: 5,
    padding: 11,
    borderRadius: 11,
    border: "1px solid rgba(251,191,36,.34)",
    background: "rgba(120,53,15,.28)",
    color: "#fde68a",
    lineHeight: 1.5,
  },
  settingsValidationReady: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    padding: 11,
    borderRadius: 11,
    border: "1px solid rgba(74,222,128,.26)",
    background: "rgba(20,83,45,.23)",
    color: "#bbf7d0",
    lineHeight: 1.5,
  },
  connectionStatusRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    paddingTop: 8,
    borderTop: "1px solid var(--border-subtle)",
  },
  quietDangerButton: {
    border: 0,
    background: "transparent",
    color: "#fca5a5",
    cursor: "pointer",
    padding: "8px 4px",
  },
  screenIntro: {
    display: "grid",
    gap: 7,
    paddingBottom: 14,
    borderBottom: "1px solid var(--border-subtle)",
  },
  formSection: {
    display: "grid",
    gap: 9,
    maxWidth: 860,
    padding: "10px 0",
  },
  fieldLabel: {
    display: "grid",
    gap: 3,
    color: "var(--fg-secondary)",
    lineHeight: 1.5,
  },
  inputLarge: {
    width: "100%",
    borderRadius: 11,
    border: "1px solid var(--border-strong)",
    background: "var(--surface-base)",
    color: "var(--fg)",
    padding: "14px 15px",
    fontSize: 16,
  },
  choiceExplanation: {
    borderLeft: "3px solid var(--accent)",
    borderRadius: "0 10px 10px 0",
    background: "var(--accent-soft)",
    padding: "10px 12px",
    display: "grid",
    gap: 4,
    color: "var(--fg-secondary)",
  },
  advancedDetails: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 12,
    padding: "12px 14px",
    background: "var(--surface-base)",
  },
  nestedDetails: {
    borderTop: "1px solid var(--border-subtle)",
    paddingTop: 10,
  },
  advancedContent: {
    display: "grid",
    gap: 12,
    paddingTop: 12,
  },
  helpText: {
    color: "var(--fg-secondary)",
    fontSize: 12,
  },
  projectOverviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  nextActionCard: {
    border: "1px solid rgba(167,139,250,.2)",
    borderRadius: 15,
    padding: 18,
    display: "grid",
    gap: 9,
    alignContent: "start",
    background:
      "linear-gradient(135deg, rgba(139,92,246,.13), rgba(20,21,27,.98))",
  },
  nextActionTitle: {
    fontSize: 22,
  },
  progressCard: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 15,
    padding: 18,
    display: "grid",
    gap: 10,
    alignContent: "start",
    background: "var(--surface)",
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    overflow: "hidden",
    background: "rgba(148,163,184,.18)",
  },
  progressFill: {
    display: "block",
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, var(--accent-strong), #a78bfa)",
  },
  aiUsageCard: {
    border: "1px solid rgba(167,139,250,.2)",
    borderRadius: 15,
    padding: 18,
    display: "grid",
    gap: 14,
    background:
      "linear-gradient(135deg, rgba(76,29,149,.2), rgba(20,21,27,.98))",
  },
  aiUsageCost: {
    color: "#ddd6fe",
    fontSize: 24,
  },
  aiUsageMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 8,
  },
  aiUsageLatest: {
    border: "1px solid rgba(196,181,253,.18)",
    borderRadius: 12,
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    background: "rgba(46,16,101,.18)",
  },
  aiUsageMetric: {
    borderRadius: 12,
    padding: "10px 12px",
    display: "grid",
    gap: 4,
    background: "rgba(255,255,255,.035)",
  },
  aiModelList: {
    display: "grid",
    gap: 6,
  },
  aiModelRow: {
    borderTop: "1px solid rgba(196,181,253,.14)",
    paddingTop: 8,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  inlineLink: {
    color: "#c4b5fd",
  },
  generationMonitor: {
    position: "sticky",
    top: 10,
    zIndex: 8,
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 14,
    marginTop: 12,
    padding: "14px 16px",
    border: "1px solid",
    borderRadius: 14,
    boxShadow: "0 18px 52px rgba(0,0,0,.28)",
    backdropFilter: "blur(18px)",
  },
  generationMonitorIcon: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,.12)",
    color: "var(--accent-fg)",
    fontWeight: 900,
  },
  generationMonitorBody: {
    minWidth: 0,
    display: "grid",
    gap: 7,
  },
  generationMonitorHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    flexWrap: "wrap",
  },
  generationMonitorDescription: {
    color: "var(--fg-secondary)",
    fontSize: 12,
  },
  generationMonitorAction: {
    border: "1px solid var(--border-strong)",
    borderRadius: 10,
    padding: "9px 12px",
    background: "var(--surface-raised)",
    color: "var(--fg)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  contextNotice: {
    display: "grid",
    gap: 4,
    marginBottom: 14,
    padding: "12px 14px",
    border: "1px solid rgba(167,139,250,.2)",
    borderRadius: 12,
    background: "var(--accent-soft)",
    color: "var(--fg-secondary)",
    fontSize: 12,
  },
  runningIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "var(--accent-fg)",
    fontSize: 12,
  },
  stepList: {
    display: "grid",
    gap: 6,
    paddingTop: 10,
  },
  stepRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    borderBottom: "1px solid var(--border-subtle)",
    padding: "8px 0",
  },
  stepActions: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  stickyActionBar: {
    position: "sticky",
    bottom: 12,
    zIndex: 3,
    border: "1px solid var(--border-strong)",
    borderRadius: 13,
    padding: "12px 14px",
    background: "rgba(20,21,27,.94)",
    backdropFilter: "blur(18px)",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    color: "var(--fg-secondary)",
  },
  subTitle: {
    margin: "8px 0 0",
  },
  metricRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  metricCard: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 11,
    padding: "12px 14px",
    background: "var(--surface-base)",
    display: "grid",
    gap: 4,
  },
  metricValue: {
    fontSize: 28,
  },
  list: {
    display: "grid",
    gap: 8,
  },
  listItem: {
    textAlign: "left",
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-base)",
    color: "var(--fg)",
    borderRadius: 10,
    padding: "12px 14px",
    display: "grid",
    gap: 4,
    cursor: "pointer",
  },
  label: {
    fontSize: 13,
    opacity: 0.85,
  },
  labelInline: {
    fontSize: 12,
    opacity: 0.8,
  },
  input: {
    width: "100%",
    borderRadius: 9,
    border: "1px solid var(--border-strong)",
    background: "var(--surface-base)",
    color: "var(--fg)",
    padding: "9px 11px",
  },
  inputSmall: {
    borderRadius: 9,
    border: "1px solid var(--border-strong)",
    background: "var(--surface-base)",
    color: "var(--fg)",
    padding: "9px 11px",
    minWidth: 110,
  },
  primaryButton: {
    border: "none",
    borderRadius: 10,
    padding: "10px 16px",
    background: "linear-gradient(135deg, #9569f8, var(--accent))",
    color: "#fff",
    fontWeight: 680,
    boxShadow: "0 8px 20px rgba(76,29,149,.16)",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid var(--border-strong)",
    borderRadius: 10,
    padding: "9px 14px",
    background: "var(--surface-raised)",
    color: "var(--fg)",
    cursor: "pointer",
    width: "fit-content",
  },
  compactButton: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 7,
    padding: "4px 7px",
    background: "var(--surface-raised)",
    color: "var(--fg-secondary)",
    cursor: "pointer",
    fontSize: 10,
  },
  dangerButton: {
    border: "1px solid rgba(248,113,113,0.5)",
    borderRadius: 10,
    padding: "9px 14px",
    background: "rgba(127,29,29,0.4)",
    color: "#fecaca",
    cursor: "pointer",
    width: "fit-content",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  infoCard: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 10,
    padding: "10px 12px",
    display: "grid",
    gap: 6,
    background: "var(--surface-base)",
  },
  jobCard: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 10,
    padding: "10px 12px",
    display: "grid",
    gap: 6,
    background: "var(--surface-base)",
  },
  stepWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  stepBadge: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 12,
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
  },
  inlineButton: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 999,
    padding: "2px 6px",
    background: "var(--surface-raised)",
    color: "var(--fg)",
    cursor: "pointer",
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  actionBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  checkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 8,
  },
  checkItem: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 8,
    padding: "8px 10px",
    display: "grid",
    gridTemplateColumns: "20px 1fr auto",
    gap: 8,
    alignItems: "center",
    background: "var(--surface-base)",
  },
  fileGrid: {
    display: "grid",
    gap: 6,
  },
  fileLink: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 8,
    padding: "7px 9px",
    color: "#c4b5fd",
    textDecoration: "none",
    background: "var(--surface-base)",
    overflowWrap: "anywhere",
  },
  logBox: {
    margin: 0,
    borderRadius: 12,
    border: "1px solid var(--border-subtle)",
    background: "#0d0e12",
    padding: 12,
    maxHeight: 220,
    overflow: "auto",
    whiteSpace: "pre-wrap",
  },
  lineRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  dialogueCard: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "start",
    border: "1px solid var(--border-subtle)",
    borderRadius: 12,
    padding: 12,
    background: "var(--surface-base)",
  },
  dialogueNumber: {
    width: 28,
    height: 28,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    flex: "0 0 auto",
    color: "var(--accent-fg)",
    background: "var(--accent-soft)",
    border: "1px solid rgba(167,139,250,.2)",
    fontWeight: 800,
  },
  scriptEditorToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-raised)",
  },
  scriptDirtyBadge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 30,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(251,191,36,.42)",
    background: "rgba(120,53,15,.42)",
    color: "#fde68a",
    fontSize: 12,
    fontWeight: 700,
  },
  scriptSavedBadge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 30,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(74,222,128,.34)",
    background: "rgba(20,83,45,.38)",
    color: "#bbf7d0",
    fontSize: 12,
    fontWeight: 700,
  },
  scriptEditorWorkspace: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 310px)",
    gap: 14,
    alignItems: "start",
  },
  scriptEditorMain: {
    minWidth: 0,
    display: "grid",
    gap: 14,
  },
  scriptMetadataPanel: {
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface)",
  },
  scriptSectionHeading: {
    display: "flex",
    alignItems: "start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  scriptMetadataGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: "8px 14px",
    alignItems: "end",
  },
  scriptLinesPanel: {
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface)",
  },
  scriptLineList: {
    display: "grid",
    gap: 10,
  },
  scriptLineCard: {
    minWidth: 0,
    display: "grid",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-base)",
    boxShadow: "0 10px 24px rgba(0,0,0,.1)",
  },
  scriptLineCardReimu: {
    borderLeft: "3px solid #a78bfa",
  },
  scriptLineCardMarisa: {
    borderLeft: "3px solid #facc15",
  },
  scriptLineCardError: {
    borderColor: "rgba(248,113,113,.5)",
  },
  scriptLineHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  scriptLineIdentity: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "var(--fg-secondary)",
  },
  scriptSpeakerBadge: {
    padding: "4px 8px",
    borderRadius: 999,
    background: "var(--accent-soft)",
    color: "var(--accent-fg)",
    fontSize: 11,
    fontWeight: 700,
  },
  scriptLineActions: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  scriptLineFields: {
    display: "grid",
    gridTemplateColumns: "150px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
  },
  scriptTextarea: {
    width: "100%",
    minHeight: 78,
    resize: "vertical",
    borderRadius: 10,
    border: "1px solid var(--border-strong)",
    background: "#0d0e12",
    color: "var(--fg)",
    padding: "10px 11px",
    font: "inherit",
    lineHeight: 1.65,
  },
  scriptFieldError: {
    color: "#fca5a5",
    lineHeight: 1.5,
  },
  scriptAddLineButton: {
    width: "100%",
    minHeight: 44,
    borderRadius: 12,
    border: "1px dashed rgba(167,139,250,.3)",
    background: "rgba(139,92,246,.07)",
    color: "#c4b5fd",
    cursor: "pointer",
    fontWeight: 700,
  },
  scriptSummaryPanel: {
    position: "sticky",
    top: 116,
    display: "grid",
    gap: 12,
    padding: 15,
    borderRadius: 14,
    border: "1px solid var(--border-subtle)",
    background: "rgba(20,21,27,.96)",
    boxShadow: "var(--shadow-panel)",
  },
  scriptMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  scriptMetricCard: {
    display: "grid",
    gap: 2,
    justifyItems: "center",
    padding: 10,
    borderRadius: 11,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-raised)",
    color: "var(--fg-secondary)",
    fontSize: 11,
  },
  scriptDurationCard: {
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(167,139,250,.2)",
    background: "var(--accent-soft)",
    color: "var(--fg-secondary)",
  },
  scriptSpeakerSummary: {
    display: "grid",
    gap: 7,
    padding: "2px 0",
  },
  scriptSpeakerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingBottom: 6,
    borderBottom: "1px solid var(--border-subtle)",
    color: "var(--fg-secondary)",
    fontSize: 12,
  },
  scriptValidationReady: {
    display: "grid",
    gap: 5,
    padding: 11,
    borderRadius: 11,
    border: "1px solid rgba(74,222,128,.3)",
    background: "rgba(20,83,45,.3)",
    color: "#bbf7d0",
    lineHeight: 1.5,
  },
  scriptValidationWarning: {
    display: "grid",
    gap: 5,
    padding: 11,
    borderRadius: 11,
    border: "1px solid rgba(251,191,36,.35)",
    background: "rgba(120,53,15,.3)",
    color: "#fde68a",
    lineHeight: 1.5,
  },
  scriptValidationList: {
    margin: 0,
    paddingLeft: 18,
    display: "grid",
    gap: 3,
    fontSize: 11,
  },
  scriptTipsList: {
    margin: "10px 0 0",
    paddingLeft: 20,
    display: "grid",
    gap: 6,
    color: "rgba(203,213,225,.76)",
    fontSize: 12,
    lineHeight: 1.55,
  },
  scriptFooterStatus: {
    minWidth: 0,
    display: "grid",
    gap: 3,
  },
  assetUploadWorkspace: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 300px)",
    gap: 14,
    alignItems: "start",
  },
  assetWorkspaceMain: {
    minWidth: 0,
    display: "grid",
    gap: 14,
  },
  assetUploadPanel: {
    minWidth: 0,
    display: "grid",
    gap: 13,
    padding: 16,
    borderRadius: 14,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface)",
  },
  assetSectionHeading: {
    display: "flex",
    alignItems: "start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  assetDropZone: {
    minHeight: 190,
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 9,
    padding: 20,
    borderRadius: 14,
    border: "1px dashed rgba(167,139,250,.3)",
    background:
      "radial-gradient(circle at 50% 0%, rgba(139,92,246,.12), rgba(13,14,18,.96) 72%)",
    textAlign: "center",
    transition:
      "border-color 160ms ease, background 160ms ease, transform 160ms ease",
  },
  assetDropZoneActive: {
    borderColor: "#a78bfa",
    background: "rgba(139,92,246,.16)",
    transform: "scale(1.005)",
  },
  assetDropZoneError: {
    borderColor: "rgba(248,113,113,.65)",
    background: "rgba(69,10,10,.28)",
  },
  visuallyHiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  assetUploadIcon: {
    width: 48,
    height: 48,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    border: "1px solid rgba(167,139,250,.24)",
    background: "var(--accent-soft)",
    color: "#c4b5fd",
    fontSize: 25,
    fontWeight: 800,
  },
  assetSelectedFile: {
    display: "grid",
    gap: 3,
    justifyItems: "center",
    color: "var(--fg-secondary)",
  },
  assetFormatHint: {
    maxWidth: 640,
    color: "var(--fg-tertiary)",
    lineHeight: 1.6,
  },
  assetUploadError: {
    maxWidth: 640,
    padding: "8px 10px",
    borderRadius: 9,
    border: "1px solid rgba(248,113,113,.36)",
    background: "rgba(127,29,29,.34)",
    color: "#fecaca",
    fontSize: 12,
    lineHeight: 1.5,
  },
  assetFormGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(190px, 1.35fr) minmax(130px, .7fr) minmax(150px, .8fr)",
    gap: 10,
    alignItems: "end",
  },
  assetUploadActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "11px 12px",
    borderRadius: 12,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-base)",
    color: "var(--fg-secondary)",
    fontSize: 12,
  },
  assetLibraryPanel: {
    minWidth: 0,
    display: "grid",
    gap: 13,
    padding: 16,
    borderRadius: 14,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface)",
  },
  assetCountBadge: {
    minWidth: 48,
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(167,139,250,.2)",
    background: "var(--accent-soft)",
    color: "var(--accent-fg)",
    textAlign: "center",
    fontSize: 12,
    fontWeight: 800,
  },
  assetCardGrid: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))",
    gap: 10,
  },
  assetEmptyState: {
    minHeight: 190,
    display: "grid",
    placeContent: "center",
    justifyItems: "center",
    gap: 8,
    padding: 24,
    borderRadius: 14,
    border: "1px dashed var(--border-strong)",
    background: "var(--surface-base)",
    color: "var(--fg-secondary)",
    textAlign: "center",
    lineHeight: 1.6,
  },
  assetEmptyIcon: {
    fontSize: 30,
    color: "#c4b5fd",
  },
  assetEmptyKinds: {
    display: "flex",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 4,
    fontSize: 11,
  },
  assetLibraryCard: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "165px minmax(0, 1fr)",
    gap: 12,
    padding: 11,
    borderRadius: 12,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-base)",
    boxShadow: "0 10px 24px rgba(0,0,0,.1)",
  },
  assetCardPreview: {
    minHeight: 118,
    aspectRatio: "16 / 10",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    borderRadius: 11,
    border: "1px solid var(--border-subtle)",
    background:
      "radial-gradient(circle at center, rgba(139,92,246,.12), #0b0b0f 75%)",
  },
  assetLibraryThumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  assetTypeIcon: {
    color: "#c4b5fd",
    fontSize: 28,
    fontWeight: 800,
  },
  assetCardBody: {
    minWidth: 0,
    display: "grid",
    gap: 6,
    alignContent: "start",
    color: "var(--fg-secondary)",
  },
  assetCardBadges: {
    display: "flex",
    gap: 5,
    flexWrap: "wrap",
  },
  assetTypeBadge: {
    padding: "3px 7px",
    borderRadius: 999,
    background: "var(--accent-soft)",
    color: "var(--accent-fg)",
    fontSize: 10,
    fontWeight: 700,
  },
  assetUsageBadge: {
    padding: "3px 7px",
    borderRadius: 999,
    background: "rgba(255,255,255,.06)",
    color: "var(--fg-secondary)",
    fontSize: 10,
    fontWeight: 700,
  },
  assetCardTitle: {
    color: "var(--fg)",
    fontSize: 16,
    overflowWrap: "anywhere",
  },
  assetCardActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  assetPathDetails: {
    paddingTop: 5,
    borderTop: "1px solid var(--border-subtle)",
    fontSize: 11,
  },
  assetPathText: {
    display: "block",
    marginTop: 5,
    overflowWrap: "anywhere",
    color: "rgba(203,213,225,.56)",
  },
  assetLibrarySummary: {
    position: "sticky",
    top: 116,
    display: "grid",
    gap: 12,
    padding: 15,
    borderRadius: 14,
    border: "1px solid var(--border-subtle)",
    background: "rgba(20,21,27,.96)",
    boxShadow: "var(--shadow-panel)",
  },
  assetTotalCard: {
    display: "grid",
    gap: 3,
    padding: 13,
    borderRadius: 12,
    border: "1px solid rgba(167,139,250,.2)",
    background: "var(--accent-soft)",
    color: "var(--fg-secondary)",
  },
  assetTypeMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 5,
  },
  assetTypeMetric: {
    minWidth: 0,
    display: "grid",
    justifyItems: "center",
    gap: 2,
    padding: "8px 3px",
    borderRadius: 9,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-raised)",
    color: "var(--fg-secondary)",
    fontSize: 9,
  },
  assetUsageSummary: {
    display: "grid",
    gap: 7,
  },
  assetSummaryRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingBottom: 6,
    borderBottom: "1px solid var(--border-subtle)",
    color: "var(--fg-secondary)",
    fontSize: 12,
  },
  assetAutomationNote: {
    display: "grid",
    gap: 5,
    padding: 11,
    borderRadius: 11,
    border: "1px solid rgba(74,222,128,.25)",
    background: "rgba(20,83,45,.25)",
    color: "#bbf7d0",
    fontSize: 12,
    lineHeight: 1.55,
  },
  deliveryStatusPanel: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(167,139,250,.2)",
    background: "var(--accent-soft)",
  },
  deliveryStatusRunning: {
    borderColor: "rgba(251,191,36,.42)",
    background: "rgba(120,53,15,.34)",
  },
  deliveryStatusReady: {
    borderColor: "rgba(167,139,250,.28)",
    background: "rgba(139,92,246,.14)",
  },
  deliveryStatusComplete: {
    borderColor: "rgba(74,222,128,.34)",
    background: "rgba(20,83,45,.34)",
  },
  deliveryStatusIcon: {
    width: 34,
    height: 34,
    flex: "0 0 auto",
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.08)",
    color: "var(--fg)",
    fontWeight: 800,
  },
  deliveryStatusCopy: {
    minWidth: 0,
    display: "grid",
    gap: 3,
    color: "var(--fg-secondary)",
  },
  deliveryReviewWorkspace: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 320px)",
    gap: 14,
    alignItems: "start",
  },
  deliveryReviewMain: {
    minWidth: 0,
    display: "grid",
    gap: 14,
  },
  deliveryMonitorPanel: {
    minWidth: 0,
    display: "grid",
    gap: 12,
    padding: 15,
    borderRadius: 14,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface)",
  },
  deliverySectionHeading: {
    display: "flex",
    alignItems: "start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  deliveryVideoPlayer: {
    width: "100%",
    aspectRatio: "16 / 9",
    maxHeight: 560,
    display: "block",
    borderRadius: 12,
    border: "1px solid var(--border-subtle)",
    background: "#010308",
    boxShadow: "0 18px 44px rgba(0,0,0,.28)",
  },
  deliveryMonitorEmpty: {
    minHeight: 270,
    display: "grid",
    placeContent: "center",
    justifyItems: "center",
    gap: 8,
    padding: 24,
    borderRadius: 12,
    border: "1px dashed var(--border-strong)",
    background:
      "radial-gradient(circle at center, rgba(139,92,246,.11), rgba(1,3,8,.94) 72%)",
    color: "var(--fg-secondary)",
    textAlign: "center",
    lineHeight: 1.6,
  },
  deliveryMonitorEmptyIcon: {
    width: 48,
    height: 48,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    border: "1px solid rgba(167,139,250,.24)",
    color: "#c4b5fd",
    background: "var(--accent-soft)",
    paddingLeft: 3,
  },
  deliveryPreviewMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 7,
  },
  deliveryPreviewMetric: {
    minWidth: 0,
    display: "grid",
    gap: 3,
    padding: "9px 10px",
    borderRadius: 10,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-raised)",
    color: "var(--fg-secondary)",
    fontSize: 10,
  },
  deliveryPreviewTechnical: {
    gridColumn: "1 / -1",
    padding: "8px 10px",
    borderRadius: 9,
    background: "rgba(255,255,255,.035)",
    color: "var(--fg-secondary)",
    fontSize: 11,
  },
  deliveryTechnicalDetails: {
    gridColumn: "1 / -1",
    paddingTop: 7,
    borderTop: "1px solid var(--border-subtle)",
    color: "rgba(203,213,225,.62)",
    fontSize: 11,
  },
  deliveryPreviewPrompt: {
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid rgba(167,139,250,.14)",
    background: "rgba(139,92,246,.08)",
    color: "var(--fg-secondary)",
    fontSize: 12,
    lineHeight: 1.55,
  },
  deliveryChecksPanel: {
    minWidth: 0,
    display: "grid",
    gap: 14,
    padding: 15,
    borderRadius: 14,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface)",
  },
  deliveryCheckGroup: {
    display: "grid",
    gap: 9,
  },
  deliveryCheckGroupHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 8,
    borderBottom: "1px solid var(--border-subtle)",
  },
  deliveryAutoCheckGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 8,
  },
  deliveryCheckPassed: {
    display: "flex",
    alignItems: "start",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(74,222,128,.24)",
    background: "rgba(20,83,45,.23)",
    color: "#bbf7d0",
  },
  deliveryCheckWarning: {
    display: "flex",
    alignItems: "start",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(251,191,36,.3)",
    background: "rgba(120,53,15,.24)",
    color: "#fde68a",
  },
  deliveryCheckCopy: {
    minWidth: 0,
    display: "grid",
    gap: 3,
    lineHeight: 1.45,
  },
  deliveryChecksEmpty: {
    gridColumn: "1 / -1",
    padding: 14,
    borderRadius: 10,
    border: "1px dashed var(--border-strong)",
    color: "rgba(203,213,225,.64)",
    textAlign: "center",
    fontSize: 12,
  },
  deliveryManualCheckList: {
    display: "grid",
    gap: 7,
  },
  deliveryManualCheck: {
    display: "flex",
    alignItems: "start",
    gap: 9,
    padding: 10,
    borderRadius: 10,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-base)",
    color: "var(--fg-secondary)",
    cursor: "pointer",
  },
  deliveryManualCheckDone: {
    borderColor: "rgba(74,222,128,.26)",
    background: "rgba(20,83,45,.2)",
  },
  deliveryManualCheckbox: {
    marginTop: 2,
    accentColor: "var(--accent)",
  },
  deliveryPublishPanel: {
    position: "sticky",
    top: 116,
    display: "grid",
    gap: 12,
    padding: 15,
    borderRadius: 14,
    border: "1px solid var(--border-subtle)",
    background: "rgba(20,21,27,.96)",
    boxShadow: "var(--shadow-panel)",
  },
  deliveryPublishStatus: {
    display: "grid",
    gap: 5,
    padding: 11,
    borderRadius: 11,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-raised)",
    color: "var(--fg-secondary)",
    lineHeight: 1.5,
    fontSize: 12,
  },
  deliveryOutputCard: {
    display: "grid",
    gap: 3,
    padding: 12,
    borderRadius: 11,
    border: "1px solid rgba(167,139,250,.2)",
    background: "var(--accent-soft)",
    color: "var(--fg-secondary)",
  },
  deliveryRenderButton: {
    width: "100%",
    minHeight: 48,
    border: "none",
    borderRadius: 12,
    padding: "11px 15px",
    background: "linear-gradient(135deg, #9569f8, var(--accent))",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(76,29,149,.18)",
  },
  deliveryPublishHint: {
    color: "#fde68a",
    lineHeight: 1.5,
  },
  deliveryPublishReady: {
    color: "#bbf7d0",
    lineHeight: 1.5,
  },
  deliveryDownloadCard: {
    display: "grid",
    gap: 5,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(74,222,128,.3)",
    background: "rgba(20,83,45,.28)",
    color: "rgba(220,252,231,.78)",
  },
  deliveryDownloadButton: {
    display: "block",
    marginTop: 4,
    padding: "9px 11px",
    borderRadius: 9,
    background: "rgba(74,222,128,.9)",
    color: "#052e16",
    textAlign: "center",
    textDecoration: "none",
    fontWeight: 800,
  },
  assetRow: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 12,
    padding: "10px 12px",
    display: "grid",
    gap: 3,
  },
  assetThumb: {
    width: 120,
    aspectRatio: "16 / 9",
    objectFit: "cover",
    borderRadius: 6,
    border: "1px solid var(--border-subtle)",
    background: "rgba(2, 8, 23, 0.8)",
  },
  timelineStudioWorkspace: {
    display: "grid",
    gap: 16,
  },
  timelineStudioTop: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.55fr) minmax(320px, 0.72fr)",
    gap: 14,
    alignItems: "stretch",
  },
  timelinePreviewPanel: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 15,
    background: "var(--surface)",
    padding: 14,
    display: "grid",
    gap: 12,
    minWidth: 0,
    boxShadow: "var(--shadow-panel)",
  },
  timelinePanelHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  timelinePanelEyebrow: {
    display: "block",
    color: "#c4b5fd",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.14em",
    marginBottom: 3,
  },
  timelinePanelTitle: {
    display: "block",
    fontSize: 18,
    lineHeight: 1.25,
  },
  timelineMonitorFrame: {
    aspectRatio: "16 / 9",
    minHeight: 220,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    borderRadius: 12,
    background:
      "radial-gradient(circle at center, rgba(35, 30, 52, .86), #050509 72%)",
    border: "1px solid var(--border-subtle)",
  },
  timelineMonitorVideo: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
    background: "#010308",
  },
  timelineMonitorEmpty: {
    maxWidth: 440,
    padding: 24,
    display: "grid",
    gap: 8,
    justifyItems: "center",
    textAlign: "center",
    color: "rgba(226,232,240,.8)",
  },
  timelineMonitorEmptyIcon: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "#c4b5fd",
    background: "var(--accent-soft)",
    border: "1px solid rgba(167,139,250,.24)",
    paddingLeft: 3,
    fontSize: 19,
  },
  timelineTransportBar: {
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "6px 8px",
    borderRadius: 10,
    background: "var(--surface-base)",
  },
  timelineTransportButton: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "1px solid rgba(167,139,250,.3)",
    background: "var(--accent-soft)",
    color: "var(--accent-fg)",
    cursor: "pointer",
  },
  timelineTimecode: {
    fontFamily: '"Cascadia Mono", "SFMono-Regular", Consolas, monospace',
    fontSize: 13,
    fontVariantNumeric: "tabular-nums",
  },
  timelineTransportHint: {
    marginLeft: "auto",
    color: "rgba(203,213,225,.66)",
    fontSize: 11,
  },
  timelineControlPanel: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 15,
    background: "var(--surface)",
    padding: 14,
    display: "grid",
    gap: 14,
    alignContent: "start",
  },
  timelineMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 7,
  },
  timelineMetric: {
    minWidth: 0,
    display: "grid",
    gap: 2,
    justifyItems: "center",
    padding: "9px 5px",
    borderRadius: 10,
    background: "var(--surface-base)",
    border: "1px solid var(--border-subtle)",
    fontSize: 10,
    color: "rgba(203,213,225,.76)",
  },
  timelineTimeFields: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  timelineControlGroup: {
    display: "grid",
    gap: 8,
  },
  timelineControlLabel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 12,
  },
  timelineShortcutHelp: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 7,
    padding: 10,
    borderRadius: 10,
    border: "1px solid var(--border-subtle)",
    color: "rgba(203,213,225,.76)",
    fontSize: 10,
    cursor: "default",
  },
  shortcutKey: {
    display: "inline-block",
    minWidth: 28,
    padding: "2px 5px",
    borderRadius: 5,
    border: "1px solid var(--border-strong)",
    background: "#0d0e12",
    color: "var(--fg)",
    textAlign: "center",
    fontFamily: '"Cascadia Mono", Consolas, monospace',
  },
  timelineWorkspace: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 340px)",
    gap: 14,
    alignItems: "start",
  },
  timelineVisualPanel: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 14,
    background: "var(--surface)",
    padding: 14,
    display: "grid",
    gap: 10,
    overflowX: "auto",
    minWidth: 0,
  },
  timelineScrollableContent: {
    minWidth: 760,
    display: "grid",
    gap: 10,
  },
  timelineViewportLabel: {
    color: "rgba(203,213,225,.68)",
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
  },
  timelineRuler: {
    position: "relative",
    height: 34,
    borderRadius: 10,
    background:
      "linear-gradient(180deg, rgba(32,33,42,.92) 0%, rgba(20,21,27,.9) 100%)",
    border: "1px solid var(--border-subtle)",
    overflow: "hidden",
  },
  timelineTick: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    background: "rgba(255,255,255,.1)",
  },
  timelineTickLabel: {
    position: "absolute",
    top: 6,
    left: 6,
    fontSize: 11,
    color: "rgba(226, 232, 240, 0.86)",
    whiteSpace: "nowrap",
  },
  timelineMarkerLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    background: "rgba(250, 204, 21, 0.9)",
    boxShadow: "0 0 12px rgba(250, 204, 21, 0.42)",
  },
  timelinePlayheadLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    background: "rgba(248, 113, 113, 0.95)",
    boxShadow: "0 0 12px rgba(248, 113, 113, 0.45)",
    pointerEvents: "none",
  },
  timelineLane: {
    display: "grid",
    gridTemplateColumns: "120px minmax(0, 1fr)",
    gap: 10,
    alignItems: "stretch",
  },
  timelineLaneHeader: {
    position: "sticky",
    left: 0,
    zIndex: 3,
    borderRadius: 12,
    border: "1px solid var(--border-subtle)",
    padding: "10px 12px",
    background: "rgba(26,27,34,.98)",
    boxShadow: "8px 0 18px rgba(0,0,0,.28)",
    display: "grid",
    gap: 4,
    alignContent: "center",
  },
  timelineLaneCanvas: {
    position: "relative",
    minHeight: 72,
    borderRadius: 12,
    border: "1px solid var(--border-subtle)",
    background:
      "linear-gradient(180deg, rgba(20,21,27,.96) 0%, rgba(14,15,19,.96) 100%)",
    overflow: "hidden",
  },
  timelineClipBlock: {
    position: "absolute",
    top: 10,
    bottom: 10,
    border: "none",
    borderRadius: 12,
    padding: "8px 10px",
    color: "#eff6ff",
    display: "grid",
    gap: 3,
    textAlign: "left",
    cursor: "pointer",
    minWidth: 30,
    overflow: "hidden",
  },
  timelineClipTitle: {
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  timelineClipSubtitle: {
    fontSize: 11,
    opacity: 0.92,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  timelineInspector: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 14,
    background: "var(--surface)",
    padding: 14,
    display: "grid",
    gap: 10,
    alignContent: "start",
    position: "sticky",
    top: 116,
    maxHeight: "calc(100vh - 132px)",
    overflow: "auto",
  },
  timelineInspectorHeader: {
    display: "block",
    fontSize: 18,
    fontWeight: 700,
  },
  timelineInspectorFieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  timelineInspectorEmpty: {
    minHeight: 200,
    padding: 22,
    display: "grid",
    placeContent: "center",
    justifyItems: "center",
    gap: 8,
    textAlign: "center",
    color: "rgba(203,213,225,.7)",
    border: "1px dashed var(--border-strong)",
    borderRadius: 12,
  },
  timelineUtilityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  timelineUtilityCard: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 12,
    background: "var(--surface-base)",
    padding: 12,
    display: "grid",
    gap: 10,
  },
  timelineUtilityHeading: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "var(--fg)",
  },
  compactField: {
    display: "grid",
    gap: 6,
    minWidth: 120,
  },
  timelineEditorFooter: {
    position: "sticky",
    bottom: 10,
    zIndex: 5,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid var(--border-strong)",
    background: "rgba(20,21,27,.96)",
    boxShadow: "0 18px 48px rgba(0,0,0,.34)",
    backdropFilter: "blur(14px)",
  },
  timelineEditorFooterStatus: {
    display: "grid",
    gap: 3,
  },
  timelineTrack: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 8,
    background: "var(--surface-base)",
  },
  clipEditor: {
    borderRadius: 10,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-base)",
    padding: "8px 10px",
    display: "grid",
    gap: 6,
  },
  sliderRow: {
    display: "grid",
    gridTemplateColumns: "50px 1fr 80px",
    gap: 8,
    alignItems: "center",
  },
  slider: {
    width: "100%",
    accentColor: "var(--accent)",
  },
  previewCard: {
    border: "1px solid var(--border-subtle)",
    borderRadius: 12,
    padding: "12px 14px",
    display: "grid",
    gap: 6,
    background: "var(--surface-base)",
  },
  videoPlayer: {
    width: "100%",
    maxHeight: 520,
    borderRadius: 8,
    border: "1px solid var(--border-subtle)",
    background: "#020617",
  },
  downloadButton: {
    border: "1px solid var(--border-strong)",
    borderRadius: 8,
    padding: "9px 14px",
    background: "var(--surface-raised)",
    color: "var(--fg)",
    textDecoration: "none",
    width: "fit-content",
  },
};
