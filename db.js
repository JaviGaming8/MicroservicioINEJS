// db.js
const mysql = require('mysql2');
const fs = require('fs');

const connection = mysql.createConnection({
  host: 'mysql-1287b1c4-javier7737302566-b2f7.h.aivencloud.com',
  port: 15332,
  user: 'avnadmin',
  password: 'AVNS_X7iGvR2HGCNq7FbKt8B',
  database: 'defaultdb'
});

connection.connect((err) => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
    return;
  }
  console.log('Conectado a la base de datos MySQL');
});

module.exports = connection;
