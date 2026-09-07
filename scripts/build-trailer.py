#!/usr/bin/env python3
"""Assemble 菇林弹丸 trailer from public/trailer/raw clips. Encode <90MB."""
from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
from gtts import gTTS
from PIL import Image, ImageDraw, ImageFont

RAW = Path("/workspace/public/trailer/raw")
WORK = Path("/workspace/public/trailer/build")
WORK.mkdir(parents=True, exist_ok=True)
FFMPEG = "/usr/local/bin/ffmpeg"
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
LATIN = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# (filename, duration seconds)
CLIPS = [
    ("s00.mp4", 10),
    ("s01.mp4", 10),
    ("s02.mp4", 10),
    ("s03.mp4", 15),
    ("s04.mp4", 10),
    ("s05.mp4", 10),
    ("s06.mp4", 10),
    ("s07.mp4", 15),
    ("s08.mp4", 15),
    ("s09.mp4", 10),
    ("s10.mp4", 15),
    ("s11.mp4", 10),
    ("s12.mp4", 15),
    ("s13.mp4", 15),
    ("s14.mp4", 10),
]

VO_LINES = [
    ("菇林会记住每一发子弹。", 1.2),
    ("瞄准，开火。", 31.0),
    ("三王苏醒了。", 91.0),
    ("菇林弹丸。", 172.0),
]


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd[:8]), "...")
    subprocess.run(cmd, check=True)


def make_title() -> Path:
    img = Image.new("RGBA", (1280, 720), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    title_font = ImageFont.truetype(FONT, 96)
    sub_font = ImageFont.truetype(LATIN, 28)
    tag_font = ImageFont.truetype(FONT, 24)

    def center(text: str, font, y: int, fill, stroke=0, sc=(18, 12, 8, 230)):
        x0, y0, x1, y1 = draw.textbbox((0, 0), text, font=font)
        x = (1280 - (x1 - x0)) // 2
        draw.text((x, y), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=sc)

    # dim bar behind title
    draw.rectangle((180, 230, 1100, 500), fill=(10, 14, 12, 90))
    center("菇林弹丸", title_font, 250, (255, 244, 214, 255), 5)
    center("SHROOM SHOT", sub_font, 368, (232, 196, 92, 255), 2)
    center("一次远征，一条随机的路。", tag_font, 430, (220, 210, 180, 235), 2)
    out = WORK / "title.png"
    img.save(out)
    return out


def make_vo() -> list[Path]:
    paths = []
    for i, (text, _) in enumerate(VO_LINES, 1):
        p = WORK / f"vo{i}.mp3"
        gTTS(text, lang="zh-cn", slow=False).save(str(p))
        paths.append(p)
    return paths


def make_bed(seconds: float) -> Path:
    sr = 44100
    n = int(sr * seconds)
    t = np.arange(n) / sr
    rng = np.random.default_rng(7)
    pad = (
        0.10 * np.sin(2 * np.pi * 110 * t)
        + 0.07 * np.sin(2 * np.pi * 165 * t)
        + 0.05 * np.sin(2 * np.pi * 220 * t)
        + 0.04 * np.sin(2 * np.pi * 329.63 * t)
    )
    pad *= 0.55 + 0.45 * np.sin(2 * np.pi * 0.12 * t)
    noise = rng.normal(0, 0.012, n)
    hits = np.zeros(n)
    acc = 0.0
    for _, dur in CLIPS:
        i = int(acc * sr)
        if 0 <= i < n:
            env = np.exp(-np.arange(min(int(0.32 * sr), n - i)) / (0.12 * sr))
            hits[i : i + len(env)] += 0.16 * env * np.sin(2 * np.pi * 55 * t[i : i + len(env)])
        acc += dur
    fade = int(1.2 * sr)
    env = np.ones(n)
    env[:fade] = np.linspace(0, 1, fade)
    env[-int(2.5 * sr) :] = np.linspace(1, 0, int(2.5 * sr))
    mix = np.clip((pad + noise + hits) * env, -0.95, 0.95)
    stereo = np.column_stack((mix, mix * 0.97)).astype(np.float32)
    raw = WORK / "bed.f32"
    wav = WORK / "bed.wav"
    stereo.tofile(raw)
    run(
        [
            FFMPEG, "-y", "-f", "f32le", "-ar", str(sr), "-ac", "2", "-i", str(raw),
            "-c:a", "pcm_s16le", str(wav),
        ]
    )
    raw.unlink(missing_ok=True)
    return wav


def normalize_clips(title_png: Path) -> list[Path]:
    outs = []
    for i, (name, dur) in enumerate(CLIPS):
        src = RAW / name
        if not src.exists():
            raise FileNotFoundError(src)
        out = WORK / f"n{i:02d}.mp4"
        fade_out_st = max(0.05, dur - 0.28)
        if i == len(CLIPS) - 1:
            run(
                [
                    FFMPEG, "-y", "-i", str(src), "-i", str(title_png),
                    "-filter_complex",
                    (
                        f"[0:v:0]fps=24,scale=1280:720:flags=fast_bilinear,fade=t=in:d=0.4[base];"
                        f"[1:v]format=rgba[ov];"
                        f"[base][ov]overlay=0:0:enable='gte(t,0.4)',"
                        f"fade=t=out:st={fade_out_st}:d=0.85"
                    ),
                    "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                    "-pix_fmt", "yuv420p", "-r", "24", "-t", str(dur), str(out),
                ]
            )
        else:
            vf = (
                f"fps=24,scale=1280:720:flags=fast_bilinear,"
                f"fade=t=in:d=0.18,fade=t=out:st={fade_out_st}:d=0.22"
            )
            run(
                [
                    FFMPEG, "-y", "-i", str(src), "-map", "0:v:0", "-vf", vf,
                    "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                    "-pix_fmt", "yuv420p", "-r", "24", "-t", str(dur), str(out),
                ]
            )
        outs.append(out)
        print("normalized", out, out.stat().st_size // 1024, "KB")
    return outs


def concat(clips: list[Path]) -> Path:
    lst = WORK / "list.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in clips))
    out = WORK / "silent.mp4"
    run(
        [
            FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
            "-c", "copy", str(out),
        ]
    )
    return out


def mix_audio(vo_paths: list[Path], bed: Path, total: float) -> Path:
    cmd = [FFMPEG, "-y", "-i", str(bed)]
    for p in vo_paths:
        cmd += ["-i", str(p)]
    filters = ["[0:a]volume=0.52[bed]"]
    inputs = "[bed]"
    for i, (_, start) in enumerate(VO_LINES, 1):
        ms = int(start * 1000)
        filters.append(f"[{i}:a]adelay={ms}|{ms},volume=2.2[v{i}]")
        inputs += f"[v{i}]"
    n = 1 + len(VO_LINES)
    filters.append(f"{inputs}amix=inputs={n}:duration=first:dropout_transition=2,alimiter=limit=0.94[a]")
    out = WORK / "mix.m4a"
    cmd += [
        "-filter_complex", ";".join(filters),
        "-map", "[a]", "-c:a", "aac", "-b:a", "128k",
        "-t", f"{total:.2f}", str(out),
    ]
    run(cmd)
    return out


def mux(video: Path, audio: Path) -> Path:
    out = Path("/workspace/菇林弹丸-宣传片.mp4")
    also = Path("/workspace/shroom-shot-trailer.mp4")
    run(
        [
            FFMPEG, "-y", "-i", str(video), "-i", str(audio),
            "-c:v", "libx264", "-preset", "medium", "-crf", "27",
            "-pix_fmt", "yuv420p", "-r", "24",
            "-c:a", "aac", "-b:a", "128k",
            "-shortest", "-movflags", "+faststart",
            str(out),
        ]
    )
    subprocess.run(["cp", str(out), str(also)], check=True)
    return out


def main() -> None:
    missing = [n for n, _ in CLIPS if not (RAW / n).exists()]
    if missing:
        raise SystemExit(f"missing clips: {missing}")
    print("title + vo")
    title = make_title()
    vos = make_vo()
    print("normalize")
    clips = normalize_clips(title)
    total = float(sum(d for _, d in CLIPS))
    print("concat", total, "s")
    silent = concat(clips)
    print("bed + mix")
    bed = make_bed(total)
    audio = mix_audio(vos, bed, total)
    print("mux")
    out = mux(silent, audio)
    size_mb = out.stat().st_size / (1024 * 1024)
    print(f"DONE {out} {size_mb:.1f}MB duration={total}s")
    if size_mb >= 95:
        raise SystemExit(f"too large for GitHub: {size_mb:.1f}MB")


if __name__ == "__main__":
    main()
