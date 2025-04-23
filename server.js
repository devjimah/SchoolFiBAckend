require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
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

// Connect to MongoDB with improved options
mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4, // Use IPv4, skip trying IPv6
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    // Continue running the app even if MongoDB connection fails
    // This allows the app to handle requests that don't require DB access
  });

// Add MongoDB connection error handler
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

// Add MongoDB disconnection handler
mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected, attempting to reconnect...");
});

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to ScholFi API" });
});

// Routes - mount auth routes at both /auth and /api/auth for compatibility
app.use("/auth", authRoutes);
app.use("/api/auth", authRoutes);

// Function to handle signin logic with improved error handling
const handleSignin = (req, res) => {
  try {
    // For OPTIONS requests, just return 204
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    // For POST requests, handle signin logic directly
    if (req.method === "POST") {
      // Check if request body exists
      if (!req.body) {
        console.error("No request body received");
        return res.status(400).json({ error: "Missing request body" });
      }

      const { email, password } = req.body;
      console.log(
        `Signin attempt for email: ${
          email ? email.substring(0, 3) + "..." : "undefined"
        }`
      );

      // Basic validation
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      // Set a timeout for the database operation
      const dbTimeout = setTimeout(() => {
        console.error("Database operation timeout");
        return res
          .status(503)
          .json({
            error: "Service temporarily unavailable. Please try again later.",
          });
      }, 8000); // 8 second timeout

      // Find user and authenticate (similar to the auth route)
      User.findOne({ email })
        .then((user) => {
          clearTimeout(dbTimeout); // Clear the timeout since we got a response

          if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
          }

          // Check password
          return user
            .comparePassword(password)
            .then((isMatch) => {
              if (!isMatch) {
                return res.status(401).json({ error: "Invalid credentials" });
              }

              // Generate JWT token
              const token = jwt.sign(
                { userId: user._id, walletAddress: user.walletAddress },
                process.env.JWT_SECRET || "fallback-secret-key",
                { expiresIn: "24h" }
              );

              // Send successful response
              return res.status(200).json({
                message: "Login successful",
                token,
                walletAddress: user.walletAddress,
              });
            })
            .catch((err) => {
              console.error("Password comparison error:", err);
              return res.status(500).json({ error: "Authentication error" });
            });
        })
        .catch((err) => {
          clearTimeout(dbTimeout); // Clear the timeout since we got a response
          console.error("User lookup error:", err);
          return res.status(500).json({ error: "Error processing request" });
        });
    } else {
      // For other methods, return method not allowed
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    // Catch any unexpected errors
    console.error("Unexpected error in signin handler:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Handle the specific routes that are causing issues
app.all("/auth/signin", (req, res) => handleSignin(req, res));
app.all("/api/auth/signin", (req, res) => handleSignin(req, res));

// Handle double-slash issue in URLs
app.all("//auth/signin", (req, res) => {
  console.log("Redirecting from double-slash URL to /auth/signin");
  handleSignin(req, res);
});

// Add a catch-all route for any auth/signin path to handle potential URL issues
app.all("**/auth/signin", (req, res) => {
  console.log(`Handling wildcard auth path: ${req.path}`);
  handleSignin(req, res);
});

// Basic health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "An unexpected error occurred",
  });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
