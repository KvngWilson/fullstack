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
const logger = require("../../config/logger");

class WebSocketManager {
  constructor(httpServer, redisClient) {
    this.io = null;
    this.httpServer = httpServer;
    this.redisClient = redisClient;
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
          origin: process.env.FRONTEND_URL || "http://localhost:3000",
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
        url: process.env.REDIS_URL || 
             `redis://:${process.env.REDIS_PASSWORD || ""}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
        db: parseInt(process.env.REDIS_DB || "0"),
      });

      await this.redisSubscriber.connect();

      // Use Redis adapter for multi-process support
      this.io.adapter(
        createAdapter(this.redisClient, this.redisSubscriber)
      );

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
        const token = socket.handshake.auth.token;
        if (!token) {
          const userId = socket.handshake.auth.guestId;
          socket.userId = userId; // For guest tracking
          socket.isGuest = true;
          return next();
        }

        // Verify JWT token (simplified - in production, use proper JWT verification)
        // For now, assume token is valid and contains userId
        const payload = this._decodeToken(token);
        socket.userId = payload.userId;
        socket.isGuest = false;
        next();
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
      logger.debug("Client connected", { socketId: socket.id, userId: socket.userId });

      // Track authenticated user
      if (socket.userId) {
        if (!this.authenticatedUsers.has(socket.userId)) {
          this.authenticatedUsers.set(socket.userId, new Set());
        }
        this.authenticatedUsers.get(socket.userId).add(socket.id);

        // Join user-specific room for targeted updates
        socket.join(`user:${socket.userId}`);
      }

      // Handle order tracking subscription
      socket.on("subscribe:order", (orderId, callback) => {
        socket.join(`order:${orderId}`);
        logger.debug("User subscribed to order updates", { orderId, userId: socket.userId });
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
        logger.debug("Client disconnected", { socketId: socket.id });
      });

      // Error handler
      socket.on("error", (error) => {
        logger.error("WebSocket error", { socketId: socket.id, error });
      });
    });
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
    this.io.to(`user:${statusChangeEvent.userId}`).emit("order:status-updated", payload);

    logger.debug("Order status update emitted", { orderId, newStatus: statusChangeEvent.newStatus });
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
    userIds.forEach(userId => {
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
   * Simplified token decoder (in production, use proper JWT verification)
   */
  _decodeToken(token) {
    try {
      // This is a placeholder - implement proper JWT verification
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      throw new Error("Invalid token");
    }
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
