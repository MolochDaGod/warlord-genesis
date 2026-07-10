#!/usr/bin/env node
/**
 * Generate terrain diffuse + normal maps expected at /textures/ground_*.jpg
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "textures");

const ps = `
Add-Type -AssemblyName System.Drawing
function Save-Jpeg($bmp, $path, $quality) {
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $enc = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $enc.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $quality)
  $bmp.Save($path, $codec, $enc)
}
$diff = New-Object System.Drawing.Bitmap 512, 512
$g = [System.Drawing.Graphics]::FromImage($diff)
$g.Clear([System.Drawing.Color]::FromArgb(255, 93, 107, 60))
$rand = New-Object System.Random 42
for ($y = 0; $y -lt 512; $y += 4) {
  for ($x = 0; $x -lt 512; $x += 4) {
    $n = $rand.Next(-18, 18)
    $c = [System.Drawing.Color]::FromArgb(255, [Math]::Max(0,[Math]::Min(255,93+$n)), [Math]::Max(0,[Math]::Min(255,107+$n)), [Math]::Max(0,[Math]::Min(255,60+$n)))
    $brush = New-Object System.Drawing.SolidBrush $c
    $g.FillRectangle($brush, $x, $y, 4, 4)
    $brush.Dispose()
  }
}
$g.Dispose()
Save-Jpeg $diff '${OUT_DIR.replace(/\\/g, "\\\\")}\\\\ground_diff.jpg' 85L
$diff.Dispose()
$nor = New-Object System.Drawing.Bitmap 512, 512
$ng = [System.Drawing.Graphics]::FromImage($nor)
$ng.Clear([System.Drawing.Color]::FromArgb(255, 128, 128, 255))
$ng.Dispose()
Save-Jpeg $nor '${OUT_DIR.replace(/\\/g, "\\\\")}\\\\ground_nor.jpg' 85L
$nor.Dispose()
`;

const diffPath = join(OUT_DIR, "ground_diff.jpg");
const norPath = join(OUT_DIR, "ground_nor.jpg");
if (existsSync(diffPath) && existsSync(norPath)) {
  console.log("[ground] textures/ground_diff.jpg + textures/ground_nor.jpg already present — skip");
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
const res = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
if (res.status !== 0) {
  console.error(res.stderr || res.stdout);
  process.exit(1);
}
console.log("[ground] wrote textures/ground_diff.jpg + textures/ground_nor.jpg");