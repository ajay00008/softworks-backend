import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { env } from "../config/env";
import createHttpError from "http-errors";
const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});
export async function login(req, res, next) {
    try {
        const { email, password } = LoginSchema.parse(req.body);
        const user = await User.findOne({ email, isActive: true });
        if (!user)
            throw new createHttpError.Unauthorized("Invalid credentials");
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok)
            throw new createHttpError.Unauthorized("Invalid credentials");
        const token = jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_SECRET, {
            expiresIn: env.JWT_EXPIRES_IN,
        });
        res.json({ success: true, token, user: { id: user._id, email: user.email, name: user.name, role: user.role } });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=authController.js.map