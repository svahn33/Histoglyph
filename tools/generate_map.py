"""Regenerate the local detailed SVG world map.

Requirements:
    pip install matplotlib basemap scour

Run from the project root:
    python tools/generate_map.py
"""
from pathlib import Path
import subprocess
import matplotlib.pyplot as plt
from mpl_toolkits.basemap import Basemap

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "assets" / "detailed-world-map-raw.svg"
OUTPUT = ROOT / "assets" / "detailed-world-map.svg"

fig = plt.figure(figsize=(19.716, 10), dpi=100)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_axis_off()

world = Basemap(
    projection="robin",
    lon_0=0,
    resolution="i",
    area_thresh=100,
    ax=ax,
)

world.drawmapboundary(fill_color="#c8c8c8", linewidth=0)
world.fillcontinents(color="#ffffff", lake_color="#c8c8c8", zorder=1)
world.drawcoastlines(color="#9f9f9f", linewidth=0.25, zorder=2)
world.drawcountries(color="#b8b8b8", linewidth=0.22, zorder=3)

plt.savefig(RAW, format="svg", bbox_inches="tight", pad_inches=0, facecolor="#c8c8c8")
plt.close(fig)

subprocess.run([
    "scour", "-i", str(RAW), "-o", str(OUTPUT),
    "--enable-viewboxing", "--enable-id-stripping",
    "--enable-comment-stripping", "--shorten-ids", "--indent=none",
], check=True)

RAW.unlink(missing_ok=True)
print(f"Generated {OUTPUT}")
