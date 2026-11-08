# Generate PWA icons (warm orange gradient + white CJK char, ASCII-only source)
Add-Type -AssemblyName System.Drawing

$cheng = [string][char]0x6210  # CJK char

function Make-Icon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $c1 = [System.Drawing.Color]::FromArgb(255, 255, 184, 119)
  $c2 = [System.Drawing.Color]::FromArgb(255, 249, 115, 22)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 90)
  $g.FillRectangle($brush, $rect)

  $fontSize = $size * 0.54
  $font = New-Object System.Drawing.Font('Microsoft YaHei', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rectText = New-Object System.Drawing.RectangleF(0, ($size * 0.02), $size, $size)
  $g.DrawString($script:cheng, $font, [System.Drawing.Brushes]::White, [System.Drawing.RectangleF]$rectText, $sf)

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "OK $path"
}

$root = Join-Path $PSScriptRoot '..\public'
Make-Icon 512 (Join-Path $root 'pwa-512x512.png')
Make-Icon 192 (Join-Path $root 'pwa-192x192.png')
Make-Icon 180 (Join-Path $root 'apple-touch-icon.png')
