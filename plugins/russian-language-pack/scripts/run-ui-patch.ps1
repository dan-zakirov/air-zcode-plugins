$ErrorActionPreference = "Stop"

$pluginRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $pluginRoot ".zcode-plugin\plugin.json"
$supervisorSource = Join-Path $PSScriptRoot "runtime-supervisor.ps1"
$stateDir = Join-Path $env:USERPROFILE ".zcode\air-russian-language-pack"
$supervisorTarget = Join-Path $stateDir "runtime-supervisor.ps1"
$supervisorLockPath = Join-Path $stateDir "supervisor.lock.json"
$powerShell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path -LiteralPath $manifestPath) -or -not (Test-Path -LiteralPath $supervisorSource) -or -not (Test-Path -LiteralPath $powerShell)) {
    [Console]::Error.WriteLine("[russian-language-pack] Startup runtime files were not found.")
    exit 1
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$runtimeVersion = [string]$manifest.version
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null

$supervisorRunning = $false
if (Test-Path -LiteralPath $supervisorLockPath) {
    try {
        $lock = Get-Content -LiteralPath $supervisorLockPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$lock.pid)" -ErrorAction SilentlyContinue
        $owned = $null -ne $process -and $process.CommandLine -match "runtime-supervisor\.ps1"
        if ($owned -and [string]$lock.version -eq $runtimeVersion) {
            $supervisorRunning = $true
        }
        elseif ($owned) {
            Stop-Process -Id ([int]$lock.pid) -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 250
        }
    }
    catch {
        # A stale supervisor lock is replaced below.
    }
}

Copy-Item -LiteralPath $supervisorSource -Destination $supervisorTarget -Force

$runKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$runValueName = "AIR ZCode Russian Language Pack"
$startupCommand = "`"$powerShell`" -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$supervisorTarget`" -RuntimeVersion `"$runtimeVersion`""
New-Item -Path $runKeyPath -Force | Out-Null
New-ItemProperty -LiteralPath $runKeyPath -Name $runValueName -Value $startupCommand -PropertyType String -Force | Out-Null

if (-not $supervisorRunning) {
    Remove-Item -LiteralPath $supervisorLockPath -Force -ErrorAction SilentlyContinue
    Start-Process -FilePath $powerShell `
        -ArgumentList @("-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", "`"$supervisorTarget`"", "-RuntimeVersion", "`"$runtimeVersion`"") `
        -WindowStyle Hidden | Out-Null
}

exit 0
