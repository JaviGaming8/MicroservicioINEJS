const express = require('express');
const router = express.Router();
const connection = require('./db');

router.use(express.json());

router.post('/', (req, res) => {
  const { curp, nombre, apellido_paterno, fecha_nacimiento } = req.body;

  if (!curp || !nombre || !apellido_paterno || !fecha_nacimiento) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const sql = `
    INSERT INTO ciudadanos (curp, nombre, apellido_paterno, fecha_nacimiento)
    VALUES (?, ?, ?, ?)
  `;

  connection.query(sql, [curp, nombre, apellido_paterno, fecha_nacimiento], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error al insertar ciudadano' });
    }

    const ciudadano_id = result.insertId;
    res.status(201).json({ message: 'Ciudadano registrado', ciudadano_id });
  });
});

module.exports = router;
