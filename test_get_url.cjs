const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({
  env: 'cshj001-d7g5f1k0tc94d4181',
});
app.callFunction({
  name: 'api',
  data: { action: 'getProducts' }
}).then(res => {
  console.log(res);
}).catch(console.error);
