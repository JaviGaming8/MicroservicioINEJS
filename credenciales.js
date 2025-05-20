const express = require('express');
const router = express.Router();
const connection = require('./db');

router.use(express.json());

router.post('/', (req, res) => {
  const { ciudadano_id, folio_credencial, tipo_credencial, fecha_emision } = req.body;

  if (!ciudadano_id || !folio_credencial || !tipo_credencial || !fecha_emision) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const sql = `
    INSERT INTO credenciales (ciudadano_id, folio_credencial, tipo_credencial, fecha_emision)
    VALUES (?, ?, ?, ?)
  `;

  connection.query(sql, [ciudadano_id, folio_credencial, tipo_credencial, fecha_emision], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error al insertar credencial' });
    }

    res.status(201).json({ message: 'Credencial registrada', id: result.insertId });
  });
});

module.exports = router;
