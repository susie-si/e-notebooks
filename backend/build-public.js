const fs = require('fs')
const path = require('path')

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist')
const publicDir = path.join(__dirname, 'public')

if (!fs.existsSync(frontendDist)) {
  console.error('frontend/dist 不存在，请先在 frontend 目录执行 npm run build')
  process.exit(1)
}

if (fs.existsSync(publicDir)) {
  fs.rmSync(publicDir, { recursive: true })
}
fs.mkdirSync(publicDir, { recursive: true })
copyDir(frontendDist, publicDir)
console.log('已复制 frontend/dist -> backend/public')

function copyDir(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true })
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}
