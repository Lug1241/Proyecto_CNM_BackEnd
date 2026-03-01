
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

    // Verificar si hay calificaciones regulares (tablas normales)
    const [inscripcionesRegulares] = await sequelize.query(`
      SELECT COUNT(*) as total
      FROM matriculas m
      JOIN inscripciones i ON i.ID_matricula = m.ID
      JOIN calificaciones_quimestrales cq ON i.ID = cq.ID_inscripcion
      WHERE m.ID_periodo_academico = ?
      LIMIT 1
    `, { replacements: [periodoId] });

    // Verificar si hay calificaciones de Básico Elemental (tablas _be)
    const [inscripcionesBE] = await sequelize.query(`
      SELECT COUNT(*) as total
      FROM matriculas m
      JOIN inscripciones i ON i.ID_matricula = m.ID
      JOIN calificaciones_quimestrales_be cq ON i.ID = cq.ID_inscripcion
      WHERE m.ID_periodo_academico = ?
      LIMIT 1
    `, { replacements: [periodoId] });

    if (inscripcionesRegulares[0].total === 0 && inscripcionesBE[0].total === 0) {
      console.warn(`⚠️ No se puede cerrar el periodo ${periodoId}, no hay calificaciones`);
      return;
    }

    // Llamar al Stored Procedure correspondiente según el tipo de estudiante
    if (inscripcionesRegulares[0].total > 0) {
      console.log(`📊 Ejecutando sp_cerrar_periodo_regular para ${inscripcionesRegulares[0].total} estudiantes...`);
      await sequelize.query('CALL sp_cerrar_periodo_regular(?)', { replacements: [periodoId] });
    }

    if (inscripcionesBE[0].total > 0) {
      console.log(`📊 Ejecutando sp_cerrar_periodo_basico para ${inscripcionesBE[0].total} estudiantes de Básico Elemental...`);
      await sequelize.query('CALL sp_cerrar_periodo_basico(?)', { replacements: [periodoId] });
    }

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
  reprogramarPeriodosPendientes
};
