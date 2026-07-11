param(
  [switch]$SkipAivis,
  [switch]$SkipDbPush,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $workspaceRoot

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
}

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
}

if (-not $SkipDbPush) {
  Write-Host "Prisma migration を反映します。"
  corepack pnpm db:migrate:deploy
  if ($LASTEXITCODE -ne 0) {
    throw "corepack pnpm db:migrate:deploy に失敗しました。既存DBを初めてmigration管理へ移す場合はREADMEの手順を確認してください。"
  }
}

Write-Host "開発サーバーを起動します。停止するまでこのウィンドウを閉じないでください。"
$devProcess = Start-Process -FilePath "corepack.cmd" -ArgumentList @("pnpm", "dev") -WorkingDirectory $workspaceRoot -PassThru -NoNewWindow
try {
  Wait-HttpReady -Url "http://127.0.0.1:3000" -TimeoutSec 120
  Wait-HttpReady -Url "http://127.0.0.1:3001/health" -TimeoutSec 120
  if (-not $NoBrowser) {
    Start-Process "http://127.0.0.1:3000" | Out-Null
  }
  Wait-Process -Id $devProcess.Id
  if ($devProcess.ExitCode -ne 0) {
    throw "corepack pnpm dev に失敗しました。"
  }
} finally {
  if (-not $devProcess.HasExited) {
    Stop-Process -Id $devProcess.Id
  }
}
