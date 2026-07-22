# Boneyard art manifests

Regenerate from the preserved 0.72.5 game image directory:

```bash
cd "/mnt/c/Users/User/Documents/GitHub/SB Modding/Solomon Dark"
python3 "Website/tools/extract-boneyard-assets.py"
```

Pass another `images/` directory as the optional first argument. The script reads the common sprite record format through `Mod Loader/tools/extract_bundles.py`.

The source atlases are the 0.72.5 abandonware copy retained for fan preservation. Original art (c) Raptisoft. The generated PNGs are exact bundle rectangles. Logical cell size and origin stay in JSON. Transparent records keep their IDs and use `file: null`.

DeadHawg entry IDs must remain dense and equal to bundle indices. RegionLayout section 11 stores `atlas_entry_id` values and resolves them against DeadHawg by index. Reordering entries breaks native Boneyard placement.

BadGuys is included because Goodie owns indicator and break-effect records there. Bonedit supplies stock editor chrome and fence-piece references. Contact sheets are written to `Website/tools/out/`, outside `frontend/src/`.
