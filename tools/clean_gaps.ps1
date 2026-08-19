<#
.SYNOPSIS
  清掉立繪裡「被畫稿包住、去背時碰不到」的殘留白色。
  最典型的就是頭髮和肩膀之間那條縫。

.DESCRIPTION
  一般去背是從圖的外框往內填，所以髮絲和肩膀之間那種四面被線稿圍住的白色
  永遠填不到，會留下一條白縫。

  但不是每一塊被包住的白色都是背景 —— 牙齒、眼睛高光、對話泡泡、白色衣領
  都是畫上去的。這裡用三個條件同時成立才刪：

    近  離透明區只有幾個像素（中間只隔一層線稿）。牙齒、眼白都在臉中央，離很遠。
    細  外框是細長條（兩個形狀之間的縫），不是一團。圓形的對話泡泡因此保得住。
    大  太小的不動，通常是畫稿本身的細節。

.EXAMPLE
  # 先試跑看看會刪掉哪些，不動到檔案
  .\tools\clean_gaps.ps1 -Source assets\characters\heroine -WhatIf

  # 確認沒問題再實際執行
  .\tools\clean_gaps.ps1 -Source assets\characters

.PARAMETER MaxGap
  離透明區最遠幾個像素還算「只隔一層線稿」，預設 14。

.PARAMETER MinArea
  小於這個面積的白點不動，預設 80。

.PARAMETER MinAspect
  長寬比要多細長才算「縫」，預設 2.2。

.NOTES
  原圖備份在 data\gapfix_original\。
  改完務必用 -WhatIf 的清單對照一下，確認沒有刪到牙齒或高光。
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory)][string]$Source,
  [string]$Filter = "*.png",
  [int]$HardWhite = 243,
  [int]$MaxGap = 14,
  [int]$MinArea = 80,
  [double]$MinAspect = 2.2,
  [string]$BackupDir = "data\gapfix_original"
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\imagelib.ps1"

$Source = (Resolve-Path $Source).Path
# -WhatIf 會讓 New-Item 只是「假裝」建立，所以這裡要用 -Confirm:$false 真的建出來，
# 否則接下來的 Resolve-Path 會找不到路徑而中斷。
New-Item -ItemType Directory -Force -Path $BackupDir -Confirm:$false -WhatIf:$false | Out-Null
$BackupDir = (Resolve-Path $BackupDir).Path

$files = if (Test-Path -LiteralPath $Source -PathType Container) {
  Get-ChildItem -LiteralPath $Source -Recurse -File -Filter $Filter
} else {
  Get-Item -LiteralPath $Source
}

$total = 0
foreach ($f in $files) {
  $img = [SpriteCut]::Load($f.FullName)
  $erased = [SpriteCut]::RemoveTrappedBackground($img, $HardWhite, $MaxGap, $MinArea, $MinAspect)

  if ($erased -eq 0) {
    Write-Output ("{0,-22} 沒有要清的白縫" -f $f.Name)
    continue
  }

  $total += $erased
  if ($PSCmdlet.ShouldProcess($f.FullName, "清掉 $erased 個殘留白色像素")) {
    $backup = Join-Path $BackupDir ($f.Directory.Name + '_' + $f.Name)
    if (-not (Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $f.FullName -Destination $backup }
    [SpriteCut]::Save($img, $f.FullName)
    Write-Output ("{0,-22} 清掉 {1} 個像素" -f $f.Name, $erased)
  } else {
    Write-Output ("{0,-22} 會清掉 {1} 個像素（試跑）" -f $f.Name, $erased)
  }
}

Write-Output ("合計 {0} 個像素，原圖備份在 {1}" -f $total, $BackupDir)
