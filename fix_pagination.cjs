const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src/pages'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('pageSize:')) {
    content = content.replace(/pageSize:\s*(\d+)/g, 'defaultPageSize: $1, showSizeChanger: true');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
}
console.log('✅ Pagination fixed!');
