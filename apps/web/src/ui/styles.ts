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
.tab, .tab-active {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(15, 30, 60, 0.4);
  color: var(--fg);
  cursor: pointer;
  transition: transform 180ms ease, background 180ms ease;
}
.tab:hover, .tab-active:hover {
  transform: translateY(-1px);
}
.tab-active {
  background: linear-gradient(120deg, var(--accent-strong), var(--accent));
  color: #062029;
  font-weight: 700;
}
@media (max-width: 900px) {
  .tab, .tab-active {
    flex: 1 0 44%;
  }
}
`;

export const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px 18px 40px",
    position: "relative",
    overflow: "hidden",
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
  kicker: {
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    opacity: 0.7,
    fontSize: 12,
  },
  title: {
    margin: "4px 0 0",
    fontSize: "clamp(24px, 3.5vw, 36px)",
  },
  statusCard: {
    border: "1px solid rgba(148, 226, 255, 0.28)",
    borderRadius: 18,
    padding: "12px 16px",
    minWidth: 240,
    background: "rgba(15, 30, 60, 0.52)",
    display: "grid",
    gap: 4,
  },
  navBar: {
    marginTop: 16,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    position: "relative",
    zIndex: 2,
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
