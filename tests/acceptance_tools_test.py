import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1] / "scripts/acceptance"
def module(name):
    spec = importlib.util.spec_from_file_location(name, HERE / (name + ".py"))
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result); return result
backup, restore = module("backup"), module("restore")

class AcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.fixture_root = Path(__file__).resolve().parents[1] / ".audit-runtime/acceptance-fixtures"
        self.fixture_root.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=self.fixture_root)
        self.root = Path(self.temp.name) / "backup"; self.root.mkdir()
    def tearDown(self):
        self.assertTrue(Path(self.temp.name).resolve().is_relative_to(self.fixture_root.resolve()))
        self.temp.cleanup()
    def archive(self, name, member, link=False):
        target = self.root / name
        with tarfile.open(target, "w") as tar:
            entry = tarfile.TarInfo(member)
            if link: entry.type = tarfile.SYMTYPE; entry.linkname = "/etc/passwd"; tar.addfile(entry)
            else:
                data = b"fixture-only"; entry.size = len(data); tar.addfile(entry, io.BytesIO(data))
        return target
    def manifest(self, files):
        (self.root / "SHA256SUMS").write_text("\n".join(hashlib.sha256(file.read_bytes()).hexdigest() + "  " + file.name for file in files))
        return backup.verify(self.root, "SHA256SUMS")
    def fixture(self):
        files = [self.archive("data.tar", "data/uploads/test"), self.archive("branding.tar", "uploads/logo.png")]
        for name, value in {"dump.sql": "CREATE TABLE fixture(id INT);", "key": "fixture-key-not-real", "inspect.json": json.dumps([{"Config": {"Env": ["DATABASE_URL=mysql://production.invalid/never", "APP_TIME_ZONE=America/Toronto", "AZURE_CLIENT_SECRET=fixture-secret", "NODE_OPTIONS=unsafe", "SESSION_SECRET=fixture-session"]}}])}.items():
            file = self.root / name; file.write_text(value); files.append(file)
        mapping = {"database_dump": "dump.sql", "application_data_tar": "data.tar", "branding_tar": "branding.tar", "settings_key": "key", "application_inspect": "inspect.json", "entra_reference_env": "AZURE_CLIENT_SECRET", "application_data_prefix": "data", "branding_prefix": "uploads"}
        return self.manifest(files), mapping
    def test_checksum_tampering_and_traversal_refused(self):
        file = self.root / "fixture"; file.write_text("original"); self.manifest([file]); file.write_text("changed")
        with self.assertRaises(backup.Refused): backup.verify(self.root, "SHA256SUMS")
        (self.root / "SHA256SUMS").write_text("a" * 64 + "  ../outside")
        with self.assertRaises(backup.Refused): backup.verify(self.root, "SHA256SUMS")
    def test_regular_archive_only(self):
        for member, link in [("../escape", False), ("uploads/link", True), ("/absolute", False), ("other/file", False)]:
            with self.assertRaises(backup.Refused): backup.extract(self.archive("bad.tar", member, link), Path(self.temp.name) / "out", "uploads")
    def test_preparation_retargets_only_disposable_urls_preserves_originals(self):
        records, mapping = self.fixture(); before = {key: file.read_bytes() for key, file in records.items()}
        run = Path(self.temp.name) / "new-run"; output = io.StringIO()
        with contextlib.redirect_stdout(output): backup.prepare(self.root, records, mapping, run)
        self.assertEqual(output.getvalue(), "")
        self.assertEqual(before, {key: file.read_bytes() for key, file in records.items()})
        env = json.loads((run / "private/app/runtime.json").read_text())["environment"]
        self.assertNotIn("DATABASE_URL", env); self.assertNotIn("NODE_OPTIONS", env)
        self.assertEqual((run / "private/app/entra_secret").read_text(), "fixture-secret")
        self.assertIn("@inventory:3306/it_assets", (run / "private/app/inventory_url").read_text())
        self.assertIn("@rollback-db:3306/it_assets", (run / "private/app/rollback-db_url").read_text())
        self.assertEqual((run / "legacy-data/uploads/test").read_bytes(), (run / "rollback-data/uploads/test").read_bytes())
        with self.assertRaises(backup.Refused): backup.prepare(self.root, records, mapping, run)
    def test_unverified_input_and_backup_destination_refused(self):
        records, mapping = self.fixture()
        with self.assertRaises(backup.Refused): backup.prepare(self.root, records, mapping, self.root / "new")
        mapping["settings_key"] = "unverified"
        with self.assertRaises(backup.Refused): backup.prepare(self.root, records, mapping, Path(self.temp.name) / "new")
    def test_restore_refuses_wrong_target_without_docker(self):
        with patch.object(restore, "quiet") as quiet:
            with self.assertRaises(ValueError): restore.restore(self.root, "production", "anything")
            with self.assertRaises(ValueError): restore.restore(self.root, "inventory", "wrong confirmation")
            quiet.assert_not_called()
    def test_restore_refuses_wrong_project_running_app_and_nonempty_database(self):
        run = Path(self.temp.name) / "run"; run.mkdir()
        (run / "prepared.json").write_text(json.dumps({"project": restore.PROJECT, "dump": "database.sql"}))
        label = json.dumps({"com.docker.compose.project": restore.PROJECT, "com.docker.compose.service": "inventory"}).encode()
        for replies in [[b"fixture-id", b'{}'], [b"fixture-id", label, b"app\ninventory"], [b"fixture-id", label, b"inventory", b"23"]]:
            with patch.object(restore, "quiet", side_effect=replies), patch.object(restore.subprocess, "Popen") as popen:
                with self.assertRaises(ValueError): restore.restore(run, "inventory", restore.PROJECT + ":inventory:it_assets")
                popen.assert_not_called()

if __name__ == "__main__": unittest.main()
