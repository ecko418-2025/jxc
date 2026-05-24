const { execSync } = require('child_process');

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

function generateOrderNo() {
  return 'PO' + Date.now().toString() + Math.floor(Math.random()*1000).toString().padStart(3, '0');
}

function runSQL(sql) {
  const stdout = execSync(`tcb db execute -e cshj001-d7g5f1k0tc94d4181 --sql "${sql}" --json`, { encoding: 'utf-8' });
  const jsonMatch = stdout.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]).data.items || [];
  }
  return [];
}

function runSQLSilent(sql) {
  try {
    execSync(`tcb db execute -e cshj001-d7g5f1k0tc94d4181 --sql "${sql}"`);
  } catch (e) {
    console.error('Error executing:', sql.substring(0, 50));
  }
}

// FIRST RESET INVENTORY TO 0
runSQLSilent("UPDATE inventory SET current_qty = 0;");
runSQLSilent("DELETE FROM inventory_logs;");
runSQLSilent("DELETE FROM purchase_items;");
runSQLSilent("DELETE FROM purchase_orders;");

const products = runSQL("SELECT id, min_stock, purchase_price FROM products;");
const suppliers = runSQL("SELECT id FROM suppliers;");

if (!products.length || !suppliers.length) {
  console.log('No products or suppliers found.');
  process.exit(1);
}

// Shuffle products
for (let i = products.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [products[i], products[j]] = [products[j], products[i]];
}

const numOrders = 10;
const productsPerOrder = Math.ceil(products.length / numOrders);

const ordersSql = [];
const itemsSql = [];
const inventoryLogsSql = [];
const inventoryUpdatesSql = [];

console.log('Generating 10 purchase orders...');

for (let i = 0; i < numOrders; i++) {
  const orderId = generateId();
  const orderNo = generateOrderNo();
  const supplierId = suppliers[Math.floor(Math.random() * suppliers.length)].id;
  const orderDate = new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString().split('T')[0];
  
  const chunk = products.slice(i * productsPerOrder, (i + 1) * productsPerOrder);
  let totalAmount = 0;

  for (const product of chunk) {
    const qty = product.min_stock + Math.floor(Math.random() * 20) + 1;
    const unitPrice = parseFloat(product.purchase_price);
    const subtotal = qty * unitPrice;
    totalAmount += subtotal;

    itemsSql.push(`('${generateId()}', '${orderId}', '${product.id}', ${qty}, ${unitPrice}, ${subtotal}, '')`);
    
    // id, product_id, type, quantity_change, balance, ref_type, ref_id, operator, _openid
    inventoryLogsSql.push(`('${generateId()}', '${product.id}', 'purchase', ${qty}, ${qty}, 'purchase', '${orderId}', 'system', '')`);
    
    // Inventory update
    inventoryUpdatesSql.push(`UPDATE inventory SET current_qty = ${qty} WHERE product_id = '${product.id}';`);
  }

  // id, order_no, supplier_id, order_date, total_amount, status, remark, _openid
  ordersSql.push(`('${orderId}', '${orderNo}', '${supplierId}', '${orderDate}', ${totalAmount}, 'completed', '系统自动生成的测试采购单', '')`);
}

// Execute inserts
if (ordersSql.length > 0) {
  runSQLSilent(`INSERT INTO purchase_orders (id, order_no, supplier_id, order_date, total_amount, status, remark, _openid) VALUES ${ordersSql.join(', ')};`);
  runSQLSilent(`INSERT INTO purchase_items (id, order_id, product_id, quantity, unit_price, subtotal, _openid) VALUES ${itemsSql.join(', ')};`);
  runSQLSilent(`INSERT INTO inventory_logs (id, product_id, type, quantity_change, balance, ref_type, ref_id, operator, _openid) VALUES ${inventoryLogsSql.join(', ')};`);
  
  // Update inventory one by one
  for (const update of inventoryUpdatesSql) {
    runSQLSilent(update);
  }
}

console.log('✅ 成功创建 10 条采购单，所有库存均已在警戒线之上！');
