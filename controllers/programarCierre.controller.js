
const schedule = require('node-schedule');
const fs = require('fs').promises;
const path = require('path');
const Periodo = require('../models/periodo_academico.model')
const { sequelize } = require('../config/sequelize.config')
const { Op } = require("sequelize");
const jobsPorPeriodo = new Map();

function convertirFecha(fechaStr) {
  if (fechaStr instanceof Date && !Number.isNaN(fechaStr.getTime())) {
    return new Date(fechaStr.getFullYear(), fechaStr.getMonth(), fechaStr.getDate(), 23, 59, 59, 999);
  }

  if (typeof fechaStr !== 'string') return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    const [anio, mes, dia] = fechaStr.split('-').map(Number);
    return new Date(anio, mes - 1, dia, 23, 59, 59, 999);
  }

  const [dia, mes, anio] = fechaStr.split("/").map(Number);
  if (!dia || !mes || !anio) return null;

  return new Date(anio, mes - 1, dia, 23, 59, 59, 999); // mes - 1 porque en JS enero es 0
}
async function cerrarPeriodo(periodoId) {
  try {
    const periodo = await Periodo.findByPk(periodoId, { raw: true });
    if (!periodo || periodo.estado === 'Finalizado') return;

    const fechaFinPeriodo = convertirFecha(periodo.fecha_fin);
    if (!fechaFinPeriodo || Number.isNaN(fechaFinPeriodo.getTime())) {
      console.warn(`⚠️ No se puede cerrar periodo ${periodoId}: fecha_fin inválida (${periodo.fecha_fin})`);
      return;
    }

    if (new Date() < fechaFinPeriodo) {
      console.log(`⏳ Periodo ${periodoId} aún no vence (fecha_fin=${periodo.fecha_fin}), no se cierra.`);
      return;
    }
    const [inscripcionesValidas] = await sequelize.query(`
      SELECT i.ID
      FROM inscripciones i
      JOIN matriculas m ON i.ID_matricula = m.ID
      JOIN calificaciones_quimestrales cq ON i.ID = cq.ID_inscripcion
      WHERE m.ID_periodo_academico = ?
      GROUP BY i.ID
      HAVING COUNT(DISTINCT cq.quimestre) = 2
    `, {
      replacements: [periodoId]
    });

    if (inscripcionesValidas.length === 0) {
      console.warn(`⚠️ No se puede cerrar el periodo ${periodoId}, faltan calificaciones`);
      return;
    }

    console.log(`🕒 Cerrando automáticamente el periodo: ${periodo.descripcion}`);

    const [inscripciones] = await sequelize.query(`
      SELECT 
        m.ID AS ID_matricula,
        m.ID_estudiante,
        i.ID AS ID_inscripcion,
        cf.examen_recuperacion,
        COALESCE(cf.examen_recuperacion, 
          (
            (
              (
                ((cp1.insumo1 + cp1.insumo2)/2 * 0.7 + cp1.evaluacion * 0.3) +
                ((cp2.insumo1 + cp2.insumo2)/2 * 0.7 + cp2.evaluacion * 0.3)
              ) / 2 * 0.7 + cq1.examen * 0.3
            ) +
            (
              ((cp3.insumo1 + cp3.insumo2)/2 * 0.7 + cp3.evaluacion * 0.3) +
              ((cp4.insumo1 + cp4.insumo2)/2 * 0.7 + cp4.evaluacion * 0.3)
            ) / 2 * 0.7 + cq2.examen * 0.3
          ) / 2
        ) AS nota_final
      FROM matriculas m
      JOIN inscripciones i ON i.ID_matricula = m.ID
      LEFT JOIN calificaciones_parciales cp1 ON cp1.ID_inscripcion = i.ID AND cp1.quimestre = 'Q1' AND cp1.parcial = 1
      LEFT JOIN calificaciones_parciales cp2 ON cp2.ID_inscripcion = i.ID AND cp2.quimestre = 'Q1' AND cp2.parcial = 2
      LEFT JOIN calificaciones_parciales cp3 ON cp3.ID_inscripcion = i.ID AND cp3.quimestre = 'Q2' AND cp3.parcial = 1
      LEFT JOIN calificaciones_parciales cp4 ON cp4.ID_inscripcion = i.ID AND cp4.quimestre = 'Q2' AND cp4.parcial = 2
      LEFT JOIN calificaciones_quimestrales cq1 ON cq1.ID_inscripcion = i.ID AND cq1.quimestre = 'Q1'
      LEFT JOIN calificaciones_quimestrales cq2 ON cq2.ID_inscripcion = i.ID AND cq2.quimestre = 'Q2'
      LEFT JOIN calificaciones_finales cf ON cf.ID_inscripcion = i.ID
      WHERE m.ID_periodo_academico = ?
    `, { replacements: [periodoId] });
    const agrupadasPorMatricula = {};

    for (const insc of inscripciones) {
      const nota = parseFloat(insc.nota_final ?? 0);
      const recuperacion = parseFloat(insc.examen_recuperacion ?? 0);

      const aprobada =
        nota >= 7 ||
        (nota >= 4 && nota < 7 && recuperacion >= 7);

      if (!agrupadasPorMatricula[insc.ID_matricula]) {
        agrupadasPorMatricula[insc.ID_matricula] = {
          estudiante_id: insc.ID_estudiante,
          inscripciones: []
        };
      }

      agrupadasPorMatricula[insc.ID_matricula].inscripciones.push(aprobada);
    }

    // Preparamos actualizaciones
    const actualizaciones = [];

    for (const [id, data] of Object.entries(agrupadasPorMatricula)) {
      const todasAprobadas = data.inscripciones.every(v => v === true);
      actualizaciones.push({
        ID_matricula: id,
        estado: todasAprobadas ? 'Aprobado' : 'Reprobado'
      });
    }
    const caseSQL = actualizaciones.map(r => `WHEN ${r.ID_matricula} THEN '${r.estado}'`).join('\n');
    const ids = actualizaciones.map(r => r.ID_matricula).join(',');

    const updateQuery = `
  UPDATE matriculas
  SET estado = CASE ID
    ${caseSQL}
  END
  WHERE ID IN (${ids});
`;

    await sequelize.query(updateQuery);
    // Niveles ordenados para saber cuál sigue
    const niveles = [
      "1ro Básico Elemental",
      "2do Básico Elemental",
      "1ro Básico Medio",
      "2do Básico Medio",
      "3ro Básico Medio",
      "1ro Básico Superior",
      "2do Básico Superior",
      "3ro Básico Superior",
      "1ro Bachillerato",
      "2do Bachillerato",
      "3ro Bachillerato",
      "Graduado"
    ];

    // Traer las matrículas aprobadas del periodo con su estudiante y nivel actual
    const [matriculasAprobadas] = await sequelize.query(`
  SELECT e.ID AS estudiante_id, e.nivel
  FROM matriculas m
  JOIN estudiantes e ON m.ID_estudiante = e.ID
  WHERE m.estado = 'Aprobado' AND m.ID_periodo_academico = ?
`, {
      replacements: [periodoId],
    });

    // Generar los nuevos niveles
    const promociones = matriculasAprobadas
      .map(({ estudiante_id, nivel }) => {
        const idx = niveles.indexOf(nivel);
        if (idx >= 0 && idx < niveles.length - 1) {
          return {
            id: estudiante_id,
            nuevoNivel: niveles[idx + 1]
          };
        }
        return null;
      })
      .filter(p => p);

    // Ejecutar el bulk update si hay estudiantes por promover
    if (promociones.length > 0) {
      const caseNivel = promociones
        .map(p => `WHEN ${p.id} THEN '${p.nuevoNivel}'`)
        .join("\n");
      const ids = promociones.map(p => p.id).join(",");

      const updateNiveles = `
    UPDATE estudiantes
    SET nivel = CASE ID
      ${caseNivel}
    END
    WHERE ID IN (${ids});
  `;

      await sequelize.query(updateNiveles);
      console.log(`🎓 Se promovieron ${promociones.length} estudiantes de nivel.`);

    } else {
      console.log(`📘 No hay estudiantes para promover.`);
    }

    await Periodo.update({ estado: 'Finalizado' }, { where: { ID: periodoId } });
    console.log(`✅ Periodo ${periodoId} marcado como Finalizado.`);
  }
  catch (err) {
    console.log("ocurrio un error durante el cierre del periodo: ", err)
  }
}

async function reprogramarPeriodosPendientes() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const periodos = await Periodo.findAll({
    where: {
      estado: 'Activo',
      fecha_fin: {
        [Op.lt]: hoy
      }
    }
  });
  console.log("Periodos activos", periodos)
  const periodosPlain = periodos.map(periodo => {
    return periodo.get({ plain: true })
  })
  console.log("estos son los periodos", periodosPlain)
  for (const periodo of periodos) {
    programarCierrePeriodo(periodo.ID, convertirFecha(periodo.fecha_fin));
  }
}

function programarCierrePeriodo(periodoId, fechaFin) {
  const fecha = convertirFecha(fechaFin);

  if (!fecha || Number.isNaN(fecha.getTime())) {
    console.warn(`⚠️ No se programó cierre para periodo ${periodoId}: fecha_fin inválida (${fechaFin})`);
    return;
  }

  const jobExistente = jobsPorPeriodo.get(periodoId);
  if (jobExistente) {
    jobExistente.cancel();
    jobsPorPeriodo.delete(periodoId);
  }

  if (fecha <= new Date()) {
    console.log(`⚠️ La fecha ya pasó, cerrando inmediatamente`);
    cerrarPeriodo(periodoId);
    return;
  }

  const job = schedule.scheduleJob(fecha, async () => {
    await cerrarPeriodo(periodoId);
    jobsPorPeriodo.delete(periodoId);
  });
  jobsPorPeriodo.set(periodoId, job);

  console.log(`📅 Tarea programada para cerrar periodo ID ${periodoId} el ${fecha}`);
}



module.exports = {
  programarCierrePeriodo,
  reprogramarPeriodosPendientes
};
