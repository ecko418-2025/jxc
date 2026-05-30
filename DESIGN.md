# 酒店保洁产品进销存系统 — 设计参考文档

> 本文档作为项目的设计参考，后续修改或新增功能时请先阅读此文档，
> 了解整体架构、数据模型、功能模块和代码约定。

---

## 1. 项目概述

### 1.1 业务场景

面向酒店保洁产品销售领域的进销存管理系统，核心管理：

- **进货（进）**：供应商管理、采购订单、入库记录
- **销售（销）**：客户（酒店）管理、销售订单、出库记录
- **库存（存）**：实时库存监控、库存预警、盘点管理

### 1.2 目标用户

- 仓库管理员 — 日常出入库操作
- 销售人员 — 下单、查看库存
- 管理层 — 报表、数据分析

### 1.3 当前版本

- **版本**：v1.0.0
- **运行方式**：本地 Web 应用（Vite 开发服务器）
- **数据存储**：腾讯云开发 (CloudBase) MySQL 数据库 + 云函数 (Node.js)

---

## 2. 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 构建工具 | Vite | 8.x | 开发服务器 + 打包 |
| 前端框架 | React | 18.x | 组件化 UI |
| 语言 | TypeScript | 5.x | 类型安全 |
| UI 组件库 | Ant Design | 5.x | 企业级表格/表单/弹窗 |
| 图标 | @ant-design/icons | — | 图标库 |
| 路由 | react-router-dom | 7.x | 单页应用路由 |
| 日期处理 | dayjs | — | 日期格式化 |
| Excel 读写 | SheetJS (xlsx) | — | Excel 导入导出 |
| 数据存储 | CloudBase MySQL | — | 后端关系型数据库 |

### 设计风格

- **主题**：深色模式（Dark Mode）
- **主色调**：靛蓝 `#6366f1`（Indigo 500）
- **字体**：Inter（Google Fonts）
- **风格**：玻璃拟态（Glassmorphism）+ 渐变卡片

---

## 3. 项目目录结构

```
hotel-inventory/
├── index.html                    # 入口 HTML
├── package.json                  # 依赖管理
├── vite.config.ts                # Vite 配置
├── tsconfig.json                 # TypeScript 配置
├── DESIGN.md                     # 📌 本文件（设计参考）
│
└── src/
    ├── main.tsx                  # 应用入口
    ├── App.tsx                   # 路由配置 + Ant Design 主题
    ├── index.css                 # 全局样式 + 设计系统变量
    │
    ├── database/                 # 数据层
    │   ├── types.ts              # 所有数据模型的 TypeScript 类型定义
    │   ├── db.ts                 # 前端 API 调用封装（对接云函数）
    │   └── seed.ts               # 示例数据生成脚本
    │
    ├── utils/
    │   └── excel.ts              # Excel 导入导出工具
    │
    ├── components/
    │   └── AppLayout.tsx         # 主布局（侧边栏 + 顶栏 + 内容区）
    │
    └── pages/                    # 各功能页面（每个文件夹一个 index.tsx）
        ├── Dashboard/            # 数据看板
        ├── Products/             # 产品管理（含品类管理）
        ├── Purchase/             # 采购管理
        ├── Sales/                # 销售管理
        ├── Inventory/            # 库存管理
        ├── Suppliers/            # 供应商管理
        ├── Customers/            # 客户管理
        ├── Reports/              # 数据报表
        └── Settings/             # 系统设置
```

---

## 4. 数据模型

所有类型定义在 `src/database/types.ts`，以下是核心数据表关系：

```
Category（品类）──< Product（产品）──< Inventory（库存）
                        │                    │
                        ├──< PurchaseItem     └──< InventoryLog（出入库流水）
                        │       │
                        │       └── PurchaseOrder（采购单）──> Supplier（供应商）
                        │
                        └──< SalesItem
                                │
                                └── SalesOrder（销售单）──> Customer（客户/酒店）
```

### 4.1 品类 Category

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID 主键 |
| code | string | 品类编码，如 `BJ-001` |
| name | string | 品类名称 |
| parentId | string? | 父级品类ID（支持树形结构） |
| description | string? | 说明 |

### 4.2 产品 Product

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID 主键 |
| sku | string | 产品编码，如 `P-0001` |
| name | string | 产品名称 |
| categoryId | string | 所属品类 |
| unit | string | 计量单位（桶/瓶/箱…） |
| spec | string | 规格型号，如 `5L/桶` |
| brand | string | 品牌 |
| purchasePrice | number | 采购价 |
| salePrice | number | 销售价 |
| minStock | number | 最低库存预警值 |
| active | boolean | 是否启用 |

### 4.3 供应商 Supplier

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID 主键 |
| name | string | 供应商名称 |
| contact | string | 联系人 |
| phone | string | 电话 |
| address | string | 地址 |
| bankAccount | string? | 开户行及账号 |

### 4.4 客户 Customer

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID 主键 |
| name | string | 酒店名称 |
| contact | string | 联系人 |
| phone | string | 电话 |
| address | string | 地址 |
| level | string | 等级：普通/银牌/金牌/VIP |
| creditLimit | number? | 信用额度 |

### 4.5 采购单 PurchaseOrder

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID 主键 |
| orderNo | string | 自动生成，如 `PO202605180001` |
| supplierId | string | 供应商 |
| orderDate | string | 采购日期 |
| totalAmount | number | 总金额 |
| status | string | `draft` → `confirmed` → `received` / `cancelled` |
| extOrderNo | string | 对方流转单号（可选） |
| remark | string | 备注信息 |
*(注：采购明细存储于 `purchase_items` 表中，由 `order_id` 关联)*

### 4.6 销售单 SalesOrder

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID 主键 |
| orderNo | string | 自动生成，如 `SO202605180001` |
| customerId | string | 客户 |
| orderDate | string | 销售日期 |
| totalAmount | number | 总金额（已减折扣） |
| discount | number | 折扣金额 |
| status | string | `draft` → `confirmed` → `shipped` → `completed` / `cancelled` |
| paymentStatus | string | `pending` → `partial` → `paid` |
| extOrderNo | string | 对方流转单号（可选） |
| remark | string | 备注信息 |
*(注：销售明细存储于 `sales_items` 表中，由 `order_id` 关联)*

### 4.7 库存 Inventory & InventoryLog

- **Inventory**：每个产品一条记录，记录 `currentQty`（当前库存）
- **InventoryLog**：每次出入库都记录一条流水，包含变动数量、变动后余额、关联的业务单据ID与价格信息

### 4.8 订单流水 OrderLog

- **OrderLog**：记录所有采购单和销售单的状态变更、信息修改记录，供“订单动态”时间轴展示。

---

## 5. 业务流程

### 5.1 采购入库流程

```
创建采购单（草稿）
    ↓
确认采购单（已确认）
    ↓
确认入库（已入库）→ 自动增加对应产品库存 → 记录入库流水
```

### 5.2 销售出库流程

```
创建销售单（草稿）
    ↓
确认销售单（已确认）
    ↓
确认发货（已发货）→ 检查库存充足 → 自动扣减库存 → 记录出库流水
    ↓
标记完成（已完成）+ 标记收款状态
```

### 5.3 库存预警规则

- 产品的 `currentQty <= minStock` 时触发预警
- 看板页面和侧边栏 Badge 实时显示预警数量
- 库存页面可手动调整库存（生成调整流水）

---

## 6. 功能模块清单

### 已完成 ✅

| 模块 | 路由 | 对应文件 | 核心功能 |
|------|------|---------|---------|
| 数据看板 | `/` | `pages/Dashboard/` | 统计卡片、库存预警列表、热销TOP5、近期订单 |
| 产品管理 | `/products` | `pages/Products/` | 品类树、产品CRUD、Excel导入/导出、搜索筛选 |
| 采购管理 | `/purchase` | `pages/Purchase/` | 采购单创建→确认→入库，明细管理 |
| 销售管理 | `/sales` | `pages/Sales/` | 销售单创建→确认→发货→完成，收款状态 |
| 库存管理 | `/inventory` | `pages/Inventory/` | 实时库存、预警标识、手动调整、出入库流水 |
| 供应商 | `/suppliers` | `pages/Suppliers/` | 供应商CRUD |
| 客户管理 | `/customers` | `pages/Customers/` | 酒店客户CRUD、等级标签 |
| 数据报表 | `/reports` | `pages/Reports/` | 按周/月/季/年统计、客户排行、产品排行、品类分布 |
| 系统设置 | `/settings` | `pages/Settings/` | 数据备份/恢复、示例数据、清空数据 |

### 待开发 📋

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 数据可视化图表 | 中 | 用 ECharts 展示销售趋势、库存变化 |
| 单据打印/PDF | 中 | 采购单、销售单打印导出 |
| 多仓库支持 | 低 | 支持多仓库独立库存管理 |
| 客户分级定价 | 低 | 不同等级客户不同价格 |
| 应收应付管理 | 低 | 财务层面的账款管理 |
| Electron 打包 | 低 | 打包为桌面应用 (.dmg/.exe) |

---

## 7. Excel 导入规范

### 7.1 品类导入模板

| 品类编码 | 品类名称 | 上级品类编码 | 说明 |
|---------|---------|------------|------|
| BJ-001 | 客房清洁 | _(空)_ | 一级品类 |
| BJ-001-01 | 清洁剂 | BJ-001 | 二级品类 |

- 文件格式：`.xlsx` 或 `.xls`
- 编码重复的记录自动跳过
- 上级品类编码需已存在

### 7.2 产品导入模板

| 产品编码 | 产品名称 | 品类编码 | 规格 | 单位 | 品牌 | 采购价 | 销售价 | 最低库存 |
|---------|---------|---------|------|------|------|--------|--------|---------|
| P-0001 | 多功能清洁剂 | BJ-001-01 | 5L/桶 | 桶 | 洁霸 | 35.00 | 58.00 | 50 |

- 产品编码和名称为必填
- 品类编码必须已存在
- 导入前会展示预览和校验结果

---

## 8. 代码约定

### 8.1 文件组织

- 每个页面一个文件夹，入口为 `index.tsx`
- 数据操作统一通过 `src/database/db.ts` 中的 DB 对象
- 类型定义集中在 `src/database/types.ts`
- 工具函数放 `src/utils/`

### 8.2 数据库操作模式

```typescript
// 所有 DB 对象遵循统一接口：
xxxDB.getAll()              // 获取全部
xxxDB.getById(id)           // 按ID获取
xxxDB.create(data)          // 新增（自动生成 id + 时间戳）
xxxDB.update(id, data)      // 更新（自动更新 updatedAt）
xxxDB.delete(id)            // 删除
```

### 8.3 订单号生成规则

- 采购单：`PO` + 日期(YYYYMMDD) + 4位序号，如 `PO202605180001`
- 销售单：`SO` + 日期(YYYYMMDD) + 4位序号，如 `SO202605180001`
- 序号通过云端数据库的 `counters` 集合维护递增

### 8.4 UI 组件规范

- 表格统一使用 Ant Design `<Table>` + `size="small"`
- 弹窗表单使用 `<Modal>` + `<Form layout="vertical">`
- 状态标签使用 `<Tag color="...">` 配合预定义颜色映射
- 金额显示：采购价用灰色/黄色，销售额用绿色
- CSS 变量定义在 `src/index.css` 的 `:root` 中

### 8.5 样式变量（主要）

```css
--primary-500: #6366f1;      /* 主色 */
--bg-primary: #0f172a;       /* 页面背景 */
--bg-secondary: #1e293b;     /* 卡片/侧边栏背景 */
--bg-tertiary: #334155;      /* 输入框/表头背景 */
--text-primary: #f1f5f9;     /* 主文字 */
--text-secondary: #94a3b8;   /* 辅助文字 */
--success: #22c55e;          /* 成功/销售额 */
--warning: #f59e0b;          /* 警告/采购额 */
--error: #ef4444;            /* 错误/预警 */
```

---

## 9. 运行指南

```bash
# 安装依赖
cd hotel-inventory
npm install

# 启动开发服务器
npm run dev
# 打开 http://localhost:5173/

# 首次使用
# 进入 系统设置 → 点击"加载示例数据"
```

---

## 10. 更新日志

### v1.0.0 (2026-05-18)

- 初始版本发布
- 完成 9 个功能模块：看板/产品/采购/销售/库存/供应商/客户/报表/设置
- 支持 Excel 品类和产品批量导入
- 深色主题 UI
- 数据备份/恢复功能
