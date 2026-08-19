<#
.SYNOPSIS
  在本機開一個小型網頁伺服器，用瀏覽器測試遊戲。

.DESCRIPTION
  一般情況直接雙擊 index.html 就能玩。但如果瀏覽器對本機檔案有安全限制
  （例如擋掉存檔功能），就改用這個方式：

      powershell -File tools\serve.ps1

  然後在瀏覽器打開 http://127.0.0.1:8123/
  要關掉伺服器，在視窗裡按 Ctrl+C。

.NOTES
  只監聽 127.0.0.1（本機），同一個網路的其他人連不進來。
#>
param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot),
  [int]$Port = 8123
)

$Root = (Resolve-Path $Root).Path

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8';  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png';  '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'
  '.svg'  = 'image/svg+xml'; '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg'; '.ico' = 'image/x-icon'
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "遊戲已啟動： http://127.0.0.1:$Port/" -ForegroundColor Green
Write-Host "（資料夾：$Root　按 Ctrl+C 關閉）"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $stream.ReadTimeout = 5000
      $buf = New-Object byte[] 8192
      $n = $stream.Read($buf, 0, $buf.Length)
      if ($n -le 0) { continue }

      $path = (([System.Text.Encoding]::ASCII.GetString($buf, 0, $n) -split "`r`n")[0] -split ' ')[1]
      if (-not $path) { continue }
      $path = [System.Uri]::UnescapeDataString(($path -split '\?')[0])
      if ($path -eq '/') { $path = '/index.html' }

      $target = Join-Path $Root ($path.TrimStart('/') -replace '/', '\')
      $resolved = $null
      try { $resolved = (Resolve-Path -LiteralPath $target -ErrorAction Stop).Path } catch {}

      # 只允許讀取專案資料夾底下的檔案
      if ($resolved -and $resolved.StartsWith($Root) -and (Test-Path -LiteralPath $resolved -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($resolved)
        $ct = $types[[System.IO.Path]::GetExtension($resolved).ToLower()]
        if (-not $ct) { $ct = 'application/octet-stream' }
        $head = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
      } else {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 not found: $path")
        $head = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
      }

      $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
      $stream.Write($hb, 0, $hb.Length)
      $stream.Write($bytes, 0, $bytes.Length)
      $stream.Flush()
    } catch {}
    finally { $client.Close() }
  }
} finally {
  $listener.Stop()
}
