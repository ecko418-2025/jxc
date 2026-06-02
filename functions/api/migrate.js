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

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_name VARCHAR(100),
        action_type VARCHAR(100),
        message VARCHAR(255),
        payload JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Created audit_logs table");
  } catch(e) {
    console.log("audit_logs skip: " + e.message);
  }

  process.exit(0);
}

migrate();
