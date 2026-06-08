function getDbConfig() {
  const config = {
    host: process.env.DB_HOST || process.env.MYSQL_HOST || process.env.TCB_MYSQL_HOST,
    port: process.env.DB_PORT || process.env.MYSQL_PORT || process.env.TCB_MYSQL_PORT || 3306,
    user: process.env.DB_USER || process.env.MYSQL_USERNAME,
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+08:00',
    dateStrings: true
  };

  const optionalKeys = new Set([
    'port',
    'waitForConnections',
    'connectionLimit',
    'queueLimit',
    'timezone',
    'dateStrings'
  ]);

  const missing = Object.entries(config)
    .filter(([key, value]) => !optionalKeys.has(key) && !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required database environment variables: ${missing.join(', ')}`);
  }

  return config;
}

module.exports = {
  getDbConfig
};
