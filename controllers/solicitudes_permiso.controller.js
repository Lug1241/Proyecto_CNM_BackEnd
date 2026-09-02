const Solicitudes = require('../models/solicitudesPermiso.model');
const Docente = require('../models/docente.model');
const { sequelize } = require('../config/sequelize.config')

const createSolicitud = async (req, res) => {
    try {
        const solicitud = req.body;
        const docente = await Docente.findOne( {where: { nroCedula: solicitud.nroCedula_docente}} );
        if (!docente) {
          return res.status(404).json({ message: "Docente no encontrado" });
        }
        const ID_docente = docente.ID;

        const solicitudFound = await Solicitudes.findOne({
            where: {
                ID_docente: ID_docente,
                fecha_inicio: solicitud.fecha_inicio,
                fecha_fin: solicitud.fecha_fin,
                motivo: solicitud.motivo,
                descripcion: solicitud.descripcion  // 🔥 Validar también el parcial/quimestre
            }
        });

        if (solicitudFound) {
            return res.status(400).json({ message: 'Esta solicitud ya fue hecha para ese rango y sección.' });
        }

        delete solicitud.nroCedula_docente;
        solicitud.ID_docente = ID_docente;

        const nuevaSolicitud = await Solicitudes.create(solicitud);

        const newSolicitud = await Solicitudes.findByPk(nuevaSolicitud.ID, {
            include: [{
                model: Docente,
                attributes: ["primer_nombre", "primer_apellido"]
            }]
        });

        const result = newSolicitud.get({ plain: true });
        return res.status(201).json(result);

    } catch (error) {
        console.log('Error al crear solicitud', error);

        if (error.name === "SequelizeValidationError") {
            const errEncontrado = error.errors.find(err =>
                err.validatorKey === "notEmpty" ||
                err.validatorKey === "isNumeric" ||
                err.validatorKey === "len" ||
                err.validatorKey === "is_null" ||
                err.validatorKey === "isDate"
            );
            if (errEncontrado) {
                return res.status(400).json({ message: errEncontrado.message });
            }
        }

        if (error.name === "SequelizeUniqueConstraintError") {
            const errEncontrado = error.errors.find(err =>
                err.validatorKey === "not_unique"
            );
            if (errEncontrado) {
                return res.status(400).json({ message: `${errEncontrado.path} debe ser único` });
            }
        }

        return res.status(500).json({ message: `Error al crear solicitud en el servidor:` });
    }
};

const updateSolicitud = async (req, res) => {
    try {
        const solicitud = req.body;
        const id = req.params.id;

        // Validar solo si vienen ambas fechas en el body
        if (solicitud.fecha_inicio && solicitud.fecha_fin) {
            const { fecha_inicio, fecha_fin } = solicitud;

            if (fecha_inicio > fecha_fin) {
                return res.status(400).json({ message: 'La fecha de inicio no puede ser posterior a la fecha de fin.' });
            }
        }

        const [updatedRows] = await Solicitudes.update(solicitud, { where: { ID: id } });

        if (updatedRows === 0) {
            return res.status(404).json({ message: "Solicitud no encontrada" });
        }

        const result = await Solicitudes.findByPk(id, {
            include: [{
                model: Docente,
                attributes: ["primer_nombre", "primer_apellido"]
            }]
        });

        const newSolicitud = result.get({ plain: true });
        return res.status(200).json(newSolicitud);

    } catch (error) {
        console.log("Error al editar solicitud", error);

        if (error.name === "SequelizeValidationError") {
            const errEncontrado = error.errors.find(err =>
                err.validatorKey === "notEmpty" ||
                err.validatorKey === "isNumeric" ||
                err.validatorKey === "len" ||
                err.validatorKey === "is_null" ||
                err.validatorKey === "isDate"
            );

            if (errEncontrado) {
                return res.status(400).json({ message: errEncontrado.message });
            }
        }

        if (error.name === "SequelizeUniqueConstraintError") {
            return res.status(400).json({ message: error.message });
        }

        return res.status(500).json({ message: `Error al editar solicitud en el servidor:` });
    }
};

const getSolicitudesByDocente = async (req, res) => {

    try {
        const nroCedula = req.user.nroCedula
        const docente = await Docente.findOne( {where: { nroCedula: nroCedula}} );
        if (!docente) {
          return res.status(404).json({ message: "Docente no encontrado" });
        }
        const ID_docente = docente.ID;

        const solicitudes = await Solicitudes.findAll({
            where: {
                ID_docente: ID_docente,
            },
            include: [
                {
                    model: Docente,
                    attributes: ["primer_nombre", "primer_apellido"]
                }
            ]
        })
        const result = solicitudes.map(solicitud => {
            return solicitud.get({ plain: true })
        })

        return res.status(200).json(result)
    } catch (error) {
        console.error("Error al obtener las solicitudes", error)
        return res.status(500).json({ message: `Error al obtener las solicitudes en el servidor:` })
    }
}

const getAllSolicitud = async (req, res) => {

    try {
        const solicitudes = await Solicitudes.findAll({
            include: [
                {
                    model: Docente,
                    attributes: ["primer_nombre", "primer_apellido"]
                }
            ]
        })
        console.log("estas son las solicitudes", solicitudes)
        const result = solicitudes.map(solicitud => {
            return solicitud.get({ plain: true })
        })
        console.log("esto se mando del backedn", result)
        return res.status(200).json(result)
    } catch (error) {
        console.error("Error al obtener las solicitudes", error)
        return res.status(500).json({ message: `Error al obtener las solicitudes en el servidor:` })
    }
}

const getUltimaSolicitud = async (req, res) => {
    try {
        const nroCedula = req.user.nroCedula;
        const docente = await Docente.findOne( {where: { nroCedula: nroCedula}} );
        if (!docente) {
          return res.status(404).json({ message: "Docente no encontrado" });
        }
        const ID_docente = docente.ID;

        const solicitud = await Solicitudes.findOne({
            where: {
                ID_docente: ID_docente,
                estado: "Aceptada"
                // puedes agregar aquí: descripcion: "parcial1_quim1" si quieres filtrar
            },
            include: [{
                model: Docente,
                attributes: ["primer_nombre", "primer_apellido"]
            }],
            order: [["fechaSolicitud", "DESC"]],
        });

        if (!solicitud) {
            return res.status(404).json({ message: "No se encontró ninguna solicitud." });
        }

        const result = solicitud.get({ plain: true });
        return res.status(200).json(result);

    } catch (error) {
        console.error("Error al obtener la solicitud", error);
        return res.status(500).json({ message: `Error al obtener la solicitud en el servidor:` });
    }
};

const deleteSolicitud = async (req, res) => {
    try {

        const id = req.params.id
        const solicitud = await Solicitudes.findByPk(id, {
            include: [{
                model: Docente,
                attributes: ["primer_nombre", "primer_apellido"]
            }]
        })
        if (!solicitud) {
            return res.status(404).json({ message: "Solicitud no encontrada" })
        }
        await Solicitudes.destroy({ where: { id } })
        const result = solicitud.get({ plain: true })
        return res.status(200).json(result)
    } catch (error) {
        console.error("Error al eliminar la solicitud", error)
        return res.status(500).json({ message: `Error al eliminar la solicitud en el servidor:` })
    }
}

module.exports = {
    createSolicitud,
    updateSolicitud,
    deleteSolicitud,
    getSolicitudesByDocente,
    getAllSolicitud,
    getUltimaSolicitud
}