#!/usr/bin/env node
/**
 * Procedural JPEGs for battle scene materials at /textures/{concrete,metal}_*.jpg
 */
import { existsSync, mkdirSync } from "node:fs";
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
function Noise-Jpeg($path, $r, $g, $b, $spread, $seed) {
  $bmp = New-Object System.Drawing.Bitmap 512, 512
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.Clear([System.Drawing.Color]::FromArgb(255, $r, $g, $b))
  $rand = New-Object System.Random $seed
  for ($y = 0; $y -lt 512; $y += 3) {
    for ($x = 0; $x -lt 512; $x += 3) {
      $n = $rand.Next(-$spread, $spread)
      $c = [System.Drawing.Color]::FromArgb(255,
        [Math]::Max(0,[Math]::Min(255,$r+$n)),
        [Math]::Max(0,[Math]::Min(255,$g+$n)),
        [Math]::Max(0,[Math]::Min(255,$b+$n)))
      $brush = New-Object System.Drawing.SolidBrush $c
      $gfx.FillRectangle($brush, $x, $y, 3, 3)
      $brush.Dispose()
    }
  }
  $gfx.Dispose()
  Save-Jpeg $bmp $path 85L
  $bmp.Dispose()
}
Noise-Jpeg '${OUT_DIR.replace(/\\/g, "\\\\")}\\\\concrete_diff.jpg' 118 118 122 22 7
Noise-Jpeg '${OUT_DIR.replace(/\\/g, "\\\\")}\\\\metal_diff.jpg' 96 104 112 28 11
$nor = New-Object System.Drawing.Bitmap 512, 512
$ng = [System.Drawing.Graphics]::FromImage($nor)
$ng.Clear([System.Drawing.Color]::FromArgb(255, 128, 128, 255))
$ng.Dispose()
Save-Jpeg $nor '${OUT_DIR.replace(/\\/g, "\\\\")}\\\\metal_nor.jpg' 85L
$nor.Dispose()
`;

const outputs = ["concrete_diff.jpg", "metal_diff.jpg", "metal_nor.jpg"].map((f) => join(OUT_DIR, f));
if (outputs.every(existsSync)) {
  console.log("[textures] concrete_diff.jpg, metal_diff.jpg, metal_nor.jpg already present — skip");
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
const res = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
if (res.status !== 0) {
  console.error(res.stderr || res.stdout);
  process.exit(1);
}
console.log("[textures] wrote concrete_diff.jpg, metal_diff.jpg, metal_nor.jpg");