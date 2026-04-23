const sql = require('mssql');

const config = {
  user: 'portfolio_user',
  password: 'Password21!', // password
  server: 'LAPTOP-KE6ER8SJ', // server name
  database: 'PortfolioForgeAI',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function connectDB() {
  try {
    await sql.connect(config);
    console.log('✅ Connected to SQL Server');
  } catch (err) {
    console.error('❌ DB Connection Error:', err);
  }
}

module.exports = { sql, connectDB };