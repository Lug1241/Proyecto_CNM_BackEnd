
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

    const [validacionSPRaw] = await sequelize.query('CALL sp_validar_notas_completas(?)', {
      replacements: [periodoId]
    });

    const validacionSP = Array.isArray(validacionSPRaw) ? validacionSPRaw[0] : validacionSPRaw;

    if (!validacionSP || Number(validacionSP.notas_completas) !== 1) {
      console.warn(`⚠️ No se puede cerrar el periodo ${periodoId}, validación de notas incompleta`, validacionSP || {});
      return;
    }

    const [totalesNivelRaw] = await sequelize.query(`
      SELECT
        SUM(CASE WHEN m.nivel COLLATE utf8mb4_unicode_ci NOT LIKE '%Básico Elemental%' THEN 1 ELSE 0 END) AS total_regular,
        SUM(CASE WHEN m.nivel COLLATE utf8mb4_unicode_ci LIKE '%Básico Elemental%' THEN 1 ELSE 0 END) AS total_be
      FROM inscripciones i
      JOIN matriculas m ON i.ID_matricula = m.ID
      WHERE m.ID_periodo_academico = ?
    `, { replacements: [periodoId] });

    const totalesNivel = Array.isArray(totalesNivelRaw) ? totalesNivelRaw[0] : totalesNivelRaw;
    const totalRegular = Number(totalesNivel?.total_regular || 0);
    const totalBE = Number(totalesNivel?.total_be || 0);

    if (totalRegular === 0 && totalBE === 0) {
      console.warn(`⚠️ No existen inscripciones en el periodo ${periodoId}`);
      return;
    }

    // ejecutar dentro de una transacción para que todo sea atómico
    await sequelize.transaction(async (t) => {
      if (totalRegular > 0) {
        console.log(`📊 Ejecutando sp_cerrar_periodo_regular para ${totalRegular} inscripciones...`);
        const [resultReg] = await sequelize.query('CALL sp_cerrar_periodo_regular(?)', {
          replacements: [periodoId],
          transaction: t
        });
        console.log('➤ Resumen periodo regular:', resultReg || '[sin resultado]');
      }

      if (totalBE > 0) {
        console.log(`📊 Ejecutando sp_cerrar_periodo_basico para ${totalBE} inscripciones de Básico Elemental...`);
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
