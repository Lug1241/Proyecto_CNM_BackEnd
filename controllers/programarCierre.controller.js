
const schedule = require('node-schedule');
const fs = require('fs').promises;
const path = require('path');
const Periodo = require('../models/periodo_academico.model')
const { sequelize } = require('../config/sequelize.config')
const { Op } = require("sequelize");
function convertirFecha(fechaStr) {
  const [dia, mes, anio] = fechaStr.split("/").map(Number);
  return new Date(anio, mes - 1, dia); // mes - 1 porque en JS enero es 0
}
async function cerrarPeriodo(periodoId) {
  try {
    const periodo = await Periodo.findByPk(periodoId);
    if (!periodo || periodo.estado === 'Finalizado') return;

    console.log(`🕒 Cerrando automáticamente el periodo: ${periodo.descripcion}`);

    // validar que existan inscripciones con los dos quimestres completos
    const [validasReg] = await sequelize.query(`
      SELECT i.ID
      FROM inscripciones i
      JOIN matriculas m ON i.ID_matricula = m.ID
      JOIN estudiantes e ON e.ID = m.ID_estudiante AND e.nivel NOT LIKE '%Básico Elemental%'
      JOIN calificaciones_quimestrales cq ON cq.ID_inscripcion = i.ID
      WHERE m.ID_periodo_academico = ?
      GROUP BY i.ID
      HAVING COUNT(DISTINCT cq.quimestre) = 2
    `, { replacements: [periodoId] });

    const [validasBE] = await sequelize.query(`
      SELECT i.ID
      FROM inscripciones i
      JOIN matriculas m ON i.ID_matricula = m.ID
      JOIN estudiantes e ON e.ID = m.ID_estudiante AND e.nivel LIKE '%Básico Elemental%'
      JOIN calificaciones_quimestrales_be cq ON cq.ID_inscripcion = i.ID
      WHERE m.ID_periodo_academico = ?
      GROUP BY i.ID
      HAVING COUNT(DISTINCT cq.quimestre) = 2
    `, { replacements: [periodoId] });

    if (validasReg.length === 0 && validasBE.length === 0) {
      console.warn(`⚠️ No se puede cerrar el periodo ${periodoId}, faltan calificaciones completas`);
      return;
    }

    // ejecutar dentro de una transacción para que todo sea atómico
    await sequelize.transaction(async (t) => {
      if (validasReg.length > 0) {
        console.log(`📊 Ejecutando sp_cerrar_periodo_regular para ${validasReg.length} estudiantes...`);
        const [resultReg] = await sequelize.query('CALL sp_cerrar_periodo_regular(?)', {
          replacements: [periodoId],
          transaction: t
        });
        console.log('➤ Resumen periodo regular:', resultReg || '[sin resultado]');
      }

      if (validasBE.length > 0) {
        console.log(`📊 Ejecutando sp_cerrar_periodo_basico para ${validasBE.length} estudiantes de Básico Elemental...`);
        const [resultBE] = await sequelize.query('CALL sp_cerrar_periodo_basico(?)', {
          replacements: [periodoId],
          transaction: t
        });
        console.log('➤ Resumen periodo básico:', resultBE || '[sin resultado]');
      }

      // marcar periodo como finalizado
      await Periodo.update({ estado: 'Finalizado' }, { where: { ID: periodoId }, transaction: t });
    });

    console.log(`✅ Periodo ${periodo.descripcion} cerrado exitosamente`);

  } catch (err) {
    console.log("Ocurrió un error durante el cierre del periodo: ", err)
  }
}

async function reprogramarPeriodosPendientes() {
  const periodos = await Periodo.findAll({
    where: {
      estado: 'Activo',
      fecha_fin: {
        [Op.lt]: new Date()
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
  const fecha = new Date(fechaFin);

  if (fecha <= new Date()) {
    console.log(`⚠️ La fecha ya pasó, cerrando inmediatamente`);
    cerrarPeriodo(periodoId);

    return;
  }

  schedule.scheduleJob(fecha, async () => {
    await cerrarPeriodo(periodoId);

  });

  console.log(`📅 Tarea programada para cerrar periodo ID ${periodoId} el ${fecha}`);
}



module.exports = {
  programarCierrePeriodo,
  reprogramarPeriodosPendientes,
  cerrarPeriodo
};
