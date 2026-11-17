#!/usr/bin/env python3
"""Offline, operator-invoked backup verification/preparation. Never contacts Docker."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import shutil
import tarfile

class Refused(Exception):
    pass

def confined(root, value):
    if not isinstance(value, str) or not value or "\\" in value:
        raise Refused("Unsafe backup path.")
    parts = PurePosixPath(value)
    if parts.is_absolute() or ".." in parts.parts or not parts.parts:
        raise Refused("Unsafe backup path.")
    target = root
    for part in parts.parts:
        target = target / part
        if target.is_symlink():
            raise Refused("Backup symlinks are not accepted.")
    if not target.resolve().is_relative_to(root.resolve()) or not target.is_file():
        raise Refused("Backup member missing or outside backup root.")
    return target

def digest(file):
    result = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()

def verify(root, manifest):
    records = {}
    for line in confined(root, manifest).read_text(encoding="utf-8").splitlines():
        match = re.fullmatch(r"([a-fA-F0-9]{64}) [ *](.+)", line)
        if not match or match[2] in records:
            raise Refused("Invalid or duplicate SHA-256 manifest entry.")
        file = confined(root, match[2])
        if digest(file) != match[1].lower():
            raise Refused("Backup checksum mismatch. Nothing was restored.")
        records[match[2]] = file
    if not records:
        raise Refused("Empty checksum manifest.")
    return records

def extract(archive, destination, prefix):
    """Copy regular files only, strip an explicitly selected archive root, never links."""
    prefix_parts = PurePosixPath(prefix).parts if prefix else ()
    if PurePosixPath(prefix).is_absolute() or ".." in prefix_parts:
        raise Refused("Unsafe archive prefix.")
    total = 0
    names = set()
    with tarfile.open(archive, "r:*") as tar:
        for member in tar:
            name = PurePosixPath(member.name)
            if name.is_absolute() or ".." in name.parts or "\\" in member.name or not (member.isfile() or member.isdir()):
                raise Refused("Archive contains unsafe paths, links or special files.")
            # Directory ancestors of the selected root are harmless; unrelated entries are refused.
            if member.isdir() and prefix_parts[:len(name.parts)] == name.parts:
                continue
            if name.parts[:len(prefix_parts)] != prefix_parts:
                raise Refused("Archive root does not match the selected prefix.")
            relative = name.parts[len(prefix_parts):]
            if not relative:
                if member.isdir(): continue
                raise Refused("Invalid archive member.")
            target = destination.joinpath(*relative)
            if str(target) in names: raise Refused("Duplicate archive member.")
            names.add(str(target))
            total += member.size
            if len(names) > 100000 or total > 20 * 1024**3: raise Refused("Archive exceeds acceptance limits.")
            if member.isdir(): target.mkdir(parents=True, exist_ok=True, mode=0o700)
            else:
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with tar.extractfile(member) as source, target.open("xb") as output:
                    shutil.copyfileobj(source, output)
                target.chmod(0o600)

def prepare(root, records, mapping, destination):
    required = ["database_dump", "application_data_tar", "branding_tar", "settings_key", "application_inspect"]
    for key in required + (["entra_secret"] if mapping.get("entra_secret") else []):
        if mapping.get(key) not in records: raise Refused("Each selected input must be covered by the verified manifest.")
    if destination.exists() or destination.resolve().is_relative_to(root.resolve()):
        raise Refused("Choose a new destination outside the immutable backup directory.")
    inspect = json.loads(records[mapping["application_inspect"]].read_text(encoding="utf-8"))
    if isinstance(inspect, list):
        if len(inspect) != 1: raise Refused("Expected one backed-up application inspect record.")
        inspect = inspect[0]
    env = dict(item.split("=", 1) for item in inspect["Config"]["Env"] if "=" in item)
    reference = mapping.get("entra_reference_env")
    if reference and (not re.fullmatch(r"[A-Z][A-Z0-9_]*SECRET[A-Z0-9_]*", reference) or reference in {"SESSION_SECRET"}):
        raise Refused("Unsupported legacy Entra reference name; review it explicitly.")
    if reference and not env.get(reference): raise Refused("Legacy Entra reference missing from the verified application backup.")
    key = records[mapping["settings_key"]].read_text(encoding="utf-8").strip()
    if not key: raise Refused("Original settings key is empty; do not substitute a new key.")
    entra = records[mapping["entra_secret"]].read_text(encoding="utf-8").strip() if mapping.get("entra_secret") else env.get(reference, "")
    if reference and entra != env[reference]: raise Refused("Entra credential does not match its original reference.")
    destination.mkdir(parents=True, mode=0o700)
    app = destination / "private/app"; app.mkdir(parents=True, mode=0o700)
    db = destination / "private/db"; db.mkdir(mode=0o700)
    (destination / "evidence").mkdir(mode=0o700)
    def write(file, value):
        with file.open("x", encoding="utf-8") as stream: stream.write(value)
        file.chmod(0o600)
    password, root_password = secrets.token_hex(32), secrets.token_hex(32)
    write(db / "db_password", password); write(db / "db_root_password", root_password)
    write(db / "db_client", "[client]\nuser=root\npassword=" + root_password + "\n")
    for host in ["inventory", "rollback-db"]:
        write(app / (host + "_url"), f"mysql://acceptance:{password}@{host}:3306/it_assets")
    write(app / "settings_key", key)
    write(app / "digest_key", secrets.token_hex(32))
    if entra: write(app / "entra_secret", entra)
    selected = {name: env[name] for name in ["APP_TIME_ZONE", "TZ", "SESSION_SECRET"] if name in env}
    write(app / "runtime.json", json.dumps({"environment": selected, "entraReference": reference, "entraSecretPresent": bool(entra)}))
    dump = records[mapping["database_dump"]]
    suffix = ".sql.gz" if dump.name.endswith(".gz") else ".sql"
    shutil.copyfile(dump, destination / ("database" + suffix)); (destination / ("database" + suffix)).chmod(0o600)
    for key_name, folder, prefix_name in [("application_data_tar", "legacy-data", "application_data_prefix"), ("branding_tar", "branding", "branding_prefix")]:
        target = destination / folder; target.mkdir(mode=0o700)
        extract(records[mapping[key_name]], target, mapping.get(prefix_name, ""))
    shutil.copytree(destination / "legacy-data", destination / "rollback-data")
    shutil.copytree(destination / "branding", destination / "legacy-branding")
    shutil.copytree(destination / "branding", destination / "rollback-branding")
    write(destination / "prepared.json", json.dumps({"format": 1, "project": "it-assets-v060-upgrade-acceptance", "dump": "database" + suffix, "dumpSha256": digest(dump)}))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["verify", "prepare"])
    parser.add_argument("--backup", required=True, type=Path)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--inputs", type=Path)
    parser.add_argument("--destination", type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        records = verify(args.backup.resolve(), args.manifest)
        if args.operation == "prepare":
            if not args.inputs or not args.destination: raise Refused("Preparation requires inputs mapping and a new destination.")
            prepare(args.backup.resolve(), records, json.loads(args.inputs.read_text(encoding="utf-8")), args.destination)
        print("PASS: backup checks completed" + ("; private disposable inputs prepared." if args.operation == "prepare" else "."))
    except Exception:
        # File names, inspect data, OS errors and parser values can contain secrets.
        print("FAIL: backup verification/preparation refused. Check private mapping, manifest, archive roots and destination; no Docker operation occurred.")
        raise SystemExit(1)

if __name__ == "__main__": main()
