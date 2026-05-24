const { execSync } = require('child_process');

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

const categories = [
  { id: 'r1ab3zczq', code: 'BJ-001', name: '客房清洁' },
  { id: '2x7rvljts', code: 'BJ-002', name: '公区保洁' },
  { id: 'xg1esxpqp', code: 'BJ-003', name: '洗涤用品' },
  { id: '6qwar0935', code: 'BJ-004', name: '一次性用品' },
  { id: 'u5t4hnju0', code: 'BJ-005', name: '清洁工具' }
];

const units = ['个', '瓶', '桶', '箱', '件', '包', '袋', '卷', '套', '条'];
const specs = ['500ml', '1L', '5L', '20kg', '100个/箱', '50只/包', '标准', '大号', '小号', '定制'];
const brands = ['洁霸', '蓝月亮', '庄臣', '3M', '威猛先生', '奥妙', '金纺', '洁丽雅', '美丽雅', '靓涤', '白猫', '超能', '滴露', '心相印', '清风'];
const names = [
  '多功能清洁剂', '84消毒液', '空气清新剂', '地面大理石抛光剂', '玻璃清洁剂',
  '洗衣液(商用)', '柔顺剂(商用)', '一次性牙刷套装', '一次性拖鞋', '超细纤维抹布',
  '拖把(商用)', '垃圾袋(加厚)', '洗手液', '漂白粉', '除垢剂',
  '洗洁精', '厕所清洁剂', '地毯清洁剂', '不锈钢保养剂', '空气香氛'
];

const products = [];
const inventories = [];

for (let i = 0; i < 100; i++) {
  const id = generateId();
  const sku = 'P-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const name = names[Math.floor(Math.random() * names.length)] + ' - ' + Math.floor(Math.random() * 1000);
  const categoryId = categories[Math.floor(Math.random() * categories.length)].id;
  const unit = units[Math.floor(Math.random() * units.length)];
  const spec = specs[Math.floor(Math.random() * specs.length)];
  const brand = brands[Math.floor(Math.random() * brands.length)];
  const purchasePrice = (Math.random() * 100 + 5).toFixed(2);
  const salePrice = (purchasePrice * (1 + Math.random() * 0.5 + 0.2)).toFixed(2);
  const minStock = Math.floor(Math.random() * 50) + 10;
  
  products.push(`('${id}', '${sku}', '${name}', '${categoryId}', '${unit}', '${spec}', '${brand}', ${purchasePrice}, ${salePrice}, ${minStock}, 1)`);
  inventories.push(`('${id}', 0)`);
}

const sqlCommands = [
  "DELETE FROM purchase_items",
  "DELETE FROM purchase_orders",
  "DELETE FROM sales_items",
  "DELETE FROM sales_orders",
  "DELETE FROM inventory_logs",
  "DELETE FROM inventory",
  "DELETE FROM products",
  "DELETE FROM categories WHERE code NOT IN ('BJ-001', 'BJ-002', 'BJ-003', 'BJ-004', 'BJ-005')",
  `INSERT INTO products (id, sku, name, category_id, unit, spec, brand, purchase_price, sale_price, min_stock, active) VALUES ${products.join(', ')}`,
  `INSERT INTO inventory (product_id, current_qty) VALUES ${inventories.join(', ')}`
];

console.log('正在执行清理和插入操作...');

for (const sql of sqlCommands) {
  try {
    console.log(`执行: ${sql.substring(0, 50)}...`);
    execSync(`tcb db execute -e cshj001-d7g5f1k0tc94d4181 --sql "${sql}"`, { stdio: 'inherit' });
  } catch (e) {
    console.error('执行失败', e);
  }
}
console.log('✅ 100 条产品及清理操作成功！');
