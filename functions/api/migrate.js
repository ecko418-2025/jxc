import { createConnection } from 'mysql2/promise';

async function migrate() {
  const pool = await createConnection({
    host: '172.17.0.12',
    user: 'ecko',
    password: 'xiXI031985',
    database: 'cshj001-d7g5f1k0tc94d4181'
  });

  try {
    await pool.query("ALTER TABLE purchase_orders ADD COLUMN ext_order_no VARCHAR(100) DEFAULT '' AFTER status;");
    console.log("Added ext_order_no to purchase_orders");
  } catch(e) {
    console.log("purchase_orders skip: " + e.message);
  }

  try {
    await pool.query("ALTER TABLE sales_orders ADD COLUMN ext_order_no VARCHAR(100) DEFAULT '' AFTER payment_status;");
    console.log("Added ext_order_no to sales_orders");
  } catch(e) {
    console.log("sales_orders skip: " + e.message);
  }

  process.exit(0);
}

migrate();
