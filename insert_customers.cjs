const { execSync } = require('child_process');

const generateId = () => Math.random().toString(36).substr(2, 9);

const customers = [
  { name: '万豪大酒店（武林广场店）', contact: '张总', phone: '0571-88880001', address: '杭州市拱墅区武林广场1号', level: 'VIP' },
  { name: '香格里拉大酒店（西湖店）', contact: '李经理', phone: '0571-88880002', address: '杭州市西湖区北山街78号', level: 'VIP' },
  { name: '全季酒店（火车东站店）', contact: '王店长', phone: '0571-88880003', address: '杭州市上城区东宁路233号', level: '金牌' },
  { name: '桔子水晶酒店（滨江店）', contact: '赵主管', phone: '0571-88880004', address: '杭州市滨江区江南大道100号', level: '金牌' },
  { name: '亚朵酒店（钱江新城店）', contact: '刘店长', phone: '0571-88880005', address: '杭州市江干区富春路290号', level: '金牌' },
  { name: '速8酒店（下沙大学城店）', contact: '孙经理', phone: '0571-88880006', address: '杭州市钱塘区学林街100号', level: '普通' },
  { name: '布丁酒店（西湖文化广场店）', contact: '周主管', phone: '0571-88880007', address: '杭州市拱墅区中山北路588号', level: '普通' },
  { name: '智选假日酒店（黄龙店）', contact: '吴店长', phone: '0571-88880008', address: '杭州市西湖区黄龙路5号', level: '银牌' },
  { name: '开元名都大酒店（萧山店）', contact: '郑总', phone: '0571-88880009', address: '杭州市萧山区市心中路818号', level: 'VIP' },
  { name: '君悦酒店（湖滨步行街店）', contact: '陈经理', phone: '0571-88880010', address: '杭州市上城区湖滨路28号', level: 'VIP' }
];

console.log('开始插入 10 条客户记录...');

for (const cust of customers) {
  const sql = `INSERT INTO customers (id, name, contact, phone, address, level, credit_limit, remark) VALUES ('${generateId()}', '${cust.name}', '${cust.contact}', '${cust.phone}', '${cust.address}', '${cust.level}', 0, '')`;
  
  try {
    execSync(`tcb db execute -e cshj001-d7g5f1k0tc94d4181 --sql "${sql}"`);
    console.log(`✅ 成功插入客户: ${cust.name}`);
  } catch (err) {
    console.error(`❌ 插入失败: ${cust.name}`);
  }
}

console.log('✅ 10 条客户记录插入完成！');
