const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({
  env: 'cshj001-d7g5f1k0tc94d4181',
});

// Since node SDK doesn't need to be imported via ES modules if we install it,
// wait, we can't install it globally easily. I will use the CLI to do it.
