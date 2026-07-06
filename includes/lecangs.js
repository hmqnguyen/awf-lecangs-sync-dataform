// Helper dùng chung cho Lecangs SQLX.
// Lecangs trả timestamp lẫn 2 định dạng: '2026-06-11T17:33:20' và '2026-06-11 17:33:21'.
// ts(expr) → COALESCE parse cả hai (expr là biểu thức SQL trả STRING).
function ts(expr) {
  return `COALESCE(` +
    `SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%E*S', ${expr}), ` +
    `SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', ${expr}))`;
}

module.exports = { ts };
