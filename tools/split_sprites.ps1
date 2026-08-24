<#
.SYNOPSIS
  把格狀的表情大圖切成一張張透明背景的 PNG。

.EXAMPLE
  .\tools\split_sprites.ps1 -Source data\woman_face_express.jpg `
      -OutDir assets\characters\heroine -Cols 4 -Rows 4 `
      -Names smile,happy,laugh,surprised,pout,shy,sad,awkward,crying,worried,sobbing,disappointed,annoyed,angry,smug,flustered `
      -Erase "0,1795,124,1930","895,1795,1019,1930"

.NOTES
  16 格會被裁到同一個框，所以遊戲切換表情時人物不會跳動。
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Source,
  [Parameter(Mandatory)][string]$OutDir,
  [int]$Cols = 4,
  [int]$Rows = 4,
  [string[]]$Names,
  # 切之前先塗白的矩形 "x0,y0,x1,y1"，用來擦掉圖上的說明文字
  [string[]]$Erase,
  # 最小色版值到多少算純背景 / 算背景的柔邊
  [int]$HardWhite = 243,
  [int]$SoftWhite = 218,
  # 圖與圖之間沒有空白（特效光暈相連）時，每一格難免切到隔壁一點點。
  # 這兩個值決定要清掉多小、多靠邊的殘片；設 0 就完全不清。
  [int]$EdgeMargin = 45,
  [int]$SpeckArea = 4000
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\imagelib.ps1"

$Source = (Resolve-Path $Source).Path
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$OutDir = (Resolve-Path $OutDir).Path

$sheet = [SpriteCut]::Load($Source)
foreach ($r in $Erase) {
  $v = $r.Split(',') | ForEach-Object { [int]$_.Trim() }
  [SpriteCut]::FillWhite($sheet, $v[0], $v[1], $v[2], $v[3])
}

# 大圖是照等距網格畫的，但實際接縫會偏個幾像素。
# 把每條內部切線吸附到最近的空白間隙，才不會切到人。
function Get-Edges([int[]]$profile, [int]$size, [int]$n, [int]$span) {
  $blankMax = [int]($span * 0.01)
  $edges = @(0)
  for ($i = 1; $i -lt $n; $i++) {
    $target = [int][Math]::Round($size * $i / $n)
    $window = [int]([Math]::Max(4, $size / $n * 0.15))
    $best = $target; $bestDist = [int]::MaxValue
    for ($p = [Math]::Max(1, $target - $window); $p -le [Math]::Min($size - 1, $target + $window); $p++) {
      if ($profile[$p] -le $blankMax) {
        $d = [Math]::Abs($p - $target)
        if ($d -lt $bestDist) { $bestDist = $d; $best = $p }
      }
    }
    if ($bestDist -ne [int]::MaxValue) {
      # 取這段連續空白的中心
      $lo = $best; while ($lo -gt 0 -and $profile[$lo - 1] -le $blankMax) { $lo-- }
      $hi = $best; while ($hi -lt $size - 1 -and $profile[$hi + 1] -le $blankMax) { $hi++ }
      $best = [int](($lo + $hi) / 2)
    } else {
      # 完全沒有空白（例如特效光暈把相鄰的圖連在一起）時，
      # 退而求其次找「內容最少」的那一欄，比硬切在等距位置準得多。
      $minVal = [int]::MaxValue
      for ($p = [Math]::Max(1, $target - $window); $p -le [Math]::Min($size - 1, $target + $window); $p++) {
        if ($profile[$p] -lt $minVal) { $minVal = $profile[$p]; $best = $p }
      }
    }
    $edges += $best
  }
  $edges += $size
  return $edges
}

$colEdges = Get-Edges ([SpriteCut]::Profile($sheet, $true,  $HardWhite)) $sheet.W $Cols $sheet.H
$rowEdges = Get-Edges ([SpriteCut]::Profile($sheet, $false, $HardWhite)) $sheet.H $Rows $sheet.W
Write-Verbose ("columns: " + ($colEdges -join ', '))
Write-Verbose ("rows:    " + ($rowEdges -join ', '))

$cells = @()
$minx = [int]::MaxValue; $miny = [int]::MaxValue; $maxx = -1; $maxy = -1
for ($ry = 0; $ry -lt $Rows; $ry++) {
  for ($cx = 0; $cx -lt $Cols; $cx++) {
    $c = [SpriteCut]::Crop($sheet, $colEdges[$cx], $rowEdges[$ry],
                           $colEdges[$cx+1] - $colEdges[$cx], $rowEdges[$ry+1] - $rowEdges[$ry])
    [SpriteCut]::RemoveBackground($c, $HardWhite, $SoftWhite)
    $bb = [SpriteCut]::BBox($c, 12)
    if ($bb[0] -lt $minx) { $minx = $bb[0] }
    if ($bb[1] -lt $miny) { $miny = $bb[1] }
    if (($bb[0] + $bb[2]) -gt $maxx) { $maxx = $bb[0] + $bb[2] }
    if (($bb[1] + $bb[3]) -gt $maxy) { $maxy = $bb[1] + $bb[3] }
    $cells += ,$c
  }
}

$pad = 4
$ux = [Math]::Max(0, $minx - $pad); $uy = [Math]::Max(0, $miny - $pad)
$uw = $maxx - $ux + $pad; $uh = $maxy - $uy + $pad

$specks = 0
for ($i = 0; $i -lt $cells.Count; $i++) {
  $label = if ($Names -and $i -lt $Names.Count) { $Names[$i] } else { "expr" }
  $file = "{0:d2}_{1}.png" -f ($i + 1), $label
  $piece = [SpriteCut]::Crop($cells[$i], $ux, $uy, $uw, $uh)
  if ($EdgeMargin -gt 0) { $specks += [SpriteCut]::RemoveEdgeSpecks($piece, $EdgeMargin, $SpeckArea, 25) }
  [SpriteCut]::Save($piece, (Join-Path $OutDir $file))
}
if ($specks -gt 0) { Write-Output "清掉切到隔壁的殘片 $specks 個像素" }

Write-Output "$($cells.Count) sprites -> $OutDir  ($uw x $uh each)"
