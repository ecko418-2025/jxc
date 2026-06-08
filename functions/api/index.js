// 云函数入口文件
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { getDbConfig } = require('./dbConfig');
const { authorizeAction, resolveOperator } = require('./permissions');
const {
  buildUpdateClause,
  CATEGORY_UPDATE_FIELDS,
  PRODUCT_UPDATE_FIELDS,
  SUPPLIER_UPDATE_FIELDS,
  CUSTOMER_UPDATE_FIELDS
} = require('./updateFields');

// 数据库连接池
let pool;
let currentOperator;

const orderStatusMap = {
  draft: '草稿',
  pending: '待处理',
  confirmed: '已确认',
  shipped: '已发货',
  received: '已入库',
  completed: '已完成',
  cancelled: '已取消'
};

const paymentStatusMap = {
  unpaid: '未付款',
  partial: '部分付款',
  paid: '已付款',
  refunded: '已退款'
};

async function logAudit(pool, action, payload) {
  if (!action || action.startsWith('get') || action === 'migrate' || action === 'getUserProfile' || action === 'getUserList') return;

  let message = `执行了操作: ${action}`;
  
  if (action === 'createSalesOrder') message = `提交了新的销售单号: ${payload.id}`;
  if (action === 'updateSalesOrder') message = `更新了销售单: ${payload.id}`;
  if (action === 'deleteSalesOrder') message = `删除了销售单: ${payload.id}`;
  if (action === 'confirmSalesShipment') message = `确认了销售单出库: ${payload.id}`;
  
  if (action === 'createPurchaseOrder') message = `提交了新的采购单号: ${payload.id}`;
  if (action === 'updatePurchaseOrder') message = `更新了采购单: ${payload.id}`;
  if (action === 'deletePurchaseOrder') message = `删除了采购单: ${payload.id}`;
  if (action === 'confirmPurchaseReceipt') message = `确认了某笔采购入库: ${payload.id}`;
  
  if (action === 'createProduct') message = `录入了新产品: ${payload.name || payload.id}`;
  if (action === 'updateProduct') message = `修改了产品信息: ${payload.id}`;
  if (action === 'deleteProduct') message = `删除了产品: ${payload.id}`;
  
  if (action === 'adjustInventoryStock') message = `调整了某个单品的库存: ${payload.productId} (变动 ${payload.newQty})`;
  
  if (action === 'createCategory') message = `创建了分类: ${payload.name}`;
  if (action === 'updateCategory') message = `更新了分类`;
  if (action === 'deleteCategory') message = `删除了分类`;
  
  if (action === 'createSupplier') message = `添加了供应商: ${payload.name}`;
  if (action === 'createCustomer') message = `添加了客户: ${payload.name}`;
  
  if (action === 'createFinanceLedger') {
    const isIncome = payload.type === 'income';
    message = `确认了一笔 ${payload.amount} 元的${isIncome ? '收款' : '付款'}`;
    if (payload.orderNo) message += ` (关联单据: ${payload.orderNo})`;
  }
  if (action === 'deleteFinanceLedger') {
    message = `删除了财务流水`;
    if (payload.amount) message += ` (${payload.amount}元)`;
    if (payload.orderNo) message += ` (关联单据: ${payload.orderNo})`;
    else if (payload.orderId) message += ` (关联单据: ${payload.orderId})`;
    else message += ` (流水ID: ${payload.id})`;
  }

  const user = (currentOperator && currentOperator.displayName) || '系统管理员';
  const operatorUid = (currentOperator && currentOperator.uid) || 'system';

  try {
    await pool.query(
      'INSERT INTO audit_logs (id, user_name, operator_uid, action_type, message, payload) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), user, operatorUid, action, message, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

exports.main = async (event, context) => {
  // 1. 初始化数据库连接池 (如果在热启动期间已有连接池，则复用)
  if (!pool) {
    pool = mysql.createPool(getDbConfig());
  }

  const { action, payload = {} } = event;
  
  if (!action) {
    return { code: 400, message: 'Missing action parameter' };
  }

  try {
    currentOperator = await resolveOperator(pool, event, context);
    const authError = authorizeAction(action, currentOperator);
    if (authError) {
      return { code: 403, message: authError };
    }

    switch (action) {
      // =============== Categories ===============
      case 'getCategories': {
        const [rows] = await pool.query('SELECT * FROM categories ORDER BY created_at DESC');
        await logAudit(pool, action, payload); return { code: 200, data: rows.map(r => ({ ...r, parentId: r.parent_id, createdAt: r.created_at })) };
      }
      case 'migrate': {

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
        } catch(e){}

        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
              uid VARCHAR(64) PRIMARY KEY,
              username VARCHAR(100) NOT NULL,
              display_name VARCHAR(100) NOT NULL,
              role VARCHAR(20) NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
          `);
        } catch(e){}

        try {
          await pool.query("ALTER TABLE audit_logs ADD COLUMN operator_uid VARCHAR(64) AFTER user_name;");
        } catch(e){}

        try {
          await pool.query("ALTER TABLE purchase_orders ADD COLUMN ext_order_no VARCHAR(100) DEFAULT '' AFTER status;");
        } catch(e){}
        try {
          await pool.query("ALTER TABLE sales_orders ADD COLUMN ext_order_no VARCHAR(100) DEFAULT '' AFTER payment_status;");
        } catch(e){}
        try {
          await pool.query("ALTER TABLE products ADD COLUMN image_url VARCHAR(500) DEFAULT '' AFTER min_stock;");
        } catch(e){}
        await logAudit(pool, action, payload); return { code: 200, message: 'Migrated' };
      }
      case 'createCategory': {
        const { code, name, parentId, description } = payload;
        const id = payload.id || crypto.randomUUID();
        await pool.query(
          'INSERT INTO categories (id, code, name, parent_id, description) VALUES (?, ?, ?, ?, ?)',
          [id, code, name, parentId || null, description || '']
        );
        await logAudit(pool, action, payload); return { code: 200, message: 'Success', data: { id } };
      }
      case 'updateCategory': {
        const { id } = payload;
        const { setClause, values } = buildUpdateClause(payload, CATEGORY_UPDATE_FIELDS);
        if (!setClause) {
          await logAudit(pool, action, payload); 
          return { code: 200 };
        }
        await pool.query(`UPDATE categories SET ${setClause} WHERE id = ?`, [...values, id]);
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }
      case 'deleteCategory': {
        await pool.query('DELETE FROM categories WHERE id = ?', [payload.id]);
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }

      // =============== Products ===============
      case 'getProducts': {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
        const products = rows.map(p => ({
          ...p,
          categoryId: p.category_id,
          purchasePrice: parseFloat(p.purchase_price),
          salePrice: parseFloat(p.sale_price),
          minStock: p.min_stock,
          imageUrl: p.image_url,
          active: p.active === 1,
          createdAt: p.created_at
        }));
        await logAudit(pool, action, payload); return { code: 200, data: products };
      }
      case 'createProduct': {
        const { sku, name, categoryId, unit, spec, brand, purchasePrice, salePrice, minStock, active, imageUrl } = payload;
        const id = payload.id || crypto.randomUUID();
        await pool.query(
          `INSERT INTO products 
          (id, sku, name, category_id, unit, spec, brand, purchase_price, sale_price, min_stock, active, image_url) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, sku, name, categoryId, unit, spec, brand, purchasePrice, salePrice, minStock, active ? 1 : 0, imageUrl || '']
        );
        await pool.query('INSERT IGNORE INTO inventory (product_id, current_qty) VALUES (?, 0)', [id]);
        await logAudit(pool, action, payload); return { code: 200, message: 'Success', data: { id } };
      }
      case 'bulkCreateProducts': {
        const { products } = payload;
        for (const p of products) {
          const id = p.id || crypto.randomUUID();
          await pool.query(
            `INSERT INTO products 
            (id, sku, name, category_id, unit, spec, brand, purchase_price, sale_price, min_stock, active, image_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, p.sku, p.name, p.categoryId, p.unit, p.spec, p.brand, p.purchasePrice, p.salePrice, p.minStock, p.active ? 1 : 0, p.imageUrl || '']
          );
          await pool.query('INSERT IGNORE INTO inventory (product_id, current_qty) VALUES (?, 0)', [id]);
        }
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }
      case 'updateProduct': {
        const { id } = payload;
        const { setClause, values } = buildUpdateClause(payload, PRODUCT_UPDATE_FIELDS);
        if (setClause) {
          await pool.query(`UPDATE products SET ${setClause} WHERE id = ?`, [...values, id]);
        }
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }
      case 'deleteProduct': {
        try {
          await pool.query('DELETE FROM products WHERE id = ?', [payload.id]);
          await logAudit(pool, action, payload); 
          return { code: 200, message: 'Success' };
        } catch (err) {
          if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            throw new Error('无法删除此产品，因为它已存在关联的采购单、销售单或库存记录。若不再使用，请【修改】产品状态为【停用】。');
          }
          throw err;
        }
      }

      // =============== Suppliers ===============
      case 'getSuppliers': {
        const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY created_at DESC');
        await logAudit(pool, action, payload); return { code: 200, data: rows.map(r => ({ ...r, bankAccount: r.bank_account, createdAt: r.created_at })) };
      }
      case 'createSupplier': {
        const { name, contact, phone, address, bankAccount, remark } = payload;
        const id = payload.id || crypto.randomUUID();
        await pool.query(
          'INSERT INTO suppliers (id, name, contact, phone, address, bank_account, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, name, contact, phone, address, bankAccount || '', remark || '']
        );
        await logAudit(pool, action, payload); return { code: 200, message: 'Success', data: { id } };
      }
      case 'updateSupplier': {
        const { id } = payload;
        const { setClause, values } = buildUpdateClause(payload, SUPPLIER_UPDATE_FIELDS);
        if (setClause) {
          await pool.query(`UPDATE suppliers SET ${setClause} WHERE id = ?`, [...values, id]);
        }
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }
      case 'deleteSupplier': {
        await pool.query('DELETE FROM suppliers WHERE id = ?', [payload.id]);
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }

      // =============== Customers ===============
      case 'getCustomers': {
        const [rows] = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
        await logAudit(pool, action, payload); return { code: 200, data: rows.map(r => ({ ...r, creditLimit: r.credit_limit ? parseFloat(r.credit_limit) : 0, createdAt: r.created_at })) };
      }
      case 'createCustomer': {
        const { name, contact, phone, address, level, creditLimit, remark } = payload;
        const id = payload.id || crypto.randomUUID();
        await pool.query(
          'INSERT INTO customers (id, name, contact, phone, address, level, credit_limit, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, name, contact, phone, address, level, creditLimit || 0, remark || '']
        );
        await logAudit(pool, action, payload); return { code: 200, message: 'Success', data: { id } };
      }
      case 'updateCustomer': {
        const { id } = payload;
        const { setClause, values } = buildUpdateClause(payload, CUSTOMER_UPDATE_FIELDS);
        if (setClause) {
          await pool.query(`UPDATE customers SET ${setClause} WHERE id = ?`, [...values, id]);
        }
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }
      case 'deleteCustomer': {
        await pool.query('DELETE FROM customers WHERE id = ?', [payload.id]);
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }

      // =============== Purchase Orders ===============
      case 'getPurchaseOrders': {
        const [orders] = await pool.query('SELECT * FROM purchase_orders ORDER BY created_at DESC');
        for (let order of orders) {
          const [items] = await pool.query('SELECT * FROM purchase_items WHERE order_id = ?', [order.id]);
          order.items = items.map(i => ({ ...i, productId: i.product_id, unitPrice: parseFloat(i.unit_price) }));
          order.supplierId = order.supplier_id;
          order.orderNo = order.order_no;
          order.orderDate = order.order_date;
          order.totalAmount = parseFloat(order.total_amount);
          order.paidAmount = parseFloat(order.paid_amount || 0);
          order.paymentStatus = order.payment_status;
          order.extOrderNo = order.ext_order_no;
          order.invoiceNo = order.invoice_no;
          order.createdAt = order.created_at;
        }
        await logAudit(pool, action, payload); return { code: 200, data: orders };
      }
      case 'createPurchaseOrder': {
        const { supplierId, orderDate, totalAmount, status, extOrderNo, invoiceNo, remark, items } = payload;
        const id = payload.id || crypto.randomUUID();
        const orderNo = 'PO' + Date.now();
        await pool.query(
          'INSERT INTO purchase_orders (id, order_no, supplier_id, order_date, total_amount, status, ext_order_no, invoice_no, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, orderNo, supplierId, orderDate, totalAmount, status, extOrderNo || '', invoiceNo || '', remark || '']
        );
        if (items && items.length > 0) {
          for (const item of items) {
            await pool.query(
              'INSERT INTO purchase_items (id, order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
              [crypto.randomUUID(), id, item.productId, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
            );
          }
        }
        await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'purchase', 'create', '创建了采购单', (currentOperator && currentOperator.uid) || 'system']);
        await logAudit(pool, action, payload); return { code: 200, message: 'Success', data: { id } };
      }
      case 'deletePurchaseOrder': {
        await pool.query('DELETE FROM purchase_items WHERE order_id = ?', [payload.id]);
        await pool.query('DELETE FROM purchase_orders WHERE id = ?', [payload.id]);
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }
      case 'updatePurchaseOrderInfo': {
        const { id, extOrderNo, invoiceNo, remark, operator } = payload;
        await pool.query('UPDATE purchase_orders SET ext_order_no = ?, invoice_no = ?, remark = ? WHERE id = ?', [extOrderNo, invoiceNo || '', remark, id]);
        await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'purchase', 'update_info', `修改了订单信息 (发票编号/对方单号/备注)`, (currentOperator && currentOperator.uid) || 'system']);
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }
      case 'updatePurchaseOrder': {
        if (payload.status) {
          await pool.query('UPDATE purchase_orders SET status = ? WHERE id = ?', [payload.status, payload.id]);
          await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), payload.id, 'purchase', 'update_status', `更新了采购单状态为: ${orderStatusMap[payload.status] || payload.status}`, (currentOperator && currentOperator.uid) || 'system']);
        }
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }
      case 'confirmPurchaseReceipt': {
        const { id, operator } = payload;
        
        // Check order status
        const [orders] = await pool.query('SELECT status FROM purchase_orders WHERE id = ?', [id]);
        if (!orders || orders.length === 0) return { code: 404, message: 'Order not found' };
        if (orders[0].status === 'received') return { code: 400, message: 'Order already received' };
        
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          
          // Update status
          await connection.query('UPDATE purchase_orders SET status = ? WHERE id = ?', ['received', id]);
          
          // Fetch items
          const [items] = await connection.query('SELECT product_id, quantity FROM purchase_items WHERE order_id = ?', [id]);
          
          // Update inventory and log
          for (const item of items) {
            const { product_id, quantity } = item;
            
            // Check current inventory
            const [invRows] = await connection.query('SELECT current_qty FROM inventory WHERE product_id = ?', [product_id]);
            const currentQty = invRows.length > 0 ? invRows[0].current_qty : 0;
            const newQty = currentQty + quantity;
            
            // Update inventory
            if (invRows.length > 0) {
              await connection.query('UPDATE inventory SET current_qty = ? WHERE product_id = ?', [newQty, product_id]);
            } else {
              await connection.query('INSERT INTO inventory (product_id, current_qty) VALUES (?, ?)', [product_id, newQty]);
            }
            
            // Insert log
            const logId = crypto.randomUUID();
            await connection.query(
              'INSERT INTO inventory_logs (id, product_id, type, quantity_change, balance, ref_type, ref_id, operator, _openid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [logId, product_id, 'in', quantity, newQty, 'purchase', id, (currentOperator && currentOperator.uid) || 'system', event.userInfo?.openId || '']
            );
          }
          
          await connection.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'purchase', 'update_status', '确认入库 (更新订单状态为: 已入库)', (currentOperator && currentOperator.uid) || 'system']);
          await connection.commit();
          await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
        } catch (e) {
          await connection.rollback();
          throw e;
        } finally {
          connection.release();
        }
      }

      // =============== Sales Orders ===============
      case 'getSalesOrders': {
        const [orders] = await pool.query('SELECT * FROM sales_orders ORDER BY created_at DESC');
        for (let order of orders) {
          const [items] = await pool.query('SELECT * FROM sales_items WHERE order_id = ?', [order.id]);
          order.items = items.map(i => ({ ...i, productId: i.product_id, unitPrice: parseFloat(i.unit_price) }));
          order.customerId = order.customer_id;
          order.orderNo = order.order_no;
          order.orderDate = order.order_date;
          order.totalAmount = parseFloat(order.total_amount);
          order.paidAmount = parseFloat(order.paid_amount || 0);
          order.paymentStatus = order.payment_status;
          order.extOrderNo = order.ext_order_no;
          order.invoiceNo = order.invoice_no;
          order.createdAt = order.created_at;
        }
        await logAudit(pool, action, payload); return { code: 200, data: orders };
      }
      case 'createSalesOrder': {
        const { customerId, orderDate, totalAmount, discount, status, paymentStatus, extOrderNo, invoiceNo, remark, items } = payload;
        const id = payload.id || crypto.randomUUID();
        const orderNo = 'SO' + Date.now();
        await pool.query(
          'INSERT INTO sales_orders (id, order_no, customer_id, order_date, total_amount, discount, status, payment_status, ext_order_no, invoice_no, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, orderNo, customerId, orderDate, totalAmount, discount || 0, status, paymentStatus, extOrderNo || '', invoiceNo || '', remark || '']
        );
        if (items && items.length > 0) {
          for (const item of items) {
            await pool.query(
              'INSERT INTO sales_items (id, order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
              [crypto.randomUUID(), id, item.productId, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
            );
          }
        }
        await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'sales', 'create', '创建了销售单', (currentOperator && currentOperator.uid) || 'system']);
        await logAudit(pool, action, payload); return { code: 200, message: 'Success', data: { id } };
      }
      case 'deleteSalesOrder': {
        await pool.query('DELETE FROM sales_items WHERE order_id = ?', [payload.id]);
        await pool.query('DELETE FROM sales_orders WHERE id = ?', [payload.id]);
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }
      case 'updateSalesOrderInfo': {
        const { id, extOrderNo, invoiceNo, remark, operator } = payload;
        await pool.query('UPDATE sales_orders SET ext_order_no = ?, invoice_no = ?, remark = ? WHERE id = ?', [extOrderNo, invoiceNo || '', remark, id]);
        await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'sales', 'update_info', `修改了订单信息 (发票编号/对方单号/备注)`, (currentOperator && currentOperator.uid) || 'system']);
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }
      case 'updateSalesOrder': {
        const { id, status, paymentStatus } = payload;
        const updates = [];
        const params = [];
        if (status) {
          updates.push('status = ?');
          params.push(status);
        }
        if (paymentStatus) {
          updates.push('payment_status = ?');
          params.push(paymentStatus);
        }
        if (updates.length > 0) {
          params.push(id);
          await pool.query(`UPDATE sales_orders SET ${updates.join(', ')} WHERE id = ?`, params);
          if (status) {
            await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'sales', 'update_status', `更新了订单状态为: ${orderStatusMap[status] || status}`, (currentOperator && currentOperator.uid) || 'system']);
          }
          if (paymentStatus) {
            await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'sales', 'update_payment', `更新了收款状态为: ${paymentStatusMap[paymentStatus] || paymentStatus}`, (currentOperator && currentOperator.uid) || 'system']);
          }
        }
        await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
      }
      case 'confirmSalesShipment': {
        const { id, operator } = payload;
        
        const [orders] = await pool.query('SELECT status FROM sales_orders WHERE id = ?', [id]);
        if (!orders || orders.length === 0) return { code: 404, message: 'Order not found' };
        if (orders[0].status === 'shipped' || orders[0].status === 'completed') return { code: 400, message: 'Order already shipped' };
        
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          
          const [items] = await connection.query('SELECT product_id, quantity FROM sales_items WHERE order_id = ?', [id]);
          
          // Verify inventory
          let insufficientItems = [];
          for (const item of items) {
            const [invRows] = await connection.query('SELECT current_qty FROM inventory WHERE product_id = ? FOR UPDATE', [item.product_id]);
            const currentQty = invRows.length > 0 ? invRows[0].current_qty : 0;
            if (currentQty < item.quantity) {
              const [prodRows] = await connection.query('SELECT name FROM products WHERE id = ?', [item.product_id]);
              const prodName = prodRows.length > 0 ? prodRows[0].name : item.product_id;
              insufficientItems.push(`- ${prodName} (需要: ${item.quantity}, 当前库存: ${currentQty})`);
            }
          }
          if (insufficientItems.length > 0) {
            throw new Error(`以下商品库存不足，无法发货:\n${insufficientItems.join('\n')}`);
          }
          
          await connection.query('UPDATE sales_orders SET status = ? WHERE id = ?', ['shipped', id]);
          
          for (const item of items) {
            const { product_id, quantity } = item;
            await connection.query('UPDATE inventory SET current_qty = current_qty - ? WHERE product_id = ?', [quantity, product_id]);
            const [invRows] = await connection.query('SELECT current_qty FROM inventory WHERE product_id = ?', [product_id]);
            const newQty = invRows[0].current_qty;
            
            const logId = crypto.randomUUID();
            await connection.query(
              'INSERT INTO inventory_logs (id, product_id, type, quantity_change, balance, ref_type, ref_id, operator, _openid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [logId, product_id, 'out', quantity, newQty, 'sales', id, (currentOperator && currentOperator.uid) || 'system', event.userInfo?.openId || '']
            );
          }
          
          await connection.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'sales', 'update_status', '确认出库 (更新订单状态为: 已发货)', (currentOperator && currentOperator.uid) || 'system']);
          await connection.commit();
          await logAudit(pool, action, payload); return { code: 200, message: 'Success' };
        } catch (e) {
          await connection.rollback();
          return { code: 400, message: e.message };
        } finally {
          connection.release();
        }
      }

      // =============== Inventory ===============
      case 'getInventory': {
        const [rows] = await pool.query('SELECT * FROM inventory');
        await logAudit(pool, action, payload); return { code: 200, data: rows.map(r => ({ productId: r.product_id, quantity: r.current_qty })) };
      }
      case 'getLowStockProducts': {
        const [rows] = await pool.query(`
          SELECT p.*, i.current_qty 
          FROM products p 
          LEFT JOIN inventory i ON p.id = i.product_id 
          WHERE i.current_qty <= p.min_stock AND p.active = 1
        `);
        const result = rows.map(r => ({
          product: { id: r.id, sku: r.sku, name: r.name, minStock: r.min_stock },
          inventory: { productId: r.id, quantity: r.current_qty }
        }));
        await logAudit(pool, action, payload); return { code: 200, data: result };
      }
      case 'getInventoryLogs': {
        const [rows] = await pool.query('SELECT * FROM inventory_logs ORDER BY created_at DESC LIMIT 500');
        await logAudit(pool, action, payload); return { code: 200, data: rows.map(r => ({ ...r, productId: r.product_id, quantity: r.quantity_change, createdAt: r.created_at })) };
      }
      case 'getInventoryLogsByProduct': {
        const { productId } = payload;
        const [rows] = await pool.query(`
          SELECT l.*, 
                 po.order_no as po_no, 
                 po.ext_order_no as po_ext_no,
                 sup.name as supplier_name,
                 pi.unit_price as purchase_price,
                 so.order_no as so_no,
                 so.ext_order_no as so_ext_no,
                 cus.name as customer_name,
                 si.unit_price as sale_price
          FROM inventory_logs l
          LEFT JOIN purchase_orders po ON l.ref_type = 'purchase' AND l.ref_id = po.id
          LEFT JOIN purchase_items pi ON pi.order_id = po.id AND pi.product_id = l.product_id
          LEFT JOIN suppliers sup ON po.supplier_id = sup.id
          LEFT JOIN sales_orders so ON l.ref_type = 'sales' AND l.ref_id = so.id
          LEFT JOIN sales_items si ON si.order_id = so.id AND si.product_id = l.product_id
          LEFT JOIN customers cus ON so.customer_id = cus.id
          WHERE l.product_id = ? 
          ORDER BY l.created_at DESC 
          LIMIT 100
        `, [productId]);
        return { 
          code: 200, 
          data: rows.map(r => {
            let remark = '';
            if (r.ref_type === 'adjust') remark = '人工调整';
            else if (r.ref_type === 'purchase') {
              remark = r.po_no ? `采购入库 (${r.po_no})` : '采购入库';
              if (r.po_ext_no) remark += ` - 对方单号: ${r.po_ext_no}`;
            }
            else if (r.ref_type === 'sales') {
              remark = r.so_no ? `销售出库 (${r.so_no})` : '销售出库';
              if (r.so_ext_no) remark += ` - 对方单号: ${r.so_ext_no}`;
            }

            return {
              id: r.id,
              productId: r.product_id, 
              type: r.type,
              quantity: r.quantity_change,
              balance: r.balance,
              operator: r.operator,
              createdAt: r.created_at,
              remark,
              poNo: r.po_no,
              poExtNo: r.po_ext_no,
              supplierName: r.supplier_name,
              purchasePrice: r.purchase_price,
              soNo: r.so_no,
              soExtNo: r.so_ext_no,
              customerName: r.customer_name,
              salePrice: r.sale_price
            };
          }) 
        };
      }
      case 'adjustInventoryStock': {
        if (!currentOperator || (currentOperator.role !== 'admin' && currentOperator.role !== 'warehouse')) {
          return { code: 403, message: 'Forbidden: Administrator or Warehouse keeper privileges required' };
        }
        const { productId, newQty, operator } = payload;
        
        // 获取当前库存
        const [invRows] = await pool.query('SELECT current_qty FROM inventory WHERE product_id = ?', [productId]);
        if (!invRows || invRows.length === 0) {
          return { code: 404, message: 'Inventory record not found' };
        }
        
        const currentQty = invRows[0].current_qty;
        const diff = newQty - currentQty;
        
        if (diff === 0) {
          await logAudit(pool, action, payload); return { code: 200, message: 'No change needed' };
        }
        
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          
          await connection.query('UPDATE inventory SET current_qty = ? WHERE product_id = ?', [newQty, productId]);
          
          const logId = crypto.randomUUID();
          await connection.query(
            'INSERT INTO inventory_logs (id, product_id, type, quantity_change, balance, ref_type, ref_id, operator, _openid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [logId, productId, 'adjust', diff, newQty, 'adjust', 'manual', (currentOperator && currentOperator.uid) || 'system', event.userInfo?.openId || '']
          );
          
          await connection.commit();
          await logAudit(pool, action, payload); return { code: 200, message: 'Stock adjusted successfully' };
        } catch (e) {
          await connection.rollback();
          throw e;
        } finally {
          connection.release();
        }
      }


      case 'getAuditLogs': {
        const [rows] = await pool.query("SELECT * FROM audit_logs WHERE action_type NOT LIKE 'get%' ORDER BY created_at DESC LIMIT 100");
        await logAudit(pool, action, payload); return { code: 200, data: rows };
      }

      case 'getOrderLogs': {
        const { orderId } = payload;
        const [logs] = await pool.query('SELECT * FROM order_logs WHERE order_id = ? ORDER BY created_at DESC', [orderId]);
        await logAudit(pool, action, payload); return { code: 200, data: logs };
      }

      case 'finance_migrate': {
        const connection = await pool.getConnection();
        try {
          await connection.query(`
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
          try { await connection.query("ALTER TABLE purchase_orders ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_amount;"); } catch(e){}
          try { await connection.query("ALTER TABLE purchase_orders ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending' AFTER status;"); } catch(e){}
          try { await connection.query("ALTER TABLE sales_orders ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_amount;"); } catch(e){}
          return { code: 200, message: 'Migration successful' };
        } finally {
          connection.release();
        }
      }

      case 'getFinanceLedgers': {
        const [rows] = await pool.query('SELECT * FROM finance_ledgers ORDER BY payment_date DESC, created_at DESC LIMIT 500');
        const mappedRows = rows.map(r => ({
          id: r.id,
          type: r.type,
          partyId: r.party_id,
          orderId: r.order_id,
          amount: r.amount,
          paymentMethod: r.payment_method,
          paymentDate: r.payment_date,
          remark: r.remark,
          createdBy: r.created_by,
          createdAt: r.created_at
        }));
        await logAudit(pool, action, payload); return { code: 200, data: mappedRows };
      }

      case 'createFinanceLedger': {
        const { type, partyId, orderId, amount, paymentMethod, paymentDate, remark, createdBy } = payload;
        if (currentOperator.role === 'sales' && type !== 'income') {
          return { code: 403, message: 'Forbidden: Sales can only create income ledgers' };
        }
        const id = crypto.randomUUID();
        
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();

          await connection.query(
            'INSERT INTO finance_ledgers (id, type, party_id, order_id, amount, payment_method, payment_date, remark, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, type, partyId, orderId || null, amount, paymentMethod, paymentDate, remark || '', createdBy]
          );

          if (orderId) {
            if (type === 'income') {
              const [so] = await connection.query('SELECT order_no FROM sales_orders WHERE id = ?', [orderId]);
              if (so.length) payload.orderNo = so[0].order_no;
              await connection.query('UPDATE sales_orders SET paid_amount = paid_amount + ? WHERE id = ?', [amount, orderId]);
              await connection.query(`
                UPDATE sales_orders 
                SET payment_status = CASE WHEN paid_amount >= total_amount THEN 'paid' ELSE 'partial' END
                WHERE id = ?
              `, [orderId]);
            } else if (type === 'expense') {
              const [po] = await connection.query('SELECT order_no FROM purchase_orders WHERE id = ?', [orderId]);
              if (po.length) payload.orderNo = po[0].order_no;
              await connection.query('UPDATE purchase_orders SET paid_amount = paid_amount + ? WHERE id = ?', [amount, orderId]);
              await connection.query(`
                UPDATE purchase_orders 
                SET payment_status = CASE WHEN paid_amount >= total_amount THEN 'paid' ELSE 'partial' END
                WHERE id = ?
              `, [orderId]);
            }
          }

          await connection.commit();
          await logAudit(pool, action, payload); return { code: 200, message: 'Finance ledger created' };
        } catch (e) {
          await connection.rollback();
          throw e;
        } finally {
          connection.release();
        }
      }

      case 'deleteFinanceLedger': {
        const { id } = payload;
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          
          const [ledgers] = await connection.query('SELECT * FROM finance_ledgers WHERE id = ?', [id]);
          if (ledgers.length === 0) throw new Error('Ledger not found');
          const ledger = ledgers[0];

          await connection.query('DELETE FROM finance_ledgers WHERE id = ?', [id]);

          payload.amount = ledger.amount;
          payload.orderId = ledger.order_id;
          if (ledger.order_id) {
            if (ledger.type === 'income') {
              const [so] = await connection.query('SELECT order_no FROM sales_orders WHERE id = ?', [ledger.order_id]);
              if (so.length) payload.orderNo = so[0].order_no;
              await connection.query('UPDATE sales_orders SET paid_amount = paid_amount - ? WHERE id = ?', [ledger.amount, ledger.order_id]);
              await connection.query(`
                UPDATE sales_orders 
                SET payment_status = CASE 
                  WHEN paid_amount <= 0 THEN 'pending' 
                  WHEN paid_amount >= total_amount THEN 'paid' 
                  ELSE 'partial' 
                END
                WHERE id = ?
              `, [ledger.order_id]);
            } else if (ledger.type === 'expense') {
              const [po] = await connection.query('SELECT order_no FROM purchase_orders WHERE id = ?', [ledger.order_id]);
              if (po.length) payload.orderNo = po[0].order_no;
              await connection.query('UPDATE purchase_orders SET paid_amount = paid_amount - ? WHERE id = ?', [ledger.amount, ledger.order_id]);
              await connection.query(`
                UPDATE purchase_orders 
                SET payment_status = CASE 
                  WHEN paid_amount <= 0 THEN 'pending' 
                  WHEN paid_amount >= total_amount THEN 'paid' 
                  ELSE 'partial' 
                END
                WHERE id = ?
              `, [ledger.order_id]);
            }
          }

          await connection.commit();
          await logAudit(pool, action, payload); return { code: 200, message: 'Finance ledger deleted' };
        } catch (e) {
          await connection.rollback();
          throw e;
        } finally {
          connection.release();
        }
      }

      case 'getUserProfile': {
        const { uid, username, displayName } = payload;
        if (!uid) return { code: 400, message: 'Missing uid' };

        // 1. Check if users table has any admins/users
        const [countRows] = await pool.query('SELECT COUNT(*) as count FROM users');
        const isFirstUser = countRows[0].count === 0;

        if (isFirstUser) {
          // Auto-insert first user as admin
          const name = displayName || username?.split('@')[0] || '管理员';
          await pool.query(
            'INSERT INTO users (uid, username, display_name, role) VALUES (?, ?, ?, ?)',
            [uid, username || 'admin', name, 'admin']
          );
          return { code: 200, data: { uid, username: username || 'admin', displayName: name, role: 'admin' } };
        }

        // 2. Fetch user profile
        const [rows] = await pool.query('SELECT * FROM users WHERE uid = ?', [uid]);
        if (rows.length > 0) {
          const user = rows[0];
          return { code: 200, data: { uid: user.uid, username: user.username, displayName: user.display_name, role: user.role } };
        }

        // 3. User does not exist, insert as pending
        const name = displayName || username?.split('@')[0] || '新成员';
        await pool.query(
          'INSERT INTO users (uid, username, display_name, role) VALUES (?, ?, ?, ?)',
          [uid, username || 'user', name, 'pending']
        );
        return { code: 200, data: { uid, username: username || 'user', displayName: name, role: 'pending' } };
      }

      case 'saveUserProfile': {
        // Admin only check
        if (!currentOperator || currentOperator.role !== 'admin') {
          return { code: 403, message: 'Forbidden: Administrator privileges required' };
        }
        const { uid, username, displayName, role } = payload;
        if (!uid || !displayName || !role) {
          return { code: 400, message: 'Missing required parameters: uid, displayName, role' };
        }

        const [rows] = await pool.query('SELECT uid FROM users WHERE uid = ?', [uid]);
        if (rows.length > 0) {
          await pool.query(
            'UPDATE users SET username = ?, display_name = ?, role = ? WHERE uid = ?',
            [username || 'user', displayName, role, uid]
          );
        } else {
          await pool.query(
            'INSERT INTO users (uid, username, display_name, role) VALUES (?, ?, ?, ?)',
            [uid, username || 'user', displayName, role]
          );
        }
        await logAudit(pool, action, payload);
        return { code: 200, message: 'User profile saved successfully' };
      }

      case 'getUserList': {
        // Allow any authorized user
        if (!currentOperator || currentOperator.role === 'pending') {
          return { code: 403, message: 'Forbidden: Unauthorized' };
        }
        const [rows] = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
        return { 
          code: 200, 
          data: rows.map(r => ({
            uid: r.uid,
            username: r.username,
            displayName: r.display_name,
            role: r.role,
            createdAt: r.created_at
          })) 
        };
      }

      case 'deleteUserProfile': {
        // Admin only check
        if (!currentOperator || currentOperator.role !== 'admin') {
          return { code: 403, message: 'Forbidden: Administrator privileges required' };
        }
        const { uid } = payload;
        if (!uid) return { code: 400, message: 'Missing uid' };

        await pool.query('DELETE FROM users WHERE uid = ?', [uid]);
        await logAudit(pool, action, payload);
        return { code: 200, message: 'User profile deleted successfully' };
      }

      default:
        return { code: 404, message: `Action not found: ${action}` };
    }
  } catch (error) {
    console.error(`[SQL Error in ${action}]:`, error);
    return { code: 500, message: error.message };
  }
};
