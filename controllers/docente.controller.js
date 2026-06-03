
const bcrypt = require("bcryptjs")
const Docente = require('../models/docente.model')
const crypto = require("crypto")
const { enviarContrasenia } = require("../utils/enivarCorreo")
const { Op, Sequelize } = require('sequelize'); // Asegúrate de tenerlo al inicio

const createDocente = async (req, res) => {
    try {
        const docente = req.body
        const docenteFound = await Docente.findByPk(docente.nroCedula)
        if (docenteFound) {
            return res.status(409).json({ message: "La cédula ya existe" })
        }
        const provicional = crypto.randomBytes(8).toString('hex').slice(0, 8);
        docente.password = provicional
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(docente.password, salt);
        docente.password = hashedPassword;
        // 👇 OBLIGAR A CAMBIAR CONTRASEÑA EN EL PRIMER LOGIN
        docente.debe_cambiar_password = true;
        console.log("esta es la password", docente.password)
        const newDocente = await Docente.create(docente)
        await enviarContrasenia(docente.email, provicional)
        const { password: _, ...result } = newDocente.toJSON()
        return res.status(201).json(result)
    } catch (error) {
        console.log("ESTE ES EL ERROR", error)
        if (error.name === "SequelizeValidationError") {
            console.log("Estos son los errores", error);

            const errEncontrado = error.errors.find(err =>
                err.validatorKey === "notEmpty" ||
                err.validatorKey === "isNumeric" ||
                err.validatorKey === "len" ||
                err.validatorKey === "is" ||
                err.validatorKey === "isEmail" ||
                err.validatorKey === "isOnlyLetters" ||
                err.validatorKey === "is_null"
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

        return res.status(500).json({ message: `Error al crear docente en el servidor:` })

    }
}
const editDocente = async (req, res) => {
    try {
        const docente = req.body
        const nroCedula = req.params.cedula
        // Si se está actualizando la password, hashearla
        const docenteExistente = await Docente.findOne({ where: { nroCedula: nroCedula } });
        if (!docenteExistente) {
            return res.status(404).json({ message: "Docente no encontrado" })
        }
        if (docente.password) {
            const salt = await bcrypt.genSalt(10);
            docente.password = await bcrypt.hash(docente.password, salt);
        }
        if (docente.email !== docenteExistente.email) {
            const provicional = crypto.randomBytes(8).toString('hex').slice(0, 8);
            docente.password = provicional
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(docente.password, salt);
            docente.password = hashedPassword
            await enviarContrasenia(docente.email, provicional)
        }
        
        const [updatedRows] = await Docente.update(docente, { where: { nroCedula } })
        if (updatedRows === 0) {
            return res.status(404).json({ message: "No se puedo actualizar el docente" })
        }
        const docenteEdited = await Docente.findByPk(nroCedula)
        
        const { password: _, ...result } = docenteEdited.toJSON()
        return res.status(200).json(result)
    } catch (error) {
        console.error("Error al editar docente", error)
        if (error.name === "SequelizeValidationError") {
            console.log("Estos son los errores", error);

            const errEncontrado = error.errors.find(err =>
                err.validatorKey === "notEmpty" ||
                err.validatorKey === "isNumeric" ||
                err.validatorKey === "len" ||
                err.validatorKey === "isEmail" ||
                err.validatorKey === "isOnlyLetters" ||
                err.validatorKey === "is" ||
                err.validatorKey === "is_null"
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

        return res.status(500).json({ message: `Error al editar docente en el servidor:` })

    }
}
const getDocente = async (req, res) => {

    try {
        const nroCedula = req.params.cedula
        const docente = await Docente.findByPk(nroCedula)
        if (!docente) {
            return res.status(404).json({ message: "Docente no encontrado" })
        }

        const { password: _, ...result } = docente.toJSON()
        return res.status(200).json(result)
    } catch (error) {
        console.error("Error al obtener docente", error)
        return res.status(500).json({ message: `Error al obtener docente en el servidor:` })
    }
}
const getDocentes = async (req, res) => {
    try {
        let { page = 1, limit = 10, search = '' } = req.query;
        console.log("Estos son los valores", page, limit, search);
        page = parseInt(page);
        limit = parseInt(limit);

        let whereConditions = {};

        if (search.trim() !== '') {
            const terms = search.trim().toLowerCase().split(/\s+/);

            if (terms.length === 2) {
                const [term1, term2] = terms;

                whereConditions = {
                    [Op.or]: [
                        {
                            [Op.and]: [
                                Sequelize.where(
                                    Sequelize.fn("LOWER", Sequelize.col("primer_nombre")),
                                    { [Op.like]: `%${term1}%` }
                                ),
                                Sequelize.where(
                                    Sequelize.fn("LOWER", Sequelize.col("primer_apellido")),
                                    { [Op.like]: `%${term2}%` }
                                )
                            ]
                        },
                        {
                            [Op.and]: [
                                Sequelize.where(
                                    Sequelize.fn("LOWER", Sequelize.col("primer_nombre")),
                                    { [Op.like]: `%${term2}%` }
                                ),
                                Sequelize.where(
                                    Sequelize.fn("LOWER", Sequelize.col("primer_apellido")),
                                    { [Op.like]: `%${term1}%` }
                                )
                            ]
                        }
                    ]
                };
            } else {
                // Solo un término, buscar en ambos campos
                whereConditions = {
                    [Op.or]: [
                        Sequelize.where(
                            Sequelize.fn("LOWER", Sequelize.col("primer_nombre")),
                            { [Op.like]: `%${terms[0]}%` }
                        ),
                        Sequelize.where(
                            Sequelize.fn("LOWER", Sequelize.col("primer_apellido")),
                            { [Op.like]: `%${terms[0]}%` }
                        )
                    ]
                };
            }
        }

        const { count, rows: docentes } = await Docente.findAndCountAll({
            limit,
            offset: (page - 1) * limit,
            where: whereConditions
        });

        return res.status(200).json({
            data: docentes,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalRows: count
        });

    } catch (error) {
        console.error("Error al obtener docentes", error);
        return res.status(500).json({ message: `Error al obtener docentes en el servidor:` });
    }
};

const eliminarDocente = async (req, res) => {
    try {

        const nroCedula = req.params.cedula
        const docente = await Docente.findByPk(nroCedula)
        if (!docente) {
            return res.status(404).json({ message: "Docente no encontrado" })
        }
        await Docente.destroy({ where: { nroCedula } })
        const { password: _, ...result } = docente.toJSON()
        return res.status(200).json(result)
    } catch (error) {
        console.error("Error al eliminar docente", error)
        return res.status(500).json({ message: `Error al eliminar docente en el servidor:` })
    }
}
module.exports = {
    createDocente,
    editDocente,
    getDocente,
    getDocentes,
    eliminarDocente
}