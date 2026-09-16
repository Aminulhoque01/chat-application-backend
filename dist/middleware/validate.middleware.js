"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
    });
    if (!result.success) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: result.error.issues,
        });
    }
    req.body = result.data.body;
    req.query = result.data.query;
    req.params = result.data.params;
    next();
};
exports.validate = validate;
