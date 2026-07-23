param(
    [string]$RuntimeVersion = "",
    [switch]$SelfTest
)

$ErrorActionPreference = "Stop"

$PluginId = "russian-language-pack@air-zcode-plugins"
$RunKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$RunValueName = "AIR ZCode Russian Language Pack"
$StateDir = Join-Path $env:USERPROFILE ".zcode\air-russian-language-pack"
$ConfigPath = Join-Path $env:USERPROFILE ".zcode\cli\config.json"
$InstalledPath = Join-Path $env:USERPROFILE ".zcode\cli\plugins\installed_plugins.json"
$RuntimeLockPath = Join-Path $StateDir "runtime.lock.json"
$SupervisorLockPath = Join-Path $StateDir "supervisor.lock.json"
$SupervisorStatePath = Join-Path $StateDir "supervisor.state.json"
$RuntimeControllerPath = Join-Path $StateDir "runtime-ui-controller.mjs"

function Read-JsonFile {
    param([string]$Path, $Fallback)

    try {
        return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        return $Fallback
    }
}

function Get-InstalledPlugin {
    param([string]$Path)

    $installed = Read-JsonFile -Path $Path -Fallback ([pscustomobject]@{ plugins = @() })
    return $installed.plugins | Where-Object { $_.id -eq $PluginId } | Select-Object -First 1
}

function Test-PluginEnabled {
    param([string]$Path)

    $config = Read-JsonFile -Path $Path -Fallback ([pscustomobject]@{})
    if ($null -eq $config.plugins -or $null -eq $config.plugins.enabledPlugins) {
        return $false
    }
    $property = $config.plugins.enabledPlugins.PSObject.Properties[$PluginId]
    return $null -ne $property -and $property.Value -eq $true
}

function Get-StateFingerprint {
    param($Payload)

    $fingerprint = [ordered]@{}
    foreach ($entry in $Payload.GetEnumerator()) {
        if ($entry.Key -ne "updatedAt") {
            $fingerprint[$entry.Key] = $entry.Value
        }
    }
    return $fingerprint | ConvertTo-Json -Compress -Depth 5
}

function Get-OwnedProcess {
    param(
        [int]$ProcessId,
        [string]$CommandPattern
    )

    if ($ProcessId -le 0) {
        return $null
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if ($null -eq $process -or $process.CommandLine -notmatch $CommandPattern) {
        return $null
    }
    return $process
}

function Get-ZCodeMainProcess {
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'ZCode.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            -not [string]::IsNullOrWhiteSpace($_.CommandLine) -and
            $_.CommandLine -notmatch "--type=" -and
            $_.CommandLine -notmatch "zcode\.cjs|runtime-ui-controller\.mjs"
        } |
        Sort-Object CreationDate -Descending
    return $processes | Select-Object -First 1
}

function Set-SupervisorState {
    param(
        [string]$Status,
        [hashtable]$Details = @{}
    )

    $payload = [ordered]@{
        version = $RuntimeVersion
        pid = $PID
        status = $Status
        updatedAt = [DateTime]::UtcNow.ToString("o")
    }
    foreach ($entry in $Details.GetEnumerator()) {
        $payload[$entry.Key] = $entry.Value
    }

    $serializedFingerprint = Get-StateFingerprint -Payload $payload
    if ($script:LastStateFingerprint -eq $serializedFingerprint) {
        return
    }

    $script:LastStateFingerprint = $serializedFingerprint
    $payload | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $SupervisorStatePath -Encoding UTF8
}

function Remove-StartupRegistration {
    try {
        Remove-ItemProperty -LiteralPath $RunKeyPath -Name $RunValueName -ErrorAction SilentlyContinue
    }
    catch {
        # The plugin is already removed; no retry is required.
    }
}

function Test-CurrentController {
    param(
        [int]$ZCodePid,
        [string]$Version
    )

    $lock = Read-JsonFile -Path $RuntimeLockPath -Fallback $null
    if ($null -eq $lock) {
        return $false
    }

    $controller = Get-OwnedProcess -ProcessId ([int]$lock.pid) -CommandPattern "runtime-ui-controller\.mjs"
    $matches = $null -ne $controller -and
        [int]$lock.zcodePid -eq $ZCodePid -and
        [string]$lock.version -eq $Version
    if ($matches) {
        return $true
    }

    if ($null -ne $controller) {
        Stop-Process -Id ([int]$lock.pid) -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 250
    }
    Remove-Item -LiteralPath $RuntimeLockPath -Force -ErrorAction SilentlyContinue
    return $false
}

function Start-RuntimeController {
    param(
        $ZCodeProcess
    )

    $runtimePath = [string]$ZCodeProcess.ExecutablePath
    if ([string]::IsNullOrWhiteSpace($runtimePath)) {
        $runtimePath = Join-Path $env:LOCALAPPDATA "Programs\ZCode\ZCode.exe"
    }
    if (-not (Test-Path -LiteralPath $RuntimeControllerPath) -or -not (Test-Path -LiteralPath $runtimePath)) {
        throw "ZCode runtime files were not found."
    }

    $previousElectronRunAsNode = $env:ELECTRON_RUN_AS_NODE
    try {
        $env:ELECTRON_RUN_AS_NODE = "1"
        Start-Process -FilePath $runtimePath `
            -ArgumentList @("`"$RuntimeControllerPath`"", "--zcode-pid", "$($ZCodeProcess.ProcessId)", "--runtime-version", "`"$RuntimeVersion`"") `
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
}

if ($SelfTest) {
    $testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "air-zcode-supervisor-$([Guid]::NewGuid().ToString('N'))"
    try {
        New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
        $testConfig = Join-Path $testRoot "config.json"
        $testInstalled = Join-Path $testRoot "installed.json"
        @{ plugins = @{ enabledPlugins = @{ $PluginId = $true } } } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $testConfig -Encoding UTF8
        @{ plugins = @(@{ id = $PluginId; version = "0.1.19"; installPath = $testRoot }) } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $testInstalled -Encoding UTF8
        if (-not (Test-PluginEnabled -Path $testConfig)) { throw "Enabled plugin was not detected." }
        if (Test-PluginEnabled -Path (Join-Path $testRoot "missing-config.json")) { throw "Missing config was detected as enabled." }
        $testPlugin = Get-InstalledPlugin -Path $testInstalled
        if ($testPlugin.version -ne "0.1.19") { throw "Installed plugin version was not detected." }
        if ($null -ne (Get-InstalledPlugin -Path (Join-Path $testRoot "missing-installed.json"))) { throw "Missing plugin was detected as installed." }
        $fingerprintA = Get-StateFingerprint -Payload ([ordered]@{ version = "0.1.19"; status = "active"; updatedAt = "first" })
        $fingerprintB = Get-StateFingerprint -Payload ([ordered]@{ version = "0.1.19"; status = "active"; updatedAt = "second" })
        if ($fingerprintA -ne $fingerprintB) { throw "State timestamp changed the fingerprint." }
        Write-Output "runtime-supervisor self-test passed"
        exit 0
    }
    finally {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if ([string]::IsNullOrWhiteSpace($RuntimeVersion)) {
    exit 1
}

New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
$createdNew = $false
$mutex = [Threading.Mutex]::new($true, "Local\AIR.ZCode.RussianLanguagePack.Supervisor", [ref]$createdNew)
if (-not $createdNew) {
    $mutex.Dispose()
    exit 0
}

$supervisorLock = [ordered]@{
    pid = $PID
    version = $RuntimeVersion
}
$supervisorLock | ConvertTo-Json | Set-Content -LiteralPath $SupervisorLockPath -Encoding UTF8
$missingPluginChecks = 0
$script:LastStateFingerprint = ""

try {
    while ($true) {
        try {
            $plugin = Get-InstalledPlugin -Path $InstalledPath
            if ($null -eq $plugin) {
                $missingPluginChecks++
                Set-SupervisorState -Status "waiting-for-plugin"
                if ($missingPluginChecks -ge 60) {
                    Remove-StartupRegistration
                    break
                }
                Start-Sleep -Seconds 1
                continue
            }

            $missingPluginChecks = 0
            if (-not (Test-PluginEnabled -Path $ConfigPath)) {
                Set-SupervisorState -Status "plugin-disabled" -Details @{ pluginVersion = $RuntimeVersion }
                Start-Sleep -Seconds 1
                continue
            }

            $zcode = Get-ZCodeMainProcess
            if ($null -eq $zcode) {
                Set-SupervisorState -Status "waiting-for-zcode" -Details @{ pluginVersion = $RuntimeVersion }
                Start-Sleep -Seconds 1
                continue
            }

            if (Test-CurrentController -ZCodePid ([int]$zcode.ProcessId) -Version $RuntimeVersion) {
                $runtimeLock = Read-JsonFile -Path $RuntimeLockPath -Fallback $null
                Set-SupervisorState -Status "active" -Details @{
                    pluginVersion = $RuntimeVersion
                    zcodePid = [int]$zcode.ProcessId
                    controllerPid = [int]$runtimeLock.pid
                }
                Start-Sleep -Seconds 1
                continue
            }

            Set-SupervisorState -Status "starting-runtime" -Details @{
                pluginVersion = $RuntimeVersion
                zcodePid = [int]$zcode.ProcessId
            }
            Start-RuntimeController -ZCodeProcess $zcode
            Start-Sleep -Seconds 2
        }
        catch {
            Set-SupervisorState -Status "retrying" -Details @{ error = $_.Exception.Message }
            Start-Sleep -Seconds 2
        }
    }
}
finally {
    $lock = Read-JsonFile -Path $SupervisorLockPath -Fallback $null
    if ($null -ne $lock -and $lock.pid -eq $PID) {
        Remove-Item -LiteralPath $SupervisorLockPath -Force -ErrorAction SilentlyContinue
    }
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
