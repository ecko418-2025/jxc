# 进销存财务系统 - 数据库与前端字段映射字典

本文档罗列了当前系统所有核心模块的数据库表结构（后端）以及 TypeScript 接口类型（前端）的字段名称映射关系。
本系统核心遵循 **数据库字段使用 snake_case（下划线命名法）**，**前端实体字段使用 camelCase（驼峰命名法）**的规范。

---

## 1. 基础信息管理 (Base Data)

### 1.1 商品分类 (Categories)
| 含义 | 后端数据库 (categories) | 前端属性 (Category) |
|---|---|---|
| 主键ID | `id` | `id` |
| 编码 | `code` | `code` |
| 名称 | `name` | `name` |
| 父级分类ID | `parent_id` | `parentId` |
| 描述 | `description` | `description` |
| 创建时间 | `created_at` | `createdAt` |

### 1.2 商品/产品 (Products)
| 含义 | 后端数据库 (products) | 前端属性 (Product) |
|---|---|---|
| 主键ID | `id` | `id` |
| SKU编号 | `sku` | `sku` |
| 商品名称 | `name` | `name` |
| 所属分类ID | `category_id` | `categoryId` |
| 单位 | `unit` | `unit` |
| 规格 | `spec` | `spec` |
| 品牌 | `brand` | `brand` |
| 采购价 | `purchase_price` | `purchasePrice` |
| 销售价 | `sale_price` | `salePrice` |
| 安全库存预警线 | `min_stock` | `minStock` |
| 启用状态(1/0) | `active` | `active` (boolean) |
| 图片地址 | `image_url` | `imageUrl` |
| 创建时间 | `created_at` | `createdAt` |

### 1.3 供应商 (Suppliers)
| 含义 | 后端数据库 (suppliers) | 前端属性 (Supplier) |
|---|---|---|
| 主键ID | `id` | `id` |
| 供应商名称 | `name` | `name` |
| 联系人 | `contact` | `contact` |
| 联系电话 | `phone` | `phone` |
| 地址 | `address` | `address` |
| 银行账户 | `bank_account` | `bankAccount` |
| 备注 | `remark` | `remark` |
| 创建时间 | `created_at` | `createdAt` |

### 1.4 客户 (Customers)
| 含义 | 后端数据库 (customers) | 前端属性 (Customer) |
|---|---|---|
| 主键ID | `id` | `id` |
| 客户名称 | `name` | `name` |
| 联系人 | `contact` | `contact` |
| 联系电话 | `phone` | `phone` |
| 地址 | `address` | `address` |
| 客户等级 | `level` | `level` |
| 信用额度 | `credit_limit` | `creditLimit` |
| 备注 | `remark` | `remark` |
| 创建时间 | `created_at` | `createdAt` |

---

## 2. 核心业务单据 (Business Orders)

### 2.1 销售订单 (Sales Orders)
| 含义 | 后端数据库 (sales_orders) | 前端属性 (SalesOrder) |
|---|---|---|
| 主键ID | `id` | `id` |
| 订单号 | `order_no` | `orderNo` |
| 客户ID | `customer_id` | `customerId` |
| 订单日期 | `order_date` | `orderDate` |
| 订单总额 | `total_amount` | `totalAmount` |
| 已收金额 | `paid_amount` | `paidAmount` |
| 折扣金额 | `discount` | `discount` |
| 订单状态 | `status` | `status` |
| 支付状态 | `payment_status` | `paymentStatus` |
| 对方单号(关单号) | `ext_order_no` | `extOrderNo` |
| 发票编号 | `invoice_no` | `invoiceNo` |
| 备注 | `remark` | `remark` |
| 包含商品 | -(关联sales_items) | `items` (SalesItem[]) |
| 创建时间 | `created_at` | `createdAt` |

#### 销售订单子项 (Sales Items)
| 含义 | 后端数据库 (sales_items) | 前端属性 (SalesItem) |
|---|---|---|
| 主键ID | `id` | `id` |
| 关联销售单ID | `order_id` | `orderId` |
| 关联商品ID | `product_id` | `productId` |
| 销售数量 | `quantity` | `quantity` |
| 销售单价 | `unit_price` | `unitPrice` |
| 小计金额 | `subtotal` | `subtotal` |

### 2.2 采购订单 (Purchase Orders)
| 含义 | 后端数据库 (purchase_orders) | 前端属性 (PurchaseOrder) |
|---|---|---|
| 主键ID | `id` | `id` |
| 订单号 | `order_no` | `orderNo` |
| 供应商ID | `supplier_id` | `supplierId` |
| 订单日期 | `order_date` | `orderDate` |
| 订单总额 | `total_amount` | `totalAmount` |
| 已付金额 | `paid_amount` | `paidAmount` |
| 订单状态 | `status` | `status` |
| 支付状态 | `payment_status` | `paymentStatus` |
| 对方单号 | `ext_order_no` | `extOrderNo` |
| 发票编号 | `invoice_no` | `invoiceNo` |
| 备注 | `remark` | `remark` |
| 包含商品 | -(关联purchase_items) | `items` (PurchaseItem[]) |
| 创建时间 | `created_at` | `createdAt` |

#### 采购订单子项 (Purchase Items)
| 含义 | 后端数据库 (purchase_items) | 前端属性 (PurchaseItem) |
|---|---|---|
| 主键ID | `id` | `id` |
| 关联采购单ID | `order_id` | `orderId` |
| 关联商品ID | `product_id` | `productId` |
| 采购数量 | `quantity` | `quantity` |
| 采购单价 | `unit_price` | `unitPrice` |
| 小计金额 | `subtotal` | `subtotal` |

---

## 3. 财务与库存流水 (Finance & Inventory)

### 3.1 资金/账务流水 (Finance Ledgers)
| 含义 | 后端数据库 (finance_ledgers) | 前端属性 (FinanceLedger) |
|---|---|---|
| 主键ID | `id` | `id` |
| 流水类型(收/支) | `type` | `type` |
| 交易方ID(客/供) | `party_id` | `partyId` |
| 关联订单ID | `order_id` | `orderId` |
| 交易金额 | `amount` | `amount` |
| 支付方式 | `payment_method` | `paymentMethod` |
| 支付日期 | `payment_date` | `paymentDate` |
| 备注 | `remark` | `remark` |
| 经办人/录入人 | `created_by` | `createdBy` |
| 创建时间 | `created_at` | `createdAt` |

### 3.2 实时库存总览 (Inventory)
| 含义 | 后端数据库 (inventory) | 前端属性 (InventoryRecord) |
|---|---|---|
| 商品ID | `product_id` | `productId` |
| 当前库存数 | `current_qty` | `currentQty` |
| 最后变动时间 | `last_updated` | `lastUpdated` |

### 3.3 库存出入库日志 (Inventory Logs)
| 含义 | 后端数据库 (inventory_logs) | 前端属性 (InventoryLog) |
|---|---|---|
| 主键ID | `id` | `id` |
| 商品ID | `product_id` | `productId` |
| 变动类型(in/out/adjust)| `type` | `type` |
| 变动数量 | `quantity_change` | `quantity` |
| 变动后结余 | `balance` | `balance` |
| 关联单据类型 | `ref_type` | `refType` (可选) |
| 关联单据ID | `ref_id` | `refId` (可选) |
| 操作人 | `operator` | `operator` |
| 用户OpenID | `_openid` | - |
| 创建时间 | `created_at` | `createdAt` |
| *注: 扩展字段* | -(Join 查询获得) | `poNo`, `poExtNo`, `supplierName`等辅助字段 |

---

## 4. 系统日志 (System Logs)

> 💡 **特别说明**：为了保留原始日志的直接可读性，部分系统级日志实体在前端直接沿用了 `snake_case` 映射，未转换为驼峰命名。

### 4.1 订单操作日志 (Order Logs)
| 含义 | 后端数据库 (order_logs) | 前端属性 (内部类型) |
|---|---|---|
| 主键ID | `id` | `id` |
| 关联订单ID | `order_id` | `order_id` |
| 订单类型(sales/purchase)| `order_type` | `order_type` |
| 操作动作 | `action` | `action` |
| 详情描述 | `detail` | `detail` |
| 操作人 | `operator` | `operator` |
| 发生时间 | `created_at` | `created_at` |

### 4.2 审计与关键操作日志 (Audit Logs)
| 含义 | 后端数据库 (audit_logs) | 前端属性 (AuditLog) |
|---|---|---|
| 主键ID | `id` | `id` |
| 操作用户名 | `user_name` | `user_name` |
| 动作类型 | `action_type` | `action_type` |
| 消息描述 | `message` | `message` |
| 携带的业务数据 | `payload` | `payload` |
| 发生时间 | `created_at` | `created_at` |
