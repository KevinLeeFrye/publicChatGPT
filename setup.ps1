param([switch]$CreateDesktopShortcut)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dirs = @('state','memory','logs','workshop\staging','workshop\accepted','workshop\rejected','optional\capabilities','optional\workspaces','backups')
foreach ($dir in $dirs) { New-Item -ItemType Directory -Force -Path (Join-Path $Root $dir) | Out-Null }
& "$Root\frye.ps1" selfcheck
if ($LASTEXITCODE -ne 0) { throw 'FRYE OS selfcheck failed.' }
if ($CreateDesktopShortcut) {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shortcut = Join-Path $desktop 'FRYE OS Clean Core.lnk'
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut($shortcut)
  $link.TargetPath = 'powershell.exe'
  $link.Arguments = "-NoExit -ExecutionPolicy Bypass -File `"$Root\frye.ps1`" serve --open-browser"
  $link.WorkingDirectory = $Root
  $link.Save()
  Write-Host "Created $shortcut"
}
Write-Host 'FRYE OS clean core setup complete.'
