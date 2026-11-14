param([ValidateSet('Promote','Rollback','Restart')][string]$Mode = 'Promote')
$ErrorActionPreference = 'Stop'
$taskName = 'SKYFORGE-Fire-Atlas-Pitch'
$releaseRoot = 'G:\SKYFORGE-NASA\fire-atlas-build-pack'
$originalRoot = 'G:\SKYFORGE-NASA\fire-atlas-pitch'
$backupRoot = 'G:\SKYFORGE-NASA\buildpack-release-backups'
$pythonPath = 'C:\Users\Shokhjahon\AppData\Local\Programs\Python\Python313\python.exe'
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
function Stop-Atlas([string]$name, [int]$port) {
  Stop-ScheduledTask -TaskName $name
  for ($attempt = 0; $attempt -lt 50; $attempt++) {
    if (-not (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) { return }
    Start-Sleep -Milliseconds 100
  }
  throw "Task $name still owns a listening port $port; refusing to start a competing process"
}
function Set-AtlasRoot([string]$root) {
  $action = New-ScheduledTaskAction -Execute 'C:\Program Files\nodejs\node.exe' -Argument 'node_modules/vite/bin/vite.js preview --host 100.105.241.126 --port 4191 --strictPort' -WorkingDirectory $root
  Set-ScheduledTask -TaskName $taskName -Action $action | Out-Null
}
function Wait-Atlas {
  for ($attempt = 0; $attempt -lt 25; $attempt++) {
    try {
      if ($Mode -eq 'Rollback') {
        $catalog = Invoke-RestMethod -Uri 'http://100.105.241.126:4191/api/ingestion/studies' -TimeoutSec 3
        if (-not $catalog.studies.Count) { throw 'Legacy study API did not return records' }
        return @{status='LEGACY_READY'; studyCount=$catalog.studies.Count}
      }
      $result = Invoke-RestMethod -Uri 'http://100.105.241.126:4191/api/health' -TimeoutSec 2
      if ($result.status -ne 'READY' -or -not $result.workspaceConfigured) { throw 'Workspace health is not ready' }
      return $result
    } catch { Start-Sleep -Seconds 1 }
  }
  throw 'Service health did not recover on 4191'
}
if ($Mode -eq 'Promote') {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  Export-ScheduledTask -TaskName $taskName | Set-Content -LiteralPath "$backupRoot\original-task-$stamp.xml" -Encoding UTF8
  Stop-Atlas 'SKYFORGE-Build-Pack-Staging' 4193
  Stop-Atlas $taskName 4191
  & $pythonPath -c 'import sqlite3,sys; a=sqlite3.connect(sys.argv[1]); b=sqlite3.connect(sys.argv[2]); a.backup(b); b.close(); a.close()' 'G:\SKYFORGE-NASA\buildpack-workspace.sqlite' "$backupRoot\workspace-$stamp.sqlite"
  if ($LASTEXITCODE -ne 0) { throw 'SQLite backup failed' }
  Set-AtlasRoot $releaseRoot
} elseif ($Mode -eq 'Rollback') {
  Stop-Atlas $taskName 4191
  Set-AtlasRoot $originalRoot
} else {
  Stop-Atlas $taskName 4191
}
Start-ScheduledTask -TaskName $taskName
try {
  $health = Wait-Atlas
  if ($Mode -eq 'Promote' -and -not $health.workspaceConfigured) { throw 'Workspace is not configured' }
  [pscustomobject]@{ mode=$Mode; health=$health; workingDirectory=(Get-ScheduledTask -TaskName $taskName).Actions.WorkingDirectory } | ConvertTo-Json -Depth 4
} catch {
  if ($Mode -eq 'Promote') {
    Stop-Atlas $taskName 4191
    Set-AtlasRoot $originalRoot
    Start-ScheduledTask -TaskName $taskName
  }
  throw
}
