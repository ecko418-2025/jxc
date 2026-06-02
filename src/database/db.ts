// ========================================
// CloudBase SQL 数据库操作层 (异步 API 架构)
// ========================================

import cloudbase from '@cloudbase/js-sdk';
import type { 
  Category, Product, Supplier, Customer, 
  PurchaseOrder, SalesOrder, InventoryRecord, InventoryLog,
  FinanceLedger 
} from './types';

// ========================
// CloudBase 初始化
// ========================
const app = cloudbase.init({
  env: 'cshj001-d7g5f1k0tc94d4181', // 腾讯云环境 ID
});
export const tcbApp = app;
export const auth = app.auth({ persistence: 'local' });

// ========================
// 统一 API 请求封装
// ========================
export let isCloudDbReady = false;

export const getCurrentUser = (): string => {
  if (!auth.currentUser) return 'system';
  return auth.currentUser.uid || 'system';
};

// 应用启动时自动触发后端数据库升级迁移
export const initCloudBase = async () => {
  isCloudDbReady = true;
  console.log('✅ CloudBase SQL API Ready');
  try {
    await callApi('migrate');
    console.log('✅ MySQL Database Schema Migrations Completed');
  } catch (e) {
    console.error('❌ Migration failed:', e);
  }
};

/**
 * 统一调用后端 api 云函数
 */
async function callApi(action: string, payload: any = {}): Promise<any> {
  try {
    const currentUser = auth.currentUser;
    const role = localStorage.getItem('user_role') || 'pending';
    const operator = currentUser ? {
      uid: currentUser.uid,
      displayName: currentUser.displayName || currentUser.email?.split('@')[0] || '未知账户',
      role
    } : undefined;

    const res = await app.callFunction({
      name: 'api',
      data: { action, payload, operator }
    });
    
    // 云函数返回结构通常是 res.result
    const result = res.result || {};
    if (result.code !== 200) {
      throw new Error(result.message || 'API Error');
    }
    return result;
  } catch (error) {
    console.error(`[API Error] ${action}:`, error);
    throw error;
  }
}



// ========================
// Categories
// ========================
export const categoryDB = {
  async getAll(): Promise<Category[]> {
    const res = await callApi('getCategories');
    return res.data || [];
  },
  async create(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await callApi('createCategory', { ...data });
  },
  async update(id: string, data: Partial<Category>): Promise<void> {
    await callApi('updateCategory', { ...data, id });
  },
  async delete(id: string): Promise<void> {
    await callApi('deleteCategory', { id });
  },
};

// ========================
// Products
// ========================
export const productDB = {
  async getAll(): Promise<Product[]> {
    const res = await callApi('getProducts');
    return res.data || [];
  },
  async create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await callApi('createProduct', { ...data });
  },
  async update(id: string, data: Partial<Product>): Promise<void> {
    await callApi('updateProduct', { ...data, id });
  },
  async delete(id: string): Promise<void> {
    await callApi('deleteProduct', { id });
  },
  async bulkCreate(itemsData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    const payload = itemsData;
    await callApi('bulkCreateProducts', { products: payload });
  },
};

// ========================
// Suppliers & Customers
// ========================
export const supplierDB = {
  async getAll(): Promise<Supplier[]> {
    const res = await callApi('getSuppliers');
    return res.data || [];
  },
  async create(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await callApi('createSupplier', { ...data });
  },
  async update(id: string, data: Partial<Supplier>): Promise<void> {
    await callApi('updateSupplier', { ...data, id });
  },
  async delete(id: string): Promise<void> {
    await callApi('deleteSupplier', { id });
  },
};

export const customerDB = {
  async getAll(): Promise<Customer[]> {
    const res = await callApi('getCustomers');
    return res.data || [];
  },
  async create(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await callApi('createCustomer', { ...data });
  },
  async update(id: string, data: Partial<Customer>): Promise<void> {
    await callApi('updateCustomer', { ...data, id });
  },
  async delete(id: string): Promise<void> {
    await callApi('deleteCustomer', { id });
  },
};

// ========================
// Purchase Orders
// ========================
export const purchaseOrderDB = {
  async getAll(): Promise<PurchaseOrder[]> {
    const res = await callApi('getPurchaseOrders');
    return res.data || [];
  },
  async create(data: Omit<PurchaseOrder, 'id' | 'orderNo' | 'createdAt' | 'updatedAt'> & { operator?: string }): Promise<void> {
    await callApi('createPurchaseOrder', { ...data });
  },
  async update(id: string, data: Partial<PurchaseOrder>): Promise<void> {
    await callApi('updatePurchaseOrder', { ...data, id });
  },
  async updateInfo(id: string, extOrderNo: string, invoiceNo: string, remark: string, operator: string): Promise<void> {
    await callApi('updatePurchaseOrderInfo', { id, extOrderNo, invoiceNo, remark, operator });
  },
  async delete(id: string): Promise<void> {
    await callApi('deletePurchaseOrder', { id });
  },
  async confirmReceipt(id: string, operator: string): Promise<void> {
    await callApi('confirmPurchaseReceipt', { id, operator });
  },
  async getLogs(orderId: string): Promise<any[]> {
    const res = await callApi('getOrderLogs', { orderId });
    return res.data || [];
  }
};

// ========================
// Sales Orders
// ========================
export const salesOrderDB = {
  async getAll(): Promise<SalesOrder[]> {
    const res = await callApi('getSalesOrders');
    return res.data || [];
  },
  async create(data: Omit<SalesOrder, 'id' | 'orderNo' | 'createdAt' | 'updatedAt'> & { operator?: string }): Promise<void> {
    await callApi('createSalesOrder', { ...data });
  },
  async update(id: string, data: Partial<SalesOrder>): Promise<void> {
    await callApi('updateSalesOrder', { ...data, id });
  },
  async updateInfo(id: string, extOrderNo: string, invoiceNo: string, remark: string, operator: string): Promise<void> {
    await callApi('updateSalesOrderInfo', { id, extOrderNo, invoiceNo, remark, operator });
  },
  async delete(id: string): Promise<void> {
    await callApi('deleteSalesOrder', { id });
  },
  async confirmShipment(id: string, operator: string): Promise<void> {
    await callApi('confirmSalesShipment', { id, operator });
  },
  async getLogs(orderId: string): Promise<any[]> {
    const res = await callApi('getOrderLogs', { orderId });
    return res.data || [];
  }
};

// ========================
// Inventory
// ========================
export const inventoryDB = {
  async getAll(): Promise<InventoryRecord[]> {
    const res = await callApi('getInventory');
    return res.data || [];
  },
  async getLowStockProducts(): Promise<{ product: Product; inventory: InventoryRecord }[]> {
    const res = await callApi('getLowStockProducts');
    return res.data || [];
  },
  async adjustStock(productId: string, newQty: number, operator: string): Promise<void> {
    await callApi('adjustInventoryStock', { productId, newQty, operator });
  }
};

// ========================
// Inventory Logs
// ========================
export const inventoryLogDB = {
  async getAll(): Promise<InventoryLog[]> {
    const res = await callApi('getInventoryLogs');
    return res.data || [];
  },
  async getByProductId(productId: string): Promise<InventoryLog[]> {
    const res = await callApi('getInventoryLogsByProduct', { productId });
    return res.data || [];
  }
};

// ========================
// Data Utils
// ========================
export const dataUtils = {
  exportAll(): string {
    return "{}"; // 不再支持纯前端导出全量数据
  },
  importAll(_jsonStr: string): boolean {
    return false;
  },
  clearAll(): void {
    console.warn("clearAll disabled");
  },
};

export const auditDB = {
  getList: async () => {
    const res = await callApi('getAuditLogs');
    return res.data || [];
  }
};

// ========================
// Finance Ledgers
// ========================
export const financeLedgerDB = {
  async getAll(): Promise<FinanceLedger[]> {
    const res = await callApi('getFinanceLedgers');
    return res.data || [];
  },
  async create(data: Omit<FinanceLedger, 'id' | 'createdAt'>): Promise<void> {
    await callApi('createFinanceLedger', { ...data });
  },
  async delete(id: string): Promise<void> {
    await callApi('deleteFinanceLedger', { id });
  },
};

// ========================
// User Roles & Profiles
// ========================
let cachedUserMap: Record<string, { displayName: string; role: string }> | null = null;

export const userDB = {
  async getProfile(uid: string, username?: string, displayName?: string) {
    const res = await callApi('getUserProfile', { uid, username, displayName });
    return res.data;
  },
  async saveProfile(uid: string, displayName: string, role: string, username?: string) {
    await callApi('saveUserProfile', { uid, displayName, role, username });
    cachedUserMap = null;
  },
  async getList() {
    const res = await callApi('getUserList');
    return res.data || [];
  },
  async deleteProfile(uid: string) {
    await callApi('deleteUserProfile', { uid });
    cachedUserMap = null;
  },
  async getUserMap(forceRefresh = false): Promise<Record<string, { displayName: string; role: string }>> {
    if (cachedUserMap && !forceRefresh) {
      return cachedUserMap;
    }
    try {
      const list = await this.getList();
      const map: Record<string, { displayName: string; role: string }> = {};
      list.forEach((u: any) => {
        const info = {
          displayName: u.displayName || u.username || u.uid,
          role: u.role
        };
        map[u.uid] = info;
        if (u.username) {
          map[u.username] = info;
        }
      });
      cachedUserMap = map;
      return map;
    } catch (e) {
      console.error('Failed to load user map:', e);
      return cachedUserMap || {};
    }
  }
};
