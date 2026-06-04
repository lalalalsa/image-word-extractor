$ErrorActionPreference = "Stop"

$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Launcher = Join-Path $AppRoot "启动图片单词提取工具.cmd"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "图片英文单词提取工具.lnk"

if (-not (Test-Path $Launcher)) {
  throw "Launcher was not found: $Launcher"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = $Launcher
$shortcut.WorkingDirectory = $AppRoot
$shortcut.Description = "图片英文单词提取工具"
$shortcut.Save()

Write-Host "Desktop shortcut created: $ShortcutPath"
