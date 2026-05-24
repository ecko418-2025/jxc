const { execSync } = require('child_process');

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

const suppliers = [
  `('${generateId()}', '广州洁霸日化有限公司', '张经理', '13800138001', '广州市白云区太和镇工业园A栋', '工商银行 622208 **** 1234', '')`,
  `('${generateId()}', '上海蓝月亮日用品公司', '李总', '13900139001', '上海市松江区九亭镇科技路88号', '建设银行 621700 **** 5678', '')`,
  `('${generateId()}', '佛山庄臣清洁科技', '王经理', '13700137001', '佛山市顺德区大良镇工业南路12号', '', '')`,
  `('${generateId()}', '义乌洁丽雅日用品批发', '赵姐', '13600136001', '义乌市国际商贸城H区3楼3028号', '', '')`
];

const customers = [
  `('${generateId()}', '锦江之星（市中心店）', '刘店长', '0571-88001234', '杭州市上城区中山中路108号', '金牌', 0, '')`,
  `('${generateId()}', '如家快捷酒店（西湖店）', '陈经理', '0571-87005678', '杭州市西湖区北山路56号', '银牌', 0, '')`,
  `('${generateId()}', '希尔顿逸林酒店', 'Mark Zhang', '0571-85009999', '杭州市滨江区江南大道1088号', 'VIP', 0, '')`,
  `('${generateId()}', '汉庭酒店（火车站店）', '孙主管', '0571-86003456', '杭州市江干区城站广场3号', '普通', 0, '')`,
  `('${generateId()}', '维也纳国际酒店', '周总', '0571-89007890', '杭州市余杭区良渚文化村', '金牌', 0, '')`
];

const sqlCommands = [
  "DELETE FROM purchase_orders", // delete any remaining orders just in case
  "DELETE FROM sales_orders",
  "DELETE FROM suppliers",
  "DELETE FROM customers",
  `INSERT INTO suppliers (id, name, contact, phone, address, bank_account, remark) VALUES ${suppliers.join(', ')}`,
  `INSERT INTO customers (id, name, contact, phone, address, level, credit_limit, remark) VALUES ${customers.join(', ')}`
];

for (const sql of sqlCommands) {
  try {
    execSync(`tcb db execute -e cshj001-d7g5f1k0tc94d4181 --sql "${sql}"`, { stdio: 'inherit' });
  } catch (e) {
    console.error('执行失败', e);
  }
}
console.log('✅ 客户和供应商清理并还原成功！');
