const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const BASE_URL = 'http://localhost:3050'; // APIs ciudadanos, credenciales, domicilios

// Validaciones básicas
function validarCiudadano({ curp, nombre, apellido_paterno, fecha_nacimiento }) {
    if (!curp || typeof curp !== 'string' || curp.length !== 18) {
        return 'CURP inválida, debe ser una cadena de 18 caracteres.';
    }
    if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
        return 'Nombre es obligatorio.';
    }
    if (!apellido_paterno || typeof apellido_paterno !== 'string' || apellido_paterno.trim() === '') {
        return 'Apellido paterno es obligatorio.';
    }
    if (!fecha_nacimiento || isNaN(Date.parse(fecha_nacimiento))) {
        return 'Fecha de nacimiento inválida.';
    }
    return null;
}

function validarCredencial(credencial) {
    if (!credencial) return 'Credencial es obligatoria.';

    if (!credencial.folio_credencial || typeof credencial.folio_credencial !== 'string' || credencial.folio_credencial.trim() === '') {
        return 'folio_credencial es obligatorio y debe ser una cadena no vacía.';
    }

    const tiposValidos = ['NUEVA', 'REPOSICION', 'MODIFICACION'];
    if (!credencial.tipo_credencial || !tiposValidos.includes(credencial.tipo_credencial)) {
        return `tipo_credencial es obligatorio y debe ser uno de: ${tiposValidos.join(', ')}.`;
    }

    if (!credencial.fecha_emision || isNaN(Date.parse(credencial.fecha_emision))) {
        return 'fecha_emision es obligatoria y debe ser una fecha válida.';
    }

    return null;
}

function validarDomicilio(domicilio) {
    if (!domicilio) return 'Domicilio es obligatorio.';
    if (!domicilio.calle || typeof domicilio.calle !== 'string') {
        return 'Calle es obligatoria en domicilio.';
    }
    // Agrega más validaciones según campos de domicilio
    return null;
}

// Obtener todos los ciudadanos con sus credenciales y domicilios
app.get('/ciudadanos-completos', async (req, res) => {
    try {
        // 1. Obtener todos los ciudadanos
        const { data: ciudadanos } = await axios.get(`${BASE_URL}/ciudadanos`);

        if (!Array.isArray(ciudadanos) || ciudadanos.length === 0) {
            return res.json([]); // Retornar arreglo vacío si no hay datos
        }

        // 2. Obtener credenciales y domicilios por ciudadano_id
        const resultados = await Promise.all(
            ciudadanos.map(async (ciudadano) => {
                const ciudadano_id = ciudadano.ciudadano_id;

                try {
                    const [credencialResp, domicilioResp] = await Promise.all([
                        axios.get(`${BASE_URL}/credenciales/ciudadano/${ciudadano_id}`),
                        axios.get(`${BASE_URL}/domicilios/ciudadano/${ciudadano_id}`)
                    ]);

                    return {
                        ...ciudadano,
                        credencial: credencialResp.data,
                        domicilio: domicilioResp.data
                    };
                } catch (error) {
                    console.error(`⚠️ Error al traer datos de ciudadano_id ${ciudadano_id}:`, error.response?.data || error.message);
                    return { ...ciudadano, credencial: null, domicilio: null };
                }
            })
        );

        res.json(resultados);
    } catch (error) {
        console.error('❌ Error al obtener todos los ciudadanos completos:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error al obtener ciudadanos completos' });
    }
});

// Insertar ciudadano + credencial + domicilio con validación y rollback
app.post('/registro-completo', async (req, res) => {
    const { curp, nombre, apellido_paterno, fecha_nacimiento, credencial, domicilio } = req.body;

    // Validaciones
    let errorValidacion = validarCiudadano({ curp, nombre, apellido_paterno, fecha_nacimiento });
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    errorValidacion = validarCredencial(credencial);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    errorValidacion = validarDomicilio(domicilio);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    let ciudadano_id = null;
    let creadoCiudadano = false;
    let creadoCredencial = false;
    let creadoDomicilio = false;

    try {
        // 1. Crear ciudadano
        const ciudadanoResp = await axios.post(`${BASE_URL}/ciudadanos`, {
            curp, nombre, apellido_paterno, fecha_nacimiento
        });
        creadoCiudadano = true;

        // 2. Obtener ciudadano_id
        const { data } = await axios.get(`${BASE_URL}/ciudadanos/curp/${curp}`);
        ciudadano_id = data.ciudadano_id;

        // 3. Crear credencial
        await axios.post(`${BASE_URL}/credenciales`, {
            ciudadano_id,
            ...credencial
        });
        creadoCredencial = true;

        // 4. Crear domicilio
        await axios.post(`${BASE_URL}/domicilios`, {
            ciudadano_id,
            ...domicilio
        });
        creadoDomicilio = true;

        res.status(201).json({ message: 'Registro completo exitoso', ciudadano_id });
    } catch (error) {
        console.error('❌ Error en registro completo:', error.response?.data || error.message);

        // Rollback manual para mantener consistencia
        try {
            if (creadoDomicilio) {
                await axios.delete(`${BASE_URL}/domicilios/ciudadano/${ciudadano_id}`);
            }
            if (creadoCredencial) {
                await axios.delete(`${BASE_URL}/credenciales/ciudadano/${ciudadano_id}`);
            }
            if (creadoCiudadano) {
                await axios.delete(`${BASE_URL}/ciudadanos/curp/${curp}`);
            }
        } catch (rollbackError) {
            console.error('⚠️ Error durante rollback:', rollbackError.response?.data || rollbackError.message);
            return res.status(500).json({ error: 'Error crítico en rollback tras fallo en registro completo.' });
        }

        res.status(500).json({ error: 'Error en registro completo. Operación revertida.' });
    }
});

// Obtener ciudadano completo por CURP
app.get('/ciudadanos/curp/:curp', async (req, res) => {
    const { curp } = req.params;

    try {
        const { data: ciudadano } = await axios.get(`${BASE_URL}/ciudadanos/curp/${curp}`);
        if (!ciudadano || !ciudadano.ciudadano_id) {
            return res.status(404).json({ error: 'Ciudadano no encontrado' });
        }
        const ciudadano_id = ciudadano.ciudadano_id;

        const [credencialResp, domicilioResp] = await Promise.all([
            axios.get(`${BASE_URL}/credenciales/ciudadano/${ciudadano_id}`),
            axios.get(`${BASE_URL}/domicilios/ciudadano/${ciudadano_id}`)
        ]);

        res.json({
            ...ciudadano,
            credencial: credencialResp.data,
            domicilio: domicilioResp.data
        });
    } catch (error) {
        console.error('❌ Error al buscar por CURP:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error al buscar ciudadano' });
    }
});

// Actualizar ciudadano completo por CURP con validaciones
app.put('/ciudadanos/curp/:curp', async (req, res) => {
    const { curp } = req.params;
    const { nombre, apellido_paterno, fecha_nacimiento, credencial, domicilio } = req.body;

    // Validaciones
    let errorValidacion = validarCiudadano({ curp, nombre, apellido_paterno, fecha_nacimiento });
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    if (credencial) {
        errorValidacion = validarCredencial(credencial);
        if (errorValidacion) return res.status(400).json({ error: errorValidacion });
    }
    if (domicilio) {
        errorValidacion = validarDomicilio(domicilio);
        if (errorValidacion) return res.status(400).json({ error: errorValidacion });
    }

    try {
        const { data: ciudadano } = await axios.get(`${BASE_URL}/ciudadanos/curp/${curp}`);
        if (!ciudadano || !ciudadano.ciudadano_id) {
            return res.status(404).json({ error: 'Ciudadano no encontrado para actualizar' });
        }
        const ciudadano_id = ciudadano.ciudadano_id;

        await axios.put(`${BASE_URL}/ciudadanos/curp/${curp}`, {
            nombre,
            apellido_paterno,
            fecha_nacimiento
        });

        if (credencial) {
            await axios.put(`${BASE_URL}/credenciales/ciudadano/${ciudadano_id}`, credencial);
        }

        if (domicilio) {
            await axios.put(`${BASE_URL}/domicilios/ciudadano/${ciudadano_id}`, domicilio);
        }

        res.json({
            message: 'Ciudadano actualizado correctamente',
            ciudadano_id: ciudadano_id  // ← 👈 esto es lo que FastAPI necesita
        });
    } catch (error) {
        console.error('❌ Error al actualizar:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error al actualizar ciudadano' });
    }
});

// Eliminar ciudadano completo por CURP con rollback implícito
app.delete('/ciudadanos/curp/:curp', async (req, res) => {
    const { curp } = req.params;

    try {
        const { data: ciudadano } = await axios.get(`${BASE_URL}/ciudadanos/curp/${curp}`);
        if (!ciudadano || !ciudadano.ciudadano_id) {
            return res.status(404).json({ error: 'Ciudadano no encontrado para eliminar' });
        }
        const ciudadano_id = ciudadano.ciudadano_id;

        // Eliminar credencial y domicilio primero
        await axios.delete(`${BASE_URL}/credenciales/ciudadano/${ciudadano_id}`);
        await axios.delete(`${BASE_URL}/domicilios/ciudadano/${ciudadano_id}`);

        // Luego ciudadano
        await axios.delete(`${BASE_URL}/ciudadanos/curp/${curp}`);

        res.json({ message: 'Ciudadano eliminado correctamente' });
    } catch (error) {
        console.error('❌ Error al eliminar:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error al eliminar ciudadano' });
    }
});

// Puerto
const PORT = 4000;
app.listen(PORT, () => {
    console.log(`🧩 Microservicio orquestador escuchando en http://localhost:${PORT}`);
});
