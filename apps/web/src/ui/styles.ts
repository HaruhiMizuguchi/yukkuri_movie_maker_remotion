import React from "react";

export const styleText = `
:root {
  --bg: #0a101f;
  --panel: rgba(12, 24, 49, 0.78);
  --line: rgba(132, 204, 255, 0.22);
  --fg: #f8fafc;
  --accent: #22d3ee;
  --accent-strong: #0ea5e9;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: radial-gradient(circle at 10% 20%, #14264d 0%, #090f1e 55%, #050914 100%);
  color: var(--fg);
  font-family: "BIZ UDPGothic", "Yu Gothic UI", "Hiragino Kaku Gothic ProN", sans-serif;
}
.home-tab, .home-tab-active {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 14px;
  background: rgba(15, 30, 60, 0.4);
  color: var(--fg);
  cursor: pointer;
  transition: transform 180ms ease, background 180ms ease;
  white-space: nowrap;
}
.home-tab:hover, .home-tab-active:hover, .stage-tab:hover, .stage-tab-active:hover {
  transform: translateY(-1px);
}
.home-tab-active {
  background: linear-gradient(120deg, var(--accent-strong), var(--accent));
  color: #062029;
  font-weight: 700;
}
.stage-tab, .stage-tab-active {
  flex: 1 1 150px;
  min-width: 136px;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 9px 10px;
  display: flex;
  gap: 9px;
  align-items: center;
  text-align: left;
  background: rgba(10, 25, 51, 0.7);
  color: var(--fg);
  cursor: pointer;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}
.stage-tab-active {
  border-color: rgba(34, 211, 238, 0.78);
  background: rgba(8, 47, 73, 0.88);
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.18) inset;
}
.stage-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: #062029;
  background: #67e8f9;
  font-weight: 800;
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
  opacity: .42;
  cursor: not-allowed;
  transform: none !important;
}
button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible, a:focus-visible {
  outline: 3px solid rgba(103, 232, 249, .9);
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
}
`;

export const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "22px 16px 48px",
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
      "radial-gradient(circle, rgba(34,211,238,0.35), rgba(14,165,233,0.03) 70%)",
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
      "radial-gradient(circle, rgba(56,189,248,0.25), rgba(14,165,233,0.01) 70%)",
    pointerEvents: "none",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
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
    width: 48,
    height: 48,
    borderRadius: 15,
    display: "grid",
    placeItems: "center",
    fontSize: 25,
    fontWeight: 900,
    color: "#062029",
    background: "linear-gradient(135deg, #67e8f9, #38bdf8)",
    boxShadow: "0 10px 30px rgba(34,211,238,.2)",
  },
  kicker: {
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    opacity: 0.7,
    fontSize: 12,
  },
  title: {
    display: "block",
    margin: "2px 0 0",
    fontSize: "clamp(21px, 3vw, 30px)",
    fontWeight: 800,
  },
  brandDescription: {
    display: "block",
    marginTop: 3,
    opacity: 0.68,
    fontSize: 12,
  },
  statusCard: {
    border: "1px solid rgba(148, 226, 255, 0.28)",
    borderRadius: 18,
    padding: "12px 16px",
    minWidth: 260,
    background: "rgba(15, 30, 60, 0.52)",
    display: "grid",
    gap: 4,
    color: "#f8fafc",
    textAlign: "left",
    cursor: "pointer",
  },
  statusCardLabel: {
    color: "#67e8f9",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: ".08em",
  },
  navBar: {
    marginTop: 16,
    display: "flex",
    alignItems: "stretch",
    gap: 8,
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
    color: "rgba(226,232,240,.76)",
    fontSize: 12,
  },
  message: {
    marginTop: 14,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(34,211,238,0.42)",
    background: "rgba(8, 47, 73, 0.58)",
  },
  errorMessage: {
    marginTop: 14,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,0.7)",
    background: "rgba(127,29,29,0.72)",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
  busyMessage: {
    marginTop: 10,
    color: "#a5f3fc",
  },
  main: {
    marginTop: 18,
    position: "relative",
    zIndex: 2,
  },
  screenStack: {
    display: "grid",
    gap: 16,
  },
  welcomePanel: {
    border: "1px solid rgba(103,232,249,.25)",
    background: "linear-gradient(135deg, rgba(8,47,73,.9), rgba(15,23,42,.82))",
    borderRadius: 24,
    padding: "clamp(22px, 4vw, 44px)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.3fr) minmax(280px, .7fr)",
    gap: 28,
    alignItems: "center",
    boxShadow: "0 24px 80px rgba(2,8,23,.24)",
  },
  welcomeCopy: {
    display: "grid",
    gap: 12,
  },
  eyebrow: {
    color: "#67e8f9",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: ".12em",
  },
  welcomeTitle: {
    margin: 0,
    fontSize: "clamp(30px, 5vw, 52px)",
    lineHeight: 1.16,
    maxWidth: 780,
  },
  leadText: {
    margin: 0,
    maxWidth: 760,
    color: "rgba(226,232,240,.78)",
    lineHeight: 1.8,
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
    borderRadius: 12,
    background: "rgba(2,8,23,.32)",
  },
  quickStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    color: "#062029",
    background: "#a5f3fc",
    fontWeight: 800,
  },
  quickStepNumberText: {},
  primaryButtonLarge: {
    border: "none",
    borderRadius: 14,
    padding: "13px 20px",
    background: "linear-gradient(120deg, #67e8f9, #38bdf8)",
    color: "#062029",
    fontSize: 15,
    fontWeight: 800,
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
    color: "#a5f3fc",
    cursor: "pointer",
    padding: "8px 0",
  },
  metricStrip: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    fontSize: 12,
    color: "rgba(226,232,240,.72)",
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
    border: "1px solid rgba(148,226,255,.2)",
    background: "rgba(11,28,57,.72)",
    color: "#f8fafc",
    borderRadius: 16,
    padding: 16,
    display: "grid",
    gap: 12,
    cursor: "pointer",
  },
  projectCardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "rgba(226,232,240,.62)",
  },
  statusPill: {
    width: "fit-content",
    borderRadius: 999,
    padding: "3px 8px",
    color: "#a5f3fc",
    background: "rgba(8,47,73,.8)",
    fontSize: 11,
    fontWeight: 700,
  },
  projectCardTitle: {
    fontSize: 18,
    lineHeight: 1.45,
  },
  projectCardAction: {
    alignSelf: "end",
    color: "#67e8f9",
    fontWeight: 700,
  },
  emptyState: {
    minHeight: 220,
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 9,
    textAlign: "center",
    border: "1px dashed rgba(148,226,255,.28)",
    borderRadius: 18,
    color: "rgba(226,232,240,.76)",
  },
  emptyStateCompact: {
    padding: 18,
    textAlign: "center",
    border: "1px dashed rgba(148,226,255,.22)",
    borderRadius: 14,
    color: "rgba(226,232,240,.7)",
  },
  emptyStateIcon: {
    fontSize: 32,
  },
  panel: {
    border: "1px solid rgba(148, 226, 255, 0.2)",
    background: "rgba(7, 20, 44, 0.72)",
    borderRadius: 18,
    padding: 20,
    display: "grid",
    gap: 12,
  },
  panelTitle: {
    margin: 0,
    fontSize: 24,
  },
  screenIntro: {
    display: "grid",
    gap: 7,
    paddingBottom: 14,
    borderBottom: "1px solid rgba(148,226,255,.14)",
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
    color: "rgba(226,232,240,.72)",
    lineHeight: 1.5,
  },
  inputLarge: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(148,226,255,.34)",
    background: "rgba(6,17,37,.86)",
    color: "#f8fafc",
    padding: "14px 15px",
    fontSize: 16,
  },
  choiceExplanation: {
    borderLeft: "3px solid #22d3ee",
    borderRadius: "0 10px 10px 0",
    background: "rgba(8,47,73,.45)",
    padding: "10px 12px",
    display: "grid",
    gap: 4,
    color: "rgba(226,232,240,.76)",
  },
  advancedDetails: {
    border: "1px solid rgba(148,226,255,.17)",
    borderRadius: 14,
    padding: "12px 14px",
    background: "rgba(3,16,33,.38)",
  },
  nestedDetails: {
    borderTop: "1px solid rgba(148,226,255,.12)",
    paddingTop: 10,
  },
  advancedContent: {
    display: "grid",
    gap: 12,
    paddingTop: 12,
  },
  helpText: {
    color: "rgba(226,232,240,.68)",
    fontSize: 12,
  },
  projectOverviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  nextActionCard: {
    border: "1px solid rgba(103,232,249,.3)",
    borderRadius: 18,
    padding: 18,
    display: "grid",
    gap: 9,
    alignContent: "start",
    background: "linear-gradient(135deg, rgba(8,47,73,.72), rgba(10,30,60,.6))",
  },
  nextActionTitle: {
    fontSize: 22,
  },
  progressCard: {
    border: "1px solid rgba(148,226,255,.18)",
    borderRadius: 18,
    padding: 18,
    display: "grid",
    gap: 10,
    alignContent: "start",
    background: "rgba(10,30,60,.6)",
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
    background: "linear-gradient(90deg, #22d3ee, #38bdf8)",
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
    borderRadius: 18,
    boxShadow: "0 18px 50px rgba(2, 8, 23, .35)",
    backdropFilter: "blur(14px)",
  },
  generationMonitorIcon: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,.12)",
    color: "#cffafe",
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
    color: "rgba(226, 232, 240, .76)",
    fontSize: 12,
  },
  generationMonitorAction: {
    border: "1px solid rgba(207, 250, 254, .36)",
    borderRadius: 12,
    padding: "9px 12px",
    background: "rgba(8, 20, 43, .68)",
    color: "#ecfeff",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  contextNotice: {
    display: "grid",
    gap: 4,
    marginBottom: 14,
    padding: "12px 14px",
    border: "1px solid rgba(103, 232, 249, .28)",
    borderRadius: 14,
    background: "rgba(8, 47, 73, .42)",
    color: "rgba(226, 232, 240, .82)",
    fontSize: 12,
  },
  runningIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#a5f3fc",
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
    borderBottom: "1px solid rgba(148,226,255,.08)",
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
    border: "1px solid rgba(103,232,249,.3)",
    borderRadius: 16,
    padding: "12px 14px",
    background: "rgba(5,14,28,.94)",
    backdropFilter: "blur(12px)",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    color: "rgba(226,232,240,.72)",
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
    border: "1px solid rgba(34, 211, 238, 0.2)",
    borderRadius: 12,
    padding: "12px 14px",
    background: "rgba(12, 34, 67, 0.6)",
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
    border: "1px solid rgba(148,226,255,0.22)",
    background: "rgba(11, 28, 57, 0.72)",
    color: "#f8fafc",
    borderRadius: 12,
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
    borderRadius: 10,
    border: "1px solid rgba(148,226,255,0.26)",
    background: "rgba(6, 17, 37, 0.8)",
    color: "#f8fafc",
    padding: "9px 11px",
  },
  inputSmall: {
    borderRadius: 10,
    border: "1px solid rgba(148,226,255,0.26)",
    background: "rgba(6, 17, 37, 0.8)",
    color: "#f8fafc",
    padding: "9px 11px",
    minWidth: 110,
  },
  primaryButton: {
    border: "none",
    borderRadius: 12,
    padding: "10px 16px",
    background: "linear-gradient(120deg, #22d3ee, #38bdf8)",
    color: "#072532",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid rgba(148,226,255,0.28)",
    borderRadius: 12,
    padding: "9px 14px",
    background: "rgba(9, 30, 61, 0.72)",
    color: "#f8fafc",
    cursor: "pointer",
    width: "fit-content",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  infoCard: {
    border: "1px solid rgba(148,226,255,0.2)",
    borderRadius: 12,
    padding: "10px 12px",
    display: "grid",
    gap: 6,
    background: "rgba(10, 30, 60, 0.7)",
  },
  jobCard: {
    border: "1px solid rgba(148,226,255,0.2)",
    borderRadius: 12,
    padding: "10px 12px",
    display: "grid",
    gap: 6,
    background: "rgba(9, 24, 50, 0.68)",
  },
  stepWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  stepBadge: {
    border: "1px solid rgba(148,226,255,0.24)",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 12,
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
  },
  inlineButton: {
    border: "1px solid rgba(148,226,255,0.18)",
    borderRadius: 999,
    padding: "2px 6px",
    background: "rgba(3, 16, 33, 0.72)",
    color: "#f8fafc",
    cursor: "pointer",
    fontSize: 11,
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
    border: "1px solid rgba(148,226,255,0.16)",
    borderRadius: 8,
    padding: "8px 10px",
    display: "grid",
    gridTemplateColumns: "20px 1fr auto",
    gap: 8,
    alignItems: "center",
    background: "rgba(6, 20, 42, 0.6)",
  },
  fileGrid: {
    display: "grid",
    gap: 6,
  },
  fileLink: {
    border: "1px solid rgba(148,226,255,0.16)",
    borderRadius: 8,
    padding: "7px 9px",
    color: "#bae6fd",
    textDecoration: "none",
    background: "rgba(3, 16, 33, 0.55)",
    overflowWrap: "anywhere",
  },
  logBox: {
    margin: 0,
    borderRadius: 12,
    border: "1px solid rgba(148,226,255,0.2)",
    background: "rgba(2, 8, 23, 0.9)",
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
    border: "1px solid rgba(148,226,255,.16)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(6,20,42,.56)",
  },
  dialogueNumber: {
    width: 28,
    height: 28,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    flex: "0 0 auto",
    color: "#062029",
    background: "#a5f3fc",
    fontWeight: 800,
  },
  assetRow: {
    border: "1px solid rgba(148,226,255,0.18)",
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
    border: "1px solid rgba(148,226,255,0.18)",
    background: "rgba(2, 8, 23, 0.8)",
  },
  timelineHeroGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  timelineWorkspace: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 14,
    alignItems: "start",
  },
  timelineVisualPanel: {
    border: "1px solid rgba(148,226,255,0.16)",
    borderRadius: 16,
    background: "rgba(4, 16, 34, 0.82)",
    padding: 14,
    display: "grid",
    gap: 10,
    overflowX: "auto",
  },
  timelineRuler: {
    position: "relative",
    height: 34,
    borderRadius: 10,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(13,23,42,0.72) 100%)",
    border: "1px solid rgba(148,226,255,0.12)",
    overflow: "hidden",
  },
  timelineTick: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    background: "rgba(148,226,255,0.18)",
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
    borderRadius: 12,
    border: "1px solid rgba(148,226,255,0.14)",
    padding: "10px 12px",
    background: "rgba(8, 20, 43, 0.78)",
    display: "grid",
    gap: 4,
    alignContent: "center",
  },
  timelineLaneCanvas: {
    position: "relative",
    minHeight: 72,
    borderRadius: 12,
    border: "1px solid rgba(148,226,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(7,20,44,0.92) 0%, rgba(5,14,28,0.92) 100%)",
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
    border: "1px solid rgba(148,226,255,0.16)",
    borderRadius: 16,
    background: "rgba(7, 20, 44, 0.78)",
    padding: 14,
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  timelineInspectorHeader: {
    fontSize: 18,
    fontWeight: 700,
  },
  timelineUtilityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  timelineUtilityCard: {
    border: "1px solid rgba(148,226,255,0.16)",
    borderRadius: 14,
    background: "rgba(8, 20, 43, 0.72)",
    padding: 12,
    display: "grid",
    gap: 10,
  },
  compactField: {
    display: "grid",
    gap: 6,
    minWidth: 120,
  },
  timelineTrack: {
    border: "1px solid rgba(148,226,255,0.18)",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 8,
    background: "rgba(9, 30, 60, 0.55)",
  },
  clipEditor: {
    borderRadius: 10,
    border: "1px solid rgba(148,226,255,0.16)",
    background: "rgba(5, 18, 38, 0.6)",
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
  },
  previewCard: {
    border: "1px solid rgba(148,226,255,0.22)",
    borderRadius: 12,
    padding: "12px 14px",
    display: "grid",
    gap: 6,
    background: "rgba(6, 25, 48, 0.64)",
  },
  videoPlayer: {
    width: "100%",
    maxHeight: 520,
    borderRadius: 8,
    border: "1px solid rgba(148,226,255,0.22)",
    background: "#020617",
  },
  downloadButton: {
    border: "1px solid rgba(148,226,255,0.28)",
    borderRadius: 8,
    padding: "9px 14px",
    background: "rgba(9, 30, 61, 0.72)",
    color: "#f8fafc",
    textDecoration: "none",
    width: "fit-content",
  },
};
