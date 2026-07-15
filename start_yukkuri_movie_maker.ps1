param(
  [switch]$SkipAivis,
  [switch]$SkipDbPush,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $workspaceRoot

# ショートカット起動で画面を読み取れなかった場合も原因を確認できるよう、全出力を保存する。
$launcherLogDir = Join-Path $workspaceRoot "logs\launcher"
New-Item -ItemType Directory -Path $launcherLogDir -Force | Out-Null
$launcherLogPath = Join-Path $launcherLogDir ("launcher-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
Start-Transcript -Path $launcherLogPath -Force | Out-Null

trap {
  Write-Host "`n起動処理でエラーが発生しました。" -ForegroundColor Red
  Write-Host $_ -ForegroundColor Red
  Write-Host "ログ: $launcherLogPath" -ForegroundColor Yellow
  try {
    Stop-Transcript | Out-Null
  } catch {
    # Transcriptが既に停止済みの場合は何もしない。
  }
  exit 1
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " ゆっくり動画メーカーを起動しています" -ForegroundColor Cyan
Write-Host " このウィンドウは閉じないでください" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "起動ログ: $launcherLogPath"

function Test-PortOpen {
  param(
    [string]$HostName,
    [int]$Port
  )

  try {
    $result = Test-NetConnection -ComputerName $HostName -Port $Port -WarningAction SilentlyContinue
    return [bool]$result.TcpTestSucceeded
  } catch {
    return $false
  }
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSec = 120
  )

  $startedAt = Get-Date
  while (((Get-Date) - $startedAt).TotalSeconds -lt $TimeoutSec) {
    try {
      $response = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -eq 200) {
        return
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  throw "Timed out waiting for $Url"
}

Write-Host "`n[1/5] AivisSpeech（音声合成）を確認しています..." -ForegroundColor Yellow
if (-not $SkipAivis) {
  $aivisCandidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\AivisSpeech\AivisSpeech.exe"),
    (Join-Path $env:ProgramFiles "AivisSpeech\AivisSpeech.exe")
  )
  $aivisPath = $aivisCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($aivisPath) {
    if (-not (Test-PortOpen -HostName "127.0.0.1" -Port 10101)) {
      Write-Host "AivisSpeech を起動します: $aivisPath"
      Start-Process -FilePath $aivisPath | Out-Null
    }
    Wait-HttpReady -Url "http://127.0.0.1:10101/speakers" -TimeoutSec 180
    Write-Host "AivisSpeech の準備ができました。"
  } else {
    Write-Warning "AivisSpeech.exe が見つかりませんでした。音声合成が必要なら手動で起動してください。"
  }
} else {
  Write-Host "AivisSpeechの確認をスキップしました。"
}

Write-Host "`n[2/5] PostgreSQL（データベース）を確認しています..." -ForegroundColor Yellow
if (-not (Test-PortOpen -HostName "localhost" -Port 5432)) {
  Write-Host "PostgreSQLをDocker Composeで起動します。"
  corepack pnpm db:up
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQLを自動起動できませんでした。Docker DesktopまたはローカルDBを起動してください。"
  }
  $dbStartedAt = Get-Date
  while (-not (Test-PortOpen -HostName "localhost" -Port 5432)) {
    if (((Get-Date) - $dbStartedAt).TotalSeconds -ge 60) {
      throw "PostgreSQLの起動待機がタイムアウトしました。"
    }
    Start-Sleep -Seconds 2
  }
} else {
  Write-Host "PostgreSQLは起動済みです。"
}

Write-Host "`n[3/5] データベースを最新状態にしています..." -ForegroundColor Yellow
if (-not $SkipDbPush) {
  Write-Host "Prisma migration を反映します。"
  corepack pnpm db:migrate:deploy
  if ($LASTEXITCODE -ne 0) {
    throw "corepack pnpm db:migrate:deploy に失敗しました。既存DBを初めてmigration管理へ移す場合はREADMEの手順を確認してください。"
  }
  Write-Host "データベースの準備ができました。"
} else {
  Write-Host "データベース更新をスキップしました。"
}

Write-Host "`n[4/5] Web/API/Workerサーバーを起動しています..." -ForegroundColor Yellow
$serversAlreadyRunning = (Test-PortOpen -HostName "localhost" -Port 3000) -and (Test-PortOpen -HostName "127.0.0.1" -Port 3001)
if ($serversAlreadyRunning) {
  Write-Host "Web/APIサーバーは既に起動しています。二重起動せず、そのまま利用します。" -ForegroundColor Green
  Write-Host "`n[5/5] ブラウザを開きます..." -ForegroundColor Yellow
  if (-not $NoBrowser) {
    Start-Process "http://localhost:3000" | Out-Null
    Write-Host "ブラウザを開きました: http://localhost:3000" -ForegroundColor Green
  } else {
    Write-Host "ブラウザの自動表示をスキップしました。URL: http://localhost:3000"
  }
  Write-Host "既存サーバーを利用したため、起動処理は完了です。" -ForegroundColor Green
} else {
  $devProcess = Start-Process -FilePath "corepack.cmd" -ArgumentList @("pnpm", "dev") -WorkingDirectory $workspaceRoot -PassThru -NoNewWindow
  try {
    Write-Host "Web画面とAPIの応答を待っています。初回は数分かかることがあります。"
    Wait-HttpReady -Url "http://localhost:3000" -TimeoutSec 120
    Wait-HttpReady -Url "http://127.0.0.1:3001/health" -TimeoutSec 120
    Write-Host "Web/API/Workerサーバーの準備ができました。"

    Write-Host "`n[5/5] ブラウザを開きます..." -ForegroundColor Yellow
    if (-not $NoBrowser) {
      Start-Process "http://localhost:3000" | Out-Null
      Write-Host "ブラウザを開きました: http://localhost:3000" -ForegroundColor Green
    } else {
      Write-Host "ブラウザの自動表示をスキップしました。URL: http://localhost:3000"
    }

    Write-Host "`n起動完了。このウィンドウはサーバー稼働中ずっと開いたままです。" -ForegroundColor Green
    Write-Host "終了するときは、このウィンドウで Ctrl+C を押してください。"
    Wait-Process -Id $devProcess.Id
    if ($devProcess.ExitCode -ne 0) {
      throw "corepack pnpm dev に失敗しました。"
    }
  } finally {
    if (-not $devProcess.HasExited) {
      Stop-Process -Id $devProcess.Id
    }
  }
}

Stop-Transcript | Out-Null
