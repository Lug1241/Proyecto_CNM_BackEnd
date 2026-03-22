const CalificacionesFinales = require('../models/calificaciones_finales.model');
const Inscripcion = require('../models/inscripcion.model');
const Matricula = require('../models/matricula.models');
const Estudiante = require('../models/estudiante.model');
const { Op } = require('sequelize');

module.exports.createFinal = async (req, res) => {
  try {
    const { id_inscripcion, examen_recuperacion } = req.body;
    if (!id_inscripcion) {
      return res.status(400).json({ message: "Falta id_inscripcion" });
    }
    // Buscar si ya existe una nota final para ese ID_inscripcion
    let record = await CalificacionesFinales.findOne({ where: { ID_inscripcion: id_inscripcion } });
    if (record) {
      // Actualizar si existe
      await CalificacionesFinales.update(
        { examen_recuperacion },
        { where: { ID_inscripcion: id_inscripcion } }
      );
      record = await CalificacionesFinales.findOne({ where: { ID_inscripcion: id_inscripcion } });
      return res.status(200).json(record);
    } else {
      // Crear si no existe
      record = await CalificacionesFinales.create({
        ID_inscripcion: id_inscripcion,
        examen_recuperacion
      });
      return res.status(201).json(record);
    }
  } catch (error) {
    console.error("createFinal error:", error);
    return res.status(500).json({ message: "Error en servidor" });
  }
};

module.exports.createFinalBulk = async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Array requerido" });
    }

    // 1. Construir condiciones OR
    const conditions = items.map(i => ({
      ID_inscripcion: i.id_inscripcion
    }));

    // 2. Buscar registros existentes
    const existing = await CalificacionesFinales.findAll({
      where: {
        [Op.or]: conditions
      }
    });

    // 3. Crear un Set con las claves existentes
    const existingKeys = new Set(
      existing.map(e => e.ID_inscripcion)
    );

    // 4. Filtrar registros nuevos
    const newRows = items.filter(i => !existingKeys.has(i.id_inscripcion));

    // 5. Si no hay nada nuevo
    if (newRows.length === 0) {
      return res.status(200).json({ message: "No se han insertado registros, ya existen." });
    }

    // 6. Preparar payload
    const payload = newRows.map(i => ({
      ID_inscripcion: i.id_inscripcion,
      examen_recuperacion: i.examen_recuperacion
    }));

    // 7. Insertar registros nuevos
    const created = await CalificacionesFinales.bulkCreate(payload, { validate: true });
    return res.status(201).json(created);

  } catch (error) {
    console.error("createFinalBulk error:", error);
    return res.status(500).json({ message: "Error en servidor" });
  }
};

module.exports.updateFinal = async (req, res) => {
  try {
    const { id } = req.params;
    const { examen_recuperacion } = req.body;
    // Buscar registro existente
    let record = await CalificacionesFinales.findByPk(id);
    if (record) {
      // Actualizar si existe
      await CalificacionesFinales.update(
        { examen_recuperacion },
        { where: { ID: id } }
      );
      record = await CalificacionesFinales.findByPk(id);
      return res.status(200).json(record);
    } else {
      // Crear si no existe
      record = await CalificacionesFinales.create({
        ID_inscripcion: id,
        examen_recuperacion
      });
      return res.status(201).json(record);
    }
  } catch (error) {
    console.error("updateFinal error:", error);
    return res.status(500).json({ message: "Error en servidor" });
  }
};

module.exports.getFinal = async (req, res) => {
  try {
    const record = await CalificacionesFinales.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: "No encontrado" });
    return res.status(200).json(record);
  } catch (error) {
    console.error("getFinal error:", error);
    return res.status(500).json({ message: "Error en servidor" });
  }
};

module.exports.getFinalesPorAsignacion = async (req, res) => {
  try {
    const { id_asignacion } = req.params;
    // Buscar inscripciones de la asignación
    const inscripciones = await Inscripcion.findAll({
      where: { ID_asignacion: id_asignacion },
      include: [{
        model: Matricula,
        attributes: ['nivel'],
        include: [{ model: Estudiante, attributes: ['ID','primer_nombre','segundo_nombre','primer_apellido','segundo_apellido'] }]
      }]
    });

    // Buscar parciales y quimestrales BE
    const parcialesBE = await require('../models/calificaciones_parciales_be.model').findAll({
      where: { ID_inscripcion: { [Op.in]: inscripciones.map(i => i.ID) } }
    });
    const quimestralesBE = await require('../models/calificaciones_quimestrales_be.model').findAll({
      where: { ID_inscripcion: { [Op.in]: inscripciones.map(i => i.ID) } }
    });
    // Buscar finales existentes
    const finales = await CalificacionesFinales.findAll({
      where: { ID_inscripcion: { [Op.in]: inscripciones.map(i => i.ID) } }
    });
    const finalesMap = new Map(finales.map(f => [f.ID_inscripcion, f]));

    // Helper para calcular promedio quimestral BE
    function calcularPromedioQuimestral(inscId, quimestre) {
      const parciales = parcialesBE.filter(p => p.ID_inscripcion === inscId && p.quimestre === quimestre);
      if (parciales.length < 2) return null;
      const p1 = parciales.find(p => p.parcial === 'P1');
      const p2 = parciales.find(p => p.parcial === 'P2');
      if (!p1 || !p2) return null;
      // Promedio de parciales
      const promParciales = ((parseFloat(p1.insumo1) + parseFloat(p1.insumo2) + parseFloat(p1.evaluacion)) / 3 + (parseFloat(p2.insumo1) + parseFloat(p2.insumo2) + parseFloat(p2.evaluacion)) / 3) / 2;
      // Mejoramiento no afecta promedio final
      const quim = quimestralesBE.find(q => q.ID_inscripcion === inscId && q.quimestre === quimestre);
      if (!quim) return null;
      // 70% parciales + 30% examen
      return promParciales * 0.7 + parseFloat(quim.examen) * 0.3;
    }

    // Helper para equivalencia
    function equivalencia(nota) {
      if (nota >= 9) return 'B+';
      if (nota >= 7) return 'B-';
      if (nota >= 4) return 'D-';
      return 'D--';
    }

    // Helper para estado
    function estado(nota) {
      if (nota >= 7) return 'Aprobado';
      return 'Reprobado';
    }

    // Construir resultados
    const result = inscripciones.map(insc => {
      const est = insc.Matricula?.Estudiante;
      const nombre = est
        ? `${est.primer_apellido} ${est.segundo_apellido||''} ${est.primer_nombre} ${est.segundo_nombre||''}`.trim()
        : null;
      // Si existe registro final, usarlo
      const final = finalesMap.get(insc.ID);
      let notaQ1 = calcularPromedioQuimestral(insc.ID, 'Q1');
      let notaQ2 = calcularPromedioQuimestral(insc.ID, 'Q2');
      let promedioFinal = null;
      if (notaQ1 !== null && notaQ2 !== null) {
        promedioFinal = ((notaQ1 + notaQ2) / 2).toFixed(2);
      }
      // Si hay examen de recuperación, usarlo como nota final
      if (final && final.examen_recuperacion !== null && final.examen_recuperacion !== undefined) {
        promedioFinal = parseFloat(final.examen_recuperacion).toFixed(2);
      }
      return {
        idInscripcion: insc.ID,
        idFinal: final?.ID || null,
        idEstudiante: est?.ID || null,
        nombreEstudiante: nombre,
        nivel: insc.Matricula?.nivel || null,
        primerQuimestre: notaQ1 !== null ? notaQ1.toFixed(2) : null,
        segundoQuimestre: notaQ2 !== null ? notaQ2.toFixed(2) : null,
        promedioFinal,
        examenRecuperacion: final?.examen_recuperacion !== null && final?.examen_recuperacion !== undefined ? final.examen_recuperacion.toString() : null,
        escala: promedioFinal !== null ? equivalencia(promedioFinal) : null,
        estado: promedioFinal !== null ? estado(promedioFinal) : null
      };
    });
    result.sort((a,b) => (a.nombreEstudiante||'').localeCompare(b.nombreEstudiante));
    return res.status(200).json(result);
  } catch (error) {
    console.error("getFinalesPorAsignacion error:", error);
    return res.status(500).json({ message: "Error en servidor" });
  }
};

module.exports.deleteFinal = async (req, res) => {
  try {
    const record = await CalificacionesFinales.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: "No encontrado" });
    await record.destroy();
    return res.status(200).json({ message: "Eliminado correctamente", eliminado: record });
  } catch (error) {
    console.error("deleteFinal error:", error);
    return res.status(500).json({ message: "Error en servidor" });
  }
};
