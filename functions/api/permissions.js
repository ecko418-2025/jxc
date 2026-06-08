const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
});

const READ_ACTIONS = new Set([
  'getCategories',
  'getProducts',
  'getSuppliers',
  'getCustomers',
  'getPurchaseOrders',
  'getSalesOrders',
  'getInventory',
  'getLowStockProducts',
  'getInventoryLogs',
  'getInventoryLogsByProduct',
  'getOrderLogs',
  'getFinanceLedgers',
  'getUserList'
]);

const ROLE_ACTIONS = {
  admin: '*',
  sales: new Set([
    'createCategory',
    'updateCategory',
    'deleteCategory',
    'createProduct',
    'bulkCreateProducts',
    'updateProduct',
    'deleteProduct',
    'createSupplier',
    'updateSupplier',
    'deleteSupplier',
    'createCustomer',
    'updateCustomer',
    'deleteCustomer',
    'createPurchaseOrder',
    'updatePurchaseOrder',
    'updatePurchaseOrderInfo',
    'deletePurchaseOrder',
    'createSalesOrder',
    'updateSalesOrder',
    'updateSalesOrderInfo',
    'deleteSalesOrder',
    'createFinanceLedger'
  ]),
  warehouse: new Set([
    'createPurchaseOrder',
    'updatePurchaseOrder',
    'updatePurchaseOrderInfo',
    'deletePurchaseOrder',
    'confirmPurchaseReceipt',
    'confirmSalesShipment',
    'adjustInventoryStock'
  ]),
  finance: new Set([
    'createFinanceLedger',
    'deleteFinanceLedger'
  ])
};

function getServerUserInfo() {
  try {
    return app.auth().getUserInfo() || {};
  } catch (err) {
    return {};
  }
}

async function resolveOperator(pool, event, context) {
  const clientOperator = event.operator || {};
  const serverUser = getServerUserInfo();
  const trustedUid = serverUser.uid || event.userInfo?.uid || context?.uid || '';
  const uid = trustedUid || clientOperator.uid || event.userInfo?.openId || context?.OPENID || '';

  if (!uid) return null;

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE uid = ?', [uid]);
    if (rows.length > 0) {
      const user = rows[0];
      return {
        uid: user.uid,
        username: user.username,
        displayName: user.display_name,
        role: user.role
      };
    }
  } catch (err) {
    if (event.action !== 'migrate' && event.action !== 'getUserProfile') {
      throw err;
    }
  }

  return {
    uid,
    username: clientOperator.username || 'user',
    displayName: clientOperator.displayName || '未知账户',
    role: 'pending'
  };
}

function authorizeAction(action, operator) {
  if (action === 'getUserProfile') return null;
  if (action === 'migrate') {
    return operator ? null : 'Authentication required';
  }

  if (!operator || operator.role === 'pending') {
    return 'Forbidden: Unauthorized';
  }

  if (operator.role === 'admin') return null;
  if (action === 'getAuditLogs' || action === 'finance_migrate') {
    return 'Forbidden: Administrator privileges required';
  }
  if (READ_ACTIONS.has(action)) return null;

  const allowed = ROLE_ACTIONS[operator.role];
  if (allowed === '*' || allowed?.has(action)) return null;

  return 'Forbidden: Insufficient privileges';
}

module.exports = {
  authorizeAction,
  resolveOperator
};
