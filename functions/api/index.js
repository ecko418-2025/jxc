// 云函数入口文件
const mysql = require('mysql2/promise');
const crypto = require('crypto');

// 数据库连接池
let pool;

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

exports.main = async (event, context) => {
  // 1. 初始化数据库连接池 (如果在热启动期间已有连接池，则复用)
  if (!pool) {
    // 实际使用时，请将这些配置存放在云函数的环境变量中
    pool = mysql.createPool({
      // 兼容可能存在的默认环境变量
      host: process.env.DB_HOST || process.env.MYSQL_HOST || process.env.TCB_MYSQL_HOST || '127.0.0.1',
      port: process.env.DB_PORT || process.env.MYSQL_PORT || process.env.TCB_MYSQL_PORT || 3306,
      user: process.env.DB_USER || process.env.MYSQL_USERNAME || 'root',
      password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || 'password',
      database: process.env.DB_NAME || 'hotel_inventory',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+08:00',
      dateStrings: true
    });
  }

  const { action, payload } = event;
  
  if (!action) {
    return { code: 400, message: 'Missing action parameter' };
  }

  try {
    switch (action) {
      // =============== Categories ===============
      case 'getCategories': {
        const [rows] = await pool.query('SELECT * FROM categories ORDER BY created_at DESC');
        return { code: 200, data: rows.map(r => ({ ...r, parentId: r.parent_id })) };
      }
      case 'migrate': {
        try {
          await pool.query("ALTER TABLE purchase_orders ADD COLUMN ext_order_no VARCHAR(100) DEFAULT '' AFTER status;");
        } catch(e){}
        try {
          await pool.query("ALTER TABLE sales_orders ADD COLUMN ext_order_no VARCHAR(100) DEFAULT '' AFTER payment_status;");
        } catch(e){}
        return { code: 200, message: 'Migrated' };
      }
      case 'createCategory': {
        const { code, name, parentId, description } = payload;
        const id = payload.id || crypto.randomUUID();
        await pool.query(
          'INSERT INTO categories (id, code, name, parent_id, description) VALUES (?, ?, ?, ?, ?)',
          [id, code, name, parentId || null, description || '']
        );
        return { code: 200, message: 'Success', data: { id } };
      }
      case 'updateCategory': {
        const { id, ...updateFields } = payload;
        if (Object.keys(updateFields).length === 0) return { code: 200 };
        const setClause = Object.keys(updateFields).map(k => `${k.replace('parentId', 'parent_id')} = ?`).join(', ');
        const values = Object.values(updateFields);
        await pool.query(`UPDATE categories SET ${setClause} WHERE id = ?`, [...values, id]);
        return { code: 200, message: 'Success' };
      }
      case 'deleteCategory': {
        await pool.query('DELETE FROM categories WHERE id = ?', [payload.id]);
        return { code: 200, message: 'Success' };
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
          active: p.active === 1
        }));
        return { code: 200, data: products };
      }
      case 'createProduct': {
        const { sku, name, categoryId, unit, spec, brand, purchasePrice, salePrice, minStock, active } = payload;
        const id = payload.id || crypto.randomUUID();
        await pool.query(
          `INSERT INTO products 
          (id, sku, name, category_id, unit, spec, brand, purchase_price, sale_price, min_stock, active) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, sku, name, categoryId, unit, spec, brand, purchasePrice, salePrice, minStock, active ? 1 : 0]
        );
        await pool.query('INSERT IGNORE INTO inventory (product_id, current_qty) VALUES (?, 0)', [id]);
        return { code: 200, message: 'Success', data: { id } };
      }
      case 'bulkCreateProducts': {
        const { products } = payload;
        for (const p of products) {
          const id = p.id || crypto.randomUUID();
          await pool.query(
            `INSERT IGNORE INTO products 
            (id, sku, name, category_id, unit, spec, brand, purchase_price, sale_price, min_stock, active) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, p.sku, p.name, p.categoryId, p.unit, p.spec, p.brand, p.purchasePrice, p.salePrice, p.minStock, p.active ? 1 : 0]
          );
          await pool.query('INSERT IGNORE INTO inventory (product_id, current_qty) VALUES (?, 0)', [id]);
        }
        return { code: 200, message: 'Success' };
      }
      case 'updateProduct': {
        const { id, ...rest } = payload;
        const updateFields = { ...rest };
        if (updateFields.categoryId) { updateFields.category_id = updateFields.categoryId; delete updateFields.categoryId; }
        if (updateFields.purchasePrice !== undefined) { updateFields.purchase_price = updateFields.purchasePrice; delete updateFields.purchasePrice; }
        if (updateFields.salePrice !== undefined) { updateFields.sale_price = updateFields.salePrice; delete updateFields.salePrice; }
        if (updateFields.minStock !== undefined) { updateFields.min_stock = updateFields.minStock; delete updateFields.minStock; }

        if (Object.keys(updateFields).length > 0) {
          const setClause = Object.keys(updateFields).map(k => `${k} = ?`).join(', ');
          const values = Object.values(updateFields);
          await pool.query(`UPDATE products SET ${setClause} WHERE id = ?`, [...values, id]);
        }
        return { code: 200, message: 'Success' };
      }
      case 'deleteProduct': {
        await pool.query('DELETE FROM products WHERE id = ?', [payload.id]);
        return { code: 200, message: 'Success' };
      }

      // =============== Suppliers ===============
      case 'getSuppliers': {
        const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY created_at DESC');
        return { code: 200, data: rows.map(r => ({ ...r, bankAccount: r.bank_account })) };
      }
      case 'createSupplier': {
        const { name, contact, phone, address, bankAccount, remark } = payload;
        const id = payload.id || crypto.randomUUID();
        await pool.query(
          'INSERT INTO suppliers (id, name, contact, phone, address, bank_account, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, name, contact, phone, address, bankAccount || '', remark || '']
        );
        return { code: 200, message: 'Success', data: { id } };
      }
      case 'updateSupplier': {
        const { id, ...rest } = payload;
        const updateFields = { ...rest };
        if (updateFields.bankAccount !== undefined) { updateFields.bank_account = updateFields.bankAccount; delete updateFields.bankAccount; }
        if (Object.keys(updateFields).length > 0) {
          const setClause = Object.keys(updateFields).map(k => `${k} = ?`).join(', ');
          const values = Object.values(updateFields);
          await pool.query(`UPDATE suppliers SET ${setClause} WHERE id = ?`, [...values, id]);
        }
        return { code: 200, message: 'Success' };
      }
      case 'deleteSupplier': {
        await pool.query('DELETE FROM suppliers WHERE id = ?', [payload.id]);
        return { code: 200, message: 'Success' };
      }

      // =============== Customers ===============
      case 'getCustomers': {
        const [rows] = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
        return { code: 200, data: rows.map(r => ({ ...r, creditLimit: r.credit_limit ? parseFloat(r.credit_limit) : 0 })) };
      }
      case 'createCustomer': {
        const { name, contact, phone, address, level, creditLimit, remark } = payload;
        const id = payload.id || crypto.randomUUID();
        await pool.query(
          'INSERT INTO customers (id, name, contact, phone, address, level, credit_limit, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, name, contact, phone, address, level, creditLimit || 0, remark || '']
        );
        return { code: 200, message: 'Success', data: { id } };
      }
      case 'updateCustomer': {
        const { id, ...rest } = payload;
        const updateFields = { ...rest };
        if (updateFields.creditLimit !== undefined) { updateFields.credit_limit = updateFields.creditLimit; delete updateFields.creditLimit; }
        if (Object.keys(updateFields).length > 0) {
          const setClause = Object.keys(updateFields).map(k => `${k} = ?`).join(', ');
          const values = Object.values(updateFields);
          await pool.query(`UPDATE customers SET ${setClause} WHERE id = ?`, [...values, id]);
        }
        return { code: 200, message: 'Success' };
      }
      case 'deleteCustomer': {
        await pool.query('DELETE FROM customers WHERE id = ?', [payload.id]);
        return { code: 200, message: 'Success' };
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
          order.extOrderNo = order.ext_order_no;
        }
        return { code: 200, data: orders };
      }
      case 'createPurchaseOrder': {
        const { supplierId, orderDate, totalAmount, status, extOrderNo, remark, items } = payload;
        const id = payload.id || crypto.randomUUID();
        const orderNo = 'PO' + Date.now();
        await pool.query(
          'INSERT INTO purchase_orders (id, order_no, supplier_id, order_date, total_amount, status, ext_order_no, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, orderNo, supplierId, orderDate, totalAmount, status, extOrderNo || '', remark || '']
        );
        if (items && items.length > 0) {
          for (const item of items) {
            await pool.query(
              'INSERT INTO purchase_items (id, order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
              [crypto.randomUUID(), id, item.productId, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
            );
          }
        }
        await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'purchase', 'create', '创建了采购单', payload.operator || '系统']);
        return { code: 200, message: 'Success', data: { id } };
      }
      case 'deletePurchaseOrder': {
        await pool.query('DELETE FROM purchase_items WHERE order_id = ?', [payload.id]);
        await pool.query('DELETE FROM purchase_orders WHERE id = ?', [payload.id]);
        return { code: 200, message: 'Success' };
      }
      case 'updatePurchaseOrderInfo': {
        const { id, extOrderNo, remark, operator } = payload;
        await pool.query('UPDATE purchase_orders SET ext_order_no = ?, remark = ? WHERE id = ?', [extOrderNo, remark, id]);
        await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'purchase', 'update_info', `修改了订单信息 (对方单号/备注)`, operator || '系统']);
        return { code: 200, message: 'Success' };
      }
      case 'updatePurchaseOrder': {
        if (payload.status) {
          await pool.query('UPDATE purchase_orders SET status = ? WHERE id = ?', [payload.status, payload.id]);
          await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), payload.id, 'purchase', 'update_status', `更新了采购单状态为: ${orderStatusMap[payload.status] || payload.status}`, payload.operator || '系统']);
        }
        return { code: 200, message: 'Success' };
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
              [logId, product_id, 'in', quantity, newQty, 'purchase', id, operator || '系统', event.userInfo?.openId || '']
            );
          }
          
          await connection.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'purchase', 'update_status', '确认入库 (更新订单状态为: 已入库)', operator || '系统']);
          await connection.commit();
          return { code: 200, message: 'Success' };
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
          order.paymentStatus = order.payment_status;
          order.extOrderNo = order.ext_order_no;
        }
        return { code: 200, data: orders };
      }
      case 'createSalesOrder': {
        const { customerId, orderDate, totalAmount, discount, status, paymentStatus, extOrderNo, remark, items } = payload;
        const id = payload.id || crypto.randomUUID();
        const orderNo = 'SO' + Date.now();
        await pool.query(
          'INSERT INTO sales_orders (id, order_no, customer_id, order_date, total_amount, discount, status, payment_status, ext_order_no, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, orderNo, customerId, orderDate, totalAmount, discount || 0, status, paymentStatus, extOrderNo || '', remark || '']
        );
        if (items && items.length > 0) {
          for (const item of items) {
            await pool.query(
              'INSERT INTO sales_items (id, order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
              [crypto.randomUUID(), id, item.productId, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
            );
          }
        }
        await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'sales', 'create', '创建了销售单', payload.operator || '系统']);
        return { code: 200, message: 'Success', data: { id } };
      }
      case 'deleteSalesOrder': {
        await pool.query('DELETE FROM sales_items WHERE order_id = ?', [payload.id]);
        await pool.query('DELETE FROM sales_orders WHERE id = ?', [payload.id]);
        return { code: 200, message: 'Success' };
      }
      case 'updateSalesOrderInfo': {
        const { id, extOrderNo, remark, operator } = payload;
        await pool.query('UPDATE sales_orders SET ext_order_no = ?, remark = ? WHERE id = ?', [extOrderNo, remark, id]);
        await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'sales', 'update_info', `修改了订单信息 (对方单号/备注)`, operator || '系统']);
        return { code: 200, message: 'Success' };
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
            await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'sales', 'update_status', `更新了订单状态为: ${orderStatusMap[status] || status}`, payload.operator || '系统']);
          }
          if (paymentStatus) {
            await pool.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'sales', 'update_payment', `更新了收款状态为: ${paymentStatusMap[paymentStatus] || paymentStatus}`, payload.operator || '系统']);
          }
        }
        return { code: 200, message: 'Success' };
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
              [logId, product_id, 'out', quantity, newQty, 'sales', id, operator || '系统', event.userInfo?.openId || '']
            );
          }
          
          await connection.query('INSERT INTO order_logs (id, order_id, order_type, action, detail, operator) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, 'sales', 'update_status', '确认出库 (更新订单状态为: 已发货)', operator || '系统']);
          await connection.commit();
          return { code: 200, message: 'Success' };
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
        return { code: 200, data: rows.map(r => ({ productId: r.product_id, quantity: r.current_qty })) };
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
        return { code: 200, data: result };
      }
      case 'getInventoryLogs': {
        const [rows] = await pool.query('SELECT * FROM inventory_logs ORDER BY created_at DESC LIMIT 500');
        return { code: 200, data: rows.map(r => ({ ...r, productId: r.product_id, quantity: r.quantity_change })) };
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
        const { productId, newQty, operator } = payload;
        
        // 获取当前库存
        const [invRows] = await pool.query('SELECT current_qty FROM inventory WHERE product_id = ?', [productId]);
        if (!invRows || invRows.length === 0) {
          return { code: 404, message: 'Inventory record not found' };
        }
        
        const currentQty = invRows[0].current_qty;
        const diff = newQty - currentQty;
        
        if (diff === 0) {
          return { code: 200, message: 'No change needed' };
        }
        
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          
          await connection.query('UPDATE inventory SET current_qty = ? WHERE product_id = ?', [newQty, productId]);
          
          const logId = crypto.randomUUID();
          await connection.query(
            'INSERT INTO inventory_logs (id, product_id, type, quantity_change, balance, ref_type, ref_id, operator, _openid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [logId, productId, 'adjust', diff, newQty, 'adjust', 'manual', operator || '系统', event.userInfo?.openId || '']
          );
          
          await connection.commit();
          return { code: 200, message: 'Stock adjusted successfully' };
        } catch (e) {
          await connection.rollback();
          throw e;
        } finally {
          connection.release();
        }
      }

      case 'getOrderLogs': {
        const { orderId } = payload;
        const [logs] = await pool.query('SELECT * FROM order_logs WHERE order_id = ? ORDER BY created_at DESC', [orderId]);
        return { code: 200, data: logs };
      }

      default:
        return { code: 404, message: `Action not found: ${action}` };
    }
  } catch (error) {
    console.error(`[SQL Error in ${action}]:`, error);
    return { code: 500, message: error.message };
  }
};
