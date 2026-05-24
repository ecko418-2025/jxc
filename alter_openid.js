const fs = require('fs');
const { execSync } = require('child_process');

const tables = [
  'categories', 'products', 'suppliers', 'customers', 
  'purchase_orders', 'purchase_items', 'sales_orders', 'sales_items', 
  'inventory', 'inventory_logs'
];

for (const table of tables) {
  try {
    console.log(`Altering table ${table}...`);
    execSync(`tcb db execute -e cshj001-d7g5f1k0tc94d4181 --sql "ALTER TABLE ${table} MODIFY COLUMN \\`_openid\\` varchar(256) DEFAULT '';"`);
  } catch (e) {
    console.log(`Failed or no _openid in ${table}`);
  }
}
