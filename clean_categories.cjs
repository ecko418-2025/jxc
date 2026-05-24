const { execSync } = require('child_process');

const sqlCommands = [
  "DELETE FROM purchase_items WHERE product_id IN (SELECT id FROM products WHERE category_id NOT IN ('r1ab3zczq', '2x7rvljts', 'xg1esxpqp', '6qwar0935', 'u5t4hnju0'))",
  "DELETE FROM sales_items WHERE product_id IN (SELECT id FROM products WHERE category_id NOT IN ('r1ab3zczq', '2x7rvljts', 'xg1esxpqp', '6qwar0935', 'u5t4hnju0'))",
  "DELETE FROM inventory_logs WHERE product_id IN (SELECT id FROM products WHERE category_id NOT IN ('r1ab3zczq', '2x7rvljts', 'xg1esxpqp', '6qwar0935', 'u5t4hnju0'))",
  "DELETE FROM inventory WHERE product_id IN (SELECT id FROM products WHERE category_id NOT IN ('r1ab3zczq', '2x7rvljts', 'xg1esxpqp', '6qwar0935', 'u5t4hnju0'))",
  "DELETE FROM products WHERE category_id NOT IN ('r1ab3zczq', '2x7rvljts', 'xg1esxpqp', '6qwar0935', 'u5t4hnju0')",
  "DELETE FROM categories WHERE code NOT IN ('BJ-001', 'BJ-002', 'BJ-003', 'BJ-004', 'BJ-005')"
];

for (const sql of sqlCommands) {
  try {
    execSync(`tcb db execute -e cshj001-d7g5f1k0tc94d4181 --sql "${sql}"`, { stdio: 'inherit' });
  } catch (e) {
    console.error('执行失败', e);
  }
}
console.log('✅ 清理完成！');
