<#
.SYNOPSIS
  影像處理的共用程式碼，由 split_sprites.ps1 和 cutout.ps1 共用。

.NOTES
  用法：在腳本開頭寫 . "$PSScriptRoot\imagelib.ps1"
  這裡刻意用 Windows PowerShell 5.1 內建的 System.Drawing，
  不要改成 System.Drawing.Common（5.1 沒有那個組件，會編譯失敗）。
#>

Add-Type -AssemblyName System.Drawing

if (-not ('SpriteCut' -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class SpriteCut
{
    public class Buf {
        public int W, H;
        public byte[] P; // BGRA, 4 bytes per pixel, no padding
        public Buf(int w, int h) { W = w; H = h; P = new byte[w * h * 4]; }
    }

    public static Buf Load(string path) {
        using (Bitmap src = new Bitmap(path))
        using (Bitmap bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb)) {
            using (Graphics g = Graphics.FromImage(bmp)) { g.DrawImage(src, 0, 0, src.Width, src.Height); }
            Buf b = new Buf(bmp.Width, bmp.Height);
            BitmapData d = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            for (int y = 0; y < bmp.Height; y++)
                Marshal.Copy(IntPtr.Add(d.Scan0, y * d.Stride), b.P, y * bmp.Width * 4, bmp.Width * 4);
            bmp.UnlockBits(d);
            return b;
        }
    }

    public static void Save(Buf b, string path) {
        using (Bitmap bmp = new Bitmap(b.W, b.H, PixelFormat.Format32bppArgb)) {
            BitmapData d = bmp.LockBits(new Rectangle(0,0,b.W,b.H), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            for (int y = 0; y < b.H; y++)
                Marshal.Copy(b.P, y * b.W * 4, IntPtr.Add(d.Scan0, y * d.Stride), b.W * 4);
            bmp.UnlockBits(d);
            bmp.Save(path, ImageFormat.Png);
        }
    }

    public static void FillWhite(Buf b, int x0, int y0, int x1, int y1) {
        for (int y = Math.Max(0,y0); y < Math.Min(b.H,y1); y++)
            for (int x = Math.Max(0,x0); x < Math.Min(b.W,x1); x++) {
                int i = (y * b.W + x) * 4;
                b.P[i] = 255; b.P[i+1] = 255; b.P[i+2] = 255; b.P[i+3] = 255;
            }
    }

    public static Buf Crop(Buf s, int x0, int y0, int w, int h) {
        Buf o = new Buf(w, h);
        for (int y = 0; y < h; y++) {
            int sy = y0 + y;
            if (sy < 0 || sy >= s.H) continue;
            for (int x = 0; x < w; x++) {
                int sx = x0 + x;
                if (sx < 0 || sx >= s.W) continue;
                Array.Copy(s.P, (sy * s.W + sx) * 4, o.P, (y * o.W + x) * 4, 4);
            }
        }
        return o;
    }

    // Flood fills the outer background to transparent starting from the border.
    // Enclosed white areas (a shirt, a collar, the whites of eyes) are never
    // reached by the fill, so they survive.
    public static void RemoveBackground(Buf b, int hard, int soft) {
        int n = b.W * b.H;
        bool[] visited = new bool[n];
        int[] work = new int[n * 2];
        int wp = 0;

        for (int x = 0; x < b.W; x++) { work[wp++] = x; work[wp++] = (b.H - 1) * b.W + x; }
        for (int y = 0; y < b.H; y++) { work[wp++] = y * b.W; work[wp++] = y * b.W + b.W - 1; }

        while (wp > 0) {
            int idx = work[--wp];
            if (idx < 0 || idx >= n || visited[idx]) continue;
            int i4 = idx * 4;
            int mn = Math.Min(b.P[i4], Math.Min(b.P[i4+1], b.P[i4+2]));
            if (mn < soft) continue;
            visited[idx] = true;

            if (mn < hard) {
                // Antialiased rim: fade it out but stop here, so the fill cannot
                // leak through a soft pixel into the artwork.
                int a = (int)(255.0 * (hard - mn) / (double)(hard - soft));
                b.P[i4+3] = (byte)Math.Max(0, Math.Min(255, a));
                continue;
            }
            b.P[i4+3] = 0;

            if (wp + 4 > work.Length) continue;
            int x2 = idx % b.W, y2 = idx / b.W;
            if (x2 > 0)        work[wp++] = idx - 1;
            if (x2 < b.W - 1)  work[wp++] = idx + 1;
            if (y2 > 0)        work[wp++] = idx - b.W;
            if (y2 < b.H - 1)  work[wp++] = idx + b.W;
        }
    }

    // Same flood fill, but for a flat GREY background such as the checkerboard
    // that image tools bake into a JPG when they fake transparency.
    // A pixel counts as background when it is nearly colourless (chroma small)
    // AND bright. Skin, hair and cloth all carry enough colour to stop the fill;
    // enclosed white areas (a shirt, a notebook) are never reached from the border.
    public static void RemoveBackgroundFlat(Buf b, int hardBright, int softBright, int maxChroma) {
        int n = b.W * b.H;
        bool[] visited = new bool[n];
        int[] work = new int[n * 2];
        int wp = 0;

        for (int x = 0; x < b.W; x++) { work[wp++] = x; work[wp++] = (b.H - 1) * b.W + x; }
        for (int y = 0; y < b.H; y++) { work[wp++] = y * b.W; work[wp++] = y * b.W + b.W - 1; }

        while (wp > 0) {
            int idx = work[--wp];
            if (idx < 0 || idx >= n || visited[idx]) continue;
            int i4 = idx * 4;
            int bl = b.P[i4], g = b.P[i4+1], r = b.P[i4+2];
            int mx = Math.Max(r, Math.Max(g, bl));
            int mn = Math.Min(r, Math.Min(g, bl));
            if (mx - mn > maxChroma) continue;      // has colour -> artwork
            if (mx < softBright) continue;          // too dark -> artwork
            visited[idx] = true;

            if (mx < hardBright) {
                int a = (int)(255.0 * (hardBright - mx) / (double)(hardBright - softBright));
                b.P[i4+3] = (byte)Math.Max(0, Math.Min(255, a));
                continue;                            // soft rim: do not expand through it
            }
            b.P[i4+3] = 0;

            if (wp + 4 > work.Length) continue;
            int x2 = idx % b.W, y2 = idx / b.W;
            if (x2 > 0)        work[wp++] = idx - 1;
            if (x2 < b.W - 1)  work[wp++] = idx + 1;
            if (y2 > 0)        work[wp++] = idx - b.W;
            if (y2 < b.H - 1)  work[wp++] = idx + b.W;
        }
    }

    // Removes background that the border flood fill could not reach.
    //
    // A hair strand drawn over a shoulder traps a sliver of the white sheet between
    // two inked outlines. RemoveBackground starts from the border, so it never gets
    // in there and the sliver stays opaque white.
    //
    // Not every enclosed white area is background though — teeth, eye highlights, a
    // thought bubble and a white collar are all painted white. Three tests together
    // separate them, and a region must satisfy ALL of them to be erased:
    //
    //   near      the region sits just behind the silhouette, at most maxGap pixels
    //             from a transparent pixel (only an outline separates them).
    //             Teeth and eye whites are deep inside the drawing.
    //   thin      bbox is elongated (a gap between two shapes), not a blob.
    //             This is what keeps a round thought bubble.
    //   big       small speckles are left alone; they are usually artwork detail.
    //
    // Returns how many pixels were erased.
    public static int RemoveTrappedBackground(Buf b, int hardWhite, int maxGap, int minArea, double minAspect) {
        int n = b.W * b.H;

        // How far is each pixel from transparency? (multi-source BFS, capped at maxGap)
        int[] dist = new int[n];
        int[] queue = new int[n];
        int qh = 0, qt = 0;
        for (int i = 0; i < n; i++) {
            if (b.P[i * 4 + 3] <= 40) { dist[i] = 0; queue[qt++] = i; }
            else dist[i] = int.MaxValue;
        }
        while (qh < qt) {
            int idx = queue[qh++];
            if (dist[idx] >= maxGap) continue;
            int x = idx % b.W, y = idx / b.W;
            for (int d = 0; d < 4; d++) {
                int nx = x, ny = y;
                if (d == 0) nx--; else if (d == 1) nx++; else if (d == 2) ny--; else ny++;
                if (nx < 0 || ny < 0 || nx >= b.W || ny >= b.H) continue;
                int ni = ny * b.W + nx;
                if (dist[ni] != int.MaxValue) continue;
                dist[ni] = dist[idx] + 1;
                queue[qt++] = ni;
            }
        }

        bool[] isWhite = new bool[n];
        for (int i = 0; i < n; i++) {
            int p = i * 4;
            int mn = Math.Min(b.P[p + 2], Math.Min(b.P[p + 1], b.P[p]));
            isWhite[i] = b.P[p + 3] > 200 && mn >= hardWhite;
        }

        int[] label = new int[n];
        int[] stack = new int[n];
        int erased = 0;

        for (int s = 0; s < n; s++) {
            if (!isWhite[s] || label[s] != 0) continue;

            int sp = 0;
            stack[sp++] = s;
            label[s] = 1;
            int area = 0, minx = b.W, maxx = -1, miny = b.H, maxy = -1, near = int.MaxValue;
            int head = 0;

            while (sp > head) {
                int idx = stack[head++];
                area++;
                int x = idx % b.W, y = idx / b.W;
                if (x < minx) minx = x;
                if (x > maxx) maxx = x;
                if (y < miny) miny = y;
                if (y > maxy) maxy = y;
                if (dist[idx] < near) near = dist[idx];

                for (int d = 0; d < 4; d++) {
                    int nx = x, ny = y;
                    if (d == 0) nx--; else if (d == 1) nx++; else if (d == 2) ny--; else ny++;
                    if (nx < 0 || ny < 0 || nx >= b.W || ny >= b.H) continue;
                    int ni = ny * b.W + nx;
                    if (isWhite[ni] && label[ni] == 0) { label[ni] = 1; stack[sp++] = ni; }
                }
            }

            int w = maxx - minx + 1, h = maxy - miny + 1;
            double aspect = (double)Math.Max(w, h) / Math.Max(1, Math.Min(w, h));
            if (near <= maxGap && area >= minArea && aspect >= minAspect) {
                for (int k = 0; k < sp; k++) { b.P[stack[k] * 4 + 3] = 0; }
                erased += area;
            }
        }
        return erased;
    }

    // Box-filter downscale that is correct for transparent images.
    //
    // Naively averaging RGBA blends the RGB of fully transparent pixels into the
    // edges. Those pixels still hold the old background colour, so a cut-out on a
    // white sheet grows a pale halo. Averaging PREMULTIPLIED colour and dividing
    // the alpha back out afterwards keeps edges clean.
    public static Buf Downscale(Buf s, int w, int h) {
        Buf o = new Buf(w, h);
        double sx = (double)s.W / w, sy = (double)s.H / h;

        for (int y = 0; y < h; y++) {
            int y0 = (int)(y * sy);
            int y1 = (int)Math.Ceiling((y + 1) * sy);
            if (y1 <= y0) y1 = y0 + 1;
            if (y1 > s.H) y1 = s.H;

            for (int x = 0; x < w; x++) {
                int x0 = (int)(x * sx);
                int x1 = (int)Math.Ceiling((x + 1) * sx);
                if (x1 <= x0) x1 = x0 + 1;
                if (x1 > s.W) x1 = s.W;

                double pb = 0, pg = 0, pr = 0, sa = 0;
                int n = 0;
                for (int yy = y0; yy < y1; yy++) {
                    for (int xx = x0; xx < x1; xx++) {
                        int i = (yy * s.W + xx) * 4;
                        double a = s.P[i + 3];
                        pb += s.P[i]     * a;
                        pg += s.P[i + 1] * a;
                        pr += s.P[i + 2] * a;
                        sa += a;
                        n++;
                    }
                }

                int oi = (y * o.W + x) * 4;
                if (sa > 0) {
                    o.P[oi]     = (byte)Math.Max(0, Math.Min(255, (int)Math.Round(pb / sa)));
                    o.P[oi + 1] = (byte)Math.Max(0, Math.Min(255, (int)Math.Round(pg / sa)));
                    o.P[oi + 2] = (byte)Math.Max(0, Math.Min(255, (int)Math.Round(pr / sa)));
                    o.P[oi + 3] = (byte)Math.Max(0, Math.Min(255, (int)Math.Round(sa / n)));
                }
            }
        }
        return o;
    }

    // Keeps only the largest connected blob of visible pixels and erases the rest.
    // Background removal stops at anything coloured, so bits of scenery that were
    // never touching the border survive as stray fragments; this clears them out
    // without having to hand-tune the crop.
    public static int KeepLargestComponent(Buf b, int alphaMin) {
        int n = b.W * b.H;
        int[] label = new int[n];      // 0 = unvisited, -1 = background, >0 = component id
        int[] stack = new int[n];
        int best = 0, bestSize = 0, id = 0;

        for (int start = 0; start < n; start++) {
            if (label[start] != 0) continue;
            if (b.P[start * 4 + 3] <= alphaMin) { label[start] = -1; continue; }

            id++;
            int size = 0, sp = 0;
            stack[sp++] = start;
            label[start] = id;

            while (sp > 0) {
                int idx = stack[--sp];
                size++;
                int x = idx % b.W, y = idx / b.W;

                for (int d = 0; d < 4; d++) {
                    int nx = x, ny = y;
                    if (d == 0) nx--; else if (d == 1) nx++; else if (d == 2) ny--; else ny++;
                    if (nx < 0 || ny < 0 || nx >= b.W || ny >= b.H) continue;
                    int ni = ny * b.W + nx;
                    if (label[ni] != 0) continue;
                    if (b.P[ni * 4 + 3] <= alphaMin) { label[ni] = -1; continue; }
                    label[ni] = id;
                    stack[sp++] = ni;
                }
            }

            if (size > bestSize) { bestSize = size; best = id; }
        }

        for (int i = 0; i < n; i++)
            if (label[i] != best) b.P[i * 4 + 3] = 0;

        return bestSize;
    }

    // Per-column / per-row count of pixels whose alpha is above a threshold.
    public static int[] AlphaProfile(Buf b, bool byColumn, int alphaMin) {
        int[] c = new int[byColumn ? b.W : b.H];
        for (int y = 0; y < b.H; y++)
            for (int x = 0; x < b.W; x++)
                if (b.P[(y * b.W + x) * 4 + 3] > alphaMin) c[byColumn ? x : y]++;
        return c;
    }

    // Per-column / per-row count of pixels that are not background white.
    public static int[] Profile(Buf b, bool byColumn, int white) {
        int[] c = new int[byColumn ? b.W : b.H];
        for (int y = 0; y < b.H; y++)
            for (int x = 0; x < b.W; x++) {
                int i = (y * b.W + x) * 4;
                int mn = Math.Min(b.P[i], Math.Min(b.P[i+1], b.P[i+2]));
                if (mn < white) c[byColumn ? x : y]++;
            }
        return c;
    }

    public static int[] BBox(Buf b, int alphaMin) {
        int minx = b.W, miny = b.H, maxx = -1, maxy = -1;
        for (int y = 0; y < b.H; y++)
            for (int x = 0; x < b.W; x++)
                if (b.P[(y * b.W + x) * 4 + 3] > alphaMin) {
                    if (x < minx) minx = x;
                    if (x > maxx) maxx = x;
                    if (y < miny) miny = y;
                    if (y > maxy) maxy = y;
                }
        if (maxx < 0) return new int[] { 0, 0, b.W, b.H };
        return new int[] { minx, miny, maxx - minx + 1, maxy - miny + 1 };
    }
}
"@
}
