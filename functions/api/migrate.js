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

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS finance_ledgers (
        id VARCHAR(36) PRIMARY KEY,
        type VARCHAR(20),
        party_id VARCHAR(36),
        order_id VARCHAR(36),
        amount DECIMAL(10,2) DEFAULT 0.00,
        payment_method VARCHAR(50),
        payment_date DATETIME,
        remark VARCHAR(255),
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Created finance_ledgers table");
  } catch(e) {
    console.log("finance_ledgers skip: " + e.message);
  }

  try {
    await pool.query("ALTER TABLE purchase_orders ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_amount;");
    console.log("Added paid_amount to purchase_orders");
  } catch(e) {
    console.log("purchase_orders paid_amount skip: " + e.message);
  }

  try {
    await pool.query("ALTER TABLE sales_orders ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_amount;");
    console.log("Added paid_amount to sales_orders");
  } catch(e) {
    console.log("sales_orders paid_amount skip: " + e.message);
  }

  process.exit(0);
}

migrate();
