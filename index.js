const express = require('express');
const connection = require('./db');

const ciudadanosRouter = require('./ciudadanos');
const credencialesRouter = require('./credenciales');
const domiciliosRouter = require('./domicilios');

const app = express();
app.use(express.json());

app.use('/api/ciudadanos', ciudadanosRouter);
app.use('/api/credenciales', credencialesRouter);
app.use('/api/domicilios', domiciliosRouter);

console.log('Conectado a la base de datos MySQL');


// ✅ INSERTAR TODO
app.post('/api/registro-completo', async (req, res) => {
  const { ciudadano, credencial, domicilio } = req.body;

  if (!ciudadano || !credencial || !domicilio) {
    return res.status(400).json({ error: '❌ Faltan datos de ciudadano, credencial o domicilio' });
  }

  try {
    // 1. Insertar ciudadano
    const ciudadanoSQL = `
      INSERT INTO ciudadanos (curp, nombre, apellido_paterno, fecha_nacimiento)
      VALUES (?, ?, ?, ?)
    `;
    await connection.promise().query(ciudadanoSQL, [
      ciudadano.curp,
      ciudadano.nombre,
      ciudadano.apellido_paterno,
      ciudadano.fecha_nacimiento
    ]);

    // 2. Obtener ciudadano_id
    const [rows] = await connection.promise().query(
      'SELECT ciudadano_id FROM ciudadanos WHERE curp = ?',
      [ciudadano.curp]
    );

    const ciudadano_id = rows[0].ciudadano_id;

    // 3. Insertar credencial
    const credencialSQL = `
      INSERT INTO credenciales (ciudadano_id, folio_credencial, tipo_credencial, fecha_emision)
      VALUES (?, ?, ?, ?)
    `;
    await connection.promise().query(credencialSQL, [
      ciudadano_id,
      credencial.folio_credencial,
      credencial.tipo_credencial,
      credencial.fecha_emision
    ]);

    // 4. Insertar domicilio
    const domicilioSQL = `
      INSERT INTO domicilios (ciudadano_id, calle, municipio, estado)
      VALUES (?, ?, ?, ?)
    `;
    await connection.promise().query(domicilioSQL, [
      ciudadano_id,
      domicilio.calle,
      domicilio.municipio,
      domicilio.estado
    ]);

    res.status(201).json({
      message: '✅ Registro completo exitoso',
      ciudadano_id: ciudadano_id
    });

  } catch (error) {
    console.error('❌ Error en el registro completo:', error);
    res.status(500).json({ error: '❌ Error en el registro completo' });
  }
});


// 🔍 BUSCAR POR ID o CURP
app.get('/api/registro-completo/buscar', async (req, res) => {
  const { id, curp } = req.query;

  try {
    let query = '';
    let params = [];

    if (id) {
      query = 'WHERE c.ciudadano_id = ?';
      params.push(id);
    } else if (curp) {
      query = 'WHERE c.curp = ?';
      params.push(curp);
    } else {
      return res.status(400).json({ error: '❌ Se requiere id o curp para buscar' });
    }

    const [result] = await connection.promise().query(
      `
      SELECT 
        c.*, cr.folio_credencial, cr.tipo_credencial, cr.fecha_emision,
        d.calle, d.municipio, d.estado
      FROM ciudadanos c
      LEFT JOIN credenciales cr ON c.ciudadano_id = cr.ciudadano_id
      LEFT JOIN domicilios d ON c.ciudadano_id = d.ciudadano_id
      ${query}
      `,
      params
    );

    if (result.length === 0) {
      return res.status(404).json({ message: '❌ No se encontró el registro' });
    }

    res.json(result[0]);

  } catch (error) {
    console.error('❌ Error al buscar:', error);
    res.status(500).json({ error: 'Error al buscar registro' });
  }
});


// 🗑️ ELIMINAR POR CURP
app.delete('/api/registro-completo', async (req, res) => {
  const { curp } = req.body;

  if (!curp) {
    return res.status(400).json({ error: '❌ Debes enviar el CURP para eliminar' });
  }

  try {
    const [rows] = await connection.promise().query(
      'SELECT ciudadano_id FROM ciudadanos WHERE curp = ?',
      [curp]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '❌ Ciudadano no encontrado' });
    }

    const ciudadano_id = rows[0].ciudadano_id;

    // Eliminar en orden: credenciales, domicilios, ciudadano
    await connection.promise().query('DELETE FROM credenciales WHERE ciudadano_id = ?', [ciudadano_id]);
    await connection.promise().query('DELETE FROM domicilios WHERE ciudadano_id = ?', [ciudadano_id]);
    await connection.promise().query('DELETE FROM ciudadanos WHERE ciudadano_id = ?', [ciudadano_id]);

    res.json({ message: '✅ Registro eliminado exitosamente' });

  } catch (error) {
    console.error('❌ Error al eliminar:', error);
    res.status(500).json({ error: 'Error al eliminar registro' });
  }
});


// 📋 CONSULTAR TODOS
app.get('/api/registro-completo', async (req, res) => {
  try {
    const [result] = await connection.promise().query(
      `
      SELECT 
        c.*, cr.folio_credencial, cr.tipo_credencial, cr.fecha_emision,
        d.calle, d.municipio, d.estado
      FROM ciudadanos c
      LEFT JOIN credenciales cr ON c.ciudadano_id = cr.ciudadano_id
      LEFT JOIN domicilios d ON c.ciudadano_id = d.ciudadano_id
      `
    );
    res.json(result);

  } catch (error) {
    console.error('❌ Error al consultar:', error);
    res.status(500).json({ error: 'Error al consultar registros' });
  }
});


// 🚀 INICIAR SERVIDOR
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Microservicios corriendo en http://localhost:${PORT}`);
});
