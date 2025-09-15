import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models/User";
import logger from "../utils/logger";

async function createAdminUser(email: string, password: string, name: string) {
  await mongoose.connect(env.MONGO_URI);
  
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      logger.info("User already exists", { email, role: existing.role });
      return { success: false, message: "User already exists", user: existing };
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await User.create({ email, passwordHash, name, role: "ADMIN" });
    
    logger.info("Admin user created successfully", { 
      id: admin._id, 
      email: admin.email, 
      name: admin.name, 
      role: admin.role 
    });
    
    return { 
      success: true, 
      message: "Admin user created successfully", 
      user: { 
        id: admin._id, 
        email: admin.email, 
        name: admin.name, 
        role: admin.role 
      } 
    };
  } catch (error) {
    logger.error("Failed to create admin user", { error: error.message });
    return { success: false, message: "Failed to create admin user", error: error.message };
  } finally {
    await mongoose.disconnect();
  }
}

// If running directly from command line
if (import.meta.url === `file://${process.argv[1]}`) {
  const email = process.argv[2] || process.env.SEED_ADMIN_EMAIL || "admin@softworks.local";
  const password = process.argv[3] || process.env.SEED_ADMIN_PASSWORD || "Admin123!";
  const name = process.argv[4] || process.env.SEED_ADMIN_NAME || "Admin User";

  createAdminUser(email, password, name)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error("Script failed:", err.message);
      process.exit(1);
    });
}

export { createAdminUser };
