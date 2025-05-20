const express = require('express');
const router = express.Router();
const connection = require('./db');

router.use(express.json());

router.post('/', (req, res) => {
  const { ciudadano_id, calle, municipio, estado } = req.body;

  if (!ciudadano_id || !calle || !municipio || !estado) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const sql = `
    INSERT INTO domicilios (ciudadano_id, calle, municipio, estado)
    VALUES (?, ?, ?, ?)
  `;

  connection.query(sql, [ciudadano_id, calle, municipio, estado], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error al insertar domicilio' });
    }

    res.status(201).json({ message: 'Domicilio registrado', id: result.insertId });
  });
});

module.exports = router;
