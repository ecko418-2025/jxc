const tcb = require('@cloudbase/node-sdk');

const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV
});
const db = app.database();

exports.main = async (event, context) => {
  const collections = [
    'categories', 'products', 'suppliers', 'customers', 
    'purchaseOrders', 'salesOrders', 'inventory', 
    'inventoryLogs', 'counters'
  ];
  const results = [];
  
  for (const col of collections) {
    try {
      await db.createCollection(col);
      results.push(`Created collection: ${col}`);
    } catch (e) {
      if (e.message && e.message.includes('Exist')) {
        results.push(`Collection already exists: ${col}`);
      } else {
        results.push(`Error creating ${col}: ${e.message}`);
      }
    }
  }
  
  return {
    success: true,
    results
  };
};
