$port = 8084
$root = Split-Path $PSScriptRoot -Parent
$dataDir = $PSScriptRoot

if (!(Test-Path $dataDir)) {
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
}

$dataFiles = @("items.json", "system_units.json", "borrowed.json")
foreach ($file in $dataFiles) {
    $path = Join-Path $dataDir $file
    if (!(Test-Path $path)) {
        Set-Content -Path $path -Value "[]" -Encoding UTF8
    }
}

try {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
} catch {
    Write-Error "Failed to start server on port $port. Is another instance running?"
    Write-Host "Please close any other PowerShell windows running the server."
    Read-Host "Press Enter to exit..."
    exit
}

Write-Host "Server started at http://localhost:$port/"
Write-Host "Press Ctrl+C to stop."

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    
    $path = $request.Url.LocalPath
    $method = $request.HttpMethod
    
    Write-Host "$method $path"
    
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

    if ($method -eq "OPTIONS") {
        $response.Close()
        continue
    }

    try {
        if ($path.StartsWith("/api/")) {
            $response.ContentType = "application/json"
            $filename = $path.Replace("/api/", "") + ".json"
            $filePath = Join-Path $dataDir $filename
            
            if ($method -eq "GET") {
                if (Test-Path $filePath) {
                    $content = Get-Content -Path $filePath -Raw -Encoding UTF8
                    if ($null -eq $content) { $content = "[]" }
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($content)
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                } else {
                    $response.StatusCode = 404
                }
            }
            elseif ($method -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd()
                
                try {
                    $json = $body | ConvertFrom-Json
                    $formattedJson = @($json) | ConvertTo-Json -Depth 10
                    Set-Content -Path $filePath -Value $formattedJson -Encoding UTF8
                    $response.StatusCode = 200
                    $msg = '{"status":"success"}'
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($msg)
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                } catch {
                    $response.StatusCode = 400
                    $err = '{"error":"Invalid JSON"}'
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($err)
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                }
            }
        } else {
            $localPath = if ($path -eq "/") { "frontend/index.html" } else { "frontend$path" }
            $fullPath = Join-Path $root $localPath
            
            if (Test-Path $fullPath) {
                $content = Get-Content -Path $fullPath -Raw -Encoding UTF8
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($content)
                
                if ($fullPath.EndsWith(".css")) { $response.ContentType = "text/css" }
                elseif ($fullPath.EndsWith(".js")) { $response.ContentType = "application/javascript" }
                elseif ($fullPath.EndsWith(".html")) { $response.ContentType = "text/html" }
                
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            } else {
                $response.StatusCode = 404
            }
        }
    } catch {
        Write-Error $_
        $response.StatusCode = 500
    } finally {
        $response.Close()
    }
}
