/**
 * Platform admin: who gets in, and what they see.
 *
 * The lock matters more than the dashboard - these routes read every
 * workspace, so a non-admin must be refused on every one of them.
 * ADMIN_EMAILS is pinned to admin@example.com in setup-env.
 */
import "../setup-env.js";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { signIn, signUp, startTestApp } from "../helpers.js";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../src/scripts/seed.js";

let app;
let admin;
let demo;

before(async () => {
  app = await startTestApp();
  admin = await signUp(app.baseUrl, { email: "admin@example.com", name: "Admin" });
  demo = await signIn(app.baseUrl, { email: DEMO_EMAIL, password: DEMO_PASSWORD });
});

after(() => app.stop());

describe("access", () => {
  test("says who is an admin", async () => {
    assert.deepEqual((await admin.get("/api/admin/access")).body, { admin: true });
    assert.deepEqual((await demo.get("/api/admin/access")).body, { admin: false });
  });

  test("refuses non-admins on every admin route", async () => {
    for (const path of ["/api/admin/overview", "/api/admin/users", `/api/admin/users/${admin.user.id}`]) {
      const { status } = await demo.get(path);
      assert.equal(status, 403, path);
    }
  });

  test("refuses anyone signed out", async () => {
    const res = await fetch(`${app.baseUrl}/api/admin/users`);
    assert.equal(res.status, 401);
  });
});

describe("overview", () => {
  test("counts users, avatars and calls, with a day-by-day series", async () => {
    const { status, body } = await admin.get("/api/admin/overview?tz=Asia/Kolkata");

    assert.equal(status, 200);
    assert.ok(body.users.total >= 2);
    assert.ok(body.avatars.total >= 1, "the seed creates an avatar");
    assert.equal(body.daily.length, 14);
    assert.equal(body.timezone, "Asia/Kolkata");
    assert.ok(Array.isArray(body.liveCalls));
  });

  test("falls back to UTC for a timezone it does not know", async () => {
    const { body } = await admin.get("/api/admin/overview?tz=Mars/Olympus");
    assert.equal(body.timezone, "UTC");
  });
});

describe("users", () => {
  test("lists every workspace's users with their figures", async () => {
    const { body } = await admin.get("/api/admin/users");
    const seeded = body.users.find((u) => u.email === DEMO_EMAIL);

    assert.ok(seeded, "the demo user from another workspace is listed");
    assert.ok(seeded.avatars >= 1);
    assert.equal(typeof seeded.calls, "number");
    assert.equal(seeded.passwordHash, undefined);
  });

  test("searches by email, treating the query as text not a pattern", async () => {
    const { body } = await admin.get(`/api/admin/users?q=${encodeURIComponent("admin@example")}`);
    assert.deepEqual(
      body.users.map((u) => u.email),
      ["admin@example.com"],
    );

    const { status, body: odd } = await admin.get(`/api/admin/users?q=${encodeURIComponent(".*")}`);
    assert.equal(status, 200);
    assert.equal(odd.users.length, 0, "'.*' is a literal search, not match-everything");
  });

  test("shows one user's avatars and calls", async () => {
    const { body: list } = await admin.get(`/api/admin/users?q=${encodeURIComponent(DEMO_EMAIL)}`);
    const { status, body } = await admin.get(`/api/admin/users/${list.users[0].id}`);

    assert.equal(status, 200);
    assert.equal(body.user.email, DEMO_EMAIL);
    assert.equal(body.user.passwordHash, undefined);
    assert.ok(body.avatars.length >= 1);
    assert.ok(Array.isArray(body.conversations));
  });

  test("404s a user that does not exist", async () => {
    const { status } = await admin.get("/api/admin/users/000000000000000000000000");
    assert.equal(status, 404);
  });
});
