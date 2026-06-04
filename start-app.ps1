$ErrorActionPreference = "Stop"

$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 5177
$Url = "http://localhost:$Port/"
$ServerScript = Join-Path $AppRoot "server.js"

function Test-Url {
  param([string]$TargetUrl)

  try {
    $response = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Get-NodePath {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $defaultPath = "C:\Program Files\nodejs\node.exe"
  if (Test-Path $defaultPath) {
    return $defaultPath
  }

  throw "Node.js was not found. Please install Node.js or add node.exe to PATH."
}

function Get-EdgePath {
  $programFiles = [Environment]::GetFolderPath("ProgramFiles")
  $programFilesX86 = [Environment]::GetFolderPath("ProgramFilesX86")
  $localAppData = [Environment]::GetFolderPath("LocalApplicationData")

  $candidates = @(
    (Join-Path $programFiles "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $programFilesX86 "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $localAppData "Microsoft\Edge\Application\msedge.exe")
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  $command = Get-Command msedge -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  return $null
}

if (-not (Test-Path $ServerScript)) {
  throw "server.js was not found: $ServerScript"
}

if (-not (Test-Url $Url)) {
  $nodePath = Get-NodePath
  Start-Process -FilePath $nodePath -ArgumentList "server.js" -WorkingDirectory $AppRoot -WindowStyle Hidden

  $ready = $false
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Milliseconds 200
    if (Test-Url $Url) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    throw "The local server failed to start. Run node server.js manually to view the error."
  }
}

$edgePath = Get-EdgePath
if ($edgePath) {
  Start-Process -FilePath $edgePath -ArgumentList "--app=$Url", "--new-window"
} else {
  Start-Process $Url
}
