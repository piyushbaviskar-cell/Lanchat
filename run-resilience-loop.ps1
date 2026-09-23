$ErrorActionPreference = "Stop"
$maxCycles = 5
$consecutiveSuccesses = 0

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "INITIALIZING APEX RESILIENCE LOOP" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

function Kill-Ports {
    Write-Host "[STEP 1] Killing dangling processes on :8080 and :5173..." -ForegroundColor Yellow
    $ports = @(8080, 5173)
    foreach ($port in $ports) {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                Write-Host "Killing Process ID $($conn.OwningProcess) on port $port" -ForegroundColor Yellow
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

while ($true) {
    Write-Host "`n--- Starting Cycle $($consecutiveSuccesses + 1) ---" -ForegroundColor Cyan

    Kill-Ports

    Write-Host "[STEP 2] Running Strict Static Typing (npx tsc --noEmit)..." -ForegroundColor Yellow
    Set-Location -Path ".\frontend"
    try {
        $tscProcess = Start-Process -FilePath "npx.cmd" -ArgumentList "tsc --noEmit" -NoNewWindow -Wait -PassThru
        if ($tscProcess.ExitCode -ne 0) {
            throw "tsc failed with exit code $($tscProcess.ExitCode)"
        }
        Write-Host "Static Typing Passed" -ForegroundColor Green
    } catch {
        Write-Host "Static Typing Failed: $_" -ForegroundColor Red
        $consecutiveSuccesses = 0
        Set-Location -Path ".."
        Write-Host "Loop interrupted. Debug and patch required." -ForegroundColor Red
        Break
    }

    Write-Host "[STEP 3] Running Production Bundle (npm run build)..." -ForegroundColor Yellow
    try {
        $buildProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run build" -NoNewWindow -Wait -PassThru
        if ($buildProcess.ExitCode -ne 0) {
            throw "Build failed with exit code $($buildProcess.ExitCode)"
        }
        Write-Host "Build Passed" -ForegroundColor Green
    } catch {
        Write-Host "Build Failed: $_" -ForegroundColor Red
        $consecutiveSuccesses = 0
        Set-Location -Path ".."
        Break
    }
    Set-Location -Path ".."

    Write-Host "[STEP 4] Skipping Spring Boot Spin-up for loop..." -ForegroundColor Yellow

    Write-Host "[STEP 5] Spinning up Vite dev server..." -ForegroundColor Yellow
    Set-Location -Path ".\frontend"
    $viteProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WindowStyle Hidden -PassThru
    Start-Sleep -Seconds 3

    Write-Host "[STEP 6] Running Headless Chaos Suite..." -ForegroundColor Yellow
    try {
        $testProcess = Start-Process -FilePath "node.exe" -ArgumentList "scripts/hard-test.js" -NoNewWindow -Wait -PassThru
        if ($testProcess.ExitCode -ne 0) {
            throw "Chaos test failed with exit code $($testProcess.ExitCode)"
        }
        Write-Host "Chaos Suite Passed" -ForegroundColor Green
        $consecutiveSuccesses++
    } catch {
        Write-Host "Chaos Suite Failed: $_" -ForegroundColor Red
        $consecutiveSuccesses = 0
    } finally {
        Write-Host "Killing Vite server..." -ForegroundColor Yellow
        Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue
    }

    Set-Location -Path ".."

    if ($consecutiveSuccesses -ge $maxCycles) {
        Write-Host "`n=========================================" -ForegroundColor Green
        Write-Host "SUCCESS: 5 CONSECUTIVE CLEAN CYCLES" -ForegroundColor Green
        Write-Host "=========================================" -ForegroundColor Green
        Break
    }
}
