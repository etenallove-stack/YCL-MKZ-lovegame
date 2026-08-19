<#
.SYNOPSIS
  把過大的立繪 PNG 縮到適合網頁的尺寸，透明度會保留，原圖先備份。

.DESCRIPTION
  遊戲畫布是 1280x720，立繪最高也只顯示到 660 左右。
  高解析度螢幕會用到兩倍，所以留 1400 就綽綽有餘，
  再高的部分只是白白增加載入時間。

.EXAMPLE
  # 整個角色資料夾
  .\tools\optimize_sprite.ps1 -Source assets\characters\heroine

  # 只處理全身姿勢圖
  .\tools\optimize_sprite.ps1 -Source assets\characters -Filter "pose_*.png"

.PARAMETER MaxHeight
  最大高度，預設 1400。

.NOTES
  縮圖用的是自己寫的 premultiplied box filter，不是 GDI+ 的縮放。
  直接縮放帶透明的圖會把「透明但仍帶顏色」的像素混進邊緣，
  在原本白底去背的素材上會長出一圈白邊。
  原圖備份在 data\sprites_original\。
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Source,
  [string]$Filter = "*.png",
  [int]$MaxHeight = 1400,
  [string]$BackupDir = "data\sprites_original"
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\imagelib.ps1"

$Source = (Resolve-Path $Source).Path
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$BackupDir = (Resolve-Path $BackupDir).Path

$files = if (Test-Path -LiteralPath $Source -PathType Container) {
  Get-ChildItem -LiteralPath $Source -Recurse -File -Filter $Filter
} else {
  Get-Item -LiteralPath $Source
}

$savedKB = 0
foreach ($f in $files) {
  $img = [SpriteCut]::Load($f.FullName)
  if ($img.H -le $MaxHeight) {
    Write-Output ("{0}  {1}x{2} 已經夠小，跳過" -f $f.Name, $img.W, $img.H)
    continue
  }

  $beforeKB = [math]::Round($f.Length / 1KB)
  $newH = $MaxHeight
  $newW = [int][Math]::Round($img.W * $MaxHeight / $img.H)
  $small = [SpriteCut]::Downscale($img, $newW, $newH)

  # 備份要沿用原本的資料夾結構。不同角色底下會有同名的 pose_stand.png，
  # 只用檔名當備份路徑的話，第二個會被當成「已經備份過」而跳過，原圖就救不回來了。
  $rel = $f.Directory.Name + '_' + $f.Name
  $backup = Join-Path $BackupDir $rel
  if (-not (Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $f.FullName -Destination $backup }

  [SpriteCut]::Save($small, $f.FullName)
  $afterKB = [math]::Round((Get-Item -LiteralPath $f.FullName).Length / 1KB)
  $savedKB += ($beforeKB - $afterKB)
  Write-Output ("{0}  {1}x{2} {3} KB  ->  {4}x{5} {6} KB" -f `
                $f.Name, $img.W, $img.H, $beforeKB, $newW, $newH, $afterKB)
}

Write-Output ("共省下 {0:N1} MB，原圖備份在 {1}" -f ($savedKB / 1024), $BackupDir)
