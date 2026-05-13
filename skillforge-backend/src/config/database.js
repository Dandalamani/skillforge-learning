const { Sequelize } = require('sequelize');

let sequelize;

if (process.env.DATABASE_URL) {
  // Production — Neon PostgreSQL
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: false,
  });
} else {
  // Local — MySQL
  sequelize = new Sequelize(
    process.env.DB_NAME || 'skillforge_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || '',
    {
      host:    process.env.DB_HOST || 'localhost',
      port:    parseInt(process.env.DB_PORT  || '3306'),
      dialect: 'mysql',
      logging: false,
    }
  );
}

module.exports = sequelize;