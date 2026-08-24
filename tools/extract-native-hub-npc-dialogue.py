#!/usr/bin/env python3
"""Build the exact retail survival-Hub NPC interaction catalog."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


EXPECTED_HASHES = {
    "survival.txt": "5e792f4dc692667d0ecaa4e7304202f11d2d1cdc664820b97be83145fa3b2d67",
    "books.txt": "d7ca0a36c2fe6af90a4a950d5ff3dab7638f43640de97684eb6a7583a02b24a1",
    "spellfacts.txt": "1d78d408664ea830465e7e5a8b56df2c6373cb4f6685dc025a1a6d0f90ab0e17",
    "narration.txt": "5a80f605f8fcac7fc634f8234d5b0a0173d3d4aa563dc076cc6d1b4dbc649174",
}
EXECUTABLE_SHA256 = "03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sections(path: Path) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    key: str | None = None
    lines: list[str] = []

    def flush() -> None:
        nonlocal lines
        if key is None:
            return
        while lines and not lines[0]:
            lines.pop(0)
        while lines and not lines[-1]:
            lines.pop()
        if not lines:
            raise ValueError(f"{path.name} section {key} is empty")
        result[key] = {"key": key, "label": lines[0], "lines": lines[1:]}
        lines = []

    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if line.startswith(">"):
            flush()
            key = line[1:]
        elif key is not None:
            lines.append(line)
    flush()
    return result


def narration(path: Path) -> dict[str, str]:
    return dict(
        line.split("=", 1)
        for line in path.read_text(encoding="utf-8-sig").splitlines()
        if line and not line.startswith("//") and "=" in line
    )


def geometry(region: str, x: float, y: float, radius: float) -> dict[str, Any]:
    return {"position": {"x": x, "y": y}, "radius": radius, "region": region}


def interaction(
    name: str,
    intro: str,
    region: str,
    x: float,
    y: float,
    radius: float,
    *,
    questions: list[str] | None = None,
    commands: list[tuple[str, str, str]] | None = None,
    dismissals: list[str] | None = None,
    service_title: str | None = None,
) -> dict[str, Any]:
    return {
        "commands": [
            {"label": label, "nativeCommand": native, "selector": selector}
            for label, native, selector in commands or []
        ],
        "dismissals": dismissals or [],
        "geometry": geometry(region, x, y, radius),
        "intro": intro,
        "name": name,
        "questions": questions or [],
        "serviceTitle": service_title,
    }


def build(source_root: Path) -> dict[str, Any]:
    paths = {name: source_root / name for name in EXPECTED_HASHES}
    for name, path in paths.items():
        actual = sha256(path)
        if actual != EXPECTED_HASHES[name]:
            raise ValueError(f"{path} SHA-256 {actual} is not retail {EXPECTED_HASHES[name]}")
    dialogue = sections(paths["survival.txt"])
    book_source = sections(paths["books.txt"])
    spell_source = sections(paths["spellfacts.txt"])
    speech = narration(paths["narration.txt"])

    interactions = {
        "hagatha": interaction("Hagatha", "WITCH_INTRO", "courtyard", 1340, 280, 15,
            questions=["WITCH_Q"], commands=[("Buy Charms and Curses", "!BUYPERKS", "hagatha")],
            service_title="HAGATHA'S CHARMS AND CURSES"),
        "fomentius": interaction("Fomentius", "POTIONGUY_INTRO", "courtyard", 1397, 664, 30,
            commands=[("Buy", "!BUYPOTIONS", "fomentius")], service_title="FOMENTIUS' USEFUL THYNGS"),
        "annalist": interaction("Provokatus", "ANNAL_INTRO", "courtyard", 895.5, 455.5, 8,
            commands=[("Boast", "!BOAST", "boast")], service_title="Select a Boast"),
        "luthacus": interaction("Luthacus", "SCAVENGER_INTRO", "courtyard", 1700.5, 449.5, 25,
            commands=[("Examine Items", "!INVENTORY", "luthacus")], service_title="LUTHACUS' SCAVENGED GOODS"),
        "skorcha": interaction("Skorcha", "ENFORCER_INTRO", "courtyard", 669, 705.5, 10,
            dismissals=["ENFORCER_DISMISS1", "ENFORCER_DISMISS2", "ENFORCER_DISMISS3"]),
        "teacher": interaction("Professor Machinimbus", "TEACHER_INTRO", "courtyard", 576.5, 710.5, 25,
            questions=["TEACHER_Q"], commands=[("Per$uade", "!SPELLS", "teacher-spells")],
            service_title="Select a Spell"),
        "memorator": interaction("Declarius", "MEMORATOR_INTRO", "mortuary", 628, 770, 25,
            questions=["MEMORATOR_Q1", "MEMORATOR_Q2"], dismissals=["MEMORATOR_DISMISS"]),
        "librarian": interaction("Professor Semicus", "LIBRARIAN_INTRO", "library", 512, 595, 55,
            commands=[("Inquire about Books", "!BOOKS", "books")], service_title="Select a Book"),
        "shlorio": interaction("Shlorio", "DOWSER_INTRO", "library", 900, 642.5, 25,
            questions=["DOWSER_Q"], commands=[("Dowse", "!DOWSE", "shlorio")],
            service_title="SHLORIO'S DISCOUNT DOWSING"),
        "arch-chancellor": interaction("The Archchancellor", "ARCH_INTRO", "office", 514, 467, 55,
            questions=["ARCH_Q"], dismissals=["ARCH_DISMISS"]),
    }
    paintings = [
        ("painting-0", 0, 512, 697), ("painting-1", 1, 350, 683),
        ("painting-100", 100, 673, 683), ("painting-3", 3, 744, 540),
        ("painting-4", 4, 590, 540), ("painting-5", 5, 434, 540),
        ("painting-6", 6, 279, 540), ("painting-7", 7, 354, 400),
        ("painting-8", 8, 512, 400), ("painting-9", 9, 670, 400),
    ]
    for interaction_id, eulogy_index, x, y in paintings:
        painting_geometry = geometry("mortuary", x, y, 15)
        painting_geometry["rangeRadius"] = 40
        interactions[interaction_id] = {
            "commands": [], "dismissals": [], "eulogyIndex": eulogy_index,
            "geometry": painting_geometry, "intro": None,
            "name": "Declarius", "questions": [], "serviceTitle": None,
        }

    boasts = [
        (0, "POTIONS ARE FOR PEASANTS!", '"I can do this entire mission without drinking a single potion of any kind!"', "ANNAL_POTIONBOAST", "potion-use"),
        (1, "I'M TOO MACHO FOR MAGIC!", '"A true magician does not wear magical clothing, rings, or other implements!"', "ANNAL_ITEMBOAST", "magical-equipment"),
        (2, "SECONDARIES ARE SISSY!", '"The learned wizard need not cast secondary spells at all!"', "ANNAL_SECONDARIESBOAST", "secondary-cast"),
        (3, "I AM ONE WITH THE MAGIC!", '"A master sorceror does not choose magic, the magic chooses him!"', "ANNAL_RANDOMBOAST", None),
        (4, "I NEVER RUN OUT OF MANA!", '"A profound practicioner of magic never allows his mana pool to empty!"', "ANNAL_MANABOAST", "mana-underflow"),
    ]
    boast_rows = [
        {"failureProducer": failure, "id": row_id, "label": label,
         "response": response, "statement": statement}
        for row_id, label, statement, response, failure in boasts
    ]

    spell_rows = [
        (72, "ACID_RAIN", "ACID RAIN", 3000, "A modified version of Magic Storm that produces a shower of hot acid."),
        (73, "FIRE_WALL", "FIRE WALL", 3500, "Calls up a flaming wall that burns enemies as they pass through it."),
        (74, "ETHER_DRAIN", "ETHER DRAIN", 4200, "Opens a hole into a quadrant of the ether that sucks."),
        (75, "IRON_GOLEM", "IRON GOLEM", 5000, "Upgrades your golem with iron spikes that reflect physical damage."),
        (79, "REGENERATE", "REGENERATE", 5100, "Magically supplements your visceral recovery node for quicker healing."),
        (78, "MINDSTAR", "MINDSTAR", 5300, "Supplements your cognitive nexus with magical force."),
        (77, "TURN_UNDEAD", "TURN UNDEAD", 6100, "Weakens nearby undead and causes them to flee the caster."),
        (76, "CALL_COMET", "CALL COMET", 10000, "Calls a frozen ball of ice down from the firmanent."),
    ]
    teacher_spells = [{
        "explanationLabel": spell_source[key]["label"],
        "explanationLines": spell_source[key]["lines"], "key": key, "name": name,
        "price": price, "quickDescription": description, "skillId": skill_id,
    } for skill_id, key, name, price, description in spell_rows]
    books = []
    for book_id in range(26):
        key = f"BOOK{book_id}" if book_id != 25 else "BOOK25_LACE"
        books.append({"id": book_id, "key": key, "lines": book_source[key]["lines"],
                      "oneShot": book_id == 25, "title": book_source[key]["label"]})

    required = {row["intro"] for row in interactions.values() if row["intro"]}
    for row in interactions.values():
        required.update(row["questions"])
        required.update(row["dismissals"])
    required.update(row["response"] for row in boast_rows)
    missing = sorted(required.difference(dialogue))
    if missing:
        raise ValueError(f"survival aggregate is missing {missing}")
    return {
        "badEulogies": [speech[f"SAY_BADEULOGY_{index}"] for index in range(8)],
        "boastInstruction": "To succeed at your boast, you must\nsurvive until at least Wave 30",
        "boastScoreMultiplier": 1.100000023841858,
        "boasts": boast_rows, "books": books,
        "dialogue": {key: dialogue[key] for key in sorted(required)},
        "eulogies": {str(index): speech.get(f"SAY_EULOGY_{index}") for index in [0, 1, 100, 3, 4, 5, 6, 7, 8, 9]},
        "interactionOrder": ["hagatha", "fomentius", "annalist", "luthacus", "skorcha", "teacher",
            "memorator", "painting-0", "painting-1", "painting-100", "painting-3", "painting-4",
            "painting-5", "painting-6", "painting-7", "painting-8", "painting-9", "librarian",
            "shlorio", "arch-chancellor"],
        "interactions": interactions,
        "interruptEulogies": [speech[f"SAY_EULOGY_INTERRUPT{index}"] for index in range(1, 5)],
        "schema": "solomon-dark-native-hub-npc-interactions-v1",
        "skorcha": {"animationDelay": {"drawCount": 10, "offsetTicks": 20},
            "animationStateCount": 3, "artRecords": list(range(510, 517)),
            "placements": [{"variant": 0, "x": 732.5, "y": 1437.5},
                {"variant": 1, "x": 403.5, "y": 1637}, {"variant": 2, "x": 669, "y": 705.5}],
            "presenceDrawCount": 3, "presenceDrawValue": 1},
        "source": {"dialogueHashes": EXPECTED_HASHES, "executableSha256": EXECUTABLE_SHA256,
            "preferredImageBase": "0x00400000", "retailVersion": "0.72.5"},
        "teacherSpells": teacher_spells,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_root", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(build(args.source_root), ensure_ascii=False, indent=2) + "\n",
                           encoding="utf-8", newline="\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
