# Fix-URL.ps1 — Run as Administrator
# This script sets up coachservices.local to point to localhost

$hostsPath = "C:\Windows\System32\drivers\etc\hosts"

# 1. Fix hosts file — remove any bad entries and add correct one
$content = Get-Content $hostsPath -Raw
# Remove any malformed coachservices lines
$content = $content -replace '(?m).*coachservices.*(\r?\n)?', ''
$content = $content -replace '(?m)127\.0\.0\.1\\[^\r\n]*', ''
# Trim trailing whitespace/newlines and add the correct entry
$content = $content.TrimEnd()
$content += "`r`n127.0.0.1`tcoachservices.local`r`n"
Set-Content -Path $hostsPath -Value $content -Encoding ASCII -NoNewline
Write-Host "✅ hosts file fixed: coachservices.local -> 127.0.0.1"

# 2. Set up portproxy: forward port 80 -> 5000
netsh interface portproxy delete v4tov4 listenport=80 listenaddress=0.0.0.0 2>$null
netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=5000 connectaddress=127.0.0.1
Write-Host "✅ Port proxy set: port 80 -> port 5000"

# 3. Allow port 80 through firewall
netsh advfirewall firewall add rule name="CoachServices Port 80" dir=in action=allow protocol=TCP localport=80 2>$null
Write-Host "✅ Firewall rule added for port 80"

# 4. Flush DNS cache
ipconfig /flushdns | Out-Null
Write-Host "✅ DNS cache flushed"

Write-Host ""
Write-Host "================================================"
Write-Host " App is now accessible at:"
Write-Host " http://coachservices.local"
Write-Host "================================================"
Write-Host ""
Write-Host "Verifying..."
Start-Sleep 2
try {
    $r = Invoke-WebRequest "http://coachservices.local" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ SUCCESS! http://coachservices.local returned status $($r.StatusCode)"
} catch {
    Write-Host "⚠️  Make sure the Node.js server is running (node server.js in the backend folder)"
}
