const { createConnection } = require('mysql2/promise');

function getDbConfig() {
  const config = {
    host: process.env.DB_HOST || process.env.MYSQL_HOST || process.env.TCB_MYSQL_HOST,
    port: process.env.DB_PORT || process.env.MYSQL_PORT || process.env.TCB_MYSQL_PORT || 3306,
    user: process.env.DB_USER || process.env.MYSQL_USERNAME,
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME
  };

  const missing = Object.entries(config)
    .filter(([key, value]) => key !== 'port' && !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required database environment variables: ${missing.join(', ')}`);
  }

  return config;
}

async function runStep(pool, label, sql) {
  try {
    await pool.query(sql);
    console.log(label);
  } catch (e) {
    console.log(`${label} skipped: ${e.message}`);
  }
}

async function migrate() {
  const pool = await createConnection(getDbConfig());

  await runStep(
    pool,
    'Added ext_order_no to purchase_orders',
    "ALTER TABLE purchase_orders ADD COLUMN ext_order_no VARCHAR(100) DEFAULT '' AFTER status;"
  );

  await runStep(
    pool,
    'Added ext_order_no to sales_orders',
    "ALTER TABLE sales_orders ADD COLUMN ext_order_no VARCHAR(100) DEFAULT '' AFTER payment_status;"
  );

  await runStep(
    pool,
    'Created audit_logs table',
    `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_name VARCHAR(100),
        action_type VARCHAR(100),
        message VARCHAR(255),
        payload JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  );

  await runStep(
    pool,
    'Created finance_ledgers table',
    `
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
    `
  );

  await runStep(
    pool,
    'Added paid_amount to purchase_orders',
    'ALTER TABLE purchase_orders ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_amount;'
  );

  await runStep(
    pool,
    'Added paid_amount to sales_orders',
    'ALTER TABLE sales_orders ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_amount;'
  );

  await pool.end();
}

migrate()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
