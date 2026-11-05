import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  control,
  profileSchema,
} from "../../src/modules/database-management/control-store";
import {
  checkProfile,
  initializeProfile,
  testConnection,
} from "../../src/modules/database-management/schema-service";
import { createProfileClient } from "../../src/modules/database-management/profile-client";
import { hashPassword } from "../../src/services/password";
import { db } from "../../src/services/database";
import {
  checkInAsset,
  checkOutAsset,
} from "../../src/modules/assets/asset.service";
import {
  createBorrowedItem,
  markBorrowedItemReturned,
} from "../../src/modules/borrowed-items/borrowed-items.service";

// No host or DB name from environment; both targets must be dedicated blank fixtures.
test("initialize, verify, operate and switch independent disposable inventories", async () => {
  const mixed = process.env.IT_ASSETS_TEST_SQL === "1";
  const run = process.env.IT_ASSETS_TEST_RUN || "";
  assert.match(run, /^[a-z0-9]{0,12}$/);
  const password = process.env.IT_ASSETS_TEST_PASSWORD;
  if (!password)
    throw new Error(
      "Set the explicit fixture password; see database-management.md.",
    );
  process.env.IT_ASSETS_MANAGED = "1";
  process.env.IT_ASSETS_CONTROL_DIR = mkdtempSync(
    path.join(tmpdir(), "it-assets-db-test-"),
  );
  const store = control();
  const profiles = ["a", "b"].map((suffix, i) =>
    profileSchema.parse({
      name: suffix,
      provider: i && mixed ? "sqlserver" : "mariadb",
      host: "127.0.0.1",
      port:
        i && mixed
          ? Number(process.env.IT_ASSETS_TEST_SQL_PORT || 1433)
          : Number(process.env.IT_ASSETS_TEST_MARIA_PORT || 43327),
      database: "it_assets_managed_" + run + suffix + "_test",
      username: "it_assets_test",
      password,
      trustCertificate: Boolean(i && mixed),
    }),
  );
  const ids: string[] = [];
  try {
    for (const p of profiles) {
      await testConnection(p);
      assert.equal(await checkProfile(p), "empty");
      const probe = createProfileClient(p);
      try {
        await probe.$executeRawUnsafe(
          "CREATE TABLE UnrelatedFixture (id INTEGER NOT NULL)",
        );
        await probe.$executeRawUnsafe(
          "INSERT INTO UnrelatedFixture (id) VALUES (42)",
        );
        assert.equal(await checkProfile(p), "incompatible");
        await assert.rejects(
          initializeProfile(p, "workspace@example.invalid", "disabled"),
          /empty/,
        );
        assert.deepEqual(
          await probe.$queryRawUnsafe("SELECT id FROM UnrelatedFixture"),
          [{ id: 42 }],
        );
        await probe.$executeRawUnsafe("DROP TABLE UnrelatedFixture");
        await probe.$executeRawUnsafe(
          "CREATE TABLE Asset (id INTEGER NOT NULL)",
        );
        assert.equal(await checkProfile(p), "partial");
        await probe.$executeRawUnsafe("DROP TABLE Asset");
      } finally {
        await probe.$disconnect();
      }
      await initializeProfile(
        p,
        "workspace@example.invalid",
        hashPassword("Disposable workspace password"),
      );
      assert.equal(await checkProfile(p), "compatible");
      await assert.rejects(
        initializeProfile(p, "workspace@example.invalid", "disabled"),
        /empty/,
      );
      ids.push(store.save(p));
    }
    for (let i = 0; i < 2; i++) {
      store.activate(ids[i], i);
      process.env.IT_ASSETS_REVISION = String(i);
      assert.throws(() => db.asset, /revision/);
      process.env.IT_ASSETS_REVISION = String(i + 1);
      const owner = await db.user.findFirstOrThrow();
      const status = await db.assetStatus.findUniqueOrThrow({
        where: { key: "IN_STOCK" },
      });
      const asset = await db.asset.create({
        data: {
          assetTag: "shared-tag",
          name: "Inventory " + i,
          statusId: status.id,
        },
      });
      await db.asset.update({
        where: { id: asset.id },
        data: { notes: "updated" },
      });
      await checkOutAsset({
        assetId: asset.id,
        assignedUserId: owner.id,
        actorUserId: owner.id,
      });
      await checkInAsset({ assetId: asset.id, actorUserId: owner.id });
      for (let n = 0; n < 2; n++) {
        const loan = await createBorrowedItem({
          itemType: "asset",
          assetId: asset.id,
          borrowerUserId: owner.id,
          actorUserId: owner.id,
          dueAt: "2030-01-01",
        });
        await markBorrowedItemReturned({
          borrowedItemId: loan.id,
          actorUserId: owner.id,
          returnedAt: new Date().toISOString(),
        });
      }
      for (let n = 0; n < 2; n++)
        await db.location.create({
          data: { slug: "loc" + n, name: "loc" + n },
        });
      await assert.rejects(
        db.$transaction(async (tx) => {
          await tx.asset.create({
            data: { assetTag: "rollback", name: "rollback" },
          });
          throw new Error("rollback");
        }),
      );
      assert.equal(
        await db.asset.count({ where: { assetTag: "rollback" } }),
        0,
      );
      const temp = await db.asset.create({
        data: { name: "Delete me", assetTag: "delete-me" },
      });
      await db.asset.delete({ where: { id: temp.id } });
      assert.ok((await db.auditLog.count()) > 0);
      await db.$disconnect();
    }
    store.activate(ids[0], 2);
    process.env.IT_ASSETS_REVISION = "3";
    assert.equal(
      (await db.asset.findUniqueOrThrow({ where: { assetTag: "shared-tag" } }))
        .name,
      "Inventory 0",
    );
    const other = createProfileClient(profiles[1]);
    try {
      assert.equal(
        (
          await other.asset.findUniqueOrThrow({
            where: { assetTag: "shared-tag" },
          })
        ).name,
        "Inventory 1",
      );
    } finally {
      await other.$disconnect();
    }
    await db.$disconnect();
  } finally {
    store.close();
  }
});
