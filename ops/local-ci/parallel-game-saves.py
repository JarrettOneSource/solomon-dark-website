#!/usr/bin/env python3
"""Fork existing continuation saves once, after both game save barriers settle."""
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


if __name__ == '__main__':
    print(json.dumps(fork_primary_saves(Path(sys.argv[1]))))
