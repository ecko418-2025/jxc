import cloudbase from '@cloudbase/node-sdk';
const app = cloudbase.init({
  env: 'cshj001-d7g5f1k0tc94d4181',
});
async function run() {
  const res = await app.callFunction({
    name: 'api',
    data: { action: 'migrate', payload: {} }
  });
  console.log(res);
}
run();
