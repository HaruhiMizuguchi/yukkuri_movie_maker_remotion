import { describe, expect, it } from 'vitest';
import { join } from 'node:path';

import {
  buildConcurrentDevCommand,
  buildDevLogPaths,
  createLogTimestamp,
  DEV_WORKSPACE_COMMANDS,
} from '../scripts/devWithLogging.mjs';

describe('devWithLogging', () => {
  it('uses corepack pnpm for all workspace dev commands', () => {
    expect(DEV_WORKSPACE_COMMANDS).toEqual([
      'corepack pnpm -C apps/web dev',
      'corepack pnpm -C apps/api dev',
      'corepack pnpm -C apps/worker dev',
    ]);
  });

  it('builds concurrently command with quoted child commands', () => {
    expect(buildConcurrentDevCommand()).toBe(
      'corepack pnpm exec concurrently -k -n WEB,API,WORKER "corepack pnpm -C apps/web dev" "corepack pnpm -C apps/api dev" "corepack pnpm -C apps/worker dev"',
    );
  });

  it('builds timestamped and latest log paths', () => {
    const fixedDate = new Date('2026-02-18T23:59:58Z');
    const timestamp = createLogTimestamp(fixedDate);
    const paths = buildDevLogPaths('C:/repo', fixedDate);

    expect(timestamp).toBe('20260218-235958');
    expect(paths.logDirectory).toBe(join('C:/repo', 'logs', 'dev'));
    expect(paths.runLogPath).toBe(join('C:/repo', 'logs', 'dev', `dev-${timestamp}.log`));
    expect(paths.latestLogPath).toBe(join('C:/repo', 'logs', 'dev', 'latest.log'));
  });
});
