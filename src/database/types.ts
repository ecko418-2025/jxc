// ========================================
// 数据模型定义 - 酒店保洁产品进销存系统
// ========================================

export interface Category {
  id: string;
  code: string;        // 品类编码
  name: string;        // 品类名称
  parentId?: string;   // 父级品类ID
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  sku: string;         // 产品编码
  name: string;        // 产品名称
  categoryId: string;  // 所属品类
  unit: string;        // 计量单位
  spec: string;        // 规格型号
  brand: string;       // 品牌
  purchasePrice: number;  // 采购价
  salePrice: number;      // 销售价
  minStock: number;    // 最低库存预警
  active: boolean;     // 是否启用
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;        // 供应商名称
  contact: string;     // 联系人
  phone: string;
  address: string;
  bankAccount?: string;  // 开户行及账号
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;        // 酒店名称
  contact: string;     // 联系人
  phone: string;
  address: string;
  level: string;       // 客户等级：普通/银牌/金牌/VIP
  creditLimit?: number;  // 信用额度
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'draft' | 'confirmed' | 'received' | 'cancelled' | 'shipped' | 'completed';
export type PaymentStatus = 'pending' | 'partial' | 'paid';

export interface PurchaseOrder {
  id: string;
  orderNo: string;       // 采购单号
  supplierId: string;    // 供应商
  orderDate: string;     // 日期
  totalAmount: number;   // 总金额
  extOrderNo?: string;   // 对方单号
  status: OrderStatus;   // 状态
  remark?: string;
  items: PurchaseItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  id: string;
  productId: string;
  quantity: number;      // 数量
  unitPrice: number;     // 单价
  subtotal: number;      // 小计
}

export interface SalesOrder {
  id: string;
  orderNo: string;       // 销售单号
  customerId: string;    // 客户
  orderDate: string;     // 日期
  totalAmount: number;   // 总金额
  extOrderNo?: string;   // 对方单号
  discount: number;      // 折扣金额
  status: OrderStatus;   // 状态
  paymentStatus: PaymentStatus;  // 收款状态
  remark?: string;
  items: SalesItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SalesItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface InventoryRecord {
  productId: string;
  currentQty: number;
  lastUpdated: string;
}

export type InventoryLogType = 'in' | 'out' | 'adjust';
export type InventoryRefType = 'purchase' | 'sales' | 'adjust';

export interface InventoryLog {
  id: string;
  productId: string;
  type: 'in' | 'out' | 'adjust'; // 入库 | 出库 | 调整
  quantity: number;      // 变动数量（+/-）
  balance: number;       // 变动后余额
  remark?: string;       // 备注/来源信息
  operator: string;      // 操作人
  createdAt: string;     // 时间
  // 富文本关联字段（用于历史明细展示）
  poNo?: string;
  poExtNo?: string;
  supplierName?: string;
  purchasePrice?: number;
  soNo?: string;
  soExtNo?: string;
  customerName?: string;
  salePrice?: number;
}

// Dashboard统计
export interface DashboardStats {
  todaySales: number;
  monthSales: number;
  pendingOrders: number;
  lowStockCount: number;
  totalProducts: number;
  totalCustomers: number;
}
