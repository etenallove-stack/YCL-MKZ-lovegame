<#
.SYNOPSIS
  把過大的背景音樂壓成 128kbps，原檔會先備份。

.DESCRIPTION
  用 Windows 內建的 Media Foundation 轉檔器，不需要安裝 ffmpeg。
  網頁遊戲用 128kbps 就夠，320kbps 的檔案通常可以省下六成。

.EXAMPLE
  # 整個 assets\bgm 資料夾
  .\tools\optimize_bgm.ps1

  # 只處理單一檔案
  .\tools\optimize_bgm.ps1 -Source assets\bgm\spring_wind.mp3

.PARAMETER SkipAtOrUnderKbps
  已經是這個位元率（含）以下的檔案就不動它，預設 144。
  判斷依據是檔案本身的位元率，不是檔案大小 —— 長曲子就算檔案大，
  只要已經是 128kbps 就不該再壓一次（重壓只會再掉一次音質，檔案卻幾乎沒變小）。

.PARAMETER Quality
  Medium 約 128kbps（預設）、Low 約 96kbps、High 約 192kbps。

.NOTES
  原檔備份在 data\bgm_original\，想反悔就從那裡複製回去。
  轉完的長度可能和原檔差個 0.5 秒以內，那是 MP3 幀邊界造成的，聽不出來。
#>
[CmdletBinding()]
param(
  [string]$Source = "assets\bgm",
  [int]$SkipAtOrUnderKbps = 144,
  [ValidateSet('Low', 'Medium', 'High')][string]$Quality = 'Medium',
  # 判讀不出位元率時預設不動它（例如副檔名寫 .mp3、實際是 MP4/AAC 的檔案）。
  # 確定要壓再加這個開關。
  [switch]$Force,
  [string]$BackupDir = "data\bgm_original"
)

$ErrorActionPreference = 'Stop'

# PowerShell 5.1 呼叫 WinRT 的非同步 API，要自己把 IAsyncOperation 轉成 Task 再等它完成
[Windows.Media.Transcoding.MediaTranscoder, Windows.Media, ContentType = WindowsRuntime]          | Out-Null
[Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]                      | Out-Null
[Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime]                    | Out-Null
[Windows.Storage.FileProperties.MusicProperties, Windows.Storage, ContentType = WindowsRuntime]    | Out-Null
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$ext = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asTaskOp = ($ext | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
$asTaskAct = ($ext | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncActionWithProgress`1' })[0]

function Wait-Op($op, [type]$t) {
  $task = $asTaskOp.MakeGenericMethod($t).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  return $task.Result
}
function Wait-Act($act, [type]$t) {
  $task = $asTaskAct.MakeGenericMethod($t).Invoke($null, @($act))
  $task.Wait(-1) | Out-Null
}

# 直接解析 MP3 的第一個訊框標頭取得位元率。
# 本來是跟 Windows 的檔案屬性要，但那要等系統建立索引 ——
# 剛複製進來的檔案會回報 0 kbps，害真正該壓的檔案被當成「已經夠小」跳過。
function Get-Mp3Kbps([string]$path) {
  $fs = [System.IO.File]::OpenRead($path)
  try {
    $head = New-Object byte[] 10
    if ($fs.Read($head, 0, 10) -lt 10) { return 0 }

    $start = 0
    # 開頭如果是 ID3v2 標籤就跳過，長度是 4 個 7-bit 的 syncsafe 位元組
    if ($head[0] -eq 0x49 -and $head[1] -eq 0x44 -and $head[2] -eq 0x33) {
      $start = 10 + (($head[6] -band 0x7F) -shl 21) + (($head[7] -band 0x7F) -shl 14) +
                    (($head[8] -band 0x7F) -shl 7)  +  ($head[9] -band 0x7F)
    }

    $fs.Position = $start
    $buf = New-Object byte[] 8192
    $n = $fs.Read($buf, 0, $buf.Length)

    # MPEG1 Layer III / MPEG2 與 2.5 Layer III 的位元率對照表
    $v1 = @(0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0)
    $v2 = @(0, 8,16,24,32,40,48,56, 64, 80, 96,112,128,144,160,0)

    for ($i = 0; $i -lt $n - 3; $i++) {
      if ($buf[$i] -ne 0xFF -or ($buf[$i+1] -band 0xE0) -ne 0xE0) { continue }
      $ver   = ($buf[$i+1] -band 0x18) -shr 3     # 11 = MPEG1, 10 = MPEG2, 00 = MPEG2.5
      $layer = ($buf[$i+1] -band 0x06) -shr 1     # 01 = Layer III
      $idx   = ($buf[$i+2] -band 0xF0) -shr 4
      if ($layer -ne 1 -or $idx -eq 0 -or $idx -eq 15 -or $ver -eq 1) { continue }
      $kbps = if ($ver -eq 3) { $v1[$idx] } else { $v2[$idx] }
      if ($kbps -gt 0) { return $kbps }
    }
    return 0
  } finally { $fs.Close() }
}

function Get-AudioInfo([string]$path) {
  $kbps = Get-Mp3Kbps $path
  $bytes = (Get-Item -LiteralPath $path).Length
  $sec = 0
  if ($kbps -gt 0) { $sec = [int]($bytes * 8 / ($kbps * 1000)) }
  return [pscustomobject]@{
    Kbps   = $kbps
    Length = "{0}:{1:d2}" -f [int]($sec / 60), ($sec % 60)
  }
}

$Source = (Resolve-Path $Source).Path
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$BackupDir = (Resolve-Path $BackupDir).Path

$files = if (Test-Path -LiteralPath $Source -PathType Container) {
  Get-ChildItem -LiteralPath $Source -File -Filter *.mp3
} else {
  Get-Item -LiteralPath $Source
}

# 轉檔不能直接覆蓋輸入檔，先寫到暫存資料夾再搬回去
$tmp = Join-Path $env:TEMP ("bgmopt_" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$savedKB = 0
try {
  foreach ($f in $files) {
    $beforeKB = [math]::Round($f.Length / 1KB)
    $info = Get-AudioInfo $f.FullName

    if ($info.Kbps -eq 0) {
      # 副檔名是 .mp3 但裡面不是 MP3（常見於下載工具產出的 MP4/AAC）。
      # 瀏覽器照樣播得出來，所以預設不動它，免得白白再壓一次。
      if (-not $Force) {
        Write-Output ("{0,-22} 判讀不出位元率（可能不是 MP3 容器），跳過。要強制壓縮請加 -Force" -f $f.Name)
        continue
      }
      Write-Output ("{0,-22} 判讀不出位元率，但指定了 -Force，照壓" -f $f.Name)
    }
    elseif ($info.Kbps -le $SkipAtOrUnderKbps) {
      Write-Output ("{0,-22} 已經是 {1} kbps，跳過" -f $f.Name, $info.Kbps)
      continue
    }

    $src    = Wait-Op ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])
    $folder = Wait-Op ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($tmp)) ([Windows.Storage.StorageFolder])
    $dst    = Wait-Op ($folder.CreateFileAsync($f.Name, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])

    $q  = [Windows.Media.MediaProperties.AudioEncodingQuality]::$Quality
    $pf = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateMp3($q)
    $tc = New-Object Windows.Media.Transcoding.MediaTranscoder
    $prep = Wait-Op ($tc.PrepareFileTranscodeAsync($src, $dst, $pf)) ([Windows.Media.Transcoding.PrepareTranscodeResult])
    if (-not $prep.CanTranscode) {
      Write-Warning ("{0} 無法轉檔：{1}" -f $f.Name, $prep.FailureReason)
      continue
    }
    Wait-Act ($prep.TranscodeAsync()) ([double])

    $out = Join-Path $tmp $f.Name
    $afterKB = [math]::Round((Get-Item -LiteralPath $out).Length / 1KB)
    if ($afterKB -ge $beforeKB) {
      Write-Output ("{0,-22} 壓不小（{1} → {2} KB），保持原樣" -f $f.Name, $beforeKB, $afterKB)
      continue
    }

    $backup = Join-Path $BackupDir $f.Name
    if (-not (Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $f.FullName -Destination $backup }
    Copy-Item -LiteralPath $out -Destination $f.FullName -Force
    $after = Get-AudioInfo $f.FullName

    $savedKB += ($beforeKB - $afterKB)
    Write-Output ("{0,-22} {1,6} KB / {2,3} kbps ({3})  ->  {4,6} KB / {5,3} kbps ({6})  省 {7:N0}%" -f `
                  $f.Name, $beforeKB, $info.Kbps, $info.Length,
                  $afterKB, $after.Kbps, $after.Length, ((1 - $afterKB / $beforeKB) * 100))
  }
} finally {
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Output ("共省下 {0:N1} MB，原檔備份在 {1}" -f ($savedKB / 1024), $BackupDir)
