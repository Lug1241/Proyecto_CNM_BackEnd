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

    // 2) Verificar que tenga asignaciones propias en el período (todos los roles)
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

    // Todos los roles filtran por su propia cédula
    const tc = 'AND a.nroCedula_docente = :cedula'
    const rp = { cedula: nroCedula, periodoId: periodo.ID }

    // 3) Contar inscripciones REGULARES con parciales incompletos
    const [[regularParciales]] = await sequelize.query(
      `SELECT COUNT(DISTINCT i.ID) AS faltantes
       FROM inscripciones i
       INNER JOIN asignaciones a    ON a.ID = i.ID_asignacion
       INNER JOIN matriculas m      ON m.ID = i.ID_matricula
       WHERE a.ID_periodo_academico   = :periodoId
         ${tc}
         AND m.nivel COLLATE utf8mb4_unicode_ci NOT LIKE '%Básico Elemental%'
         AND (
           SELECT COUNT(*)
           FROM calificaciones_parciales cp
           WHERE cp.ID_inscripcion = i.ID
             AND cp.insumo1 IS NOT NULL AND cp.insumo2 IS NOT NULL AND cp.evaluacion IS NOT NULL
         ) < 4`,
      { replacements: rp }
    )

    // 4) Contar inscripciones REGULARES con quimestrales incompletos
    const [[regularQuimestrales]] = await sequelize.query(
      `SELECT COUNT(DISTINCT i.ID) AS faltantes
       FROM inscripciones i
       INNER JOIN asignaciones a    ON a.ID = i.ID_asignacion
       INNER JOIN matriculas m      ON m.ID = i.ID_matricula
       WHERE a.ID_periodo_academico   = :periodoId
         ${tc}
         AND m.nivel COLLATE utf8mb4_unicode_ci NOT LIKE '%Básico Elemental%'
         AND (
           SELECT COUNT(*)
           FROM calificaciones_quimestrales cq
           WHERE cq.ID_inscripcion = i.ID
             AND cq.examen IS NOT NULL
         ) < 2`,
      { replacements: rp }
    )

    // 5) Contar inscripciones BE con parciales incompletos
    const [[beParciales]] = await sequelize.query(
      `SELECT COUNT(DISTINCT i.ID) AS faltantes
       FROM inscripciones i
       INNER JOIN asignaciones a    ON a.ID = i.ID_asignacion
       INNER JOIN matriculas m      ON m.ID = i.ID_matricula
       WHERE a.ID_periodo_academico   = :periodoId
         ${tc}
         AND m.nivel COLLATE utf8mb4_unicode_ci LIKE '%Básico Elemental%'
         AND (
           SELECT COUNT(*)
           FROM calificaciones_parciales_be cpbe
           WHERE cpbe.ID_inscripcion = i.ID
             AND cpbe.insumo1 IS NOT NULL AND cpbe.insumo2 IS NOT NULL AND cpbe.evaluacion IS NOT NULL
         ) < 4`,
      { replacements: rp }
    )

    // 6) Contar inscripciones BE con quimestrales incompletos
    const [[beQuimestrales]] = await sequelize.query(
      `SELECT COUNT(DISTINCT i.ID) AS faltantes
       FROM inscripciones i
       INNER JOIN asignaciones a    ON a.ID = i.ID_asignacion
       INNER JOIN matriculas m      ON m.ID = i.ID_matricula
       WHERE a.ID_periodo_academico   = :periodoId
         ${tc}
         AND m.nivel COLLATE utf8mb4_unicode_ci LIKE '%Básico Elemental%'
         AND (
           SELECT COUNT(*)
           FROM calificaciones_quimestrales_be cqbe
           WHERE cqbe.ID_inscripcion = i.ID
             AND cqbe.examen IS NOT NULL
         ) < 2`,
      { replacements: rp }
    )

    // 7) Contar inscripciones REGULARES con supletorio pendiente
    const [[regularSupletorios]] = await sequelize.query(
      `SELECT COUNT(DISTINCT base.id_inscripcion) AS faltantes
       FROM (
         SELECT i.ID AS id_inscripcion,
           TRUNCATE((
             (
               (((cp1.insumo1 + cp1.insumo2) / 2 * 0.7 + cp1.evaluacion * 0.3) +
                ((cp2.insumo1 + cp2.insumo2) / 2 * 0.7 + cp2.evaluacion * 0.3)) / 2 * 0.7 + cq1.examen * 0.3
             ) +
             (
               (((cp3.insumo1 + cp3.insumo2) / 2 * 0.7 + cp3.evaluacion * 0.3) +
                ((cp4.insumo1 + cp4.insumo2) / 2 * 0.7 + cp4.evaluacion * 0.3)) / 2 * 0.7 + cq2.examen * 0.3
             )
           ) / 2, 2) AS nota_base
         FROM inscripciones i
         INNER JOIN asignaciones a   ON a.ID = i.ID_asignacion
         INNER JOIN matriculas m     ON m.ID = i.ID_matricula
         INNER JOIN calificaciones_parciales cp1 ON cp1.ID_inscripcion = i.ID AND cp1.quimestre = 'Q1' AND cp1.parcial = 'P1'
         INNER JOIN calificaciones_parciales cp2 ON cp2.ID_inscripcion = i.ID AND cp2.quimestre = 'Q1' AND cp2.parcial = 'P2'
         INNER JOIN calificaciones_parciales cp3 ON cp3.ID_inscripcion = i.ID AND cp3.quimestre = 'Q2' AND cp3.parcial = 'P1'
         INNER JOIN calificaciones_parciales cp4 ON cp4.ID_inscripcion = i.ID AND cp4.quimestre = 'Q2' AND cp4.parcial = 'P2'
         INNER JOIN calificaciones_quimestrales cq1 ON cq1.ID_inscripcion = i.ID AND cq1.quimestre = 'Q1'
         INNER JOIN calificaciones_quimestrales cq2 ON cq2.ID_inscripcion = i.ID AND cq2.quimestre = 'Q2'
         WHERE a.ID_periodo_academico = :periodoId
           ${tc}
           AND m.nivel COLLATE utf8mb4_unicode_ci NOT LIKE '%Básico Elemental%'
       ) base
       WHERE base.nota_base >= 4
         AND base.nota_base < 7
         AND NOT EXISTS (
           SELECT 1 FROM calificaciones_finales cf
           WHERE cf.ID_inscripcion = base.id_inscripcion
             AND cf.examen_recuperacion IS NOT NULL
         )`,
      { replacements: rp }
    )

    // 8) Contar inscripciones BE con supletorio pendiente
    const [[beSupletorios]] = await sequelize.query(
      `SELECT COUNT(DISTINCT base.id_inscripcion) AS faltantes
       FROM (
         SELECT i.ID AS id_inscripcion,
           TRUNCATE((
             (
               (((cpbe1.insumo1 + cpbe1.insumo2) / 2 * 0.7 + cpbe1.evaluacion * 0.3) +
                ((cpbe2.insumo1 + cpbe2.insumo2) / 2 * 0.7 + cpbe2.evaluacion * 0.3)) / 2 * 0.7 + cqbe1.examen * 0.3
             ) +
             (
               (((cpbe3.insumo1 + cpbe3.insumo2) / 2 * 0.7 + cpbe3.evaluacion * 0.3) +
                ((cpbe4.insumo1 + cpbe4.insumo2) / 2 * 0.7 + cpbe4.evaluacion * 0.3)) / 2 * 0.7 + cqbe2.examen * 0.3
             )
           ) / 2, 2) AS nota_base
         FROM inscripciones i
         INNER JOIN asignaciones a      ON a.ID = i.ID_asignacion
         INNER JOIN matriculas m        ON m.ID = i.ID_matricula
         INNER JOIN calificaciones_parciales_be cpbe1 ON cpbe1.ID_inscripcion = i.ID AND cpbe1.quimestre = 'Q1' AND cpbe1.parcial = 'P1'
         INNER JOIN calificaciones_parciales_be cpbe2 ON cpbe2.ID_inscripcion = i.ID AND cpbe2.quimestre = 'Q1' AND cpbe2.parcial = 'P2'
         INNER JOIN calificaciones_parciales_be cpbe3 ON cpbe3.ID_inscripcion = i.ID AND cpbe3.quimestre = 'Q2' AND cpbe3.parcial = 'P1'
         INNER JOIN calificaciones_parciales_be cpbe4 ON cpbe4.ID_inscripcion = i.ID AND cpbe4.quimestre = 'Q2' AND cpbe4.parcial = 'P2'
         INNER JOIN calificaciones_quimestrales_be cqbe1 ON cqbe1.ID_inscripcion = i.ID AND cqbe1.quimestre = 'Q1'
         INNER JOIN calificaciones_quimestrales_be cqbe2 ON cqbe2.ID_inscripcion = i.ID AND cqbe2.quimestre = 'Q2'
         WHERE a.ID_periodo_academico = :periodoId
           ${tc}
           AND m.nivel COLLATE utf8mb4_unicode_ci LIKE '%Básico Elemental%'
       ) base
       WHERE base.nota_base <= 4
         AND NOT EXISTS (
           SELECT 1 FROM calificaciones_finales cf
           WHERE cf.ID_inscripcion = base.id_inscripcion
             AND cf.examen_recuperacion IS NOT NULL
         )`,
      { replacements: rp }
    )

    const totalFaltantes =
      parseInt(regularParciales.faltantes, 10) +
      parseInt(regularQuimestrales.faltantes, 10) +
      parseInt(beParciales.faltantes, 10) +
      parseInt(beQuimestrales.faltantes, 10) +
      parseInt(regularSupletorios.faltantes, 10) +
      parseInt(beSupletorios.faltantes, 10)

    if (totalFaltantes === 0) {
      return res.json({ tiene_faltantes: false })
    }

    // 9) Calcular severidad segun dias al cierre
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
        regular_supletorios:  parseInt(regularSupletorios.faltantes, 10),
        be_supletorios:       parseInt(beSupletorios.faltantes, 10),
      }
    })
  } catch (error) {
    console.error('Error en getNotasFaltantes:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

module.exports = { getNotasFaltantes }
