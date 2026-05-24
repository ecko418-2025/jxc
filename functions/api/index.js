// 云函数入口文件
const mysql = require('mysql2/promise');

// 数据库连接池
let pool;

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
      queueLimit: 0
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
      case 'createCategory': {
        const { id, code, name, parentId, description } = payload;
        await pool.query(
          'INSERT INTO categories (id, code, name, parent_id, description) VALUES (?, ?, ?, ?, ?)',
          [id, code, name, parentId || null, description || '']
        );
        return { code: 200, message: 'Success' };
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
        const { id, sku, name, categoryId, unit, spec, brand, purchasePrice, salePrice, minStock, active } = payload;
        await pool.query(
          `INSERT INTO products 
          (id, sku, name, category_id, unit, spec, brand, purchase_price, sale_price, min_stock, active) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, sku, name, categoryId, unit, spec, brand, purchasePrice, salePrice, minStock, active ? 1 : 0]
        );
        await pool.query('INSERT IGNORE INTO inventory (product_id, current_qty) VALUES (?, 0)', [id]);
        return { code: 200, message: 'Success' };
      }
      case 'bulkCreateProducts': {
        const { products } = payload;
        for (const p of products) {
          await pool.query(
            `INSERT IGNORE INTO products 
            (id, sku, name, category_id, unit, spec, brand, purchase_price, sale_price, min_stock, active) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.id, p.sku, p.name, p.categoryId, p.unit, p.spec, p.brand, p.purchasePrice, p.salePrice, p.minStock, p.active ? 1 : 0]
          );
          await pool.query('INSERT IGNORE INTO inventory (product_id, current_qty) VALUES (?, 0)', [p.id]);
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
        const { id, name, contact, phone, address, bankAccount, remark } = payload;
        await pool.query(
          'INSERT INTO suppliers (id, name, contact, phone, address, bank_account, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, name, contact, phone, address, bankAccount || '', remark || '']
        );
        return { code: 200, message: 'Success' };
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
        const { id, name, contact, phone, address, level, creditLimit, remark } = payload;
        await pool.query(
          'INSERT INTO customers (id, name, contact, phone, address, level, credit_limit, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, name, contact, phone, address, level, creditLimit || 0, remark || '']
        );
        return { code: 200, message: 'Success' };
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
        }
        return { code: 200, data: orders };
      }
      case 'createPurchaseOrder': {
        const { id, supplierId, orderDate, totalAmount, status, remark, items } = payload;
        const orderNo = 'PO' + Date.now();
        await pool.query(
          'INSERT INTO purchase_orders (id, order_no, supplier_id, order_date, total_amount, status, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, orderNo, supplierId, orderDate, totalAmount, status, remark || '']
        );
        if (items && items.length > 0) {
          for (const item of items) {
            await pool.query(
              'INSERT INTO purchase_items (id, order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
              [Math.random().toString(36).substr(2, 9), id, item.productId, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
            );
          }
        }
        return { code: 200, message: 'Success' };
      }
      case 'deletePurchaseOrder': {
        await pool.query('DELETE FROM purchase_items WHERE order_id = ?', [payload.id]);
        await pool.query('DELETE FROM purchase_orders WHERE id = ?', [payload.id]);
        return { code: 200, message: 'Success' };
      }
      case 'updatePurchaseOrder': {
        if (payload.status) {
          await pool.query('UPDATE purchase_orders SET status = ? WHERE id = ?', [payload.status, payload.id]);
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
            const logId = Math.random().toString(36).substring(2, 11);
            await connection.query(
              'INSERT INTO inventory_logs (id, product_id, type, quantity_change, balance, ref_type, ref_id, operator, _openid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [logId, product_id, 'in', quantity, newQty, 'purchase', id, operator || 'system', event.userInfo?.openId || '']
            );
          }
          
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
        }
        return { code: 200, data: orders };
      }
      case 'createSalesOrder': {
        const { id, customerId, orderDate, totalAmount, discount, status, paymentStatus, remark, items } = payload;
        const orderNo = 'SO' + Date.now();
        await pool.query(
          'INSERT INTO sales_orders (id, order_no, customer_id, order_date, total_amount, discount, status, payment_status, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, orderNo, customerId, orderDate, totalAmount, discount || 0, status, paymentStatus, remark || '']
        );
        if (items && items.length > 0) {
          for (const item of items) {
            await pool.query(
              'INSERT INTO sales_items (id, order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
              [Math.random().toString(36).substr(2, 9), id, item.productId, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
            );
          }
        }
        return { code: 200, message: 'Success' };
      }
      case 'deleteSalesOrder': {
        await pool.query('DELETE FROM sales_items WHERE order_id = ?', [payload.id]);
        await pool.query('DELETE FROM sales_orders WHERE id = ?', [payload.id]);
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
          for (const item of items) {
            const [invRows] = await connection.query('SELECT current_qty FROM inventory WHERE product_id = ? FOR UPDATE', [item.product_id]);
            const currentQty = invRows.length > 0 ? invRows[0].current_qty : 0;
            if (currentQty < item.quantity) {
              throw new Error(`Insufficient stock for product ID: ${item.product_id}`);
            }
          }
          
          await connection.query('UPDATE sales_orders SET status = ? WHERE id = ?', ['shipped', id]);
          
          for (const item of items) {
            const { product_id, quantity } = item;
            await connection.query('UPDATE inventory SET current_qty = current_qty - ? WHERE product_id = ?', [quantity, product_id]);
            const [invRows] = await connection.query('SELECT current_qty FROM inventory WHERE product_id = ?', [product_id]);
            const newQty = invRows[0].current_qty;
            
            const logId = Math.random().toString(36).substring(2, 11);
            await connection.query(
              'INSERT INTO inventory_logs (id, product_id, type, quantity_change, balance, ref_type, ref_id, operator, _openid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [logId, product_id, 'out', quantity, newQty, 'sales', id, operator || 'system', event.userInfo?.openId || '']
            );
          }
          
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
          WHERE i.current_qty <= p.min_stock
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
        const [rows] = await pool.query('SELECT * FROM inventory_logs WHERE product_id = ? ORDER BY created_at DESC LIMIT 100', [productId]);
        return { 
          code: 200, 
          data: rows.map(r => ({ 
            id: r.id,
            productId: r.product_id, 
            type: r.type,
            quantity: r.quantity_change,
            balance: r.balance,
            operator: r.operator,
            createdAt: r.created_at,
            remark: r.ref_type === 'adjust' ? '人工调整' : (r.ref_type === 'purchase' ? '采购入库' : '销售出库')
          })) 
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
          
          const logId = Math.random().toString(36).substring(2, 11);
          await connection.query(
            'INSERT INTO inventory_logs (id, product_id, type, quantity_change, balance, ref_type, ref_id, operator, _openid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [logId, productId, 'adjust', diff, newQty, 'adjust', 'manual', operator || 'system', event.userInfo?.openId || '']
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

      default:
        return { code: 404, message: `Action not found: ${action}` };
    }
  } catch (error) {
    console.error(`[SQL Error in ${action}]:`, error);
    return { code: 500, message: error.message };
  }
};
