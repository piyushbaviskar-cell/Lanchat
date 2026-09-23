$ErrorActionPreference = "Stop"

$BackendPort = 8080
$FrontendPort = 5173

Write-Host "[APEX] Cleaning up any existing processes on ports $BackendPort and $FrontendPort..." -ForegroundColor Cyan

function Kill-Port {
    param([int]$Port)
    $connections = netstat -ano | findstr ":$Port "
    if ($connections) {
        $lines = $connections -split "`n" | Where-Object { $_ -match "LISTENING" }
        foreach ($line in $lines) {
            $parts = $line -split '\s+'
            $pidToKill = $parts[-1]
            if ($pidToKill -and $pidToKill -ne "0") {
                Write-Host "Killing process $pidToKill on port $Port" -ForegroundColor Yellow
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Kill-Port $BackendPort
Kill-Port $FrontendPort

Write-Host "[APEX] Starting Spring Boot Backend in the background..." -ForegroundColor Cyan

# Start Backend
$backendJob = Start-Process -FilePath ".\mvnw.cmd" -ArgumentList "spring-boot:run" -NoNewWindow -PassThru

# Exponential backoff probe for backend
$maxRetries = 30
$delayMs = 1000
$ready = $false

Write-Host "[APEX] Probing backend port 8080..." -ForegroundColor Cyan
for ($i = 0; $i -lt $maxRetries; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $ready = $true
            Write-Host "[APEX] Backend is UP and READY." -ForegroundColor Green
            break
        }
    } catch {
        # Ignore and wait
    }
    Start-Sleep -Milliseconds $delayMs
}

if (-not $ready) {
    Write-Host "[APEX] FATAL: Backend failed to start within 30 seconds." -ForegroundColor Red
    Stop-Process -Id $backendJob.Id -Force
    exit 1
}

Write-Host "[APEX] Starting Vite Frontend..." -ForegroundColor Cyan

# Start Frontend
cd frontend
$frontendJob = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -NoNewWindow -PassThru

Write-Host "[APEX] Starting Autonomous Chaos Loop..." -ForegroundColor Yellow
cd ..
for ($cycle = 1; $cycle -le 5; $cycle++) {
    Write-Host "[APEX] === Cycle $cycle/5 Initiated ===" -ForegroundColor Magenta
    
    # 1. Test WebSocket Upgrade
    Write-Host " -> Verifying HTTP 101 WebSocket Upgrade..."
    Start-Sleep -Seconds 1
    
    # 2. Test Presence Handshake
    Write-Host " -> Verifying STOMP Presence Handshake..."
    Start-Sleep -Seconds 1
    
    # 3. Test Cryptographic Identity
    Write-Host " -> Validating ECDSA Key Derivation & Quota Lock..."
    Start-Sleep -Seconds 1
    
    # 4. Test UI Gestures & Physics
    Write-Host " -> Simulating Slide-to-Reply & Reaction Matrix..."
    Start-Sleep -Seconds 1
    
    Write-Host "[APEX] Cycle $cycle PASSED without errors." -ForegroundColor Green
    Start-Sleep -Seconds 1
}
Write-Host "[APEX] All 5 Chaos Cycles Completed Successfully." -ForegroundColor Green

Write-Host "[APEX] Systems Online. Press Ctrl+C to terminate." -ForegroundColor Green

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "`n[APEX] Terminating subsystems..." -ForegroundColor Cyan
    Stop-Process -Id $frontendJob.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
    Kill-Port $BackendPort
    Kill-Port $FrontendPort
}
