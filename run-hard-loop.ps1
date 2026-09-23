Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  APEX AUTONOMOUS VERIFICATION & SELF-HEALING ENGINE  " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$SuccessCount = 0
$TargetCycles = 3

while ($SuccessCount -lt $TargetCycles) {
    Write-Host "`n[CYCLE $($SuccessCount + 1)/$TargetCycles] Executing Build & Triage Checks..." -ForegroundColor Yellow

    # 1. Clean Stale Processes
    Get-Process -Id (Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Id (Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force

    # 2. Compile Backend
    Set-Location -Path "backend"
    mvn clean compile -DskipTests
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Backend compilation failed. Patching required." -ForegroundColor Red
        $SuccessCount = 0
        exit 1
    }

    # 3. Type-check and Build Frontend
    Set-Location -Path "..\frontend"
    npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ TypeScript errors detected. Patching required." -ForegroundColor Red
        $SuccessCount = 0
        exit 1
    }

    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Frontend bundle build failed. Check PostCSS/Tailwind configuration." -ForegroundColor Red
        $SuccessCount = 0
        exit 1
    }

    # 4. Spin up Backend in Background
    Set-Location -Path "..\backend"
    $BackendJob = Start-Job -ScriptBlock { mvn spring-boot:run }
    
    # Wait for Health Probe
    $BackendReady = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/health" -TimeoutSec 2 -ErrorAction Stop
            if ($response.status -eq "UP") {
                $BackendReady = $true
                break
            }
        } catch {}
    }

    if (-not $BackendReady) {
        Write-Host "❌ Backend failed to start or /api/health did not respond." -ForegroundColor Red
        Stop-Job $BackendJob
        Remove-Job $BackendJob
        $SuccessCount = 0
        exit 1
    }

    # 5. Run Headless Multi-Client Chaos Simulation
    Set-Location -Path "..\frontend"
    node scripts/chaos-sim.mjs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Multi-client simulation failed." -ForegroundColor Red
        Stop-Job $BackendJob
        Remove-Job $BackendJob
        $SuccessCount = 0
        exit 1
    }

    # Clean up jobs
    Stop-Job $BackendJob
    Remove-Job $BackendJob

    $SuccessCount++
    Write-Host "✅ Cycle $SuccessCount passed completely without error." -ForegroundColor Green
}

Write-Host "`n🎉 [SUCCESS] APEX passed all hard-testing criteria across $TargetCycles consecutive cycles!" -ForegroundColor Green
