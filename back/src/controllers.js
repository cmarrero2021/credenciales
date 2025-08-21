const jwt = require('jsonwebtoken');
const pool = require('./db');
const {
    hashPassword,
    comparePassword,
    generateToken,
    generateSecureToken,
    sendEmail,
    validatePassword,
    getSessionTimeout
} = require('./utils');
// ================================
// Servidores
// ================================
// Crear servidores
exports.createServer = async (req, res) => {
    const { area_id, institucion_id, sede_id, estado_id, cedula, nombres, apellidos, cargo_id } = req.body;
    const client = await pool.connect();
    try {
        const server = await client.query('SELECT cedula FROM servidores WHERE cedula = $1', [cedula]);
        if (server.rowCount > 0) {
            return res.status(409).json({ error: 'La cédula del servidor ya está registrada.' });
        }
        // Insertar servidor
        await client.query(
            'INSERT INTO servidores (cedula, nombres, apellidos, institucion_id, sede_id, area_id, cargo_id) VALUES ($4, $5, $6, $2, $3, $1, $7)',
            [area_id, institucion_id, sede_id, cedula, nombres, apellidos, cargo_id]
        );
        // Si hay archivo de foto
        if (req.file && req.file.path) {
            // Buscar el usuario_id por la cédula
            const userRes = await client.query('SELECT id FROM servidores WHERE cedula = $1', [cedula]);
            if (userRes.rows.length > 0) {
                const usuario_id = userRes.rows[0].id;
                const foto_url = req.file.path.replace(/\\/g, '/');
                await client.query('INSERT INTO fotos_usuarios (usuario_id, foto_url) VALUES ($1, $2)', [usuario_id, foto_url]);
            }
        }
        res.status(200).json({ message: 'Servidor creado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear el servidor.' });
    } finally {
        client.release();
    }
};
// Listar Servidores
exports.listServers = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT a.institucion_id,a.institucion,a.sede_id,a.sede,a.area_id,a.area,a.cedula,a.nombres ||  a.apellidos as nombres,a.cargo_id,a.cargo FROM vservidores a  ORDER BY a.institucion_id,a.sede_id,a.area_id,a.cedula');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los servidores.' });
    } finally {
        client.release();
    }
};

// Buscar servidor
exports.seekServer = async (req, res) => {
    const { cedula } = req.params;
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT a.institucion_id, a.institucion, a.sede_id, a.sede, a.area_id, a.area, a.cedula, a.nombres, a.hora_voto, a.observaciones FROM vservidores a WHERE a.cedula = $1',
            [cedula]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Servidor no encontrado.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al buscar el servidor.' });
    } finally {
        client.release();
    }
};
exports.updateServer = async (req, res) => {
    const { cedula } = req.params;
    const { area_id, institucion_id, sede_id, nombres, hora_voto, observaciones } = req.body;
    const client = await pool.connect();
    try {
        const updates = [];
        const values = [];

        if (area_id !== undefined) {
            updates.push('area_id = $' + (values.length + 1));
            values.push(area_id);
        }
        if (institucion_id !== undefined) {
            updates.push('institucion_id = $' + (values.length + 1));
            values.push(institucion_id);
        }
        if (sede_id !== undefined) {
            updates.push('sede_id = $' + (values.length + 1));
            values.push(sede_id);
        }
        if (nombres !== undefined) {
            updates.push('nombres = $' + (values.length + 1));
            values.push(nombres);
        }
        if (hora_voto !== undefined) {
            updates.push('hora_voto = $' + (values.length + 1));
            values.push(hora_voto);
        }
        if (observaciones !== undefined) {
            updates.push('observaciones = $' + (values.length + 1));
            values.push(observaciones);
        }

        values.push(cedula); // Añadir la cedula al final de los valores
        const query = `UPDATE servidores SET ${updates.join(', ')}, updated_at = NOW() WHERE cedula = $${values.length}`;
        await client.query(query, values);
        res.status(200).json({ message: 'Servidor actualizado exitosamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar el servidor.' });
    } finally {
        client.release();
    }
};
// Actualización masiva de la hora del voto de los servidores

exports.massUpdateServer = async (req, res) => {
    const { cedulas } = req.body;
    
    if (!cedulas || typeof cedulas !== 'string') {
        return res.status(400).json({ error: 'Se requiere el parámetro cedulas con múltiples cédulas separadas por espacios' });
    }

    const client = await pool.connect();
    try {
        // Procesar las cédulas
        const cedulasProcesadas = cedulas.split(/\s+/)
            .map(ced => ced.replace(/\D/g, ''))
            .filter(ced => ced.length > 0);

        const cedulasUnicas = [...new Set(cedulasProcesadas)];

        // Objetos para almacenar los detalles
        const resultado = {
            actualizadas: {
                cantidad: 0,
                cedulas: []
            },
            previamente_cargadas: {
                cantidad: 0,
                cedulas: []
            },
            rechazadas: {
                cantidad: 0,
                cedulas: []
            },
            total_procesadas: cedulasUnicas.length
        };

        for (const cedula of cedulasUnicas) {
            try {
                // Verificar si existe la cédula y su hora_voto
                const checkQuery = 'SELECT hora_voto FROM servidores WHERE cedula = $1';
                const checkResult = await client.query(checkQuery, [cedula]);
                
                if (checkResult.rows.length > 0) {
                    if (checkResult.rows[0].hora_voto === null) {
                        // Actualizar solo si hora_voto es NULL
                        const updateQuery = 'UPDATE servidores SET hora_voto = NOW(), updated_at = NOW() WHERE cedula = $1';
                        await client.query(updateQuery, [cedula]);
                        resultado.actualizadas.cantidad++;
                        resultado.actualizadas.cedulas.push(cedula);
                    } else {
                        resultado.previamente_cargadas.cantidad++;
                        resultado.previamente_cargadas.cedulas.push(cedula);
                    }
                } else {
                    resultado.rechazadas.cantidad++;
                    resultado.rechazadas.cedulas.push(cedula);
                }
            } catch (err) {
                console.error(`Error procesando cédula ${cedula}:`, err);
                resultado.rechazadas.cantidad++;
                resultado.rechazadas.cedulas.push(cedula);
            }
        }

        res.status(200).json({ 
            message: 'Proceso de actualización masiva completado.',
            ...resultado
        });
    } catch (err) {
        console.error('Error en massUpdateServer:', err);
        res.status(500).json({ error: 'Error en el proceso de actualización masiva' });
    } finally {
        client.release();
    }
}
// Listado de movilización de  adultos por estado
exports.elderState = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT estado,cantidad_personas as cant_estado,porcentaje_cantidad_personas,por_movilizar,porcentaje_por_movilizar,adultos_meta  FROM vmovilizacion_adultos_estados');
        // const result = await client.query('SELECT estado,cantidad_personas as cant_estado,  FROM vmovilizacion_adultos_estados');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los adultos.' });
    } finally {
        client.release();
    }
};
// Listado de movilización de servidores por estado
exports.serverPosition = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id,cargo FROM cargos ORDER BY cargo');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los cargos.' });
    } finally {
        client.release();
    }
};
exports.elderHour = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT franja_horaria,cantidad,acumulado FROM vmovilizacion_adultos_horas');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los adultos.' });
    } finally {
        client.release();
    }
};
exports.elderHourState = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT estado_nombre, CASE WHEN "0" IS NULL THEN 0 ELSE "0"::integer END AS "00", CASE WHEN "1" IS NULL THEN 0 ELSE "1"::integer END AS "01", CASE WHEN "2" IS NULL THEN 0 ELSE "2"::integer END AS "02", CASE WHEN "3" IS NULL THEN 0 ELSE "3"::integer END AS "03", CASE WHEN "4" IS NULL THEN 0 ELSE "4"::integer END AS "04", CASE WHEN "5" IS NULL THEN 0 ELSE "5"::integer END AS "05", CASE WHEN "6" IS NULL THEN 0 ELSE "6"::integer END AS "06", CASE WHEN "7" IS NULL THEN 0 ELSE "7"::integer END AS "07", CASE WHEN "8" IS NULL THEN 0 ELSE "8"::integer END AS "08", CASE WHEN "9" IS NULL THEN 0 ELSE "9"::integer END AS "09", CASE WHEN "10" IS NULL THEN 0 ELSE "10"::integer END AS "10", CASE WHEN "11" IS NULL THEN 0 ELSE "11"::integer END AS "11", CASE WHEN "12" IS NULL THEN 0 ELSE "12"::integer END AS "12", CASE WHEN "13" IS NULL THEN 0 ELSE "13"::integer END AS "13", CASE WHEN "14" IS NULL THEN 0 ELSE "14"::integer END AS "14", CASE WHEN "15" IS NULL THEN 0 ELSE "15"::integer END AS "15", CASE WHEN "16" IS NULL THEN 0 ELSE "16"::integer END AS "16", CASE WHEN "17" IS NULL THEN 0 ELSE "17"::integer END AS "17", CASE WHEN "18" IS NULL THEN 0 ELSE "18"::integer END AS "18", CASE WHEN "19" IS NULL THEN 0 ELSE "19"::integer END AS "19", CASE WHEN "20" IS NULL THEN 0 ELSE "20"::integer END AS "20", CASE WHEN "21" IS NULL THEN 0 ELSE "21"::integer END AS "21", CASE WHEN "22" IS NULL THEN 0 ELSE "22"::integer END AS "22", CASE WHEN "23" IS NULL THEN 0 ELSE "23"::integer END AS "23" FROM vmovilizacion_hora_estado_adultos;');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar la movilización de adultos.' });
    } finally {
        client.release();
    }
};
exports.serverHourState = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT estado_nombre, CASE WHEN "0" IS NULL THEN 0 ELSE "0"::integer END AS "00", CASE WHEN "1" IS NULL THEN 0 ELSE "1"::integer END AS "01", CASE WHEN "2" IS NULL THEN 0 ELSE "2"::integer END AS "02", CASE WHEN "3" IS NULL THEN 0 ELSE "3"::integer END AS "03", CASE WHEN "4" IS NULL THEN 0 ELSE "4"::integer END AS "04", CASE WHEN "5" IS NULL THEN 0 ELSE "5"::integer END AS "05", CASE WHEN "6" IS NULL THEN 0 ELSE "6"::integer END AS "06", CASE WHEN "7" IS NULL THEN 0 ELSE "7"::integer END AS "07", CASE WHEN "8" IS NULL THEN 0 ELSE "8"::integer END AS "08", CASE WHEN "9" IS NULL THEN 0 ELSE "9"::integer END AS "09", CASE WHEN "10" IS NULL THEN 0 ELSE "10"::integer END AS "10", CASE WHEN "11" IS NULL THEN 0 ELSE "11"::integer END AS "11", CASE WHEN "12" IS NULL THEN 0 ELSE "12"::integer END AS "12", CASE WHEN "13" IS NULL THEN 0 ELSE "13"::integer END AS "13", CASE WHEN "14" IS NULL THEN 0 ELSE "14"::integer END AS "14", CASE WHEN "15" IS NULL THEN 0 ELSE "15"::integer END AS "15", CASE WHEN "16" IS NULL THEN 0 ELSE "16"::integer END AS "16", CASE WHEN "17" IS NULL THEN 0 ELSE "17"::integer END AS "17", CASE WHEN "18" IS NULL THEN 0 ELSE "18"::integer END AS "18", CASE WHEN "19" IS NULL THEN 0 ELSE "19"::integer END AS "19", CASE WHEN "20" IS NULL THEN 0 ELSE "20"::integer END AS "20", CASE WHEN "21" IS NULL THEN 0 ELSE "21"::integer END AS "21", CASE WHEN "22" IS NULL THEN 0 ELSE "22"::integer END AS "22", CASE WHEN "23" IS NULL THEN 0 ELSE "23"::integer END AS "23" FROM vmovilizacion_servidores_hora_estado;');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar la movilización de servidores.' });
    } finally {
        client.release();
    }
};

exports.elderTotals = async (req,res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT movilizados,por_movilizar,meta FROM vtotal_adultos');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los adultos.' });
    } finally {
        client.release();
    }   
}
exports.serverTotals = async (req,res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT movilizados,por_movilizar,meta FROM vtotal_servidores');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los servidores.' });
    } finally {
        client.release();
    }
}
exports.serverInstitutionAreaTotals = async (req,res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT institucion,area,movilizados,por_movilizar,total FROM vmovilizacion_servidorres_insitucion_area');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los servidores.' });
    } finally {
        client.release();
    }
}
exports.elderTotalState = async (req,res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT estado,cantidad_adultos,meta FROM vcumplimiento_metas_adultos');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los adultos.' });
    } finally {
        client.release();
    }   
}
// Consulta de cédulas por lote en renac_anc
exports.readRenac = async (req, res) => {
    // Verificar que se proporcionó el parámetro de cédulas
    if (!req.query.cedulas || typeof req.query.cedulas !== 'string') {
        return res.status(400).json({ error: 'Debe proporcionar un listado de cédulas separadas por espacios' });
    }

    const cedulas = req.query.cedulas.trim().split(/\s+/);
    if (cedulas.length === 0) {
        return res.status(400).json({ error: 'El listado de cédulas está vacío' });
    }

    const client = await pool.connect();
    try {
        // Consultar las cédulas en la base de datos
        const query = `
            SELECT cedula, fecha_nac 
            FROM renac_anc 
            WHERE cedula = ANY($1)
        `;
        
        const result = await client.query(query, [cedulas]);
        
        // Procesar los resultados
        const noEncontradas = [];
        const menores60 = [];
        const mayores60 = [];
        
        const encontradas = new Set(); // Para trackear qué cédulas se encontraron
        
        // Procesar cada registro encontrado
        for (const row of result.rows) {
            encontradas.add(row.cedula);
            
            // Parsear la fecha de nacimiento (formato YYMMDD)
            const fechaNacStr = row.fecha_nac;
            let year = parseInt(fechaNacStr.substring(0, 2), 10);
            const month = parseInt(fechaNacStr.substring(2, 4), 10) - 1; // Meses son 0-indexed
            const day = parseInt(fechaNacStr.substring(4, 6), 10);
            
            // Asumimos que años < 50 son 2000s, >=50 son 1900s
            year = year < 50 ? 2000 + year : 1900 + year;
            
            const fechaNac = new Date(year, month, day);
            const hoy = new Date();
            
            // Calcular edad
            let edad = hoy.getFullYear() - fechaNac.getFullYear();
            const mesActual = hoy.getMonth();
            const diaActual = hoy.getDate();
            
            // Ajustar si aún no ha cumplido años este año
            if (mesActual < month || (mesActual === month && diaActual < day)) {
                edad--;
            }
            
            // Clasificar la cédula
            if (edad >= 60) {
                mayores60.push({
                    cedula: row.cedula,
                    edad: edad,
                    fecha_nac: fechaNac.toISOString().split('T')[0] // Formato YYYY-MM-DD
                });
            } else {
                menores60.push({
                    cedula: row.cedula,
                    edad: edad,
                    fecha_nac: fechaNac.toISOString().split('T')[0]
                });
            }
        }
        
        // Encontrar cédulas no encontradas
        for (const cedula of cedulas) {
            if (!encontradas.has(cedula)) {
                noEncontradas.push(cedula);
            }
        }
        
        // Devolver los resultados
        res.status(200).json({
            no_encontradas: noEncontradas,
            menores_60: menores60,
            mayores_60: mayores60
        });
        
    } catch (err) {
        console.error('Error al procesar las cédulas:', err);
        res.status(500).json({ error: 'Error al procesar las cédulas' });
    } finally {
        client.release();
    }
};
// Listado de movilización de servidores por estado
exports.serveHour = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT franja_horaria,cantidad,acumulado FROM vmovilizacion_servidores_horas');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los servidores.' });
    } finally {
        client.release();
    }
};
exports.eldersInsert = async (req, res) => {
    const { cedulas } = req.body;
    
    if (!cedulas || typeof cedulas !== 'string') {
        return res.status(400).json({ error: 'Se requiere el parámetro cedulas con múltiples cédulas separadas por espacios' });
    }

    const client = await pool.connect();
    // try {
        // Procesar las cédulas
        const cedulasProcesadas = cedulas.split(/\s+/)
            .map(ced => ced.replace(/\D/g, ''))
            .filter(ced => ced.length > 0);

        const cedulasUnicas = [...new Set(cedulasProcesadas)];

        // Objetos para almacenar los detalles
        const resultado = {
            insertadas: {
                cantidad: 0,
                cedulas: []
            },
            previamente_existentes: {
                cantidad: 0,
                cedulas: []
            },
            rechazadas: {
                cantidad: 0,
                cedulas: []
            },
            edad_insuficiente: {
                cantidad: 0,
                cedulas: []
            },
            total_procesadas: cedulasUnicas.length
        };

        for (const cedula of cedulasUnicas) {
            try {
                // Verificar si la cédula ya existe en la tabla adultos
                const checkExistQuery = 'SELECT 1 FROM adultos WHERE cedula = $1';
                const checkExistResult = await client.query(checkExistQuery, [cedula]);
                
                if (checkExistResult.rows.length > 0) {
                    resultado.previamente_existentes.cantidad++;
                    resultado.previamente_existentes.cedulas.push(cedula);
                    continue;
                }

                // Verificar la edad en renac_anc y obtener estado_id
                const checkAgeQuery = 'SELECT fecha_nac, estado_id FROM renac_anc WHERE cedula = $1';
                const checkAgeResult = await client.query(checkAgeQuery, [cedula]);
                
                if (checkAgeResult.rows.length === 0) {
                    // No se encontró la cédula en renac_anc
                    resultado.rechazadas.cantidad++;
                    resultado.rechazadas.cedulas.push(cedula);
                    continue;
                }

                const fechaNacStr = checkAgeResult.rows[0].fecha_nac;
                const estadoId = checkAgeResult.rows[0].estado_id;
                
                if (!fechaNacStr || fechaNacStr.length !== 8) {
                    resultado.rechazadas.cantidad++;
                    resultado.rechazadas.cedulas.push(cedula);
                    continue;
                }

                // Convertir YYYYMMDD a Date
                const year = parseInt(fechaNacStr.substring(0, 4));
                const month = parseInt(fechaNacStr.substring(4, 6)) - 1; // Meses son 0-indexados
                const day = parseInt(fechaNacStr.substring(6, 8));
                
                const fechaNac = new Date(year, month, day);
                const hoy = new Date();
                
                // Calcular edad
                let edad = hoy.getFullYear() - fechaNac.getFullYear();
                const mes = hoy.getMonth() - fechaNac.getMonth();
                
                if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
                    edad--;
                }

                if (edad < 60) {
                    resultado.edad_insuficiente.cantidad++;
                    resultado.edad_insuficiente.cedulas.push(cedula);
                    continue;
                }

                // Obtener region_id desde la tabla estados
                let regionId = null;
                try {
                    const getRegionQuery = 'SELECT region_id FROM estados WHERE estado_id = $1';
                    const regionResult = await client.query(getRegionQuery, [estadoId]);
                    
                    if (regionResult.rows.length > 0) {
                        regionId = regionResult.rows[0].region_id;
                    } else {
                        // Si no encontramos la región, rechazamos la cédula
                        throw new Error('No se encontró región para el estado_id');
                    }
                } catch (err) {
                    console.error(`Error obteniendo región para cédula ${cedula}:`, err);
                    resultado.rechazadas.cantidad++;
                    resultado.rechazadas.cedulas.push(cedula);
                    continue;
                }

                // Insertar la cédula en la tabla adultos con estado_id y region_id
                const insertQuery = `
                    INSERT INTO adultos (cedula, region_id, estado_id, created_at) 
                    VALUES ($1, $2, $3, NOW())
                `;
                await client.query(insertQuery, [cedula, regionId, estadoId]);
                resultado.insertadas.cantidad++;
                resultado.insertadas.cedulas.push(cedula);

            } catch (err) {
                console.error(`Error procesando cédula ${cedula}:`, err);
                resultado.rechazadas.cantidad++;
                resultado.rechazadas.cedulas.push(cedula);
            }
        }

        res.status(200).json({ 
            message: 'Proceso de inserción de adultos mayores completado.',
            ...resultado
        });
    // } catch (err) {
    //     console.error('Error en eldersInsert:', err);
    //     res.status(500).json({ error: 'Error en el proceso de inserción de adultos mayores' });
    // } finally {
        client.release();
    // }
};
// estadisticas de los adultos mayores
exports.elderStatistics = async (req, res) => {
    const client = await pool.connect();
    try {
        // Consultar todas las vistas en paralelo para mejor rendimiento
        const [movilizacion, estados, horas, regiones] = await Promise.all([
            client.query('SELECT franja_horaria, region, estado, nac, cedula, nombre, fecha_nac, edad, sexo, hora_voto FROM vmovilizacion_adultos'),
            client.query('SELECT estado_id, estado, cantidad_personas FROM vmovilizacion_adultos_estados'),
            client.query('SELECT franja_horaria, cantidad, acumulado FROM vmovilizacion_adultos_horas'),
            client.query('SELECT id, region, cantidad_personas FROM vmovilizacion_adultos_regiones')
        ]);

        // Estructurar la respuesta
        const response = {
            movilizacion: movilizacion.rows,
            estados: estados.rows,
            horas: horas.rows,
            regiones: regiones.rows,
            metadata: {
                timestamp: new Date().toISOString(),
                totalMovilizacion: movilizacion.rows.length,
            }
        };

        res.status(200).json(response);
    } catch (err) {
        console.error('Error en elderStatistics:', err);
        res.status(500).json({ 
            error: 'Error al obtener las estadísticas de adultos mayores.',
            details: err.message 
        });
    } finally {
        client.release();
    }
};
exports.serverStatistics = async (req, res) => {
    const client = await pool.connect();
    try {
        // Consultar todas las vistas en paralelo para mejor rendimiento
        const [movilizacion, servidores, horas, total,instituciones,sedes,areas] = await Promise.all([
            client.query('SELECT id,franja_horaria,institucion_id,institucion,sede_id,sede,area_id,area,cedula,nombres,hora_voto,observaciones from vmovilizacion_servidores '),
            client.query('SELECT id,institucion_id,institucion,sede_id,sede,area_id,area,cedula,nombres,hora_voto,observaciones from vservidores'),
            client.query('SELECT franja_horaria, cantidad, acumulado FROM vmovilizacion_servidores_horas'),
            client.query('SELECT movilizados,por_movilizar,total_registros FROM vtotal_servidores'),
            client.query('SELECT institucion_id,institucion,movilizados,total_registros FROM vmovilizacion_servidores_institucion'),
            client.query('SELECT sede_id,sede,movilizados,total_registros FROM vmovilizacion_servidores_sedes'),
            client.query('SELECT id,area,movilizados,total_registros FROM vmovilizacion_servidores_area')
        ]);

        // Estructurar la respuesta
        const response = {
            movilizacion: movilizacion.rows,
            servidores: servidores.rows,
            horas: horas.rows,
            total: total.rows,
            instituciones: instituciones.rows,
            sedes: sedes.rows,
            areas: areas.rows, 
            metadata: {
                timestamp: new Date().toISOString(),
                totalMovilizacion: movilizacion.rows.length,
            }
        };

        res.status(200).json(response);
    } catch (err) {
        console.error('Error en serverStatistics:', err);
        res.status(500).json({ 
            error: 'Error al obtener las estadísticas de los servidores.',
            details: err.message 
        });
    } finally {
        client.release();
    }
};

// Eliminar servidor (Borrado Lógico)
exports.deleteServer = async (req, res) => {
    const { cedula } = req.params;
    const client = await pool.connect();
    try {
        //await client.query('UPDATE servidores SET deleted_at = NOW() WHERE cedula = $1', [cedula]);
        await client.query('DELETE from servidores WHERE cedula = $1', [cedula]);
        res.status(200).json({ message: 'Servidor eliminado.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el servidor.' });
    } finally {
        client.release();
    }
};

// Eliminar servidor (Borrado Físico)
exports.deleteServerPermanently = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario permanentemente.' });
    } finally {
        client.release();
    }
};

// ================================
// Instituciones
// ================================
// Crear instituciones
exports.createInstitution = async (req, res) => {
    const { username, email, password } = req.body;

    // Validar el formato del password
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
        return res.status(400).json({ errors: passwordErrors });
    }

    const hashedPassword = await hashPassword(password);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Crear usuario
        const result = await client.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
            [username, email, hashedPassword]
        );
        const userId = result.rows[0].id;

        // Generar token de verificación
        const token = generateSecureToken();
        // Enviar correo de verificación
        const verificationLink = `http://intranet.minaamp.gob.ve/verify-email?token=${token}`;
        await sendEmail(email, 'Verifica tu correo', `Haz clic en el siguiente enlace para verificar tu correo: ${verificationLink}`);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Usuario creado exitosamente. Se ha enviado un correo de verificación.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al crear el usuario.' });
    } finally {
        client.release();
    }
};
// Listar institucion
exports.listInstitutions = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT a.id,a.institucion FROM instituciones a  ORDER BY a.id');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar las instituciones.' });
    } finally {
        client.release();
    }
};

// Actualizar institucion
exports.updateInstitution = async (req, res) => {
    const { userId } = req.params;
    const { username, email } = req.body;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET username = $1, email = $2, updated_at = NOW() WHERE id = $3', [username, email, userId]);
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar institucion (Borrado Lógico)
exports.deleteInstitution = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado lógicamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar servidor (Borrado Físico)
exports.deleteInstitutionPermanently = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario permanentemente.' });
    } finally {
        client.release();
    }
};

// ================================
// Sedes
// ================================
// Crear sede
exports.createHeadquarter = async (req, res) => {
    const { username, email, password } = req.body;

    // Validar el formato del password
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
        return res.status(400).json({ errors: passwordErrors });
    }

    const hashedPassword = await hashPassword(password);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Crear usuario
        const result = await client.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
            [username, email, hashedPassword]
        );
        const userId = result.rows[0].id;

        // Generar token de verificación
        const token = generateSecureToken();
        // Enviar correo de verificación
        const verificationLink = `http://intranet.minaamp.gob.ve/verify-email?token=${token}`;
        await sendEmail(email, 'Verifica tu correo', `Haz clic en el siguiente enlace para verificar tu correo: ${verificationLink}`);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Usuario creado exitosamente. Se ha enviado un correo de verificación.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al crear el usuario.' });
    } finally {
        client.release();
    }
};
// Listar Sedes
exports.listHeadquarters = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT a.id,a.sede FROM sedes a WHERE a.deleted_at IS NULL ORDER BY a.id ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar las sedes.' });
    } finally {
        client.release();
    }
};

// Actualizar sede
exports.updateHeadquarter = async (req, res) => {
    const { userId } = req.params;
    const { username, email } = req.body;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET username = $1, email = $2, updated_at = NOW() WHERE id = $3', [username, email, userId]);
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar sede (Borrado Lógico)
exports.deleteHeadquarter = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado lógicamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar sede (Borrado Físico)
exports.deleteHeadquarterPermanently = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario permanentemente.' });
    } finally {
        client.release();
    }
};

// ================================
// Areas
// ================================
// Crear area
exports.createArea = async (req, res) => {
    const { username, email, password } = req.body;

    // Validar el formato del password
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
        return res.status(400).json({ errors: passwordErrors });
    }

    const hashedPassword = await hashPassword(password);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Crear usuario
        const result = await client.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
            [username, email, hashedPassword]
        );
        const userId = result.rows[0].id;

        // Generar token de verificación
        const token = generateSecureToken();
        // Enviar correo de verificación
        const verificationLink = `http://intranet.minaamp.gob.ve/verify-email?token=${token}`;
        await sendEmail(email, 'Verifica tu correo', `Haz clic en el siguiente enlace para verificar tu correo: ${verificationLink}`);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Usuario creado exitosamente. Se ha enviado un correo de verificación.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al crear el usuario.' });
    } finally {
        client.release();
    }
};
// Listar areas
exports.listAreas = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id AS area_id,a.area FROM areas a  WHERE a.deleted_at IS NULL ORDER BY a.id ASC');
        // const result = await client.query('SELECT a.institucion_id,b.institucion,a.sede_id,c.sede,a.id AS area_id,a.area FROM areas a LEFT JOIN instituciones b ON b.id = a.institucion_id LEFT JOIN sedes c ON c.id = a.sede_id WHERE a.deleted_at IS NULL ORDER BY a.institucion_id,a.sede_id,a.id ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar las áreas.' });
    } finally {
        client.release();
    }
};

// Actualizar area
exports.updateArea = async (req, res) => {
    const { userId } = req.params;
    const { username, email } = req.body;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET username = $1, email = $2, updated_at = NOW() WHERE id = $3', [username, email, userId]);
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar area (Borrado Lógico)
exports.deleteArea = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado lógicamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar area (Borrado Físico)
exports.deleteAreaPermanently = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario permanentemente.' });
    } finally {
        client.release();
    }
};


// ================================
// Usuarios
// ================================

// Crear Usuario
exports.createUser = async (req, res) => {
    const { username, email, password } = req.body;

    // Validar el formato del password
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
        return res.status(400).json({ errors: passwordErrors });
    }

    const hashedPassword = await hashPassword(password);

    const client = await pool.connect();
    // try {
        await client.query('BEGIN');

        // Crear usuario
        const result = await client.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
            [username, email, hashedPassword]
        );
        const userId = result.rows[0].id;

        // Generar token de verificación
        // const token = generateSecureToken();
        // Enviar correo de verificación
        // const verificationLink = `http://intranet.minaamp.gob.ve/verify-email?token=${token}`;
        // await sendEmail(email, 'Verifica tu correo', `Haz clic en el siguiente enlace para verificar tu correo: ${verificationLink}`);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Usuario creado exitosamente. Se ha enviado un correo de verificación.' });
    // } catch (err) {
    //     await client.query('ROLLBACK');
    //     res.status(500).json({ error: 'Error al crear el usuario.' });
    // } finally {
        client.release();
    // }
};

// Verificar Correo Electrónico
exports.verifyEmail = async (req, res) => {
    const { token } = req.body;
    const client = await pool.connect();

    try {
        const result = await client.query('SELECT user_id, expires_at FROM email_verifications WHERE token = $1', [token]);
        if (!result.rows.length || new Date(result.rows[0].expires_at) < new Date()) {
            return res.status(400).json({ error: 'Token inválido o expirado.' });
        }

        await client.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [result.rows[0].user_id]);
        await client.query('DELETE FROM email_verifications WHERE token = $1', [token]);

        res.status(200).json({ message: 'Correo verificado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al verificar el correo.' });
    } finally {
        client.release();
    }
};

// Cambiar Contraseña
exports.changePassword = async (req, res) => {
    const { userId } = req; // Obtenido del middleware de autenticación
    const { oldPassword, newPassword } = req.body;

    // Validar el formato del nuevo password
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
        return res.status(400).json({ errors: passwordErrors });
    }

    const client = await pool.connect();
    try {
        // Verificar la contraseña actual
        const result = await client.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        const isMatch = await comparePassword(oldPassword, result.rows[0].password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
        }

        // Hashear y actualizar la nueva contraseña
        const hashedPassword = await hashPassword(newPassword);
        await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);

        res.status(200).json({ message: 'Contraseña cambiada exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al cambiar la contraseña.' });
    } finally {
        client.release();
    }
};

// Listar Usuarios
exports.listUsers = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id, first_name,last_name,cedula,email, is_email_verified, status, session_timeout_min FROM users WHERE deleted_at IS NULL');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los usuarios.' });
    } finally {
        client.release();
    }
};

// Actualizar Usuario
exports.updateUser = async (req, res) => {
    const { userId } = req.params;
    const { username, email } = req.body;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET username = $1, email = $2, updated_at = NOW() WHERE id = $3', [username, email, userId]);
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar Usuario (Borrado Lógico)
exports.deleteUser = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado lógicamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar Usuario (Borrado Físico)
exports.deleteUserPermanently = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario permanentemente.' });
    } finally {
        client.release();
    }
};

// ================================
// Roles
// ================================

// Crear Rol
exports.createRole = async (req, res) => {
    const { name, description } = req.body;
    console.log("name: ",name);
    console.log("description: ",description);
    const client = await pool.connect();
    try {
        const result = await client.query(
            'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id',
            [name, description]
        );
        res.status(201).json({ message: 'Rol creado exitosamente.', roleId: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear el rol.' });
    } finally {
        client.release();
    }
};
// Listar Roles
exports.listRoles = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id, name, description FROM roles WHERE deleted_at IS NULL');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los roles.' });
    } finally {
        client.release();
    } 
};

// Actualizar Rol
exports.updateRole = async (req, res) => {
    const { roleId } = req.params;
    const { name, description } = req.body;

    const client = await pool.connect();
    try {
        await client.query('UPDATE roles SET name = $1, description = $2, updated_at = NOW() WHERE id = $3', [name, description, roleId]);
        res.status(200).json({ message: 'Rol actualizado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el rol.' });
    } finally {
        client.release();
    }
};

// Eliminar Rol (Borrado Lógico)
exports.deleteRole = async (req, res) => {
    const { roleId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('UPDATE roles SET deleted_at = NOW() WHERE id = $1', [roleId]);
        res.status(200).json({ message: 'Rol eliminado lógicamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el rol.' });
    } finally {
        client.release();
    }
};

// Eliminar Rol (Borrado Físico)
exports.deleteRolePermanently = async (req, res) => {
    const { roleId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM roles WHERE id = $1', [roleId]);
        res.status(200).json({ message: 'Rol eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el rol permanentemente.' });
    } finally {
        client.release();
    }
};

// ================================
// Permisos
// ================================

// Crear Permiso
exports.createPermission = async (req, res) => {
    const { name, description } = req.body;

    const client = await pool.connect();
    try {
        const result = await client.query(
            'INSERT INTO permissions (name, description) VALUES ($1, $2) RETURNING id',
            [name, description]
        );
        res.status(201).json({ message: 'Permiso creado exitosamente.', permissionId: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear el permiso.' });
    } finally {
        client.release();
    }
};

// Listar Permisos
exports.listPermissions = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id, name, description FROM permissions WHERE deleted_at IS NULL');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los permisos.' });
    } finally {
        client.release();
    }
};

// Actualizar Permiso
exports.updatePermission = async (req, res) => {
    const { permissionId } = req.params;
    const { name, description } = req.body;

    const client = await pool.connect();
    try {
        await client.query('UPDATE permissions SET name = $1, description = $2, updated_at = NOW() WHERE id = $3', [name, description, permissionId]);
        res.status(200).json({ message: 'Permiso actualizado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el permiso.' });
    } finally {
        client.release();
    }
};

// Eliminar Permiso (Borrado Lógico)
exports.deletePermission = async (req, res) => {
    const { permissionId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('UPDATE permissions SET deleted_at = NOW() WHERE id = $1', [permissionId]);
        res.status(200).json({ message: 'Permiso eliminado lógicamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el permiso.' });
    } finally {
        client.release();
    }
};

// Eliminar Permiso (Borrado Físico)
exports.deletePermissionPermanently = async (req, res) => {
    const { permissionId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM permissions WHERE id = $1', [permissionId]);
        res.status(200).json({ message: 'Permiso eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el permiso permanentemente.' });
    } finally {
        client.release();
    }
};

// ================================
// Asignaciones
// ================================

// Asignar Rol a Usuario
exports.assignRoleToUser = async (req, res) => {
    const { userId, roleId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
        res.status(200).json({ message: 'Rol asignado al usuario exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al asignar el rol al usuario.' });
    } finally {
        client.release();
    }
};

// Remover Rol de Usuario
exports.removeRoleFromUser = async (req, res) => {
    const { userId, roleId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
        res.status(200).json({ message: 'Rol removido del usuario exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al remover el rol del usuario.' });
    } finally {
        client.release();
    }
};

// Asignar Permiso a Rol
exports.assignPermissionToRole = async (req, res) => {
    const { roleId, permissionId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [roleId, permissionId]);
        res.status(200).json({ message: 'Permiso asignado al rol exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al asignar el permiso al rol.' });
    } finally {
        client.release();
    }
};

// Remover Permiso de Rol
exports.removePermissionFromRole = async (req, res) => {
    const { roleId, permissionId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [roleId, permissionId]);
        res.status(200).json({ message: 'Permiso removido del rol exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al remover el permiso del rol.' });
    } finally {
        client.release();
    }
};

// ================================
// Login y Logout
// ================================

exports.prueba = async (req,res) =>{
    res.status(200).json({ message: 'Prueba exitosa.' });
}
// Login
exports.login = async (req, res) => {
    const { username, password } = req.body;
    const ip = req.ip; // Dirección IP del cliente

    const client = await pool.connect();
    try {
/*
        console.log('🔍 Verificando sesiones activas para:', username);
        // Verificar si el usuario ya tiene una sesión activa
        const activeSession = await client.query(
            'SELECT * FROM login_logs WHERE username = $1 AND logout_type IS NULL',
            [username]
        );

        if (activeSession.rows.length > 0) {
            console.log('🔒 Sesión ya activa para:', username);
            return res.status(403).json({ error: 'La sesión del usuario ya está abierta, no se puede volver a abrir.' });
        }
*/
        console.log('👤 Buscando usuario:', username);
        // Buscar al usuario por nombre de usuario
        const result = await client.query(
            'SELECT id, password_hash, status, failed_login_attempts, last_failed_login FROM users WHERE email = $1',
            [username]
        );

        if (!result.rows.length) {
            console.log('❌ Usuario no encontrado:', username);
            await client.query(
                'INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)',
                [username, ip, 'failed']
            );
            return res.status(400).json({ error: 'Nombre de usuario o contraseña incorrectos.' });
        }

        const user = result.rows[0];

        // Verificar si el usuario está dado de baja
        if (user.status === 'deleted') {
            console.log('🗑️ Usuario dado de baja:', username);
            await client.query(
                'INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)',
                [username, ip, 'failed']
            );
            return res.status(403).json({ error: 'El usuario ha sido dado de baja.' });
        }

        // Verificar si el usuario está suspendido
        if (user.status === 'suspended') {
            console.log('🚫 Usuario suspendido:', username);
            await client.query(
                'INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)',
                [username, ip, 'failed']
            );
            return res.status(403).json({ error: 'El usuario está suspendido.' });
        }
/*
        // Verificar si el usuario tiene más de 3 intentos fallidos
        if (user.failed_login_attempts >= 3 && new Date(user.last_failed_login) > new Date(Date.now() - 15 * 60 * 1000)) {
            console.log('⏰ Usuario bloqueado por múltiples intentos fallidos:', username);
            await client.query(
                'UPDATE users SET status = $1 WHERE id = $2',
                ['suspended', user.id]
            );
            await client.query(
                'INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)',
                [username, ip, 'blocked']
            );
            return res.status(403).json({ error: 'El usuario ha sido bloqueado debido a múltiples intentos fallidos.' });
        }
*/
        console.log('🔐 Comparando contraseña...');
        // Comparar la contraseña
        const isMatch = await comparePassword(password, user.password_hash);

/*        
        if (!isMatch) {
            console.log('⚠️ Contraseña incorrecta:', username);
            await client.query(
                'UPDATE users SET failed_login_attempts = failed_login_attempts + 1, last_failed_login = NOW() WHERE id = $1',
                [user.id]
            );

            await client.query(
                'INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)',
                [username, ip, 'failed']
            );
            return res.status(400).json({ error: 'Nombre de usuario o contraseña incorrectos.' });
        }
        console.log('🔄 Reiniciando contador de intentos fallidos...');
        // Reiniciar el contador de intentos fallidos
        await client.query(
            'UPDATE users SET failed_login_attempts = 0, last_failed_login = NULL WHERE id = $1',
            [user.id]
        );
*/
        console.log('⏳ Obteniendo duración de sesión...');
        // Generar token JWT con vigencia de 120 minutos
        const token = await generateToken(user.id);
            
        // Obtener duración en minutos
        const timeoutMin = await getSessionTimeout(user.id);
        console.log('⏰ Duración de sesión:', timeoutMin, 'minutos');

                console.log('🔑 Generando token JWT...');
        await client.query(
        "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, NOW() + $3 * INTERVAL '1 minute')",
        [user.id, token, parseInt(timeoutMin, 10)]
        );
        ///////////////////
       // Obtener permisos del usuario
        console.log('🔍 Obteniendo permisos del usuario...');
        const permissionsQuery = `
            SELECT p.name, p.description,p.action 
            FROM user_permissions up
            JOIN permissions p ON up.permission_id = p.id
            WHERE up.user_id = $1
            UNION
            SELECT p.name, p.description,p.action 
            FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = $1
            AND NOT EXISTS (
                SELECT 1 FROM user_permissions WHERE user_id = $1
            )
        `;
        
        const permissionsResult = await client.query(permissionsQuery, [user.id]);
        const permissions = permissionsResult.rows;
        ///////////////////
        // Registrar ingreso exitoso en la auditoría
        await client.query(
            'INSERT INTO login_logs (user_id, username, ip_address, login_status, session_token) VALUES ($1, $2, $3, $4, $5)',
            [user.id, username, ip, 'success', token]
        );
        console.log('✅ Registrando login exitoso...');
        res.status(200).json({ message: 'Inicio de sesión exitoso.', token,permissions });
    } catch (err) {
        console.error('❌ Error en login:', err.message);
        console.error('🔍 Detalles del error:', err.stack);        
        res.status(200).json({ 
            message: 'Inicio de sesión exitoso.', 
            permissions,
            token
        });
    } finally {
        client.release();
    }
};

// Logout
exports.logout = async (req, res) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
        return res.status(400).json({ error: 'No se proporcionó un token.' });
    }

    const decoded = jwt.decode(token);
    const userId = decoded.userId;

    const client = await pool.connect();
    try {
        // Marcar la sesión como cerrada por logout
        await client.query(
            'UPDATE login_logs SET logout_type = $1, logout_timestamp = NOW() WHERE session_token = $2',
            ['logout', token]
        );

        // Agregar el token a la lista negra
        const expiresAt = new Date(decoded.exp * 1000);
        await client.query('INSERT INTO blacklisted_tokens (token, expires_at) VALUES ($1, $2)', [token, expiresAt]);

        res.status(200).json({ message: 'Cierre de sesión exitoso.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al cerrar sesión.' });
    } finally {
        client.release();
    }
};
///////////////
exports.forceLogout = async (req, res) => {
    const userId = req.body.userId;
    const client = await pool.connect();
    try {
        await client.query(
            'UPDATE login_logs SET logout_type = $1, logout_timestamp = NOW() WHERE user_id = $2',
            ['force logout', userId]
        );
        res.status(200).json({ message: 'Cierre forzoso de sesión exitoso.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al cerrar sesión.' });
    } finally {
        client.release();
    }
};
///////////////
////////////MANTENEDORES/////////////////
// ================================
// Revistas
// ================================

// Insertarr revista
exports.insertRevista = async (req, res) => {
    const insertFields = req.body; // Campos a insertar

    // Lista de columnas que deben estar en minúsculas
    const columnasMinusculas = ['correo_revista', 'correo_editor', 'url'];

    // Convertir cadenas a mayúsculas o minúsculas según corresponda
    for (const key in insertFields) {
        if (typeof insertFields[key] === 'string') {
            if (columnasMinusculas.includes(key)) {
                // Forzar a minúsculas para columnas específicas
                insertFields[key] = insertFields[key].toLowerCase();
            } else {
                // Convertir a mayúsculas para el resto de las columnas
                insertFields[key] = insertFields[key].toUpperCase();
            }
        }
    }

    const client = await pool.connect();
    try {
        // Construir la consulta dinámicamente
        const keys = Object.keys(insertFields);
        if (keys.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para insertar.' });
        }

        const columns = keys.join(', ');
        // Corregir los placeholders para usar $1, $2, etc.
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
        const values = keys.map(key => insertFields[key]);

        const query = `
            INSERT INTO revistas (${columns})
            VALUES (${placeholders})
            RETURNING *;
        `;

        console.log('Consulta SQL:', query); // Para depuración
        console.log('Valores:', values); // Para depuración

        // Ejecutar la consulta
        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            console.log('No se pudo insertar la revista.');
            return res.status(500).json({ error: 'Error al insertar la revista.' });
        }

        console.log('Revista insertada:', result.rows[0]);
        res.status(201).json({ message: 'Revista insertada exitosamente.', revista: result.rows[0] });
    } catch (err) {
        console.error('Error al insertar la revista:', err);
        res.status(500).json({ error: 'Error al insertar la revista.' });
    } finally {
        client.release();
    }
};

// Actualizar Revista (PATCH)
exports.updateRevista = async (req, res) => {
    const { id } = req.params; // ID de la revista a editar
    const updateFields = req.body; // Campos a actualizar

    console.log(updateFields.portada)

    // Lista de columnas que deben estar en minúsculas
    const columnasMinusculas = ['correo_revista', 'correo_editor', 'url'];

    // Convertir cadenas a mayúsculas o minúsculas según corresponda
    for (const key in updateFields) {
        if (typeof updateFields[key] === 'string') {
            if (columnasMinusculas.includes(key)) {
                // Forzar a minúsculas para columnas específicas
                updateFields[key] = updateFields[key].toLowerCase();
            } else {
                // Convertir a mayúsculas para el resto de las columnas
                updateFields[key] = updateFields[key].toUpperCase();
            }
        }
    }

    const client = await pool.connect();
    try {
        // Construir la consulta dinámicamente
        const keys = Object.keys(updateFields);
        if (keys.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
        }

        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const values = keys.map(key => updateFields[key]);
        values.push(id); // Añadir el ID al final de los valores

        const query = `
            UPDATE revistas
            SET ${setClause}
            WHERE id = $${values.length}
            RETURNING *;
        `;

        // Ejecutar la consulta
        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            console.log('No se encontró la revista con ID:', id);
            return res.status(404).json({ error: 'Revista no encontrada.' });
        }

        console.log('Revista actualizada:', result.rows[0]);
        res.status(200).json({ message: 'Revista actualizada exitosamente.', revista: result.rows[0] });
    } catch (err) {
        console.error('Error al actualizar la revista:', err);
        res.status(500).json({ error: 'Error al actualizar la revista.' });
    } finally {
        client.release();
    }
};
////////////SESIONES/////////////////
// Obtener configuración global de sesión
exports.getGlobalSessionTimeout = async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT global_timeout FROM session_settings WHERE id = 1'
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Configuración global no encontrada' });
      }
  
      res.json({ timeout: result.rows[0].global_timeout });
    } catch (err) {
      console.error('❌ Error al obtener configuración global:', err.message);
      res.status(500).json({ error: 'Error al obtener la configuración global de sesión' });
    }
  };
// Actualizar configuración global de sesión
exports.updateGlobalSessionTimeout = async (req, res) => {
    const { timeout } = req.body;
  
    if (!timeout || typeof timeout !== 'number' || timeout <= 0) {
      return res.status(400).json({ error: 'La duración debe ser un número positivo.' });
    }
  
    try {
      await pool.query(
        'UPDATE session_settings SET global_timeout = $1 WHERE id = 1',
        [timeout]
      );
  
      res.json({ message: 'Duración global de sesión actualizada exitosamente.' });
    } catch (err) {
      console.error('❌ Error al actualizar configuración global:', err.message);
      res.status(500).json({ error: 'Error al actualizar la duración global de sesión' });
    }
  };
// Actualizar duración de sesión específica para usuario
exports.updateUserSessionTimeout = async (req, res) => {
    const { userId } = req.params;
    const { timeout } = req.body;
  
    if (!timeout || typeof timeout !== 'number' || timeout <= 0) {
      return res.status(400).json({ error: 'La duración debe ser un número positivo.' });
    }
  
    try {
      const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userExists.rows.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }
  
      await pool.query(
        'UPDATE users SET session_timeout_min = $1 WHERE id = $2',
        [timeout, userId]
      );
  
      res.json({ message: 'Duración de sesión del usuario actualizada exitosamente' });
    } catch (err) {
      console.error('❌ Error al actualizar sesión de usuario:', err.message);
      res.status(500).json({ error: 'Error al actualizar la duración de sesión del usuario' });
    }
  };
// Actualizar duración de sesión específica para rol
exports.updateRoleSessionTimeout = async (req, res) => {
    const { roleId } = req.params;
    const { timeout } = req.body;
  
    if (!timeout || typeof timeout !== 'number' || timeout <= 0) {
      return res.status(400).json({ error: 'La duración debe ser un número positivo.' });
    }
  
    try {
      const roleExists = await pool.query('SELECT id FROM roles WHERE id = $1', [roleId]);
      if (roleExists.rows.length === 0) {
        return res.status(404).json({ error: 'Rol no encontrado.' });
      }
  
      await pool.query(
        'UPDATE roles SET session_timeout_min = $1 WHERE id = $2',
        [timeout, roleId]
      );
  
      res.json({ message: 'Duración de sesión del rol actualizada exitosamente' });
    } catch (err) {
      console.error('❌ Error al actualizar sesión de rol:', err.message);
      res.status(500).json({ error: 'Error al actualizar la duración de sesión del rol' });
    }
  };
