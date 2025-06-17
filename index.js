const express = require('express');
const connection = require('./db');

const app = express();
app.use(express.json());

console.log('✅ Conectado a la base de datos MySQL');

// Apis de Ciudadanos

// Crear ciudadano
app.post('/ciudadanos', async (req, res) => {
  const { curp, nombre, apellido_paterno, fecha_nacimiento } = req.body;
  if (!curp || !nombre || !apellido_paterno || !fecha_nacimiento)
    return res.status(400).json({ error: 'Faltan datos de ciudadano' });

  try {
    const sql = `INSERT INTO ciudadanos (curp, nombre, apellido_paterno, fecha_nacimiento) VALUES (?, ?, ?, ?)`;
    await connection.promise().query(sql, [curp, nombre, apellido_paterno, fecha_nacimiento]);
    res.status(201).json({ message: 'Ciudadano creado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear ciudadano' });
  }
});

// Obtener todos los ciudadanos
app.get('/ciudadanos', async (req, res) => {
  try {
    const [rows] = await connection.promise().query('SELECT * FROM ciudadanos');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ciudadanos' });
  }
});

// Buscar ciudadano por CURP
app.get('/ciudadanos/curp/:curp', async (req, res) => {
  const curp = req.params.curp;
  try {
    const [rows] = await connection.promise().query('SELECT * FROM ciudadanos WHERE curp = ?', [curp]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ciudadano no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar ciudadano' });
  }
});

// Actualizar ciudadano y sus credenciales/domicilios relacionados por CURP
app.put('/ciudadanos/curp/:curp', async (req, res) => {
  const curp = req.params.curp;
  const { nombre, apellido_paterno, fecha_nacimiento, credencial, domicilio } = req.body;
  /*
    credencial: { folio_credencial, tipo_credencial, fecha_emision }
    domicilio: { calle, municipio, estado }
  */

  try {
    // Obtener ciudadano_id
    const [ciudadanoRows] = await connection.promise().query('SELECT ciudadano_id FROM ciudadanos WHERE curp = ?', [curp]);
    if (ciudadanoRows.length === 0) return res.status(404).json({ error: 'Ciudadano no encontrado' });
    const ciudadano_id = ciudadanoRows[0].ciudadano_id;

    // Actualizar datos de ciudadano
    await connection.promise().query(
      'UPDATE ciudadanos SET nombre = ?, apellido_paterno = ?, fecha_nacimiento = ? WHERE ciudadano_id = ?',
      [nombre, apellido_paterno, fecha_nacimiento, ciudadano_id]
    );

    // Actualizar o insertar credencial
    if (credencial) {
      const [credRows] = await connection.promise().query('SELECT * FROM credenciales WHERE ciudadano_id = ?', [ciudadano_id]);
      if (credRows.length === 0) {
        // Insertar nueva credencial
        await connection.promise().query(
          'INSERT INTO credenciales (ciudadano_id, folio_credencial, tipo_credencial, fecha_emision) VALUES (?, ?, ?, ?)',
          [ciudadano_id, credencial.folio_credencial, credencial.tipo_credencial, credencial.fecha_emision]
        );
      } else {
        // Actualizar credencial existente
        await connection.promise().query(
          'UPDATE credenciales SET folio_credencial = ?, tipo_credencial = ?, fecha_emision = ? WHERE ciudadano_id = ?',
          [credencial.folio_credencial, credencial.tipo_credencial, credencial.fecha_emision, ciudadano_id]
        );
      }
    }

    // Actualizar o insertar domicilio
    if (domicilio) {
      const [domRows] = await connection.promise().query('SELECT * FROM domicilios WHERE ciudadano_id = ?', [ciudadano_id]);
      if (domRows.length === 0) {
        // Insertar nuevo domicilio
        await connection.promise().query(
          'INSERT INTO domicilios (ciudadano_id, calle, municipio, estado) VALUES (?, ?, ?, ?)',
          [ciudadano_id, domicilio.calle, domicilio.municipio, domicilio.estado]
        );
      } else {
        // Actualizar domicilio existente
        await connection.promise().query(
          'UPDATE domicilios SET calle = ?, municipio = ?, estado = ? WHERE ciudadano_id = ?',
          [domicilio.calle, domicilio.municipio, domicilio.estado, ciudadano_id]
        );
      }
    }

    res.json({ message: 'Ciudadano y datos relacionados actualizados' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar ciudadano' });
  }
});

// Eliminar ciudadano y datos relacionados por CURP
app.delete('/ciudadanos/curp/:curp', async (req, res) => {
  const curp = req.params.curp;
  try {
    // Obtener ciudadano_id
    const [ciudadanoRows] = await connection.promise().query('SELECT ciudadano_id FROM ciudadanos WHERE curp = ?', [curp]);
    if (ciudadanoRows.length === 0) return res.status(404).json({ error: 'Ciudadano no encontrado' });
    const ciudadano_id = ciudadanoRows[0].ciudadano_id;

    // Eliminar credenciales y domicilios relacionados
    await connection.promise().query('DELETE FROM credenciales WHERE ciudadano_id = ?', [ciudadano_id]);
    await connection.promise().query('DELETE FROM domicilios WHERE ciudadano_id = ?', [ciudadano_id]);

    // Eliminar ciudadano
    await connection.promise().query('DELETE FROM ciudadanos WHERE ciudadano_id = ?', [ciudadano_id]);

    res.json({ message: 'Ciudadano y datos relacionados eliminados' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar ciudadano' });
  }
});

// API de Credenciales

// Crear credencial
app.post('/credenciales', async (req, res) => {
  const { ciudadano_id, folio_credencial, tipo_credencial, fecha_emision } = req.body;
  if (!ciudadano_id || !folio_credencial || !tipo_credencial || !fecha_emision)
    return res.status(400).json({ error: 'Faltan datos de credencial' });

  try {
    await connection.promise().query(
      'INSERT INTO credenciales (ciudadano_id, folio_credencial, tipo_credencial, fecha_emision) VALUES (?, ?, ?, ?)',
      [ciudadano_id, folio_credencial, tipo_credencial, fecha_emision]
    );
    res.status(201).json({ message: 'Credencial creada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear credencial' });
  }
});

// Obtener todas las credenciales
app.get('/credenciales', async (req, res) => {
  try {
    const [rows] = await connection.promise().query('SELECT * FROM credenciales');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener credenciales' });
  }
});

// Buscar credencial por ciudadano_id
app.get('/credenciales/ciudadano/:id', async (req, res) => {
  const ciudadano_id = req.params.id;
  try {
    const [rows] = await connection.promise().query('SELECT * FROM credenciales WHERE ciudadano_id = ?', [ciudadano_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Credencial no encontrada' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar credencial' });
  }
});

// Actualizar credencial por ciudadano_id
app.put('/credenciales/ciudadano/:id', async (req, res) => {
  const ciudadano_id = req.params.id;
  const { folio_credencial, tipo_credencial, fecha_emision } = req.body;

  try {
    const [rows] = await connection.promise().query('SELECT * FROM credenciales WHERE ciudadano_id = ?', [ciudadano_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Credencial no encontrada' });

    await connection.promise().query(
      'UPDATE credenciales SET folio_credencial = ?, tipo_credencial = ?, fecha_emision = ? WHERE ciudadano_id = ?',
      [folio_credencial, tipo_credencial, fecha_emision, ciudadano_id]
    );

    res.json({ message: 'Credencial actualizada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar credencial' });
  }
});

// Eliminar credencial por ciudadano_id
app.delete('/credenciales/ciudadano/:id', async (req, res) => {
  const ciudadano_id = req.params.id;
  try {
    const [rows] = await connection.promise().query('SELECT * FROM credenciales WHERE ciudadano_id = ?', [ciudadano_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Credencial no encontrada' });

    await connection.promise().query('DELETE FROM credenciales WHERE ciudadano_id = ?', [ciudadano_id]);
    res.json({ message: 'Credencial eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar credencial' });
  }
});

// API de Domicilios

// Crear domicilio
app.post('/domicilios', async (req, res) => {
  const { ciudadano_id, calle, municipio, estado } = req.body;
  if (!ciudadano_id || !calle || !municipio || !estado)
    return res.status(400).json({ error: 'Faltan datos de domicilio' });

  try {
    await connection.promise().query(
      'INSERT INTO domicilios (ciudadano_id, calle, municipio, estado) VALUES (?, ?, ?, ?)',
      [ciudadano_id, calle, municipio, estado]
    );
    res.status(201).json({ message: 'Domicilio creado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear domicilio' });
  }
});

// Obtener todos los domicilios
app.get('/domicilios', async (req, res) => {
  try {
    const [rows] = await connection.promise().query('SELECT * FROM domicilios');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener domicilios' });
  }
});

// Buscar domicilio por ciudadano_id
app.get('/domicilios/ciudadano/:id', async (req, res) => {
  const ciudadano_id = req.params.id;
  try {
    const [rows] = await connection.promise().query('SELECT * FROM domicilios WHERE ciudadano_id = ?', [ciudadano_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Domicilio no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar domicilio' });
  }
});

// Actualizar domicilio por ciudadano_id
app.put('/domicilios/ciudadano/:id', async (req, res) => {
  const ciudadano_id = req.params.id;
  const { calle, municipio, estado } = req.body;

  try {
    const [rows] = await connection.promise().query('SELECT * FROM domicilios WHERE ciudadano_id = ?', [ciudadano_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Domicilio no encontrado' });

    await connection.promise().query(
      'UPDATE domicilios SET calle = ?, municipio = ?, estado = ? WHERE ciudadano_id = ?',
      [calle, municipio, estado, ciudadano_id]
    );

    res.json({ message: 'Domicilio actualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar domicilio' });
  }
});

// Eliminar domicilio por ciudadano_id
app.delete('/domicilios/ciudadano/:id', async (req, res) => {
  const ciudadano_id = req.params.id;
  try {
    const [rows] = await connection.promise().query('SELECT * FROM domicilios WHERE ciudadano_id = ?', [ciudadano_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Domicilio no encontrado' });

    await connection.promise().query('DELETE FROM domicilios WHERE ciudadano_id = ?', [ciudadano_id]);
    res.json({ message: 'Domicilio eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar domicilio' });
  }
});


// Puerto
const PORT = process.env.PORT || 3050;
app.listen(PORT, () => {
  console.log(`🚀 Server corriendo en puerto ${PORT}`);
});
