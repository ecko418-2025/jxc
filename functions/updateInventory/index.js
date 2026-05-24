const tcb = require('@cloudbase/node-sdk');

const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV
});
const db = app.database();
const _ = db.command;

exports.main = async (event, context) => {
  try {
    // 获取所有的 inventory 记录
    const res = await db.collection('inventory').limit(1000).get();
    const items = res.data;
    
    let updatedCount = 0;
    
    // 遍历并更新每一条记录
    for (const item of items) {
      if (item._id) {
        await db.collection('inventory').doc(item._id).update({
          currentQty: 100,
          lastUpdated: new Date().toISOString()
        });
        updatedCount++;
      }
    }
    
    return {
      success: true,
      message: `成功将 ${updatedCount} 条库存数据统一修改为 100。`
    };
  } catch (error) {
    return {
      success: false,
      message: '修改失败: ' + error.message
    };
  }
};
