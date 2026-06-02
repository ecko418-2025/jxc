import { createConnection } from 'mysql2/promise';
async function clean() {
  const pool = await createConnection({
    host: '172.17.0.12',
    user: 'ecko',
    password: 'xiXI031985',
    database: 'cshj001-d7g5f1k0tc94d4181'
  });
  await pool.query("DELETE FROM audit_logs WHERE action_type LIKE 'get%'");
  console.log('Cleaned');
  process.exit(0);
}
clean();
