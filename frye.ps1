param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = $null
foreach ($candidate in @('py -3','python','python3')) {
  try {
    $parts = $candidate.Split(' ')
    $exe = $parts[0]
    $prefix = @()
    if ($parts.Count -gt 1) { $prefix = $parts[1..($parts.Count-1)] }
    & $exe @prefix -c "import sys; assert sys.version_info >= (3,10)" 2>$null
    if ($LASTEXITCODE -eq 0) { $Python = @{Exe=$exe; Prefix=$prefix}; break }
  } catch {}
}
if (-not $Python) { throw 'Python 3.10 or newer was not found.' }
& $Python.Exe @($Python.Prefix) "$Root\frye.py" @Args
exit $LASTEXITCODE
