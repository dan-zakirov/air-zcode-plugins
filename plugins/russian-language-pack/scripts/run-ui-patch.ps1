$ErrorActionPreference = "Stop"

$runtime = $env:ZCODE_NODE_EXECUTABLE
if ([string]::IsNullOrWhiteSpace($runtime)) {
    $runtime = Join-Path $env:LOCALAPPDATA "Programs\ZCode\ZCode.exe"
}

$controller = Join-Path $PSScriptRoot "runtime-ui-controller.mjs"
if (-not (Test-Path -LiteralPath $runtime) -or -not (Test-Path -LiteralPath $controller)) {
    [Console]::Error.WriteLine("[russian-language-pack] ZCode runtime files were not found.")
    exit 1
}

$mainProcess = Get-Process -Name "ZCode" -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    Select-Object -First 1
if ($null -eq $mainProcess) {
    [Console]::Error.WriteLine("[russian-language-pack] The ZCode main process was not found.")
    exit 1
}

$lockPath = Join-Path $env:USERPROFILE ".zcode\air-russian-language-pack\runtime.lock.json"
if (Test-Path -LiteralPath $lockPath) {
    try {
        $lock = Get-Content -LiteralPath $lockPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $runningController = Get-Process -Id ([int]$lock.pid) -ErrorAction SilentlyContinue
        if ($null -ne $runningController -and [int]$lock.zcodePid -eq $mainProcess.Id) {
            exit 0
        }
    }
    catch {
        # A stale or incomplete lock is replaced by the controller.
    }
}

$previousElectronRunAsNode = $env:ELECTRON_RUN_AS_NODE
try {
    $env:ELECTRON_RUN_AS_NODE = "1"
    Start-Process -FilePath $runtime `
        -ArgumentList @("`"$controller`"", "--zcode-pid", "$($mainProcess.Id)") `
        -WindowStyle Hidden | Out-Null
}
finally {
    if ($null -eq $previousElectronRunAsNode) {
        Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    }
    else {
        $env:ELECTRON_RUN_AS_NODE = $previousElectronRunAsNode
    }
}

exit 0
