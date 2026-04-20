export const DEFAULT_BASELINE_DIR: string;
export const DEFAULT_DIFF_DIR: string;
export const DEFAULT_THRESHOLD_RATIO: number;
export function findLatestManifestPaths(evidenceRoot?: string): Promise<string[]>;
export function loadManifest(manifestPath: string): Promise<any>;
export function compareManifest(
  manifestPath: string,
  options?: {
    baselineDir?: string;
    diffDir?: string;
    thresholdRatio?: number;
    update?: boolean;
    workspaceRoot?: string;
  }
): Promise<any>;
export function comparePngFiles(
  currentPath: string,
  baselinePath: string,
  diffPath: string
): Promise<{
  width: number;
  height: number;
  totalPixels: number;
  diffPixels: number;
  diffRatio: number;
}>;
export function runVisualRegressionCli(argv?: string[]): Promise<any>;
export function parseArgs(argv: string[]): {
  baselineDir: string;
  diffDir: string;
  evidenceRoot: string;
  manifest: string | null;
  thresholdRatio: number;
  update: boolean;
};
