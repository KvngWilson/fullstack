/**
 * WebSocket Manager
 *
 * Centralized manager for all WebSocket operations using Socket.IO
 * Handles real-time communication for order tracking, notifications, and live updates.
 * Uses Redis adapter for horizontal scaling across multiple processes.
 */
const socketIO = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const redis = require("redis");
const logger = require("../../shared/utils/logger");
const verifyToken = require("../../core/auth/verifyToken");

class WebSocketManager {
  constructor(httpServer, redisClient, dbPool = null) {
    this.io = null;
    this.httpServer = httpServer;
    this.redisClient = redisClient;
    this.dbPool = dbPool;
    this.redisSubscriber = null;
    this.authenticatedUsers = new Map(); // userId -> Set of socketIds
  }

  /**
   * Initialize Socket.IO with Redis adapter
   */
  async initialize() {
    try {
      // Create Socket.IO instance
      this.io = socketIO(this.httpServer, {
        cors: {
          origin: process.env.FRONTEND_URL || "http://localhost:5173",
          credentials: true,
          methods: ["GET", "POST"],
        },
        transports: ["websocket", "polling"],
        path: "/socket.io/",
        pingInterval: 25000,
        pingTimeout: 60000,
        maxHttpBufferSize: 1e6, // 1MB
      });

      // Create Redis subscriber for adapter
      this.redisSubscriber = redis.createClient({
        url:
          process.env.REDIS_URL ||
          `redis://:${process.env.REDIS_PASSWORD || ""}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
        db: parseInt(process.env.REDIS_DB || "0"),
      });

      await this.redisSubscriber.connect();

      // Use Redis adapter for multi-process support
      this.io.adapter(createAdapter(this.redisClient, this.redisSubscriber));

      this._setupMiddleware();
      this._setupEventHandlers();

      logger.info("WebSocket manager initialized successfully");
      return this.io;
    } catch (error) {
      logger.error("Failed to initialize WebSocket manager", { error });
      throw error;
    }
  }

  /**
   * Setup Socket.IO middleware
   */
  _setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          this._extractCookieValue(socket.handshake.headers?.cookie, "token") ||
          this._extractCookieValue(
            socket.handshake.headers?.cookie,
            "access_token",
          );

        if (token) {
          const payload = await this._verifyToken(token);
          if (!payload?.id) {
            throw new Error("Invalid token");
          }

          socket.userId = Number(payload.id);
          socket.isGuest = false;
          return next();
        }

        const guestId = socket.handshake.auth?.guestId;
        if (guestId) {
          socket.userId = guestId;
          socket.isGuest = true;
          return next();
        }

        throw new Error("Authentication required");
      } catch (error) {
        logger.error("WebSocket authentication failed", { error });
        next(new Error("Authentication failed"));
      }
    });
  }

  /**
   * Setup Socket.IO event handlers
   */
  _setupEventHandlers() {
    this.io.on("connection", (socket) => {
      logger.debug("Client connected", {
        socketId: socket.id,
        userId: socket.userId,
      });

      // Track authenticated user
      if (socket.userId) {
        if (!this.authenticatedUsers.has(socket.userId)) {
          this.authenticatedUsers.set(socket.userId, new Set());
        }
        this.authenticatedUsers.get(socket.userId).add(socket.id);

        // Join user-specific room for targeted updates
        socket.join(`user:${socket.userId}`);

        this._trackSocketConnection(socket).catch((error) => {
          logger.warn("Failed to persist websocket connection", {
            socketId: socket.id,
            userId: socket.userId,
            error: error.message,
          });
        });
      }

      // Handle order tracking subscription
      socket.on("subscribe:order", (orderId, callback) => {
        socket.join(`order:${orderId}`);
        logger.debug("User subscribed to order updates", {
          orderId,
          userId: socket.userId,
        });
        callback({ success: true });
      });

      socket.on("unsubscribe:order", (orderId, callback) => {
        socket.leave(`order:${orderId}`);
        callback({ success: true });
      });

      // Handle admin dashboard subscription
      socket.on("subscribe:admin-dashboard", (callback) => {
        if (socket.isGuest) {
          return callback({ error: "Unauthorized" });
        }
        socket.join("admin:dashboard");
        callback({ success: true });
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        if (socket.userId) {
          const sockets = this.authenticatedUsers.get(socket.userId);
          if (sockets) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.authenticatedUsers.delete(socket.userId);
            }
          }
        }

        this._markSocketDisconnected(socket.id).catch((error) => {
          logger.warn("Failed to persist websocket disconnection", {
            socketId: socket.id,
            error: error.message,
          });
        });

        logger.debug("Client disconnected", { socketId: socket.id });
      });

      // Error handler
      socket.on("error", (error) => {
        logger.error("WebSocket error", { socketId: socket.id, error });
      });
    });
  }

  _extractCookieValue(cookieHeader, name) {
    if (!cookieHeader) {
      return null;
    }

    const match = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));

    if (!match) {
      return null;
    }

    return decodeURIComponent(match.slice(name.length + 1));
  }

  async _verifyToken(token) {
    const payload = await verifyToken(token);
    if (!payload?.id) {
      throw new Error("Invalid token");
    }

    return payload;
  }

  async _trackSocketConnection(socket) {
    if (!this.io || !socket.userId || socket.isGuest) {
      return;
    }

    const userId = Number(socket.userId);
    if (!Number.isFinite(userId)) {
      return;
    }

    if (!this.dbPool) {
      return;
    }

    await this.dbPool.query(
      `INSERT INTO websocket_sessions (
        id,
        user_id,
        socket_id,
        connected_at,
        disconnected_at,
        is_active
      ) VALUES ($1, $2, $3, NOW(), NULL, true)
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        socket_id = EXCLUDED.socket_id,
        connected_at = EXCLUDED.connected_at,
        disconnected_at = NULL,
        is_active = true`,
      [socket.id, userId, socket.id],
    );
  }

  async _markSocketDisconnected(socketId) {
    if (!socketId) {
      return;
    }

    if (!this.dbPool) {
      return;
    }

    await this.dbPool.query(
      `UPDATE websocket_sessions
       SET disconnected_at = NOW(), is_active = false
       WHERE id = $1`,
      [socketId],
    );
  }

  /**
   * Emit order status update to specific order room
   */
  emitOrderStatusUpdate(orderId, statusChangeEvent) {
    if (!this.io) {
      logger.warn("WebSocket not initialized");
      return;
    }

    const payload = {
      orderId,
      previousStatus: statusChangeEvent.previousStatus,
      newStatus: statusChangeEvent.newStatus,
      message: statusChangeEvent.getStatusMessage(),
      priority: statusChangeEvent.getNotificationPriority(),
      timestamp: statusChangeEvent.occurredAt,
      reason: statusChangeEvent.reason,
      metadata: statusChangeEvent.metadata,
    };

    // Emit to order-specific room
    this.io.to(`order:${orderId}`).emit("order:status-updated", payload);

    // Emit to user's dashboard
    this.io
      .to(`user:${statusChangeEvent.userId}`)
      .emit("order:status-updated", payload);

    logger.debug("Order status update emitted", {
      orderId,
      newStatus: statusChangeEvent.newStatus,
    });
  }

  /**
   * Broadcast to admin dashboard
   */
  broadcastToAdmin(eventType, data) {
    if (!this.io) return;
    this.io.to("admin:dashboard").emit(`admin:${eventType}`, data);
  }

  /**
   * Emit notification to specific user
   */
  emitToUser(userId, eventType, data) {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(eventType, data);
  }

  /**
   * Emit to multiple users
   */
  emitToUsers(userIds, eventType, data) {
    if (!this.io) return;
    userIds.forEach((userId) => {
      this.io.to(`user:${userId}`).emit(eventType, data);
    });
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount() {
    return this.authenticatedUsers.size;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId) {
    return this.authenticatedUsers.has(userId);
  }

  /**
   * Shutdown WebSocket manager
   */
  async shutdown() {
    try {
      if (this.io) {
        this.io.close();
      }
      if (this.redisSubscriber) {
        await this.redisSubscriber.quit();
      }
      logger.info("WebSocket manager shut down successfully");
    } catch (error) {
      logger.error("Error shutting down WebSocket manager", { error });
    }
  }
}

module.exports = WebSocketManager;
