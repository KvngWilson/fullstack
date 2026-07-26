const crypto = require("crypto");
const { pool } = require("../../config/db");
const { logger } = require("../../shared/utils/logger");

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hashRequestBody(body) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(body ?? {}))
    .digest("hex");
}

/**
 * Idempotency middleware backed by the idempotency_keys table.
 *
 * Clients send an Idempotency-Key header on mutating requests. The first
 * request with a given (key, caller, endpoint) executes normally and its JSON
 * response is stored; retries with the same key replay the stored response
 * instead of re-executing (preventing duplicate payments/orders). Concurrent
 * duplicates race on the table's unique constraint, so exactly one executes
 * and the others receive 409 until it completes.
 *
 * Semantics:
 * - No header present: pass through (unless `required` is set).
 * - Same key, different request body: 422.
 * - Same key while original is still processing: 409.
 * - 5xx responses (and responses that never produce JSON) release the key so
 *   the client can retry.
 * - Unexpected storage failures fail open: the request proceeds without
 *   idempotency protection rather than blocking checkout.
 *
 * @param {Object} [options]
 * @param {boolean} [options.required=false] - Reject requests missing the header
 * @param {number} [options.ttlHours=24] - How long stored responses are replayable
 */
function idempotency({ required = false, ttlHours = 24 } = {}) {
  return async (req, res, next) => {
    if (!MUTATING_METHODS.has(req.method)) {
      return next();
    }

    const key = req.get("Idempotency-Key");
    if (!key) {
      if (required) {
        return res
          .status(400)
          .json({ error: "Idempotency-Key header is required" });
      }
      return next();
    }

    if (key.length > 255) {
      return res
        .status(400)
        .json({ error: "Idempotency-Key must be 255 characters or fewer" });
    }

    const scope = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
    const endpoint = `${req.method}:${req.baseUrl}${req.path}`;
    const requestHash = hashRequestBody(req.body);

    try {
      // Purge an expired record so its key can be reused
      await pool.query(
        `DELETE FROM idempotency_keys
         WHERE idempotency_key = $1 AND scope = $2 AND endpoint = $3
           AND expires_at <= now()`,
        [key, scope, endpoint],
      );

      const inserted = await pool.query(
        `INSERT INTO idempotency_keys (idempotency_key, scope, endpoint, request_hash, expires_at)
         VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5))
         ON CONFLICT (idempotency_key, scope, endpoint) DO NOTHING
         RETURNING id`,
        [key, scope, endpoint, requestHash, ttlHours],
      );

      if (inserted.rows.length === 0) {
        const existing = await pool.query(
          `SELECT request_hash, status, response_status, response_body
           FROM idempotency_keys
           WHERE idempotency_key = $1 AND scope = $2 AND endpoint = $3`,
          [key, scope, endpoint],
        );
        const record = existing.rows[0];

        if (!record) {
          // Deleted between our INSERT and SELECT (expiry race) — proceed unprotected
          return next();
        }

        if (record.request_hash !== requestHash) {
          return res.status(422).json({
            error:
              "Idempotency-Key was already used with a different request payload",
          });
        }

        if (record.status === "processing") {
          return res.status(409).json({
            error:
              "A request with this Idempotency-Key is already being processed",
          });
        }

        res.set("Idempotency-Replayed", "true");
        return res.status(record.response_status).json(record.response_body);
      }

      // First request with this key: capture the JSON response for replay
      let persisted = false;
      const originalJson = res.json.bind(res);

      res.json = (payload) => {
        persisted = true;
        const statusCode = res.statusCode;

        const persist =
          statusCode >= 500
            ? pool.query(
                `DELETE FROM idempotency_keys
                 WHERE idempotency_key = $1 AND scope = $2 AND endpoint = $3`,
                [key, scope, endpoint],
              )
            : pool.query(
                `UPDATE idempotency_keys
                 SET status = 'completed', response_status = $4, response_body = $5
                 WHERE idempotency_key = $1 AND scope = $2 AND endpoint = $3`,
                [key, scope, endpoint, statusCode, JSON.stringify(payload)],
              );

        persist.catch((error) => {
          logger.error("Failed to persist idempotency record", {
            key,
            scope,
            endpoint,
            error: error.message,
          });
        });

        return originalJson(payload);
      };

      // If the response ends without JSON (crash, res.send, connection drop),
      // release the key so the client can retry instead of hitting 409s.
      res.on("finish", () => {
        if (persisted) return;
        pool
          .query(
            `DELETE FROM idempotency_keys
             WHERE idempotency_key = $1 AND scope = $2 AND endpoint = $3
               AND status = 'processing'`,
            [key, scope, endpoint],
          )
          .catch((error) => {
            logger.error("Failed to release idempotency key", {
              key,
              scope,
              endpoint,
              error: error.message,
            });
          });
      });

      return next();
    } catch (error) {
      logger.error("Idempotency middleware failure, proceeding without protection", {
        key,
        endpoint,
        error: error.message,
      });
      return next();
    }
  };
}

module.exports = { idempotency };
