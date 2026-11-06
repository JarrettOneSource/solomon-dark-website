from importlib.util import module_from_spec, spec_from_file_location
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = spec_from_file_location('pixijs_adoption', ROOT / 'ops/local-ci/adopt-pixijs-cloud-saves.py')
ADOPTION = module_from_spec(SPEC)
SPEC.loader.exec_module(ADOPTION)


def database_with(directory, rows):
    database = Path(directory) / 'sdr.db'
    with sqlite3.connect(database) as db:
        db.execute('''CREATE TABLE WebGameSaves (
            Id INTEGER PRIMARY KEY, UserId INTEGER NOT NULL, Slot INTEGER NOT NULL,
            Revision INTEGER NOT NULL, Document TEXT NOT NULL, UNIQUE(UserId, Slot))''')
        db.executemany('INSERT INTO WebGameSaves(UserId,Slot,Revision,Document) VALUES(?,?,?,?)', rows)
    return database


class PixiJsCloudSaveAdoptionTests(unittest.TestCase):
    def test_each_account_continues_the_save_it_kept_playing_once(self):
        with tempfile.TemporaryDirectory() as directory:
            database = database_with(directory, [
                (1, 0, 30, 'kept playing PixiJS'), (1, 1, 17, 'forked Rust copy'),
                (2, 0, 12, 'forked PixiJS copy'), (2, 1, 40, 'kept playing Rust'),
                (3, 0, 9, 'PixiJS only'),
                (4, 1, 5, 'Rust only'),
                (5, 0, 8, 'same'), (5, 1, 8, 'same'),
                (6, 0, 20, 'tied PixiJS'), (6, 1, 20, 'tied Rust'),
            ])
            self.assertEqual(ADOPTION.adopt_pixijs_saves(database), {
                'adopted': 1, 'replaced': 2, 'kept': 1, 'same': 1, 'alreadyAdopted': False})
            with sqlite3.connect(database) as db:
                self.assertEqual(db.execute(
                    'SELECT UserId,Revision,Document FROM WebGameSaves WHERE Slot=1 ORDER BY UserId'
                ).fetchall(), [
                    (1, 30, 'kept playing PixiJS'), (2, 40, 'kept playing Rust'), (3, 9, 'PixiJS only'),
                    (4, 5, 'Rust only'), (5, 8, 'same'), (6, 20, 'tied PixiJS'),
                ])
                self.assertEqual(db.execute(
                    'SELECT UserId,Slot,Revision,Document,Source FROM GameSaveAdoptionBackups ORDER BY UserId'
                ).fetchall(), [
                    (1, 1, 17, 'forked Rust copy', 'rust'), (2, 0, 12, 'forked PixiJS copy', 'pixijs'),
                    (6, 1, 20, 'tied Rust', 'rust'),
                ])
                # PixiJS's own slot is never changed.
                self.assertEqual(db.execute('SELECT COUNT(*) FROM WebGameSaves WHERE Slot=0').fetchone()[0], 5)
                db.execute("UPDATE WebGameSaves SET Revision=99, Document='later' WHERE UserId=2 AND Slot=0")
            self.assertEqual(ADOPTION.adopt_pixijs_saves(database)['alreadyAdopted'], True)
            with sqlite3.connect(database) as db:
                self.assertEqual(db.execute(
                    'SELECT Document FROM WebGameSaves WHERE UserId=2 AND Slot=1').fetchone()[0], 'kept playing Rust')
                self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')

    def test_nothing_changes_until_the_companion_definition_turns_adoption_on(self):
        with tempfile.TemporaryDirectory() as directory:
            database = database_with(directory, [(1, 0, 9, 'PixiJS only')])
            companion = Path(directory) / 'companion-game.json'
            companion.write_text(json.dumps({'mount': '/game-rust', 'adoptPixiJsSaves': False}))
            self.assertEqual(ADOPTION.main(database, companion), {'skipped': 'adoptPixiJsSaves is off'})
            with sqlite3.connect(database) as db:
                self.assertEqual(db.execute('SELECT COUNT(*) FROM WebGameSaves').fetchone()[0], 1)
                self.assertIsNone(db.execute(
                    "SELECT 1 FROM sqlite_master WHERE name='GameSaveMigrations'").fetchone())
            companion.write_text(json.dumps({'mount': '/game', 'adoptPixiJsSaves': True}))
            self.assertEqual(ADOPTION.main(database, companion)['adopted'], 1)

    def test_the_shipped_companion_definition_keeps_adoption_off(self):
        companion = json.loads((ROOT / 'frontend/tools/companion-game.json').read_text())
        self.assertIs(companion['adoptPixiJsSaves'], companion['mount'] == '/game')

    def test_missing_database_is_never_created_as_a_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / 'missing.db'
            with self.assertRaises(sqlite3.OperationalError):
                ADOPTION.adopt_pixijs_saves(database)
            self.assertFalse(database.exists())


if __name__ == '__main__':
    unittest.main()
