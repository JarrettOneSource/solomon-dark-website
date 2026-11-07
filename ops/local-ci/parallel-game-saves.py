#!/usr/bin/env python3
"""Fork existing continuation saves once, after both game save barriers settle, and
adopt PixiJS's saves once when the Rust game replaces it at /game.

Slot 0 holds each account's PixiJS save and slot 1 its Rust save. Both copies come
from the fork and count revisions from it, so at the adoption the copy written more
often since then is the one the player kept playing; a tie keeps PixiJS's. The other
copy goes to GameSaveAdoptionBackups. frontend/src/lib/pixijs-save-adoption.ts applies
the same rule to guest saves. The adoption runs only when the release's game manifest
records a companion with adoptPixiJsSaves, which frontend/tools/companion-game.json
sets at the swap.
"""
import json
from pathlib import Path
import sqlite3
import sys


def fork_primary_saves(database):
    with sqlite3.connect(database.resolve().as_uri() + '?mode=rw', uri=True) as db:
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('BEGIN IMMEDIATE')
        db.execute('CREATE TABLE IF NOT EXISTS GameSaveMigrations (Name TEXT PRIMARY KEY NOT NULL)')
        name = 'primary-to-rust-20261028'
        if db.execute('SELECT 1 FROM GameSaveMigrations WHERE Name=?', (name,)).fetchone():
            return {'copied': 0, 'alreadyMigrated': True}
        copied = db.execute('''
            INSERT INTO WebGameSaves (UserId, Slot, Revision, Document)
            SELECT source.UserId, 1, source.Revision, source.Document
            FROM WebGameSaves AS source
            WHERE source.Slot = 0 AND NOT EXISTS (
                SELECT 1 FROM WebGameSaves AS target
                WHERE target.UserId = source.UserId AND target.Slot = 1
            )
        ''').rowcount
        db.execute('INSERT INTO GameSaveMigrations (Name) VALUES (?)', (name,))
        return {'copied': copied, 'alreadyMigrated': False}


ADOPTION = 'pixijs-adoption'


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
        if db.execute('SELECT 1 FROM GameSaveMigrations WHERE Name=?', (ADOPTION,)).fetchone():
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
        db.execute('INSERT INTO GameSaveMigrations (Name) VALUES (?)', (ADOPTION,))
        return {**counts, 'alreadyAdopted': False}


def adopts_pixijs_saves(manifest):
    """Whether the release's game manifest says the Rust game replaced PixiJS."""
    return json.loads(manifest.read_text()).get('companion', {}).get('adoptPixiJsSaves') is True


def main(database, manifest=None):
    result = {'fork': fork_primary_saves(database)}
    if manifest is not None and adopts_pixijs_saves(manifest):
        result['adoption'] = adopt_pixijs_saves(database)
    return result


if __name__ == '__main__':
    print(json.dumps(main(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) > 2 else None)))
