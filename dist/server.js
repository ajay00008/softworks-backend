import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { sanitizeRequests } from "./middleware/sanitize";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import logger from "./utils/logger";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
const app = express();
app.set("trust proxy", true);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(sanitizeRequests);
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
}));
app.use(morgan("combined"));
// Swagger docs
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api", routes);
app.use(notFoundHandler);
app.use(errorHandler);
async function start() {
    await mongoose.connect(env.MONGO_URI);
    const server = app.listen(env.PORT, () => {
        logger.info(`Server listening on port ${env.PORT}`);
    });
    const shutdown = (signal) => () => {
        logger.info(`Received ${signal}, shutting down gracefully`);
        server.close(async () => {
            await mongoose.disconnect();
            process.exit(0);
        });
    };
    process.on("SIGINT", shutdown("SIGINT"));
    process.on("SIGTERM", shutdown("SIGTERM"));
}
start().catch((err) => {
    logger.error("Failed to start server", { error: err.message, stack: err.stack });
    process.exit(1);
});
//# sourceMappingURL=server.js.map