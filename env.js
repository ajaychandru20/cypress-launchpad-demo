const fs = require('fs');

/**
 * Generates .env file for the selected demo environment.
 * Target: https://www.saucedemo.com (public Cypress demo site)
 *
 * Usage: node env.js demo1
 */
function getEnvContent(region) {
  if (region === 'demo1') {
    return `
REGION=demo1
BASE_URL=https://www.saucedemo.com
APP_URL=https://www.saucedemo.com
USERNAME=standard_user
PASSWORD=secret_sauce`;
  } else if (region === 'demo2') {
    return `
REGION=demo2
BASE_URL=https://www.saucedemo.com
APP_URL=https://www.saucedemo.com
USERNAME=visual_user
PASSWORD=secret_sauce`;
  } else if (region === 'demo3') {
    return `
REGION=demo3
BASE_URL=https://www.saucedemo.com
APP_URL=https://www.saucedemo.com
USERNAME=performance_glitch_user
PASSWORD=secret_sauce`;
  } else if (region === 'local') {
    return `
REGION=local
BASE_URL=http://localhost:3000
APP_URL=http://localhost:3000
USERNAME=admin
PASSWORD=admin123`;
  }
  return '';
}

if (require.main === module) {
  var region = process.argv[2];
  if (!region) {
    console.error('Usage: node env.js <region>');
    console.error('Regions: demo1, demo2, demo3, local');
    process.exit(1);
  }
  var content = getEnvContent(region);
  if (!content) {
    console.error('Unknown region:', region);
    process.exit(1);
  }
  fs.writeFileSync('.env', content.trim() + '\n');
  console.log('.env written for region:', region);
}

module.exports = { getEnvContent };
