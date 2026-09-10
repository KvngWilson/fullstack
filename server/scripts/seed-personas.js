#!/usr/bin/env node

require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const argon2 = require("argon2");

const { pool } = require("../config/db");
const { connectRedis, redisClient } = require("../config/redis");
const PermissionCacheService = require("../shared/core/PermissionService");
const PERMISSIONS = require("../shared/constants/permissions");
const {
  PERSONAS,
  getInternalRoleDefinitions,
} = require("./personaDefinitions");

const OUTPUT_DIR = path.resolve(__dirname, "..", ".persona-sessions");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "personas.json");

function formatPermissionName(code) {
  return String(code)
    .split(":")
    .flatMap((segment) => segment.split(/[-_]/g))
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function flattenPermissionTree(node, trail = [], definitions = new Map()) {
  if (!node || typeof node !== "object") {
    return definitions;
  }

  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") {
      const category = trail[0]?.toLowerCase() || key.toLowerCase();
      definitions.set(value, {
        code: value,
        name: formatPermissionName(value),
        category,
        description: `Seeded system permission for ${value}.`,
      });
      continue;
    }

    flattenPermissionTree(value, [...trail, key], definitions);
  }

  return definitions;
}

function getAllPermissionDefinitions() {
  return Array.from(flattenPermissionTree(PERMISSIONS).values()).sort((a, b) =>
    a.code.localeCompare(b.code),
  );
}

async function getDefaultTenantId(client) {
  const result = await client.query(
    "SELECT id FROM tenants WHERE slug = 'default' LIMIT 1",
  );

  if (result.rowCount === 0) {
    throw new Error(
      "Default tenant is missing. Run migrations before seeding personas.",
    );
  }

  return result.rows[0].id;
}

async function upsertPermission(client, definition) {
  const existing = await client.query(
    "SELECT id, code FROM permissions WHERE code = $1 LIMIT 1",
    [definition.code],
  );

  if (existing.rowCount > 0) {
    const updated = await client.query(
      `UPDATE permissions
       SET name = $2,
           category = $3,
           description = $4,
           is_active = true
       WHERE code = $1
       RETURNING id, code`,
      [
        definition.code,
        definition.name,
        definition.category,
        definition.description,
      ],
    );
    return updated.rows[0];
  }

  const inserted = await client.query(
    `INSERT INTO permissions (code, name, category, description, is_active, created_at)
     VALUES ($1, $2, $3, $4, true, now())
     RETURNING id, code`,
    [
      definition.code,
      definition.name,
      definition.category,
      definition.description,
    ],
  );

  return inserted.rows[0];
}

async function upsertRole(client, roleDefinition) {
  const existing = await client.query(
    "SELECT id, code, name FROM roles WHERE code = $1 LIMIT 1",
    [roleDefinition.code],
  );

  if (existing.rowCount > 0) {
    const updated = await client.query(
      `UPDATE roles
       SET name = $2,
           description = $3,
           hierarchy_level = $4,
           is_system = true,
           is_active = true,
           updated_at = now()
       WHERE code = $1
       RETURNING id, code, name`,
      [
        roleDefinition.code,
        roleDefinition.name,
        roleDefinition.description,
        roleDefinition.hierarchyLevel,
      ],
    );
    return updated.rows[0];
  }

  const inserted = await client.query(
    `INSERT INTO roles (
       vendor_id,
       code,
       name,
       description,
       hierarchy_level,
       is_system,
       is_active,
       created_at,
       updated_at
     )
     VALUES (NULL, $1, $2, $3, $4, true, true, now(), now())
     RETURNING id, code, name`,
    [
      roleDefinition.code,
      roleDefinition.name,
      roleDefinition.description,
      roleDefinition.hierarchyLevel,
    ],
  );

  return inserted.rows[0];
}

async function syncRolePermissions(client, roleId, permissionIds) {
  await client.query("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);

  for (const permissionId of permissionIds) {
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id, granted_at)
       VALUES ($1, $2, now())
       ON CONFLICT (role_id, permission_id) DO NOTHING`,
      [roleId, permissionId],
    );
  }
}

async function upsertUser(client, persona) {
  const passwordHash = await argon2.hash(persona.demoCredential);
  const result = await client.query(
    `INSERT INTO users (
       username,
       email,
       password_hash,
       first_name,
       last_name,
       role,
       email_verified,
       is_verified,
       is_active,
       deleted_at,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, true, true, true, NULL, now(), now())
     ON CONFLICT (email)
     DO UPDATE SET
       username = EXCLUDED.username,
       password_hash = EXCLUDED.password_hash,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       role = EXCLUDED.role,
       email_verified = true,
       is_verified = true,
       is_active = true,
       deleted_at = NULL,
       updated_at = now()
     RETURNING id, email, role, first_name, last_name`,
    [
      persona.username,
      persona.email,
      passwordHash,
      persona.firstName,
      persona.lastName,
      persona.authRole,
    ],
  );

  return result.rows[0];
}

async function ensureTenantMembership(client, tenantId, userId, tenantRole) {
  await client.query(
    `INSERT INTO tenant_users (
       tenant_id,
       user_id,
       role,
       is_active,
       joined_at,
       created_at
     )
     VALUES ($1, $2, $3, true, now(), now())
     ON CONFLICT (tenant_id, user_id)
     DO UPDATE SET
       role = EXCLUDED.role,
       is_active = true,
       joined_at = COALESCE(tenant_users.joined_at, EXCLUDED.joined_at)`,
    [tenantId, userId, tenantRole],
  );
}

async function ensureVendor(client, tenantId, userId, vendorDefinition) {
  const existing = await client.query(
    `SELECT id
     FROM vendors
     WHERE user_id = $1 OR slug = $2
     ORDER BY CASE WHEN user_id = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [userId, vendorDefinition.slug],
  );

  if (existing.rowCount > 0) {
    const updated = await client.query(
      `UPDATE vendors
       SET user_id = $1,
           tenant_id = $2,
           store_name = $3,
           slug = $4,
           description = $5,
           status = $6,
           deleted_at = NULL,
           updated_at = now()
       WHERE id = $7
       RETURNING id, slug, store_name`,
      [
        userId,
        tenantId,
        vendorDefinition.storeName,
        vendorDefinition.slug,
        vendorDefinition.description || null,
        vendorDefinition.status || "active",
        existing.rows[0].id,
      ],
    );

    return updated.rows[0];
  }

  const inserted = await client.query(
    `INSERT INTO vendors (
       user_id,
       tenant_id,
       store_name,
       slug,
       description,
       status,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, now(), now())
     RETURNING id, slug, store_name`,
    [
      userId,
      tenantId,
      vendorDefinition.storeName,
      vendorDefinition.slug,
      vendorDefinition.description || null,
      vendorDefinition.status || "active",
    ],
  );

  return inserted.rows[0];
}

async function upsertEmployee(client, userId, roleId, department) {
  const result = await client.query(
    `INSERT INTO employees (
       user_id,
       role_id,
       department,
       employment_status,
       password_last_updated_at,
       failed_login_attempts,
       account_locked_until,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, 'active', now(), 0, NULL, now(), now())
     ON CONFLICT (user_id)
     DO UPDATE SET
       role_id = EXCLUDED.role_id,
       department = EXCLUDED.department,
       employment_status = 'active',
       password_last_updated_at = now(),
       failed_login_attempts = 0,
       account_locked_until = NULL,
       updated_at = now()
     RETURNING id, user_id, role_id`,
    [userId, roleId, department || null],
  );

  return result.rows[0];
}

async function updateEmployeeManager(client, employeeId, managerId) {
  await client.query(
    "UPDATE employees SET manager_id = $2, updated_at = now() WHERE id = $1",
    [employeeId, managerId],
  );
}

async function writePersonaManifest(personas) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        personas,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function printSummary(personas) {
  console.log("Seeded deterministic personas:\n");
  for (const persona of personas) {
    console.log(
      [
        `- ${persona.key}`,
        `email=${persona.email}`,
        `password=${persona.password}`,
        `workspace=${persona.expectedPath}`,
        `authRole=${persona.authRole}`,
        persona.employeeRoleCode
          ? `employeeRole=${persona.employeeRoleCode}`
          : null,
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }

  console.log(`\nWrote manifest to ${OUTPUT_FILE}`);
}

async function main() {
  let client;

  try {
    await connectRedis();

    client = await pool.connect();
    await client.query("BEGIN");

    const tenantId = await getDefaultTenantId(client);
    const permissionIdByCode = new Map();

    for (const permissionDefinition of getAllPermissionDefinitions()) {
      const permission = await upsertPermission(client, permissionDefinition);
      permissionIdByCode.set(permission.code, permission.id);
    }

    const roleIdByCode = new Map();
    for (const roleDefinition of getInternalRoleDefinitions()) {
      const role = await upsertRole(client, roleDefinition);
      roleIdByCode.set(role.code, role.id);
    }

    for (const roleDefinition of getInternalRoleDefinitions()) {
      const roleId = roleIdByCode.get(roleDefinition.code);
      const permissionIds = roleDefinition.permissionCodes.map((code) => {
        const permissionId = permissionIdByCode.get(code);
        if (!permissionId) {
          throw new Error(`Missing permission definition for ${code}`);
        }
        return permissionId;
      });
      await syncRolePermissions(client, roleId, permissionIds);
    }

    const seededPersonas = [];
    const employeeIdByPersonaKey = new Map();
    const pendingManagerAssignments = [];

    for (const persona of PERSONAS) {
      const user = await upsertUser(client, persona);
      await ensureTenantMembership(client, tenantId, user.id, persona.tenantRole);

      let vendor = null;
      if (persona.vendor) {
        vendor = await ensureVendor(client, tenantId, user.id, persona.vendor);
      }

      let employee = null;
      if (persona.employee) {
        const roleId = roleIdByCode.get(persona.employee.roleCode);
        if (!roleId) {
          throw new Error(
            `Missing role definition for ${persona.employee.roleCode}`,
          );
        }

        employee = await upsertEmployee(
          client,
          user.id,
          roleId,
          persona.employee.department,
        );
        employeeIdByPersonaKey.set(persona.key, employee.id);

        if (persona.employee.managerPersonaKey) {
          pendingManagerAssignments.push({
            employeeId: employee.id,
            managerPersonaKey: persona.employee.managerPersonaKey,
          });
        }
      }

      seededPersonas.push({
        key: persona.key,
        label: persona.label,
        audience: persona.audience,
        email: persona.email,
        password: persona.demoCredential,
        authRole: persona.authRole,
        employeeRoleCode: persona.employee?.roleCode || null,
        expectedPath: persona.expectedPath,
        apiLoginPath: "/api/v1/auth/login",
        browserLoginPath: "/login",
        userId: user.id,
        employeeId: employee?.id || null,
        vendorId: vendor?.id || null,
      });
    }

    for (const assignment of pendingManagerAssignments) {
      const managerId = employeeIdByPersonaKey.get(assignment.managerPersonaKey);
      if (!managerId) {
        throw new Error(
          `Manager persona ${assignment.managerPersonaKey} was not seeded.`,
        );
      }
      await updateEmployeeManager(client, assignment.employeeId, managerId);
    }

    await client.query("COMMIT");

    await PermissionCacheService.invalidateAllPermissions();
    await writePersonaManifest(seededPersonas);
    printSummary(seededPersonas);
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Failed to roll back persona seed transaction:",
          rollbackError,
        );
      }
    }
    console.error("Persona seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  }
}

main();
