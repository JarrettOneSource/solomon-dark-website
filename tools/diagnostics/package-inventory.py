"""Read-only file/symlink/mode inventory of the exact packaged application."""
import hashlib
import json
import os
import pathlib
import stat
import sys

root = pathlib.Path(sys.argv[1]).resolve()
output = pathlib.Path(sys.argv[2]).resolve()
if root in output.parents:
    raise SystemExit("Inventory output must be outside the application package")
rows = []
for directory, dirs, files in os.walk(root, followlinks=False):
    for name in sorted(dirs + files):
        item = pathlib.Path(directory) / name
        info = item.lstat()
        row = {"path": str(item.relative_to(root)), "mode": stat.S_IMODE(info.st_mode)}
        if item.is_symlink():
            row.update(kind="symlink", target=os.readlink(item))
        elif item.is_file():
            with item.open("rb") as source:
                row.update(kind="file", bytes=info.st_size, sha256=hashlib.file_digest(source, "sha256").hexdigest())
        elif item.is_dir():
            row.update(kind="directory")
        else:
            raise SystemExit("Unexpected packaged file type: " + str(item))
        rows.append(row)
output.write_text(json.dumps(sorted(rows, key=lambda row: row["path"]), indent=2) + "\n")
