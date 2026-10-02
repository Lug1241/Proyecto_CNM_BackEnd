const { Op, Sequelize } = require("sequelize"); // 👈 Agregamos Sequelize aquí
const sequelize = require("../config/sequelize.config");
const Fechas_notas = require("../models/fechas_notas.model");
const Asignacion = require("../models/asignacion.model");
const Docente = require("../models/docente.model");
const Materia = require("../models/materia.model");

const obtenerMonitoreoPendientes = async (req, res) => {
    try {
        // 1. Determinar qué periodos son exigibles (donde la fecha de inicio ya pasó o es hoy)
        const hoy = new Date().toISOString().split("T")[0];
        const periodosActivos = await Fechas_notas.findAll({
            where: { fecha_inicio: { [Op.lte]: hoy } }
        });

        // Si no hay periodos activos, retornamos el tablero en 0
        if (periodosActivos.length === 0) {
            return res.json({
                resumen: { docentesPendientes: 0, alumnosSinNota: 0, estado: "Estable" },
                detalles: []
            });
        }

        // 2. Construir subconsultas dinámicas basadas en los periodos activos
        let sumatoriasSQL = [];
        
        // Identificador a prueba de alias de Sequelize para saber si la materia es Básico Elemental
        const isBE = `(SELECT m.nivel FROM materias m WHERE m.ID = Asignacion.ID_materia) LIKE '%BE%'`;

        periodosActivos.forEach(periodo => {
            const desc = periodo.descripcion;
            
            // Lógica para los Parciales
            if (desc.startsWith("parcial")) {
                const quimestre = desc.includes("quim1") ? "Q1" : "Q2";
                const parcial = desc.includes("parcial1") ? "P1" : "P2";
                
                sumatoriasSQL.push(`
                    SUM(
                        CASE 
                            WHEN ${isBE} THEN 
                                (CASE WHEN NOT EXISTS (SELECT 1 FROM calificaciones_parciales_be cp WHERE cp.ID_inscripcion = i.ID AND cp.quimestre='${quimestre}' AND cp.parcial='${parcial}' AND cp.insumo1 IS NOT NULL AND cp.insumo2 IS NOT NULL AND cp.evaluacion IS NOT NULL) THEN 1 ELSE 0 END)
                            ELSE 
                                (CASE WHEN NOT EXISTS (SELECT 1 FROM calificaciones_parciales cp WHERE cp.ID_inscripcion = i.ID AND cp.quimestre='${quimestre}' AND cp.parcial='${parcial}' AND cp.insumo1 IS NOT NULL AND cp.insumo2 IS NOT NULL AND cp.evaluacion IS NOT NULL) THEN 1 ELSE 0 END)
                        END
                    )
                `);
            }
            // Lógica para los Exámenes Quimestrales
            else if (desc.startsWith("quimestre")) {
                const quimestre = desc === "quimestre1" ? "Q1" : "Q2";
                
                sumatoriasSQL.push(`
                    SUM(
                        CASE 
                            WHEN ${isBE} THEN 
                                (CASE WHEN NOT EXISTS (SELECT 1 FROM calificaciones_quimestrales_be cq WHERE cq.ID_inscripcion = i.ID AND cq.quimestre='${quimestre}' AND cq.examen IS NOT NULL) THEN 1 ELSE 0 END)
                            ELSE 
                                (CASE WHEN NOT EXISTS (SELECT 1 FROM calificaciones_quimestrales cq WHERE cq.ID_inscripcion = i.ID AND cq.quimestre='${quimestre}' AND cq.examen IS NOT NULL) THEN 1 ELSE 0 END)
                        END
                    )
                `);
            }
        });

        // Ensamblar la subconsulta final integrando todas las sumatorias
        const subQueryPendientes = `
            COALESCE((
                SELECT ${sumatoriasSQL.join(' + ')}
                FROM inscripciones i
                WHERE i.ID_asignacion = Asignacion.ID
            ), 0)
        `;

        // 3. Ejecutar la consulta cruzando la Asignación con su conteo de pendientes
        const asignaciones = await Asignacion.findAll({
            include: [
                { 
                    model: Docente, 
                    attributes: ['ID', 'nroCedula', 'primer_nombre', 'primer_apellido', 'habilitado', 'habilitado_hasta'] 
                },
                { 
                    model: Materia, 
                    as: 'materiaDetalle', 
                    attributes: ['nombre', 'nivel'] 
                }
            ],
            attributes: {
                include: [
                    // 👈 CORREGIDO: Usando Sequelize con mayúscula
                    [Sequelize.literal(subQueryPendientes), 'pendientesCount']
                ]
            }
        });

        // 4. Formatear la salida para el frontend
        let totalDocentesPendientes = new Set();
        let totalAlumnosSinNota = 0;
        let detalles = [];

        asignaciones.forEach(asig => {
            const pendientes = parseInt(asig.dataValues.pendientesCount, 10);
            
            // Solo procesamos las asignaciones que tengan 1 o más pendientes
            if (pendientes > 0) {
                totalDocentesPendientes.add(asig.Docente.ID);
                totalAlumnosSinNota += pendientes;
                
                detalles.push({
                    idDocente: asig.Docente.ID,
                    nroCedula: asig.Docente.nroCedula,
                    docente: `${asig.Docente.primer_nombre} ${asig.Docente.primer_apellido}`,
                    materia: asig.materiaDetalle.nombre,
                    nivel: asig.materiaDetalle.nivel,
                    pendientes: pendientes,
                    habilitado: asig.Docente.habilitado,
                    habilitado_hasta: asig.Docente.habilitado_hasta
                });
            }
        });

        // Determinar el indicador visual global
        const estado = totalAlumnosSinNota > 50 ? "Crítico" : (totalAlumnosSinNota > 0 ? "Atención" : "Estable");

        res.json({
            resumen: {
                docentesPendientes: totalDocentesPendientes.size,
                alumnosSinNota: totalAlumnosSinNota,
                estado: estado
            },
            detalles: detalles
        });

    } catch (error) {
        console.error("Error en monitoreo de pendientes:", error);
        res.status(500).json({ msg: "Error al procesar el monitoreo", error: error.message });
    }
};

module.exports = {
    obtenerMonitoreoPendientes
};