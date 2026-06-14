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
    "C:\Users\1120h\AppData\Local\Programs\AivisSpeech\AivisSpeech.exe",
    "C:\Program Files\AivisSpeech\AivisSpeech.exe"
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
  throw "PostgreSQL (localhost:5432) に接続できません。先にDBを起動してください。"
}

if (-not $SkipDbPush) {
  Write-Host "Prisma schema を反映します。"
  corepack pnpm db:push
  if ($LASTEXITCODE -ne 0) {
    throw "corepack pnpm db:push に失敗しました。"
  }
}

if (-not $NoBrowser) {
  Start-Process "http://127.0.0.1:3000" | Out-Null
}

Write-Host "開発サーバーを起動します。停止するまでこのウィンドウを閉じないでください。"
corepack pnpm dev
if ($LASTEXITCODE -ne 0) {
  throw "corepack pnpm dev に失敗しました。"
}
