import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models/User";
import logger from "../utils/logger";
async function run() {
    await mongoose.connect(env.MONGO_URI);
    const email = process.env.SEED_SUPER_ADMIN_EMAIL || "superadmin@softworks.local";
    const password = process.env.SEED_SUPER_ADMIN_PASSWORD || "ChangeMe123!";
    const name = process.env.SEED_SUPER_ADMIN_NAME || "Super Admin";
    const existing = await User.findOne({ email });
    if (existing) {
        logger.info("Super admin already exists", { email });
    }
    else {
        const passwordHash = await bcrypt.hash(password, 12);
        await User.create({ email, passwordHash, name, role: "SUPER_ADMIN" });
        logger.info("Super admin created", { email });
    }
    await mongoose.disconnect();
}
run().catch(async (err) => {
    logger.error("Seeding failed", { error: err.message, stack: err.stack });
    await mongoose.disconnect();
    process.exit(1);
});
//# sourceMappingURL=seedSuperAdmin.js.map