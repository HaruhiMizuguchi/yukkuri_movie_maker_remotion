import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type RootPackageJson = {
  scripts?: Record<string, string>;
};

describe('root package scripts', () => {
  it('dev script uses logging wrapper', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, 'utf-8'),
    ) as RootPackageJson;
    const devScript = packageJson.scripts?.dev ?? '';

    expect(devScript).toBe('node scripts/devWithLogging.mjs');
  });

  it('cli script uses corepack pnpm for workspace command', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, 'utf-8'),
    ) as RootPackageJson;
    const cliScript = packageJson.scripts?.cli ?? '';

    expect(cliScript).toContain('corepack pnpm -C apps/cli start');
  });

  it('exposes customer journey e2e scripts', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, 'utf-8'),
    ) as RootPackageJson;

    expect(packageJson.scripts?.['test:e2e']).toBe('playwright test');
    expect(packageJson.scripts?.['test:e2e:journey']).toBe(
      'playwright test e2e/customerJourney.spec.ts',
    );
    expect(packageJson.scripts?.['test:e2e:visual']).toBe(
      'node scripts/runCustomerJourneyVisual.mjs',
    );
    expect(packageJson.scripts?.['test:e2e:visual:update']).toBe(
      'node scripts/runCustomerJourneyVisual.mjs --update',
    );
    expect(packageJson.scripts?.['test:e2e:visual:check']).toBe(
      'node scripts/visualRegression.mjs',
    );
    expect(packageJson.scripts?.['test:e2e:real:preflight']).toBe(
      'node scripts/checkRealE2ePrereqs.mjs',
    );
    expect(packageJson.scripts?.['test:e2e:real']).toBe(
      'playwright test -c playwright.real.config.ts',
    );
    expect(packageJson.scripts?.['test:e2e:report']).toBe(
      'playwright show-report outputs/test_evidence/playwright/html-report',
    );
  });

  it('exposes database helper scripts for real e2e', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, 'utf-8'),
    ) as RootPackageJson;

    expect(packageJson.scripts?.['db:up']).toBe(
      'docker compose -f docker-compose.e2e.yml up -d',
    );
    expect(packageJson.scripts?.['db:down']).toBe(
      'docker compose -f docker-compose.e2e.yml down',
    );
  });
});
