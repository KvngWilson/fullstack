const { pool } = require("../../../../config/db");

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

    let query = `
      SELECT 
        sal.id,
        sal.employee_id,
        e.first_name,
        e.last_name,
        sal.action,
        sal.resource_type,
        sal.resource_id,
        sal.metadata,
        sal.created_at
      FROM security_audit_log sal
      LEFT JOIN employees e ON sal.employee_id = e.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by action
    if (action) {
      query += ` AND sal.action = $${params.length + 1}`;
      params.push(action);
    }

    // Filter by resource type
    if (resource) {
      query += ` AND sal.resource_type = $${params.length + 1}`;
      params.push(resource);
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        query += ` AND sal.created_at >= $${params.length + 1}`;
        params.push(start);
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        // Add 1 day for inclusive end date
        end.setDate(end.getDate() + 1);
        query += ` AND sal.created_at < $${params.length + 1}`;
        params.push(end);
      }
    }

    // Get total count
    const countQuery = query.replace(
      /SELECT.*FROM/,
      "SELECT COUNT(*) FROM"
    );
    const countResult = await pool.query(`${countQuery.split("ORDER BY")[0]}`);
    const total = parseInt(countResult.rows[0]?.count || 0, 10);

    // Apply pagination and sorting
    const limitNum = Math.min(parseInt(limit, 10), 500);
    const offsetNum = Math.max(parseInt(offset, 10), 0);

    query += ` ORDER BY sal.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum);
    params.push(offsetNum);

    const result = await pool.query(query, params);

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

    const query = `
      SELECT 
        sal.id,
        sal.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        sal.action,
        sal.resource_type,
        sal.resource_id,
        sal.metadata,
        sal.created_at
      FROM security_audit_log sal
      LEFT JOIN employees e ON sal.employee_id = e.id
      WHERE sal.id = $1
    `;

    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Audit log entry not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error getting audit log:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAuditStatistics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = Math.min(parseInt(days, 10), 365);

    // Get actions breakdown
    const actionsQuery = `
      SELECT 
        action,
        COUNT(*) as count
      FROM security_audit_log
      WHERE created_at >= NOW() - INTERVAL '${daysNum} days'
      GROUP BY action
      ORDER BY count DESC
    `;

    // Get resources breakdown
    const resourcesQuery = `
      SELECT 
        resource_type,
        COUNT(*) as count
      FROM security_audit_log
      WHERE created_at >= NOW() - INTERVAL '${daysNum} days'
      GROUP BY resource_type
      ORDER BY count DESC
    `;

    // Get top actors
    const actorsQuery = `
      SELECT 
        e.id,
        e.first_name,
        e.last_name,
        COUNT(*) as action_count
      FROM security_audit_log sal
      LEFT JOIN employees e ON sal.employee_id = e.id
      WHERE sal.created_at >= NOW() - INTERVAL '${daysNum} days'
      GROUP BY e.id, e.first_name, e.last_name
      ORDER BY action_count DESC
      LIMIT 10
    `;

    // Get daily activity
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
        0
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

    let query = `
      SELECT 
        sal.id,
        sal.action,
        sal.resource_type,
        sal.resource_id,
        sal.metadata,
        sal.created_at,
        e.first_name,
        e.last_name
      FROM security_audit_log sal
      LEFT JOIN employees e ON sal.employee_id = e.id
      WHERE 1=1
    `;

    const params = [];

    if (type === "action") {
      query += ` AND sal.action ILIKE $${params.length + 1}`;
      params.push(`%${searchQuery}%`);
    } else if (type === "resource") {
      query += ` AND sal.resource_type ILIKE $${params.length + 1}`;
      params.push(`%${searchQuery}%`);
    } else if (type === "actor") {
      query += ` AND (e.first_name ILIKE $${params.length + 1} OR e.last_name ILIKE $${params.length + 1})`;
      params.push(`%${searchQuery}%`);
      params.push(`%${searchQuery}%`);
    } else {
      // Default: search across all fields
      query += ` AND (sal.action ILIKE $${params.length + 1} OR sal.resource_type ILIKE $${params.length + 1} OR e.first_name ILIKE $${params.length + 1} OR e.last_name ILIKE $${params.length + 1})`;
      params.push(`%${searchQuery}%`);
      params.push(`%${searchQuery}%`);
      params.push(`%${searchQuery}%`);
      params.push(`%${searchQuery}%`);
    }

    query += ` ORDER BY sal.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

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

    let query = `
      SELECT 
        sal.id,
        sal.employee_id,
        e.first_name,
        e.last_name,
        sal.action,
        sal.resource_type,
        sal.resource_id,
        sal.metadata,
        sal.created_at
      FROM security_audit_log sal
      LEFT JOIN employees e ON sal.employee_id = e.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        query += ` AND sal.created_at >= $${params.length + 1}`;
        params.push(start);
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setDate(end.getDate() + 1);
        query += ` AND sal.created_at < $${params.length + 1}`;
        params.push(end);
      }
    }

    query += ` ORDER BY sal.created_at DESC`;

    const result = await pool.query(query, params);

    if (format === "csv") {
      // Convert to CSV
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
        `${row.first_name} ${row.last_name}`,
        row.action,
        row.resource_type,
        row.resource_id,
        JSON.stringify(row.metadata || {}),
        row.created_at,
      ]);

      const csv = [
        headers.join(","),
        ...rows.map((row) =>
          row
            .map((cell) => {
              if (typeof cell === "string" && (cell.includes(",") || cell.includes('"'))) {
                return `"${cell.replace(/"/g, '""')}"`;
              }
              return cell;
            })
            .join(",")
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`
      );
      return res.send(csv);
    }

    // Default JSON
    res.json({
      count: result.rows.length,
      exportedAt: new Date().toISOString(),
      logs: result.rows,
    });
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
