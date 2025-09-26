function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
}
function deepSanitize(obj) {
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            obj[i] = deepSanitize(obj[i]);
        }
        return obj;
    }
    if (isPlainObject(obj)) {
        for (const key of Object.keys(obj)) {
            const value = obj[key];
            if (key.startsWith("$") || key.includes(".")) {
                delete obj[key];
                continue;
            }
            obj[key] = deepSanitize(value);
        }
        return obj;
    }
    return obj;
}
export function sanitizeRequests(req, _res, next) {
    if (req.body && typeof req.body === "object")
        deepSanitize(req.body);
    if (req.params && typeof req.params === "object")
        deepSanitize(req.params);
    if (req.query && typeof req.query === "object")
        deepSanitize(req.query);
    next();
}
//# sourceMappingURL=sanitize.js.map