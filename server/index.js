"use strict";

require("dotenv").config();
try {
  require('./config/env').validateEnv();
} catch (error) {
  console.error('Environment validation failed:');
  console.error(error.message);
  console.error('\nTo generate secure secrets, run:');
  console.error('  node -e "require(\'./server/config/env\').generateSecrets()"');
  process.exit(1);
}

const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const RedisStore = require("connect-redis").default;
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const passport = require("./config/passport");
const adminRoutes = require("./routes/admin");
const userRoutes = require("./routes/user");
const productRoutes = require("./routes/product");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/orders");
const shippingRoutes = require("./routes/shipping");
const paymentRoutes = require("./routes/payment");
const profileRoutes = require("./routes/profile");
const swaggerUI = require("swagger-ui-express");
const yaml = require("js-yaml");
const { connectDB, pool } = require("./config/db");
const vhost = require("vhost");
const { authenticateJWT, requireAdmin } = require("./config/auth");
const { errorResponse } = require("./utils/response");
const { handleStripeWebhook } = require("./controllers/payment");

const app = express();

const PORT = process.env.PORT || 5000;

const PRODUCTS_ASSETS_PATH = path.join(
  __dirname,
  "public",
  "assets",
  "products"
);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

const toTitleCase = (segment) =>
  segment.charAt(0).toUpperCase() + segment.slice(1);

const filenameToName = (filename, fallback = "Product") => {
  const basename = path.basename(filename, path.extname(filename));
  const words = basename.split(/[-_]/).filter(Boolean);
  if (!words.length) return fallback;
  return words.map(toTitleCase).join(" ");
};

const buildFeaturedProductsFromAssets = () => {
  try {
    const files = fs.readdirSync(PRODUCTS_ASSETS_PATH);

    return files
      .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .map((file, idx) => {
        const price = 29.99 + idx;
        const originalPrice = price + 10;
        return {
          id: idx + 1,
          name: filenameToName(file, `Product ${idx + 1}`),
          category: "Featured",
          brand: "E-Shop",
          price,
          original_price: originalPrice,
          image: `/assets/products/${file}`,
          rating: 4.5,
          reviews_count: 120 + idx,
        };
      });
  } catch (error) {
    console.error("Unable to load featured products from assets", error);
    return [];
  }
};

const shuffleInPlace = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const sampleProducts = (count) => {
  const allProducts = buildFeaturedProductsFromAssets();
  if (allProducts.length <= count) return allProducts;
  return shuffleInPlace(allProducts).slice(0, count);
};

// Trust proxy for deployment behind reverse proxies
app.set("trust proxy", 1);

// Load Swagger documentation
const swaggerPath = path.join(__dirname, "swagger.yml");
const swaggerSpec = yaml.load(fs.readFileSync(swaggerPath, "utf8"));

app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerSpec));

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Security & logging middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

// Stripe webhooks need the raw body for signature verification
app.post(
  "/api/v1/payments/webhook/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Session middleware with Redis (optional)
try {
  const { redisClient } = require("./config/redis");
  app.use(
    session({
      store: new RedisStore({ client: redisClient }),
      secret: process.env.SESSION_SECRET || "session-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      },
    })
  );
} catch (error) {
  console.warn("Redis not available, using memory store for sessions");
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "session-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      },
    })
  );
}

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use('/uploads', express.static('uploads'))

// Passport initialization
app.use(passport.initialize());

// Sample route
app.get("/", (req, res) => {
  const FEATURED_COUNT = 4;
  const featuredProducts = sampleProducts(FEATURED_COUNT);
  res.render("main", { featuredProducts });
});

// Server-rendered products listing
app.get("/products", (req, res) => {
  const products = buildFeaturedProductsFromAssets();
  res.render("products", { products, categories: [] });
});

// Server-rendered product detail
app.get("/product/:id", (req, res) => {
  const productId = parseInt(req.params.id, 10);
  if (Number.isNaN(productId) || productId <= 0) {
    return res.status(400).render("404", { message: "Invalid product id" });
  }

  const products = buildFeaturedProductsFromAssets();
  const product = products.find((p) => p.id === productId);

  if (!product) {
    return res.status(404).render("404", { message: "Product not found" });
  }

  const related_products = shuffleInPlace(
    products.filter((p) => p.id !== productId)
  ).slice(0, 4);

  res.render("product-detail", { product: { ...product, related_products } });
});

// Create admin sub-application with authentication
const adminApp = express();
adminApp.use("/", authenticateJWT, requireAdmin, adminRoutes);

// Routes
app.use(vhost("admin.localhost", adminApp));
app.use(vhost("admin.*", adminApp)); // Fallback for other admin subdomains

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/cart", authenticateJWT, cartRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/shipping", authenticateJWT, shippingRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/profile", profileRoutes);

// 404 handler for unmatched routes
app.use((req, res) => {
  if (req.accepts("html")) {
    return res.status(404).render("404", { message: "Page not found" });
  }
  return res.status(404).json({ error: "Not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (res.headersSent) {
    return next(err);
  }

  const status = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";

  if (req.accepts("html")) {
    return res.status(status).render("404", { message });
  }

  errorResponse(res, message, status);
});

app.listen(PORT, () => {
  // Connect to database
  connectDB();
  console.log(`Server running on port ${PORT}`);
  console.log(`API Docs available at http://localhost:${PORT}/api-docs`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
