<#
.SYNOPSIS
  把背景圖縮到適合網頁的尺寸並重新壓縮，原圖會先備份起來。

.EXAMPLE
  # 處理單張
  .\tools\optimize_bg.ps1 -Source assets\backgrounds\courtyard_noon.jpg

  # 整個資料夾一次處理
  .\tools\optimize_bg.ps1 -Source assets\backgrounds

.PARAMETER MaxWidth
  最大寬度，預設 1920。遊戲畫布是 1280x720，1920 已經綽綽有餘。

.PARAMETER Quality
  JPEG 品質 1-100，預設 82。再低會開始看得出色塊。

.NOTES
  原圖會搬到 data\backgrounds_original\ 保存，想反悔就從那裡複製回去。
  已經夠小的檔案會自動跳過。
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Source,
  [int]$MaxWidth = 1920,
  [int]$Quality = 82,
  [string]$BackupDir = "data\backgrounds_original",
  # 小於這個大小（KB）就不動它
  [int]$SkipUnderKB = 600
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$Source = (Resolve-Path $Source).Path
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$BackupDir = (Resolve-Path $BackupDir).Path

$files = if (Test-Path -LiteralPath $Source -PathType Container) {
  Get-ChildItem -LiteralPath $Source -File | Where-Object { $_.Extension -match '^\.(jpg|jpeg|png)$' }
} else {
  Get-Item -LiteralPath $Source
}

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
             Where-Object { $_.MimeType -eq 'image/jpeg' }

foreach ($f in $files) {
  $beforeKB = [math]::Round($f.Length / 1KB)
  if ($beforeKB -lt $SkipUnderKB) {
    Write-Output ("{0}  已經夠小（{1} KB），跳過" -f $f.Name, $beforeKB)
    continue
  }

  $src = [System.Drawing.Image]::FromFile($f.FullName)
  $w = $src.Width; $h = $src.Height
  if ($w -gt $MaxWidth) {
    $h = [int][Math]::Round($h * $MaxWidth / $w)
    $w = $MaxWidth
  }

  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $w, $h)))
  $g.Dispose()
  $srcW = $src.Width; $srcH = $src.Height
  $src.Dispose()

  # 先把原圖搬去備份，再覆蓋
  $backup = Join-Path $BackupDir $f.Name
  if (-not (Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $f.FullName -Destination $backup }

  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
                   [System.Drawing.Imaging.Encoder]::Quality, [int64]$Quality)
  $out = [System.IO.Path]::ChangeExtension($f.FullName, '.jpg')
  $bmp.Save($out, $jpegCodec, $ep)
  $bmp.Dispose()
  $ep.Dispose()

  # 原本是 PNG 的話，轉存成 JPG 之後把舊檔刪掉
  if ($f.FullName -ne $out) { Remove-Item -LiteralPath $f.FullName -Force }

  $afterKB = [math]::Round((Get-Item -LiteralPath $out).Length / 1KB)
  Write-Output ("{0}  {1}x{2} {3} KB  ->  {4}x{5} {6} KB" -f `
                $f.Name, $srcW, $srcH, $beforeKB, $w, $h, $afterKB)
}

Write-Output "原圖備份在 $BackupDir"
