const { sequelize } = require('../config/sequelize.config')

const getNotasFaltantes = async (req, res) => {
  try {
    const nroCedula = req.user.nroCedula

    // 1) Buscar el periodo activo
    const [[periodo]] = await sequelize.query(
      `SELECT ID, fecha_fin FROM periodos_academicos WHERE estado = 'Activo' LIMIT 1`
    )

    if (!periodo) {
      return res.json({ tiene_faltantes: false, mensaje: 'No hay período activo' })
    }

    const hoy = new Date()
    const fechaFin = new Date(periodo.fecha_fin)
    const diasRestantes = Math.ceil((fechaFin - hoy) / (1000 * 60 * 60 * 24))

    // 2) Contar inscripciones asignadas a este docente en el periodo activo
    const [[totales]] = await sequelize.query(
      `SELECT COUNT(i.ID) AS total
       FROM inscripciones i
       INNER JOIN asignaciones a ON a.ID = i.ID_asignacion
       WHERE a.nroCedula_docente = :cedula
         AND a.ID_periodo_academico = :periodoId`,
      { replacements: { cedula: nroCedula, periodoId: periodo.ID } }
    )

    const totalInscripciones = parseInt(totales.total, 10)
    if (totalInscripciones === 0) {
      return res.json({ tiene_faltantes: false, mensaje: 'Sin asignaciones en el período activo' })
    }

    // 3) Contar inscripciones REGULARES con parciales incompletos
    const [[regularParciales]] = await sequelize.query(
      `SELECT COUNT(DISTINCT i.ID) AS faltantes
       FROM inscripciones i
       INNER JOIN asignaciones a    ON a.ID = i.ID_asignacion
       INNER JOIN matriculas m      ON m.ID = i.ID_matricula
       WHERE a.nroCedula_docente      = :cedula
         AND a.ID_periodo_academico   = :periodoId
         AND m.nivel COLLATE utf8mb4_unicode_ci NOT LIKE '%Básico Elemental%'
         AND (
           SELECT COUNT(*)
           FROM calificaciones_parciales cp
           WHERE cp.ID_inscripcion = i.ID
             AND cp.insumo1 IS NOT NULL AND cp.insumo2 IS NOT NULL AND cp.evaluacion IS NOT NULL
         ) < 4`,
      { replacements: { cedula: nroCedula, periodoId: periodo.ID } }
    )

    // 4) Contar inscripciones REGULARES con quimestrales incompletos
    const [[regularQuimestrales]] = await sequelize.query(
      `SELECT COUNT(DISTINCT i.ID) AS faltantes
       FROM inscripciones i
       INNER JOIN asignaciones a    ON a.ID = i.ID_asignacion
       INNER JOIN matriculas m      ON m.ID = i.ID_matricula
       WHERE a.nroCedula_docente      = :cedula
         AND a.ID_periodo_academico   = :periodoId
         AND m.nivel COLLATE utf8mb4_unicode_ci NOT LIKE '%Básico Elemental%'
         AND (
           SELECT COUNT(*)
           FROM calificaciones_quimestrales cq
           WHERE cq.ID_inscripcion = i.ID
             AND cq.examen IS NOT NULL
         ) < 2`,
      { replacements: { cedula: nroCedula, periodoId: periodo.ID } }
    )

    // 5) Contar inscripciones BE con parciales incompletos
    const [[beParciales]] = await sequelize.query(
      `SELECT COUNT(DISTINCT i.ID) AS faltantes
       FROM inscripciones i
       INNER JOIN asignaciones a    ON a.ID = i.ID_asignacion
       INNER JOIN matriculas m      ON m.ID = i.ID_matricula
       WHERE a.nroCedula_docente      = :cedula
         AND a.ID_periodo_academico   = :periodoId
         AND m.nivel COLLATE utf8mb4_unicode_ci LIKE '%Básico Elemental%'
         AND (
           SELECT COUNT(*)
           FROM calificaciones_parciales_be cpbe
           WHERE cpbe.ID_inscripcion = i.ID
             AND cpbe.insumo1 IS NOT NULL AND cpbe.insumo2 IS NOT NULL AND cpbe.evaluacion IS NOT NULL
         ) < 4`,
      { replacements: { cedula: nroCedula, periodoId: periodo.ID } }
    )

    // 6) Contar inscripciones BE con quimestrales incompletos
    const [[beQuimestrales]] = await sequelize.query(
      `SELECT COUNT(DISTINCT i.ID) AS faltantes
       FROM inscripciones i
       INNER JOIN asignaciones a    ON a.ID = i.ID_asignacion
       INNER JOIN matriculas m      ON m.ID = i.ID_matricula
       WHERE a.nroCedula_docente      = :cedula
         AND a.ID_periodo_academico   = :periodoId
         AND m.nivel COLLATE utf8mb4_unicode_ci LIKE '%Básico Elemental%'
         AND (
           SELECT COUNT(*)
           FROM calificaciones_quimestrales_be cqbe
           WHERE cqbe.ID_inscripcion = i.ID
             AND cqbe.examen IS NOT NULL
         ) < 2`,
      { replacements: { cedula: nroCedula, periodoId: periodo.ID } }
    )

    const totalFaltantes =
      parseInt(regularParciales.faltantes, 10) +
      parseInt(regularQuimestrales.faltantes, 10) +
      parseInt(beParciales.faltantes, 10) +
      parseInt(beQuimestrales.faltantes, 10)

    if (totalFaltantes === 0) {
      return res.json({ tiene_faltantes: false })
    }

    // 7) Calcular severidad según días al cierre
    let severidad
    if (diasRestantes > 15)     severidad = 'suave'
    else if (diasRestantes > 7) severidad = 'fuerte'
    else if (diasRestantes > 3) severidad = 'critico'
    else                        severidad = 'bloqueante'

    return res.json({
      tiene_faltantes: true,
      total_faltantes: totalFaltantes,
      dias_restantes: diasRestantes,
      severidad,
      desglose: {
        regular_parciales:    parseInt(regularParciales.faltantes, 10),
        regular_quimestrales: parseInt(regularQuimestrales.faltantes, 10),
        be_parciales:         parseInt(beParciales.faltantes, 10),
        be_quimestrales:      parseInt(beQuimestrales.faltantes, 10),
      }
    })
  } catch (error) {
    console.error('Error en getNotasFaltantes:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

module.exports = { getNotasFaltantes }
