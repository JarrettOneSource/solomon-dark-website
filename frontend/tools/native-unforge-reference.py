"""Decode the unchanged stock UI records for the independent GPU oracle."""

import base64
import hashlib
import json
from pathlib import Path

from PIL import Image


assets = Path(__file__).resolve().parent.parent / 'src/assets/game'
atlas = assets / 'skill-picker-ui-atlas.png'
records = json.loads((assets / 'native-ui-assets.json').read_text())['atlases']['UI']['records']
with Image.open(atlas) as image:
    rgba = image.convert('RGBA')
    result = {}
    for number in (75, 76, 77):
        record = records[str(number)]
        x, y, width, height = record['frame']
        result[str(number)] = {
            'record': record,
            'rgba': base64.b64encode(rgba.crop((x, y, x + width + 1, y + height + 1)).tobytes()).decode(),
        }
print(json.dumps({'atlas_sha256': hashlib.sha256(atlas.read_bytes()).hexdigest(), 'records': result}))
