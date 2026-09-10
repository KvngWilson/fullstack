const { pool } = require("../../../../config/db");

const EVENT_RESOURCE_TYPE_SQL = `CASE
  WHEN POSITION(':' IN sal.event_type) > 0 THEN split_part(sal.event_type, ':', 1)
  WHEN POSITION('_' IN sal.event_type) > 0 THEN split_part(sal.event_type, '_', 1)
  ELSE NULL
END`;
const RESOURCE_TYPE_SQL =
  `COALESCE(sal.metadata->>'resource_type', sal.metadata->>'resource', ${EVENT_RESOURCE_TYPE_SQL})`;
const RESOURCE_ID_SQL =
  "COALESCE(sal.metadata->>'resource_id', sal.metadata->>'target_id', sal.target_id::text)";

function buildAuditBaseQuery() {
  return `
    FROM security_audit_log sal
    LEFT JOIN users u ON sal.actor_id = u.id
    WHERE 1=1
  `;
}

/**
 * Audit Logs Controller
 * Read-only access to security audit trail
 */

exports.listAuditLogs = async (req, res) => {
  try {
    const {
      action = null,
      resource = null,
      startDate = null,
      endDate = null,
      limit = 50,
      offset = 0,
    } = req.query;

    const params = [];
    let whereClause = "";

    if (action) {
      whereClause += ` AND sal.event_type = $${params.length + 1}`;
      params.push(action);
    }

    if (resource) {
      whereClause += ` AND ${RESOURCE_TYPE_SQL} = $${params.length + 1}`;
      params.push(resource);
    }

    if (startDate) {
      const start = new Date(startDate);
      if (!Number.isNaN(start.getTime())) {
        whereClause += ` AND sal.created_at >= $${params.length + 1}`;
        params.push(start);
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!Number.isNaN(end.getTime())) {
        end.setDate(end.getDate() + 1);
        whereClause += ` AND sal.created_at < $${params.length + 1}`;
        params.push(end);
      }
    }

    const baseQuery = `${buildAuditBaseQuery()}${whereClause}`;
    const countResult = await pool.query(`SELECT COUNT(*) ${baseQuery}`, params);
    const total = parseInt(countResult.rows[0]?.count || 0, 10);

    const limitNum = Math.min(parseInt(limit, 10), 500);
    const offsetNum = Math.max(parseInt(offset, 10), 0);
    const pagedParams = [...params, limitNum, offsetNum];

    const result = await pool.query(
      `SELECT
         sal.id,
         sal.actor_id,
         u.first_name,
         u.last_name,
         u.email,
         sal.event_type AS action,
         ${RESOURCE_TYPE_SQL} AS resource_type,
         ${RESOURCE_ID_SQL} AS resource_id,
         sal.metadata,
         sal.created_at
       ${baseQuery}
       ORDER BY sal.created_at DESC
       LIMIT $${pagedParams.length - 1}
       OFFSET $${pagedParams.length}`,
      pagedParams,
    );

    res.json({
      total,
      count: result.rows.length,
      limit: limitNum,
      offset: offsetNum,
      logs: result.rows,
    });
  } catch (error) {
    console.error("Error listing audit logs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAuditLog = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
         sal.id,
         sal.actor_id,
         u.first_name,
         u.last_name,
         u.email,
         sal.event_type AS action,
         ${RESOURCE_TYPE_SQL} AS resource_type,
         ${RESOURCE_ID_SQL} AS resource_id,
         sal.metadata,
         sal.created_at
       ${buildAuditBaseQuery()}
       AND sal.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Audit log entry not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error getting audit log:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAuditStatistics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = Math.min(parseInt(days, 10), 365);

    const actionsQuery = `
      SELECT
        event_type AS action,
        COUNT(*) as count
      FROM security_audit_log
      WHERE created_at >= NOW() - INTERVAL '${daysNum} days'
      GROUP BY event_type
      ORDER BY count DESC
    `;

    const resourcesQuery = `
      SELECT
        ${RESOURCE_TYPE_SQL.replaceAll("sal.", "")} AS resource_type,
        COUNT(*) as count
      FROM security_audit_log
      WHERE created_at >= NOW() - INTERVAL '${daysNum} days'
      GROUP BY ${RESOURCE_TYPE_SQL.replaceAll("sal.", "")}
      ORDER BY count DESC
    `;

    const actorsQuery = `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        COUNT(*) as action_count
      FROM security_audit_log sal
      LEFT JOIN users u ON sal.actor_id = u.id
      WHERE sal.created_at >= NOW() - INTERVAL '${daysNum} days'
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY action_count DESC
      LIMIT 10
    `;

    const dailyQuery = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM security_audit_log
      WHERE created_at >= NOW() - INTERVAL '${daysNum} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const [actionsResult, resourcesResult, actorsResult, dailyResult] =
      await Promise.all([
        pool.query(actionsQuery),
        pool.query(resourcesQuery),
        pool.query(actorsQuery),
        pool.query(dailyQuery),
      ]);

    res.json({
      period: `Last ${daysNum} days`,
      actionBreakdown: actionsResult.rows,
      resourceBreakdown: resourcesResult.rows,
      topActors: actorsResult.rows,
      dailyActivity: dailyResult.rows,
      totalEvents: actionsResult.rows.reduce(
        (sum, row) => sum + parseInt(row.count, 10),
        0,
      ),
    });
  } catch (error) {
    console.error("Error getting audit statistics:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.searchAuditLogs = async (req, res) => {
  try {
    const { query: searchQuery, type = "action" } = req.query;

    if (!searchQuery || searchQuery.length < 2) {
      return res.status(400).json({
        error: "Search query must be at least 2 characters",
      });
    }

    const params = [];
    let whereClause = "";

    if (type === "action") {
      whereClause = ` AND sal.event_type ILIKE $${params.length + 1}`;
      params.push(`%${searchQuery}%`);
    } else if (type === "resource") {
      whereClause = ` AND ${RESOURCE_TYPE_SQL} ILIKE $${params.length + 1}`;
      params.push(`%${searchQuery}%`);
    } else if (type === "actor") {
      whereClause =
        ` AND (u.first_name ILIKE $${params.length + 1} OR u.last_name ILIKE $${params.length + 2} OR u.email ILIKE $${params.length + 3})`;
      params.push(`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`);
    } else {
      whereClause =
        ` AND (sal.event_type ILIKE $${params.length + 1}
        OR ${RESOURCE_TYPE_SQL} ILIKE $${params.length + 2}
        OR u.first_name ILIKE $${params.length + 3}
        OR u.last_name ILIKE $${params.length + 4}
        OR u.email ILIKE $${params.length + 5})`;
      params.push(
        `%${searchQuery}%`,
        `%${searchQuery}%`,
        `%${searchQuery}%`,
        `%${searchQuery}%`,
        `%${searchQuery}%`,
      );
    }

    const result = await pool.query(
      `SELECT
         sal.id,
         sal.actor_id,
         sal.event_type AS action,
         ${RESOURCE_TYPE_SQL} AS resource_type,
         ${RESOURCE_ID_SQL} AS resource_id,
         sal.metadata,
         sal.created_at,
         u.first_name,
         u.last_name,
         u.email
       ${buildAuditBaseQuery()}
       ${whereClause}
       ORDER BY sal.created_at DESC
       LIMIT 100`,
      params,
    );

    res.json({
      query: searchQuery,
      type,
      count: result.rows.length,
      results: result.rows,
    });
  } catch (error) {
    console.error("Error searching audit logs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.exportAuditLogs = async (req, res) => {
  try {
    const { startDate, endDate, format = "json" } = req.query;

    const params = [];
    let whereClause = "";

    if (startDate) {
      const start = new Date(startDate);
      if (!Number.isNaN(start.getTime())) {
        whereClause += ` AND sal.created_at >= $${params.length + 1}`;
        params.push(start);
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!Number.isNaN(end.getTime())) {
        end.setDate(end.getDate() + 1);
        whereClause += ` AND sal.created_at < $${params.length + 1}`;
        params.push(end);
      }
    }

    const result = await pool.query(
      `SELECT
         sal.id,
         sal.actor_id,
         u.first_name,
         u.last_name,
         u.email,
         sal.event_type AS action,
         ${RESOURCE_TYPE_SQL} AS resource_type,
         ${RESOURCE_ID_SQL} AS resource_id,
         sal.metadata,
         sal.created_at
       ${buildAuditBaseQuery()}
       ${whereClause}
       ORDER BY sal.created_at DESC`,
      params,
    );

    if (format === "csv") {
      const headers = [
        "ID",
        "Employee",
        "Action",
        "Resource Type",
        "Resource ID",
        "Metadata",
        "Timestamp",
      ];
      const rows = result.rows.map((row) => [
        row.id,
        row.email || [row.first_name, row.last_name].filter(Boolean).join(" "),
        row.action,
        row.resource_type || "",
        row.resource_id || "",
        JSON.stringify(row.metadata || {}),
        row.created_at,
      ]);

      const csv = [
        headers.join(","),
        ...rows.map((row) =>
          row
            .map((cell) => {
              if (
                typeof cell === "string"
                && (cell.includes(",") || cell.includes('"'))
              ) {
                return `"${cell.replace(/"/g, '""')}"`;
              }
              return cell;
            })
            .join(","),
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`,
      );
      return res.send(csv);
    }

    return res.json({
      count: result.rows.length,
      exportedAt: new Date().toISOString(),
      logs: result.rows,
    });
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
