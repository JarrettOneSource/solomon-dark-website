from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sqlite3
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = spec_from_file_location('parallel_saves', ROOT / 'ops/local-ci/parallel-game-saves.py')
MIGRATION = module_from_spec(SPEC)
SPEC.loader.exec_module(MIGRATION)


class ParallelSaveMigrationTests(unittest.TestCase):
    def test_current_saves_fork_once_without_overwriting_or_resurrecting_rust_progress(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / 'sdr.db'
            with sqlite3.connect(database) as db:
                db.execute('''CREATE TABLE WebGameSaves (
                    Id INTEGER PRIMARY KEY, UserId INTEGER NOT NULL, Slot INTEGER NOT NULL,
                    Revision INTEGER NOT NULL, Document TEXT NOT NULL, UNIQUE(UserId, Slot))''')
                db.executemany('INSERT INTO WebGameSaves(UserId,Slot,Revision,Document) VALUES(?,?,?,?)', [
                    (1, 0, 19, 'current checkpoint'),
                    (2, 0, 8, 'another checkpoint'),
                    (2, 1, 3, 'existing companion progress'),
                ])
            self.assertEqual(MIGRATION.fork_primary_saves(database), {'copied': 1, 'alreadyMigrated': False})
            with sqlite3.connect(database) as db:
                self.assertEqual(db.execute(
                    'SELECT UserId,Slot,Revision,Document FROM WebGameSaves ORDER BY UserId,Slot'
                ).fetchall(), [
                    (1, 0, 19, 'current checkpoint'), (1, 1, 19, 'current checkpoint'),
                    (2, 0, 8, 'another checkpoint'), (2, 1, 3, 'existing companion progress'),
                ])
                db.execute('DELETE FROM WebGameSaves WHERE UserId=1 AND Slot=1')
                db.execute("UPDATE WebGameSaves SET Revision=20, Document='new PixiJS progress' WHERE UserId=1")
                db.execute("INSERT INTO WebGameSaves(UserId,Slot,Revision,Document) VALUES(3,0,1,'new player')")
            self.assertEqual(MIGRATION.fork_primary_saves(database), {'copied': 0, 'alreadyMigrated': True})
            with sqlite3.connect(database) as db:
                self.assertEqual(db.execute(
                    'SELECT UserId,Revision,Document FROM WebGameSaves WHERE Slot=1 ORDER BY UserId'
                ).fetchall(), [(2, 3, 'existing companion progress')])
                self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')

    def test_missing_database_is_never_created_as_a_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / 'missing.db'
            with self.assertRaises(sqlite3.OperationalError):
                MIGRATION.fork_primary_saves(database)
            self.assertFalse(database.exists())


if __name__ == '__main__':
    unittest.main()
