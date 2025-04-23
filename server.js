require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoutes = require("./routes/auth");

const app = express();

// CORS configuration
const corsOptions = {
  origin: ["https://schoolfi.vercel.app", "http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
  credentials: true,
  optionsSuccessStatus: 204,
  preflightContinue: false,
};

// Apply CORS before other middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options("*", (req, res) => {
  // Set CORS headers
  res.header(
    "Access-Control-Allow-Origin",
    req.headers.origin || "https://schoolfi.vercel.app"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.status(204).end();
});

// Other middleware
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to ScholFi API" });
});

// Routes - mount auth routes at both /auth and /api/auth for compatibility
app.use("/auth", authRoutes);
app.use("/api/auth", authRoutes);

// Handle the specific route that's causing issues
app.all("/auth/signin", (req, res) => {
  // For OPTIONS requests, just return 204
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  // For other methods, forward to the auth router
  authRoutes.handle(req, res);
});

// Basic health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
