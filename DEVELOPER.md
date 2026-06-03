# 酒店保洁产品进销存系统 — 技术开发白皮书 (Developer Guide & Roadmap)

本文档面向系统开发及运维人员，汇总了当前系统的整体技术架构、代码与单号规范、数据库映射字典以及后续的技术改进路线图。

---

## 1. 系统架构与技术栈 (System Architecture)

### 1.1 技术选型
| 层级 | 技术选型 | 说明 |
|------|------|------|
| **前端基座** | React 18.x + Vite 8.x + TypeScript | 极速响应的单页应用架构（SPA） |
| **UI 设计系统** | Ant Design 5.x | 定制化暗色玻璃拟态（Glassmorphism）主题 |
| **持久层存储** | CloudBase MySQL | 腾讯云原生关系型数据库，保障数据 ACID |
| **业务逻辑层** | Node.js Serverless (云函数) | 提供全局安全拦截、审计落库与高并发控制 |
| **报表与打印** | 原生 HTML+CSS Print | 脱离第三方依赖，高度定制化 A4 PDF 输出 |

### 1.2 核心开发规范
*   **云端 API 高并发防断流**：所有涉及到多表（商品表+关联订单表）信息拉取的地方，强制采用 `串行 await` 或 `数据库事务`，以防御高并发查询导致的服务器 `ECONNRESET`（连接重置）雪崩。
*   **统一返回体格式**：`{ code: 200, message: 'Success', data: [...] }`
*   **订单防重号生成算法**：`业务前缀 (PO/SO)` + `年月日 (YYYYMMDD)` + `数据库自增 4 位流水号`。通过单独的 `counters` 序列表实现强并发互斥，杜绝多端同时制单时产生重号。

---

## 2. 数据库与前端字段映射字典 (Database Schema & Mapping)

本系统核心遵循 **数据库字段使用 snake_case（下划线命名法）**，**前端实体字段使用 camelCase（驼峰命名法）** 的规范。

### 2.1 商品分类 (Categories)
| 含义 | 后端数据库 (categories) | 前端属性 (Category) |
|---|---|---|
| 主键 ID | `id` | `id` |
| 编码 | `code` | `code` |
| 名称 | `name` | `name` |
| 父级分类 ID | `parent_id` | `parentId` |
| 描述 | `description` | `description` |
| 创建时间 | `created_at` | `createdAt` |
| 更新时间 | `updated_at` | `updatedAt` |

### 2.2 商品/产品 (Products)
| 含义 | 后端数据库 (products) | 前端属性 (Product) |
|---|---|---|
| 主键 ID | `id` | `id` |
| SKU 编号 | `sku` | `sku` |
| 商品名称 | `name` | `name` |
| 所属分类 ID | `category_id` | `categoryId` |
| 单位 | `unit` | `unit` |
| 规格 | `spec` | `spec` |
| 品牌 | `brand` | `brand` |
| 采购价 | `purchase_price` | `purchasePrice` |
| 销售价 | `sale_price` | `salePrice` |
| 安全库存预警线 | `min_stock` | `minStock` |
| 启用状态 (1/0) | `active` | `active` (boolean) |
| 图片地址 | `image_url` | `imageUrl` |
| 创建时间 | `created_at` | `createdAt` |
| 更新时间 | `updated_at` | `updatedAt` |

### 2.3 供应商 (Suppliers)
| 含义 | 后端数据库 (suppliers) | 前端属性 (Supplier) |
|---|---|---|
| 主键 ID | `id` | `id` |
| 供应商名称 | `name` | `name` |
| 联系人 | `contact` | `contact` |
| 联系电话 | `phone` | `phone` |
| 地址 | `address` | `address` |
| 银行账户 | `bank_account` | `bankAccount` |
| 备注 | `remark` | `remark` |
| 创建时间 | `created_at` | `createdAt` |
| 更新时间 | `updated_at` | `updatedAt` |

### 2.4 客户 (Customers)
| 含义 | 后端数据库 (customers) | 前端属性 (Customer) |
|---|---|---|
| 主键 ID | `id` | `id` |
| 客户名称 | `name` | `name` |
| 联系人 | `contact` | `contact` |
| 联系电话 | `phone` | `phone` |
| 地址 | `address` | `address` |
| 客户等级 | `level` | `level` |
| 信用额度 | `credit_limit` | `creditLimit` |
| 备注 | `remark` | `remark` |
| 创建时间 | `created_at` | `createdAt` |
| 更新时间 | `updated_at` | `updatedAt` |

### 2.5 销售订单 (Sales Orders)
| 含义 | 后端数据库 (sales_orders) | 前端属性 (SalesOrder) |
|---|---|---|
| 主键 ID | `id` | `id` |
| 订单号 | `order_no` | `orderNo` |
| 客户 ID | `customer_id` | `customerId` |
| 订单日期 | `order_date` | `orderDate` |
| 订单总额 | `total_amount` | `totalAmount` |
| 已收金额 | `paid_amount` | `paidAmount` |
| 折扣金额 | `discount` | `discount` |
| 订单状态 | `status` | `status` |
| 支付状态 | `payment_status` | `paymentStatus` |
| 对方单号 (外单号) | `ext_order_no` | `extOrderNo` |
| 发票编号 | `invoice_no` | `invoiceNo` |
| 备注 | `remark` | `remark` |
| 包含商品 | -(关联 sales_items) | `items` (SalesItem[]) |
| 创建时间 | `created_at` | `createdAt` |
| 更新时间 | `updated_at` | `updatedAt` |

#### 销售订单子项 (Sales Items)
| 含义 | 后端数据库 (sales_items) | 前端属性 (SalesItem) |
|---|---|---|
| 主键 ID | `id` | `id` |
| 关联销售单 ID | `order_id` | `orderId` |
| 关联商品 ID | `product_id` | `productId` |
| 销售数量 | `quantity` | `quantity` |
| 销售单价 | `unit_price` | `unitPrice` |
| 小计金额 | `subtotal` | `subtotal` |

### 2.6 采购订单 (Purchase Orders)
| 含义 | 后端数据库 (purchase_orders) | 前端属性 (PurchaseOrder) |
|---|---|---|
| 主键 ID | `id` | `id` |
| 订单号 | `order_no` | `orderNo` |
| 供应商 ID | `supplier_id` | `supplierId` |
| 订单日期 | `order_date` | `orderDate` |
| 订单总额 | `total_amount` | `totalAmount` |
| 已付金额 | `paid_amount` | `paidAmount` |
| 订单状态 | `status` | `status` |
| 支付状态 | `payment_status` | `paymentStatus` |
| 对方单号 | `ext_order_no` | `extOrderNo` |
| 发票编号 | `invoice_no` | `invoiceNo` |
| 备注 | `remark` | `remark` |
| 包含商品 | -(关联 purchase_items) | `items` (PurchaseItem[]) |
| 创建时间 | `created_at` | `createdAt` |
| 更新时间 | `updated_at` | `updatedAt` |

#### 采购订单子项 (Purchase Items)
| 含义 | 后端数据库 (purchase_items) | 前端属性 (PurchaseItem) |
|---|---|---|
| 主键 ID | `id` | `id` |
| 关联采购单 ID | `order_id` | `orderId` |
| 关联商品 ID | `product_id` | `productId` |
| 采购数量 | `quantity` | `quantity` |
| 采购单价 | `unit_price` | `unitPrice` |
| 小计金额 | `subtotal` | `subtotal` |

### 2.7 资金/账务流水 (Finance Ledgers)
| 含义 | 后端数据库 (finance_ledgers) | 前端属性 (FinanceLedger) |
|---|---|---|
| 主键 ID | `id` | `id` |
| 流水类型 (收/支) | `type` | `type` |
| 交易方 ID (客/供) | `party_id` | `partyId` |
| 关联订单 ID | `order_id` | `orderId` |
| 交易金额 | `amount` | `amount` |
| 支付方式 | `payment_method` | `paymentMethod` |
| 支付日期 | `payment_date` | `paymentDate` |
| 备注 | `remark` | `remark` |
| 经办人/录入人 UID | `created_by` | `createdBy` |
| 创建时间 | `created_at` | `createdAt` |

### 2.8 实时库存总览 (Inventory)
| 含义 | 后端数据库 (inventory) | 前端属性 (InventoryRecord) |
|---|---|---|
| 商品 ID | `product_id` | `productId` |
| 当前库存数 | `current_qty` | `currentQty` / `quantity` |
| 最后变动时间 | `last_updated` | `lastUpdated` |

### 2.9 库存出入库日志 (Inventory Logs)
| 含义 | 后端数据库 (inventory_logs) | 前端属性 (InventoryLog) |
|---|---|---|
| 主键 ID | `id` | `id` |
| 商品 ID | `product_id` | `productId` |
| 变动类型 (in/out/adjust) | `type` | `type` |
| 变动数量 | `quantity_change` | `quantity` |
| 变动后结余 | `balance` | `balance` |
| 关联单据类型 | `ref_type` | `refType` (可选) |
| 关联单据 ID | `ref_id` | `refId` (可选) |
| 操作员 UID | `operator` | `operator` |
| 创建时间 | `created_at` | `createdAt` |
| *注: 扩展属性* | -(Join 查询或映射获得) | `poNo`, `poExtNo`, `supplierName`, `soNo`, `soExtNo`, `customerName` 等辅助字段 |

### 2.10 订单操作日志 (Order Logs)
| 含义 | 后端数据库 (order_logs) | 前端属性 (内部类型) |
|---|---|---|
| 主键 ID | `id` | `id` |
| 关联订单 ID | `order_id` | `order_id` |
| 订单类型 (sales/purchase) | `order_type` | `order_type` |
| 操作动作 | `action` | `action` |
| 详情描述 | `detail` | `detail` |
| 操作人 UID | `operator` | `operator` |
| 发生时间 | `created_at` | `created_at` |

### 2.11 审计与关键操作日志 (Audit Logs)
| 含义 | 后端数据库 (audit_logs) | 前端属性 (AuditLog) |
|---|---|---|
| 主键 ID | `id` | `id` |
| 操作用户名 | `user_name` | `user_name` |
| 操作员 UID | `operator_uid` | `operator_uid` |
| 动作类型 | `action_type` | `action_type` |
| 消息描述 | `message` | `message` |
| 携带的业务数据 | `payload` | `payload` |
| 发生时间 | `created_at` | `created_at` |

### 2.12 用户与权限管理 (Users)
| 含义 | 后端数据库 (users) | 前端属性 (UserProfile) |
|---|---|---|
| 用户 UID | `uid` | `uid` |
| 登录用户名 | `username` | `username` |
| 显示姓名 | `display_name` | `displayName` |
| 系统角色 | `role` | `role` |
| 创建时间 | `created_at` | `createdAt` |
| 更新时间 | `updated_at` | `updatedAt` |

### 2.13 单号生成辅助器 (System Counters)
| 含义 | 后端数据库 (system_counters) | 前端属性 (内部使用) |
|---|---|---|
| 单号前缀 | `prefix` | - |
| 日期标记 | `date_str` | - |
| 当前自增数值 | `current_value` | - |

---

## 3. 技术改进路线图 (Technical Roadmap)

### 3.1 第一阶段：系统重构与体验优化 (P0 - High Priority)
- **【结构】服务层拆分 (Service Pattern)**：
  - 拆分庞大的 `src/database/db.ts`，将数据操作按照业务功能拆分到不同的服务中：
    `src/services/productService.ts`、`orderService.ts`、`financeService.ts`、`userService.ts`。
- **【安全】自定义数据库安全规则**：
  - 在 `cloudbaserc.json` 中配置安全规则，防御绕过客户端的恶性越权修改，限制普通用户对 `finance_ledgers` 和 `order_logs` 等表的手动调用行为。
- **【体验】Ant Design 性能优化**：
  - 为商品和日志表格开启虚拟列表（Virtual List），解决上万条大数据渲染卡顿的问题。

### 3.2 第二阶段：稳定性与数据流重构 (P1 - Medium Priority)
- **【重构】引入 React Query (TanStack Query)**：
  - 将当前繁复的 `useState` + `useEffect` 手动数据拉取模式，改为用 React Query 管理数据的获取与状态自动同步（实现自动刷新、全局缓存、骨架屏 Loading）。
- **【重构】引入 Zustand 全局状态管理**：
  - 使用 Zustand 管理当前用户信息、本地缓存的 `userMap` 映射关系，替代目前直接使用全局变量的陈旧写法。
- **【监控】统一错误请求拦截**：
  - 封装全局 `request` 网络请求工具，在云函数请求报错时自动拦截并展示友好的中文全局提示，避免控制台直接抛出原生白屏崩溃。

### 3.3 第三阶段：核心业务功能升级 (P2 - Low Priority)
- **【财务】多维度差异化定价体系**：
  - **协议价 (方案 A)**：新建 `customer_prices` 表，在销售开单选择客户后，系统自动套用该大客户对应的协议折扣价。
  - **分仓定价 (方案 B)**：升级为多仓库管理体系（`warehouses`），销售开单根据出库仓库动态加载该仓特定的售价，出库扣减对应子仓的库存。
- **【提效】条形码/扫码枪直读**：
  - 商品库增加 `barcode` 属性。在采购/销售页支持监听扫码枪输入，实现“滴”一声自动把商品添加入订单。
- **【拓展】可视化报表大屏**：
  - 在 `/reports` 页面中引入 `echarts-for-react`，以直观的饼图、折线图等大屏仪表盘展现经营走势与客户贡献排名。
- **【移动端】独立微信小程序**：
  - 复用目前 CloudBase Node.js API 云函数，构建独立的移动端小程序，供仓管现场移动扫码收发货。
