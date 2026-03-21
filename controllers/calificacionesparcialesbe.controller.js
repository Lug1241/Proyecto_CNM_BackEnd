const Calificaciones_parciales_be = require('../models/calificaciones_parciales_be.model');
const Inscripcion = require('../models/inscripcion.model');
const Matricula = require('../models/matricula.models');
const Estudiante = require('../models/estudiante.model');
const { Op } = require("sequelize");

// Crear un solo parcial básico
module.exports.createParcialBE = async (req, res) => {
  try {
    const {
      id_inscripcion,
      quimestre,
      parcial,
      insumo1,
      insumo2,
      evaluacion,
      mejoramiento
    } = req.body;

    if (!id_inscripcion || !quimestre || !parcial) {
      return res.status(400).json({ message: "Faltan datos requeridos" });
    }

    const nuevo = await Calificaciones_parciales_be.create({
      ID_inscripcion: id_inscripcion,
      quimestre,
      parcial,
      insumo1,
      insumo2,
      evaluacion,
      mejoramiento
    });

    return res.status(201).json(nuevo);
  } catch (error) {
    console.error("Error en createParcialBE:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

// Crear en bloque
module.exports.createParcialBEBulk = async (req, res) => {
  try {
    const datos = req.body;
    if (!Array.isArray(datos) || datos.length === 0) {
      return res.status(400).json({ message: "Se requiere un array de parciales básicos" });
    }

    const condiciones = datos.map(item => ({
      ID_inscripcion: item.id_inscripcion,
      quimestre: item.quimestre,
      parcial: item.parcial
    }));

    const existentes = await Calificaciones_parciales_be.findAll({
      where: { [Op.or]: condiciones }
    });

    const clavesExistentes = new Set(existentes.map(e => `${e.ID_inscripcion}-${e.quimestre}-${e.parcial}`));

    const nuevos = datos.filter(item => {
      const clave = `${item.id_inscripcion}-${item.quimestre}-${item.parcial}`;
      return !clavesExistentes.has(clave);
    });

    if (nuevos.length === 0) {
      return res.status(200).json({ message: "No se han insertado registros, ya existen." });
    }

    const registros = nuevos.map(item => ({
      ID_inscripcion: item.id_inscripcion,
      quimestre: item.quimestre,
      parcial: item.parcial,
      insumo1: item.insumo1,
      insumo2: item.insumo2,
      evaluacion: item.evaluacion,
      mejoramiento: item.mejoramiento
    }));

    const creados = await Calificaciones_parciales_be.bulkCreate(registros, { validate: true });
    return res.status(201).json(creados);
  } catch (error) {
    console.error("Error en createParcialBEBulk:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

// Actualizar un parcial
module.exports.updateParcialBE = async (req, res) => {
  try {
    const id = req.params.id;
    const {
      insumo1,
      insumo2,
      evaluacion,
      mejoramiento,
      quimestre,
      parcial,
      ID_inscripcion
    } = req.body;

    const updateData = {};
    if (insumo1 !== undefined) updateData.insumo1 = insumo1;
    if (insumo2 !== undefined) updateData.insumo2 = insumo2;
    if (evaluacion !== undefined) updateData.evaluacion = evaluacion;
    if (mejoramiento !== undefined) updateData.mejoramiento = mejoramiento;
    if (quimestre !== undefined) updateData.quimestre = quimestre;
    if (parcial !== undefined) updateData.parcial = parcial;
    if (ID_inscripcion !== undefined) updateData.ID_inscripcion = ID_inscripcion;

    // Intentar actualizar
    const [actualizados] = await Calificaciones_parciales_be.update(updateData, {
      where: { ID: id }
    });

    let actualizado;
    if (actualizados === 0) {
      // Si no existe, crear uno nuevo (upsert)
      actualizado = await Calificaciones_parciales_be.create({
        ...updateData
      });
      return res.status(201).json(actualizado);
    }

    actualizado = await Calificaciones_parciales_be.findByPk(id);
    return res.status(200).json(actualizado);
  } catch (error) {
    console.error("Error en updateParcialBE:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

// Obtener por ID
module.exports.getParcialBE = async (req, res) => {
  try {
    const id = req.params.id;
    const parcial = await Calificaciones_parciales_be.findByPk(id);
    if (!parcial) {
      return res.status(404).json({ message: "Parcial no encontrado" });
    }
    return res.status(200).json(parcial);
  } catch (error) {
    console.error("Error en getParcialBE:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

// Obtener parciales por asignación
module.exports.getParcialesBEPorAsignacion = async (req, res) => {
  try {
    const { id_asignacion } = req.params;

    const parciales = await Calificaciones_parciales_be.findAll({
      include: [{
        model: Inscripcion,
        where: { ID_asignacion: id_asignacion },
        include: [{
          model: Matricula,
          attributes: ['nivel'],
          include: [{
            model: Estudiante,
            attributes: ['ID', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido']
          }]
        }]
      }]
    });

    const resultado = parciales.map((p) => {
      const est = p.Inscripcion?.Matricula?.Estudiante;
      const nivel = p.Inscripcion?.Matricula?.nivel || "";
      const nombre = est
        ? `${est.primer_apellido} ${est.segundo_apellido ?? ''} ${est.primer_nombre} ${est.segundo_nombre ?? ''}`.trim()
        : "Sin estudiante";

      return {
        idParcial: p.ID,
        idInscripcion: p.ID_inscripcion,
        quimestre: p.quimestre,
        parcial: p.parcial,
        insumo1: p.insumo1,
        insumo2: p.insumo2,
        evaluacion: p.evaluacion,
        mejoramiento: p.mejoramiento,
        idEstudiante: est?.ID ?? null,
        nombreEstudiante: nombre,
        nivel
      };
    });

    resultado.sort((a, b) => a.nombreEstudiante.localeCompare(b.nombreEstudiante));
    return res.status(200).json(resultado);
  } catch (error) {
    console.error("Error en getParcialesBEPorAsignacion:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};


// Obtener calificaciones parciales por ID de inscripcion
module.exports.getParcialBEPorInscripcion = async (request, response) => {
  try {
    const idInscripcion = request.params.id_inscripcion;

    const parciales = await Calificaciones_parciales_be.findAll({
      where: {ID_inscripcion: idInscripcion},
      attributes: ['insumo1', 'insumo2', 'evaluacion', 'mejoramiento', 'quimestre', 'parcial']
    });

    return response.status(200).json(parciales);

  } catch (error) {
    console.error("Error en getParcialesBEPorInscripcion:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
}

// Eliminar parcial
module.exports.deleteParcialBE = async (req, res) => {
  try {
    const { id } = req.params;
    const parcial = await Calificaciones_parciales_be.findByPk(id);
    if (!parcial) {
      return res.status(404).json({ message: "Parcial no encontrado" });
    }
    await parcial.destroy();
    return res.status(200).json({ message: "Parcial eliminado correctamente", parcialEliminado: parcial });
  } catch (error) {
    console.error("Error en deleteParcialBE:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};
