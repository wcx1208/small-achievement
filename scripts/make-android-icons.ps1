# Generate Android launcher icons from the brand icon (ASCII-only source)
# - ic_launcher / ic_launcher_round: full gradient background (48..192)
# - ic_launcher_foreground: transparent bg + white CJK char in adaptive safe zone (108..432)
Add-Type -AssemblyName System.Drawing

$cheng = [string][char]0x6210
$res = Join-Path $PSScriptRoot '..\android\app\src\main\res'

function GradientRectBrush([System.Drawing.Rectangle]$rect) {
  $c1 = [System.Drawing.Color]::FromArgb(255, 255, 184, 119)
  $c2 = [System.Drawing.Color]::FromArgb(255, 249, 115, 22)
  return New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 90)
}

function Draw-Cheng($g, [int]$size, [single]$ratio) {
  $fontSize = $size * $ratio
  $font = New-Object System.Drawing.Font('Microsoft YaHei', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rectText = New-Object System.Drawing.RectangleF(0, ($size * 0.02), $size, $size)
  $g.DrawString($script:cheng, $font, [System.Drawing.Brushes]::White, $rectText, $sf)
}

# legacy + round launcher icons
foreach ($spec in @(@('mdpi', 48), @('hdpi', 72), @('xhdpi', 96), @('xxhdpi', 144), @('xxxhdpi', 192))) {
  $dpi = $spec[0]; $size = [int]$spec[1]
  $dir = Join-Path $res ("mipmap-" + $dpi)

  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $g.FillRectangle((GradientRectBrush $rect), $rect)
  Draw-Cheng $g $size 0.54
  $g.Dispose()
  $bmp.Save((Join-Path $dir 'ic_launcher.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()

  # round: circular clip
  $bmp2 = New-Object System.Drawing.Bitmap($size, $size)
  $g2 = [System.Drawing.Graphics]::FromImage($bmp2)
  $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g2.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse(0, 0, $size, $size)
  $g2.SetClip($path)
  $rect2 = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $g2.FillRectangle((GradientRectBrush $rect2), $rect2)
  Draw-Cheng $g2 $size 0.54
  $g2.Dispose()
  $bmp2.Save((Join-Path $dir 'ic_launcher_round.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp2.Dispose()
  Write-Host ("OK " + $dpi + " launcher " + $size)
}

# adaptive foreground: transparent + white char inside safe zone (content ~55% of canvas)
foreach ($spec in @(@('mdpi', 108), @('hdpi', 162), @('xhdpi', 216), @('xxhdpi', 324), @('xxxhdpi', 432))) {
  $dpi = $spec[0]; $size = [int]$spec[1]
  $dir = Join-Path $res ("mipmap-" + $dpi)
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  Draw-Cheng $g $size 0.50
  $g.Dispose()
  $bmp.Save((Join-Path $dir 'ic_launcher_foreground.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host ("OK " + $dpi + " foreground " + $size)
}
