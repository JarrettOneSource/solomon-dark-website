#!/usr/bin/env python3
"""Sample the existing Website/game services without changing their state."""

import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request


UNITS = ("solomon-dark-game.service", "solomon-dark-revived.service")


def service_sample(unit):
    result = subprocess.run(
        ["systemctl", "show", unit, "-p", "MainPID", "-p", "ActiveState",
         "-p", "NRestarts", "-p", "MemoryCurrent", "-p", "CPUUsageNSec",
         "-p", "ControlGroup"], check=True, capture_output=True, text=True,
    )
    values = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
    pid = int(values["MainPID"])
    sample = {
        "pid": pid, "state": values["ActiveState"],
        "restarts": int(values["NRestarts"]),
        "memoryMiB": int(values["MemoryCurrent"]) / 1048576,
        "cpuSeconds": int(values["CPUUsageNSec"]) / 1000000000,
    }
    if pid:
        try:
            status = dict(line.split(":", 1) for line in Path("/proc", str(pid), "status")
                          .read_text().splitlines() if ":" in line)
            sample["rssMiB"] = int(status["VmRSS"].split()[0]) / 1024
            sample["threads"] = int(status["Threads"])
        except FileNotFoundError:
            sample["processExited"] = True
    group = values.get("ControlGroup", "")
    events = Path("/sys/fs/cgroup" + group, "memory.events")
    if group and events.exists():
        sample["memoryEvents"] = dict((name, int(value)) for name, value in
                                      (line.split() for line in events.read_text().splitlines()))
    return sample


def cpu_sample():
    values = [int(value) for value in Path("/proc/stat").read_text().splitlines()[0].split()[1:9]]
    return {"total": sum(values), "idle": values[3] + values[4], "steal": values[7]}


def health_sample():
    try:
        with urllib.request.urlopen("http://127.0.0.1:5222/health", timeout=2) as response:
            return json.load(response)
    except (urllib.error.URLError, json.JSONDecodeError) as error:
        return {"error": str(error)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--interval", type=float, default=5)
    parser.add_argument("--duration", type=float, default=21600)
    args = parser.parse_args()
    if args.interval <= 0 or args.duration <= 0:
        parser.error("interval and duration must be positive seconds")
    started = time.monotonic()
    previous_at = None
    previous_services = {}
    previous_cpu = None
    while time.monotonic() - started < args.duration:
        now = time.monotonic()
        services = {unit: service_sample(unit) for unit in UNITS}
        cpu = cpu_sample()
        system_cpu = None
        steal = None
        if previous_at is not None:
            elapsed = now - previous_at
            for unit, current in services.items():
                previous = previous_services[unit]
                current["cpuPercent"] = None if current["pid"] != previous["pid"] else (
                    max(0, current["cpuSeconds"] - previous["cpuSeconds"]) / elapsed * 100
                )
            total = cpu["total"] - previous_cpu["total"]
            if total > 0:
                system_cpu = (1 - (cpu["idle"] - previous_cpu["idle"]) / total) * 100
                steal = (cpu["steal"] - previous_cpu["steal"]) / total * 100
        memory = dict(line.split(":", 1) for line in Path("/proc/meminfo").read_text().splitlines())
        print(json.dumps({
            "atUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "elapsedSeconds": now - started, "logicalCpus": os.cpu_count(),
            "systemCpuPercent": system_cpu, "stealPercent": steal,
            "loadAverage": os.getloadavg(),
            "availableMemoryMiB": int(memory["MemAvailable"].split()[0]) / 1024,
            "services": services, "health": health_sample(),
        }), flush=True)
        previous_at, previous_services, previous_cpu = now, services, cpu
        time.sleep(max(0, args.interval - (time.monotonic() - now)))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
