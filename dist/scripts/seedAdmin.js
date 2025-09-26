import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models/User";
import logger from "../utils/logger";
async function run() {
    await mongoose.connect(env.MONGO_URI);
    // Get admin details from environment variables or use defaults
    const email = process.env.SEED_ADMIN_EMAIL || "admin@softworks.local";
    const password = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
    const name = process.env.SEED_ADMIN_NAME || "Admin User";
    const existing = await User.findOne({ email });
    if (existing) {
        logger.info("Admin user already exists", { email, role: existing.role });
    }
    else {
        const passwordHash = await bcrypt.hash(password, 12);
        const admin = await User.create({ email, passwordHash, name, role: "ADMIN" });
        logger.info("Admin user created successfully", {
            id: admin._id,
            email: admin.email,
            name: admin.name,
            role: admin.role
        });
    }
    await mongoose.disconnect();
}
run().catch(async (err) => {
    logger.error("Admin seeding failed", { error: err.message, stack: err.stack });
    await mongoose.disconnect();
    process.exit(1);
});
//# sourceMappingURL=seedAdmin.js.map