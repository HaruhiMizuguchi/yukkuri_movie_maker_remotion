import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {describe, expect, it} from "vitest";

describe("デスクトップ用BATランチャー", () => {
  it("任意の作業フォルダーからPowerShell起動スクリプトを呼び出せる", async () => {
    const launcherBytes = await readFile(resolve("start_yukkuri_movie_maker.bat"));
    const launcher = launcherBytes.toString("ascii");

    // cmd.exeのコードページに依存してコマンドが分断されないよう、BATはASCIIだけで構成する。
    expect([...launcherBytes].every((byte) => byte < 0x80)).toBe(true);
    expect(launcher).toContain('set "SCRIPT_DIR=%~dp0"');
    expect(launcher).toContain('-File "%SCRIPT_DIR%start_yukkuri_movie_maker.ps1" %*');
    expect(launcher).toContain("Press any key to close this window");
    expect(launcher).toContain("pause >nul");
    expect(launcher).toContain("exit /b %EXIT_CODE%");
  });

  it("ブラウザを開くまで段階を表示し、起動後もサーバー終了まで待機する", async () => {
    const launcherPath = resolve("start_yukkuri_movie_maker.ps1");
    const launcherBytes = await readFile(launcherPath);
    const launcher = launcherBytes.toString("utf8");

    // Windows PowerShell 5はBOMなしUTF-8の日本語をANSIとして誤読するため、BOMを必須にする。
    expect([...launcherBytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    expect(launcher).toContain("[1/5] AivisSpeech");
    expect(launcher).toContain("[2/5] PostgreSQL");
    expect(launcher).toContain("[3/5] データベース");
    expect(launcher).toContain("[4/5] Web/API/Worker");
    expect(launcher).toContain("[5/5] ブラウザ");
    expect(launcher).toContain("このウィンドウはサーバー稼働中ずっと開いたままです");
    expect(launcher).toContain("Web/APIサーバーは既に起動しています");
    expect(launcher).toContain('$serversAlreadyRunning = (Test-PortOpen -HostName "localhost" -Port 3000)');
    expect(launcher).toContain("Start-Transcript");
    expect(launcher).toContain("logs\\launcher");

    const browserIndex = launcher.indexOf('Start-Process "http://localhost:3000"');
    const waitIndex = launcher.indexOf("Wait-Process -Id $devProcess.Id");
    expect(browserIndex).toBeGreaterThan(-1);
    expect(waitIndex).toBeGreaterThan(browserIndex);
  });

  it("Docker Desktopが停止中なら自動起動し、エンジン準備後にPostgreSQLを開始する", async () => {
    const launcher = await readFile(resolve("start_yukkuri_movie_maker.ps1"), "utf8");

    expect(launcher).toContain("function Test-DockerReady");
    expect(launcher).toContain("function Wait-DockerReady");
    expect(launcher).toContain("Docker Desktop.exe");
    expect(launcher).toContain("Docker Desktopを起動します");
    expect(launcher).toContain("Wait-DockerReady -TimeoutSec 180");

    const dockerWaitIndex = launcher.indexOf("Wait-DockerReady -TimeoutSec 180");
    const dbStartIndex = launcher.indexOf('Invoke-LoggedNativeCommand -FilePath "corepack.cmd"');
    expect(dockerWaitIndex).toBeGreaterThan(-1);
    expect(dbStartIndex).toBeGreaterThan(dockerWaitIndex);
  });

  it("外部コマンドの出力を起動ログへ転記し、Docker障害の詳細を残す", async () => {
    const launcher = await readFile(resolve("start_yukkuri_movie_maker.ps1"), "utf8");

    expect(launcher).toContain("function Invoke-LoggedNativeCommand");
    expect(launcher).toContain("Dockerエンジンの状態:");
    expect(launcher).toContain("docker info");
    expect(launcher).toContain("Docker Desktopの起動待機がタイムアウトしました");
  });
});
