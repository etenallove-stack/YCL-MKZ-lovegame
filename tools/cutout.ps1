<#
.SYNOPSIS
  把單張白底圖去背，裁掉多餘空白，存成透明的 PNG。
  用來處理探索場景的小物件（櫻花枝、紙袋、塗鴉……）。

.EXAMPLE
  # 一張一張處理
  .\tools\cutout.ps1 -Source data\sakura_branch.jpg -OutDir assets\props

  # 整個資料夾一次處理完
  .\tools\cutout.ps1 -Source data\props -OutDir assets\props

.PARAMETER Name
  指定輸出檔名（不用打副檔名）。省略的話沿用原本的檔名。

.EXAMPLE
  # 背景是灰白棋盤格（有些工具會把「透明」直接畫成棋盤格存成 JPG）
  .\tools\cutout.ps1 -Source data\stand.jpg -Background Flat -KeepLargest

.PARAMETER Background
  White = 純白背景（預設）。
  Flat  = 灰色或棋盤格背景。判斷方式是「幾乎沒有顏色而且夠亮」，
          所以人物身上的灰長褲、白襯衫都不會被誤刪。

.PARAMETER KeepLargest
  只留下最大的一塊圖案。背景裡沒連到主角的零碎東西（壁畫、樹葉）
  會被去背程序留下來，加這個開關就能一次清乾淨。

.PARAMETER NoTrim
  保留原圖尺寸，不要自動裁掉周圍的空白。

.NOTES
  背景如果有明顯漸層或陰影，去背會不乾淨，這種圖丟給 Claude 處理比較快。
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Source,
  [string]$OutDir = "assets\props",
  [string]$Name,
  [ValidateSet('White', 'Flat')][string]$Background = 'White',
  [switch]$KeepLargest,
  [switch]$NoTrim,
  [int]$HardWhite = 243,
  [int]$SoftWhite = 218,
  # 只有 -Background Flat 會用到
  [int]$FlatBright = 190,
  [int]$MaxChroma = 10
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\imagelib.ps1"

$Source = (Resolve-Path $Source).Path
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$OutDir = (Resolve-Path $OutDir).Path

$files = if (Test-Path -LiteralPath $Source -PathType Container) {
  Get-ChildItem -LiteralPath $Source -File | Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|bmp)$' }
} else {
  Get-Item -LiteralPath $Source
}

if (-not $files) { Write-Warning "找不到任何圖檔：$Source"; return }
if ($Name -and $files.Count -gt 1) { throw "-Name 只能用在單一檔案，資料夾模式請省略。" }

foreach ($f in $files) {
  $img = [SpriteCut]::Load($f.FullName)

  if ($Background -eq 'Flat') {
    [SpriteCut]::RemoveBackgroundFlat($img, $FlatBright, ($FlatBright - 32), $MaxChroma)
  } else {
    [SpriteCut]::RemoveBackground($img, $HardWhite, $SoftWhite)
  }

  if ($KeepLargest) { [void][SpriteCut]::KeepLargestComponent($img, 20) }

  if (-not $NoTrim) {
    $bb = [SpriteCut]::BBox($img, 12)
    $pad = 2
    $x = [Math]::Max(0, $bb[0] - $pad)
    $y = [Math]::Max(0, $bb[1] - $pad)
    $w = [Math]::Min($img.W - $x, $bb[2] + $pad * 2)
    $h = [Math]::Min($img.H - $y, $bb[3] + $pad * 2)
    $img = [SpriteCut]::Crop($img, $x, $y, $w, $h)
  }

  $base = if ($Name) { $Name } else { [System.IO.Path]::GetFileNameWithoutExtension($f.Name) }
  $out = Join-Path $OutDir ($base + '.png')
  [SpriteCut]::Save($img, $out)
  Write-Output ("{0}  ->  {1}  ({2}x{3})" -f $f.Name, (Split-Path $out -Leaf), $img.W, $img.H)
}
