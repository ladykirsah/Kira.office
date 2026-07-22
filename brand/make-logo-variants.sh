#!/bin/bash
# Recolour the flat AirPlus wordmark into the requested variants.
#
# The source PNG is a single flat colour with an anti-aliased alpha channel, so every variant is
# produced by using that alpha as a stencil and filling the RGB underneath — edges stay as smooth
# as the original and nothing is re-rasterised.
#
# Two-tone variants split the fill at x=710 and x=1030. Both cut lines fall inside fully
# transparent gaps between glyph groups (A=52-351, ir=381-697, +=723-1013, Plus=1048-1918), so the
# seam never crosses a visible pixel.
set -euo pipefail

SRC="${1:?source png}"
OUT="${2:?output dir}"
mkdir -p "$OUT"

W=$(magick identify -format %w "$SRC")
H=$(magick identify -format %h "$SRC")
PLUS_L=710
PLUS_R=1030

RED="#e10000"    # แดงสด — the locked DENSO CI primary (NOT the legacy coral in the source file)
BLACK="#000000"
WHITE="#ffffff"
BLUE="#015abf"   # น้ำเงิน — CI highlight blue

# Stencil: source alpha, reused by every variant.
magick "$SRC" -alpha extract "$OUT/.alpha.png"

# Region mask: white over the "+" band, black over the text. Hard-edged on purpose — it only ever
# gets sampled inside a transparent gap.
magick -size "${W}x${H}" xc:black -fill white \
  -draw "rectangle $PLUS_L,0 $((PLUS_R - 1)),$((H - 1))" "$OUT/.region.png"

# recolour <text-colour> <plus-colour> <output-name>
recolour() {
  local text="$1" plus="$2" name="$3"
  magick \
    \( -size "${W}x${H}" xc:"$text" \) \
    \( -size "${W}x${H}" xc:"$plus" \) \
    "$OUT/.region.png" -composite \
    "$OUT/.alpha.png" -alpha off -compose CopyOpacity -composite \
    "$OUT/$name"
  echo "  $name  (text $text · plus $plus)"
}

echo "Single colour:"
recolour "$WHITE" "$WHITE" "airplus-white.png"
recolour "$BLACK" "$BLACK" "airplus-black.png"
recolour "$RED"   "$RED"   "airplus-red.png"

echo "Two tone:"
recolour "$WHITE" "$RED"   "airplus-white-red.png"
recolour "$WHITE" "$BLACK" "airplus-white-black.png"
recolour "$BLACK" "$WHITE" "airplus-black-white.png"
recolour "$BLACK" "$RED"   "airplus-black-red.png"
recolour "$RED"   "$WHITE" "airplus-red-white.png"
recolour "$RED"   "$BLACK" "airplus-red-black.png"
recolour "$RED"   "$BLUE"  "airplus-red-blue.png"

rm -f "$OUT/.alpha.png" "$OUT/.region.png"
