$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " APEX 5-CYCLE CHAOS VERIFICATION LOOP" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$SuccessCount = 0
$RequiredSuccesses = 5
$VitePort = 5173
$BackendPort = 8080

for ($i = 1; $i -le $RequiredSuccesses; $i++) {
    Write-Host "`n--- CYCLE $i ---" -ForegroundColor Yellow

    # Step A: TCP & HTTP Probe
    Write-Host "Step A: HTTP Probe on Backend... " -NoNewline
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/audit/verify" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        $watch.Stop()
        if ($response.StatusCode -eq 200) {
            Write-Host "PASS ($($watch.ElapsedMilliseconds)ms)" -ForegroundColor Green
        } else {
            Write-Host "FAIL (Status: $($response.StatusCode))" -ForegroundColor Red
            break
        }
    } catch {
        Write-Host "FAIL ($($_.Exception.Message))" -ForegroundColor Red
        break
    }

    # Step B & C: Test proxying via Vite
    Write-Host "Step B: Proxy HTTP verification... " -NoNewline
    try {
        $responseVite = Invoke-WebRequest -Uri "http://127.0.0.1:$VitePort/api/audit/verify" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($responseVite.StatusCode -eq 200) {
            Write-Host "PASS (Vite successfully proxied request)" -ForegroundColor Green
        } else {
            Write-Host "FAIL (Vite Proxy Status: $($responseVite.StatusCode))" -ForegroundColor Red
            break
        }
    } catch {
        Write-Host "FAIL ($($_.Exception.Message))" -ForegroundColor Red
        break
    }

    Write-Host "CYCLE $i PASSED" -ForegroundColor Green
    $SuccessCount++
    Start-Sleep -Seconds 1
}

Write-Host "`n==========================================" -ForegroundColor Cyan
if ($SuccessCount -eq $RequiredSuccesses) {
    Write-Host " VERIFICATION COMPLETE: ALL CYCLES PASSED!" -ForegroundColor Green
} else {
    Write-Host " VERIFICATION FAILED AT CYCLE $($SuccessCount + 1)" -ForegroundColor Red
}
Write-Host "==========================================" -ForegroundColor Cyan
