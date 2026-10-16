
import jwt from "jsonwebtoken";

const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // Check if token exists
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Not authorized, no token"
            });
        }

        // Extract token
        const token = authHeader.split(" ")[1];

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user ID to request
        req.userId = decoded.id;

        // Continue to next middleware/controller
        next();

    } catch (error) {
      console.error("Auth middleware error:", error.message);
        return res.status(401).json({ success: false, message: "Not authorized, token failed"})
    }
};

export default auth;

