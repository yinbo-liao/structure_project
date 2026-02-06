# Start Servers Script for MPDMS Project
# This script helps start both frontend and backend servers and check their status

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "MPDMS Project - Server Startup Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a port is in use
function Test-PortInUse {
    param([int]$Port)
    $result = netstat -ano | findstr ":$Port"
    return ($result -ne $null)
}

# Function to get process name from PID
function Get-ProcessName {
    param([int]$PID)
    try {
        $process = Get-Process -Id $PID -ErrorAction SilentlyContinue
        return $process.ProcessName
    } catch {
        return "Unknown"
    }
}

# Check current server status
Write-Host "Checking current server status..." -ForegroundColor Yellow
Write-Host ""

$frontendPort = 3001
$backendPort = 8000

$frontendRunning = Test-PortInUse -Port $frontendPort
$backendRunning = Test-PortInUse -Port $backendPort

Write-Host "Frontend (port $frontendPort): " -NoNewline
if ($frontendRunning) {
    Write-Host "RUNNING ✓" -ForegroundColor Green
    # Get PID for frontend
    $frontendPID = (netstat -ano | findstr ":$frontendPort" | Select-Object -First 1 | ForEach-Object { ($_ -split '\s+')[-1] })
    $frontendProcess = Get-ProcessName -PID $frontendPID
    Write-Host "  PID: $frontendPID, Process: $frontendProcess" -ForegroundColor Gray
} else {
    Write-Host "NOT RUNNING ✗" -ForegroundColor Red
}

Write-Host "Backend (port $backendPort): " -NoNewline
if ($backendRunning) {
    Write-Host "RUNNING ✓" -ForegroundColor Green
    # Get PID for backend
    $backendPID = (netstat -ano | findstr ":$backendPort" | Select-Object -First 1 | ForEach-Object { ($_ -split '\s+')[-1] })
    $backendProcess = Get-ProcessName -PID $backendPID
    Write-Host "  PID: $backendPID, Process: $backendProcess" -ForegroundColor Gray
} else {
    Write-Host "NOT RUNNING ✗" -ForegroundColor Red
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Ask user what they want to do
Write-Host "What would you like to do?" -ForegroundColor Yellow
Write-Host "1. Start both servers (if not running)" -ForegroundColor White
Write-Host "2. Start frontend only" -ForegroundColor White
Write-Host "3. Start backend only" -ForegroundColor White
Write-Host "4. Check server status only (exit)" -ForegroundColor White
Write-Host "5. Open application in browser" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice (1-5)"

switch ($choice) {
    "1" {
        # Start both servers
        Write-Host "Starting both servers..." -ForegroundColor Green
        
        if (-not $backendRunning) {
            Write-Host "Starting backend server on port $backendPort..." -ForegroundColor Yellow
            Start-Process -NoNewWindow -FilePath "python" -ArgumentList "-m uvicorn app.main:app --reload --port $backendPort" -WorkingDirectory "backend"
            Write-Host "Backend server started." -ForegroundColor Green
        } else {
            Write-Host "Backend server is already running." -ForegroundColor Gray
        }
        
        if (-not $frontendRunning) {
            Write-Host "Starting frontend server on port $frontendPort..." -ForegroundColor Yellow
            Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "start" -WorkingDirectory "frontend"
            Write-Host "Frontend server started." -ForegroundColor Green
        } else {
            Write-Host "Frontend server is already running." -ForegroundColor Gray
        }
        
        Write-Host ""
        Write-Host "Both servers should be starting up..." -ForegroundColor Green
        Write-Host "Frontend: http://localhost:$frontendPort" -ForegroundColor Cyan
        Write-Host "Backend API: http://localhost:$backendPort" -ForegroundColor Cyan
        Write-Host "Backend Docs: http://localhost:$backendPort/docs" -ForegroundColor Cyan
    }
    
    "2" {
        # Start frontend only
        if (-not $frontendRunning) {
            Write-Host "Starting frontend server on port $frontendPort..." -ForegroundColor Yellow
            Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "start" -WorkingDirectory "frontend"
            Write-Host "Frontend server started." -ForegroundColor Green
            Write-Host "Access at: http://localhost:$frontendPort" -ForegroundColor Cyan
        } else {
            Write-Host "Frontend server is already running." -ForegroundColor Gray
        }
    }
    
    "3" {
        # Start backend only
        if (-not $backendRunning) {
            Write-Host "Starting backend server on port $backendPort..." -ForegroundColor Yellow
            Start-Process -NoNewWindow -FilePath "python" -ArgumentList "-m uvicorn app.main:app --reload --port $backendPort" -WorkingDirectory "backend"
            Write-Host "Backend server started." -ForegroundColor Green
            Write-Host "API Docs: http://localhost:$backendPort/docs" -ForegroundColor Cyan
        } else {
            Write-Host "Backend server is already running." -ForegroundColor Gray
        }
    }
    
    "4" {
        # Just show status and exit
        Write-Host "Server status check completed." -ForegroundColor Green
    }
    
    "5" {
        # Open application in browser
        Write-Host "Opening application in browser..." -ForegroundColor Green
        Start-Process "http://localhost:$frontendPort"
        Write-Host "Application opened in default browser." -ForegroundColor Green
    }
    
    default {
        Write-Host "Invalid choice. Exiting." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Quick Reference:" -ForegroundColor Yellow
Write-Host "- Frontend URL: http://localhost:$frontendPort" -ForegroundColor White
Write-Host "- Backend API: http://localhost:$backendPort/api/v1" -ForegroundColor White
Write-Host "- API Documentation: http://localhost:$backendPort/docs" -ForegroundColor White
Write-Host "- Default Login: admin@mpdms.com / admin" -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan

# Wait a moment before exiting
Start-Sleep -Seconds 2