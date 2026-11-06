#!/usr/bin/env python3
"""Make PixiJS's cloud saves the Rust game's once, when Rust replaces PixiJS at /game.

Slot 0 holds each account's PixiJS save and slot 1 its Rust save. Both copies come
from one fork at the parallel launch and count revisions from it, so the copy written
more often since then is the one the player kept playing; a tie keeps PixiJS's. The
other copy goes to GameSaveAdoptionBackups. The browser-side adoption in
frontend/src/lib/pixijs-save-adoption.ts applies the same rule to guest saves.

It runs on every deployment after both games stopped and the database was backed up,
and does nothing until frontend/tools/companion-game.json sets adoptPixiJsSaves.
"""
import json
from pathlib import Path
import sqlite3
import sys

NAME = 'pixijs-adoption'


def choose(pixi, rust):
    """The outcome for one account; each save is (revision, document) or None."""
    if pixi is None:
        return 'empty'
    if rust is None:
        return 'adopted'
    if pixi[1] == rust[1]:
        return 'same'
    return 'replaced' if pixi[0] >= rust[0] else 'kept'


def adopt_pixijs_saves(database):
    counts = {'adopted': 0, 'replaced': 0, 'kept': 0, 'same': 0}
    with sqlite3.connect(database.resolve().as_uri() + '?mode=rw', uri=True) as db:
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('BEGIN IMMEDIATE')
        db.execute('CREATE TABLE IF NOT EXISTS GameSaveMigrations (Name TEXT PRIMARY KEY NOT NULL)')
        db.execute('''CREATE TABLE IF NOT EXISTS GameSaveAdoptionBackups (
            UserId INTEGER NOT NULL, Slot INTEGER NOT NULL, Revision INTEGER NOT NULL,
            Document TEXT NOT NULL, Source TEXT NOT NULL)''')
        if db.execute('SELECT 1 FROM GameSaveMigrations WHERE Name=?', (NAME,)).fetchone():
            return {**counts, 'alreadyAdopted': True}
        rows = db.execute('''
            SELECT pixi.UserId, pixi.Revision, pixi.Document, rust.Revision, rust.Document
            FROM WebGameSaves AS pixi
            LEFT JOIN WebGameSaves AS rust ON rust.UserId = pixi.UserId AND rust.Slot = 1
            WHERE pixi.Slot = 0 ORDER BY pixi.UserId
        ''').fetchall()
        for user, pixi_revision, pixi_document, rust_revision, rust_document in rows:
            rust = None if rust_document is None else (rust_revision, rust_document)
            outcome = choose((pixi_revision, pixi_document), rust)
            counts[outcome] += 1
            if outcome == 'adopted':
                db.execute('INSERT INTO WebGameSaves (UserId, Slot, Revision, Document) VALUES (?, 1, ?, ?)',
                           (user, pixi_revision, pixi_document))
            elif outcome == 'replaced':
                db.execute('INSERT INTO GameSaveAdoptionBackups VALUES (?, 1, ?, ?, ?)',
                           (user, rust_revision, rust_document, 'rust'))
                db.execute('UPDATE WebGameSaves SET Revision=?, Document=? WHERE UserId=? AND Slot=1',
                           (pixi_revision, pixi_document, user))
            elif outcome == 'kept':
                db.execute('INSERT INTO GameSaveAdoptionBackups VALUES (?, 0, ?, ?, ?)',
                           (user, pixi_revision, pixi_document, 'pixijs'))
        db.execute('INSERT INTO GameSaveMigrations (Name) VALUES (?)', (NAME,))
        return {**counts, 'alreadyAdopted': False}


def main(database, companion):
    if not json.loads(companion.read_text()).get('adoptPixiJsSaves', False):
        return {'skipped': 'adoptPixiJsSaves is off'}
    return adopt_pixijs_saves(database)


if __name__ == '__main__':
    print(json.dumps(main(Path(sys.argv[1]), Path(sys.argv[2]))))
