#!/usr/bin/env python3
"""Explicit operator restore into one empty, project-labeled disposable MariaDB only."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

PROJECT = "it-assets-v060-upgrade-acceptance"
COMPOSE = Path(__file__).resolve().parents[2] / "docker/compose.acceptance.yml"

def command(run, *args):
    return ["docker", "compose", "--env-file", str(run / "compose.env"), "-p", PROJECT, "-f", str(COMPOSE), *args]

def quiet(args, input=None):
    result = subprocess.run(args, input=input, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if result.returncode: raise ValueError("Command failed")
    return result.stdout

def restore(run, service, confirmation, expected_tables=23):
    if service not in {"inventory", "rollback-db"} or confirmation != PROJECT + ":" + service + ":it_assets":
        raise ValueError("Explicit disposable target confirmation required")
    info = json.loads((run / "prepared.json").read_text())
    if info.get("project") != PROJECT or info.get("dump") not in {"database.sql", "database.sql.gz"}: raise ValueError()
    # Reject unrelated daemon/project targets even when a caller changes environment/context.
    ids = quiet(command(run, "ps", "-q", service)).decode().split()
    if len(ids) != 1: raise ValueError()
    labels = json.loads(quiet(["docker", "inspect", "--format", "{{json .Config.Labels}}", ids[0]]))
    if labels.get("com.docker.compose.project") != PROJECT or labels.get("com.docker.compose.service") != service: raise ValueError()
    # Require all acceptance applications and maintenance processes stopped.
    running = quiet(["docker", "ps", "--filter", "label=com.docker.compose.project=" + PROJECT, "--format", '{{.Label "com.docker.compose.service"}}']).decode().split()
    if any(name not in {"inventory", "rollback-db"} for name in running): raise ValueError()
    client = command(run, "exec", "-T", service, "mariadb", "--defaults-extra-file=/run/secrets/db_client", "--batch", "--skip-column-names", "it_assets")
    count = quiet([*client, "-e", "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='it_assets'"]).strip()
    if count != b"0": raise ValueError("Refuse nonempty database")
    dump = run / info["dump"]
    if dump.is_symlink(): raise ValueError()
    checksum = hashlib.sha256()
    with dump.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""): checksum.update(chunk)
    if checksum.hexdigest() != info["dumpSha256"]: raise ValueError()
    # Stream, never print SQL or credentials. A failed partial restore is NOT reset automatically.
    with (gzip.open(dump, "rb") if dump.suffix == ".gz" else dump.open("rb")) as source:
        with subprocess.Popen(client, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) as child:
            try:
                for chunk in iter(lambda: source.read(1024 * 1024), b""): child.stdin.write(chunk)
                child.stdin.close()
            except Exception:
                child.kill(); child.wait(); raise
            if child.wait() != 0: raise ValueError("Restore failed")
    count = quiet([*client, "-e", "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='it_assets'"]).strip()
    if not count.isdigit() or int(count) != expected_tables: raise ValueError()
    print("PASS: disposable restore completed; table count=" + count.decode() + ". Compare with the protected backup baseline.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True, type=Path)
    parser.add_argument("--service", required=True, choices=["inventory", "rollback-db"])
    parser.add_argument("--confirm", required=True)
    parser.add_argument("--expected-tables", type=int, default=23)
    args = parser.parse_args()
    os.umask(0o077)
    try: restore(args.run.resolve(), args.service, args.confirm, args.expected_tables)
    except Exception:
        print("FAIL: restore refused or interrupted. No existing target was reset; inspect private evidence and use a newly approved disposable environment.")
        sys.exit(1)
