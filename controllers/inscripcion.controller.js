const Estudiante = require('../models/estudiante.model');
const Matricula = require('../models/matricula.models');
const Asignacion = require('../models/asignacion.model');
const Inscripcion = require('../models/inscripcion.model');
const Materia = require('../models/materia.model');
const Docente = require('../models/docente.model');
const Fechas_procesos = require('../models/fechas_procesos.model');
const { sequelize } = require('../config/sequelize.config');
const { Op } = require('sequelize');
require("dotenv").config();
const jwt = require("jsonwebtoken");


const tienenDiasSolapados = (dias1, dias2) => {
    return dias1.some(dia => dias2.includes(dia));
}
const tienenHorariosSolapados = (horaInicioA, horaFinA, horaInicioB, horaFinB) => {
    return horaInicioA < horaFinB && horaFinA > horaInicioB;
}
const createInscripcion = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        // Verificar si el período de matrícula está activo para profesor
        const hoy = new Date();
        let token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol == "representante") { //AQUI HAY QUE VOLVER AÑADIR A PROFESOR CUANDO SE NORMALIZE
            const procesoMatricula = await Fechas_procesos.findOne({
                where: {
                    proceso: { [Op.like]: '%matricula%' },
                    fecha_inicio: { [Op.lte]: hoy },  // fecha_inicio <= hoy
                    fecha_fin: { [Op.gte]: hoy }    // fecha_fin >= hoy
                },
                // Si hubiera más de un período activo, tomamos el más reciente
                order: [['fecha_inicio', 'DESC']],
                transaction: t
            });

            if (!procesoMatricula) {
                await t.rollback();
                return res.status(400).json({
                    message: 'No hay un período de matrícula ACTIVO. Contacte con la administración.'
                });
            }

            const fechaInicio = new Date(procesoMatricula.fecha_inicio);
            const fechaFin = new Date(procesoMatricula.fecha_fin);

            // (Esta validación ya es casi redundante, pero la dejamos por seguridad)
            const periodoActivo = hoy >= fechaInicio && hoy <= fechaFin;

            if (!periodoActivo) {
                await t.rollback();
                return res.status(400).json({
                    message: `El período de matrícula no está activo. Período válido: ${fechaInicio.toLocaleDateString('es-ES')} - ${fechaFin.toLocaleDateString('es-ES')}`
                });
            }
        }
        const inscripcion = req.body;
        console.log("esto se recibió del front", inscripcion)

        // Verificar si ya está inscrito en esta asignación
        const inscripcionFounded = await Inscripcion.findOne({
            where: {
                ID_asignacion: inscripcion.ID_asignacion,
                ID_matricula: inscripcion.ID_matricula
            },
            transaction: t
        });
        if (inscripcionFounded) {
            await t.rollback();
            return res.status(400).json({ message: 'El estudiante ya está inscrito en esta materia' });
        }

        // Buscar asignación con lock
        const asignacionActual = await Asignacion.findByPk(inscripcion.ID_asignacion, {
            include: [
                {
                    model: Materia,
                    as: "materiaDetalle"
                }
            ],
            lock: t.LOCK.UPDATE,
            transaction: t
        });

        if (!asignacionActual) {
            await t.rollback();
            return res.status(404).json({ message: 'Asignación no encontrada' });
        }

        if (asignacionActual.cupos <= 0) {
            await t.rollback();
            return res.status(400).json({ message: 'No hay cupos disponibles en esta asignación' });
        }

        // Verificar si ya está inscrito en la misma materia (otro docente)
        const yaInscrito = await Inscripcion.findOne({
            where: {
                ID_matricula: inscripcion.ID_matricula
            },
            include: {
                model: Asignacion,
                where: {
                    ID_materia: asignacionActual.ID_materia
                }
            },
            transaction: t
        });

        if (yaInscrito) {
            await t.rollback();
            return res.status(400).json({ message: 'El estudiante ya está inscrito en esta materia con otro profesor' });
        }

        const inscripciones = await Inscripcion.findAll({
            where: {
                ID_matricula: inscripcion.ID_matricula
            },
            include: [{
                model: Asignacion,
            }],
            transaction: t
        });

        const asignaciones = inscripciones.map((inscripcion) => {
            const inscripcionPlain = inscripcion.get({ plain: true });
            return inscripcionPlain.Asignacion;
        });
        console.log("estas son las asignaciones previas", asignaciones)
        function toMin(hora) {
            if (!hora) return null;
            const [h, m] = hora.split(":").map(Number);
            return h * 60 + m;
        }
        function obtenerRangoPorDia(asignacion, dia) {
            const index = asignacion.dias.indexOf(dia);
            if (index === -1) return null;

            const tieneSegundoHorario =
                asignacion.hora1 &&
                asignacion.hora2;

            // Caso 1: un solo horario para todos los días
            if (!tieneSegundoHorario) {
                return {
                    inicio: toMin(asignacion.horaInicio),
                    fin: toMin(asignacion.horaFin)
                };
            }

            // Caso 2: dos días, dos horarios distintos
            if (index === 0) {
                return {
                    inicio: toMin(asignacion.horaInicio),
                    fin: toMin(asignacion.horaFin)
                };
            }

            if (index === 1) {
                return {
                    inicio: toMin(asignacion.hora1),
                    fin: toMin(asignacion.hora2)
                };
            }

            return null;
        }


        function tienenHorariosSolapados(rangoA, rangoB) {
            if (!rangoA || !rangoB) return false;
            if (rangoA.inicio == null || rangoA.fin == null) return false;
            if (rangoB.inicio == null || rangoB.fin == null) return false;

            return rangoA.inicio < rangoB.fin && rangoA.fin > rangoB.inicio;
        }

        const conflicto = asignaciones.some(asig => {
            return asignacionActual.dias.some(dia => {
                if (!asig.dias.includes(dia)) return false;

                const rangoNueva = obtenerRangoPorDia(asignacionActual, dia);
                const rangoExistente = obtenerRangoPorDia(asig, dia);

                return tienenHorariosSolapados(rangoNueva, rangoExistente);
            });
        });

        if (conflicto) {
            await t.rollback(); // 👈 importante
            return res.status(400).json({ message: "Inscripción no válida por cruce de horarios" });
        }

        // Crear inscripción
        const nuevaInscripcion = await Inscripcion.create(inscripcion, { transaction: t });

        // Restar cupo
        asignacionActual.cupos -= 1;
        await asignacionActual.save({ transaction: t });

        await t.commit();
        return res.status(201).json(nuevaInscripcion);

    } catch (error) {
        await t.rollback();
        console.log('Error al crear inscripcion:', error);

        if (error.name === "SequelizeValidationError") {
            const errEncontrado = error.errors.find(err =>
                err.validatorKey === "notEmpty" ||
                err.validatorKey === "isNumeric" ||
                err.validatorKey === "len" ||
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

        return res.status(500).json({ message: `Error al crear inscripción en el servidor:` });
    }
};


const updateInscripcion = async (req, res) => {
    try {
        const inscripcion = req.body
        const id = req.params.id
        const [updatedRows] = await Inscripcion.update(inscripcion, { where: { id } })
        if (updatedRows === 0) {
            return res.status(404).json({ message: "Inscripción no encontrada" })
        }
        const result = await Inscripcion.findByPk(id)
        return res.status(200).json(result)
    } catch (error) {

        if (error.name === "SequelizeValidationError") {
            console.log("Estos son los errores", error);

            const errEncontrado = error.errors.find(err =>
                err.validatorKey === "notEmpty" ||
                err.validatorKey === "isNumeric" ||
                err.validatorKey === "len" ||
                err.validatorKey === "is_null"
            );

            if (errEncontrado) {
                return res.status(400).json({ message: errEncontrado.message });
            }
        }

        if (error.name === "SequelizeUniqueConstraintError") {
            return res.status(400).json({ message: error.message })
        }

        return res.status(500).json({ message: `Error al editar inscripción en el servidor:` })

    }
}
const getInscripcion = async (req, res) => {

    try {
        const id = req.params.id
        const inscripcion = await Inscripcion.findByPk(id)
        if (!inscripcion) {
            return res.status(404).json({ message: "Inscripción no encontrada" })
        }


        res.status(200).json(inscripcion)
    } catch (error) {
        console.error("Error al obtener la inscripción", error)
        return res.status(500).json({ message: `Error al obtener la inscripción en el servidor:` })
    }
}

const deleteInscripcion = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const id = req.params.id;

        // Buscar la inscripción con su asignación relacionada, con bloqueo
        const inscripcion = await Inscripcion.findByPk(id, {
            include: {
                model: Asignacion,
                as: 'Asignacion'
            },
            transaction: t,
            lock: t.LOCK.UPDATE
        });

        if (!inscripcion) {
            await t.rollback();
            return res.status(404).json({ message: 'Inscripción no encontrada' });
        }

        // Sumar 1 cupo a la asignación relacionada
        if (inscripcion.Asignacion) {
            inscripcion.Asignacion.cupos += 1;
            await inscripcion.Asignacion.save({ transaction: t });
        }

        // Eliminar la inscripción
        await Inscripcion.destroy({
            where: { id },
            transaction: t
        });

        await t.commit();
        const inscripcionEliminada = inscripcion.get({ plain: true });
        return res.status(200).json(inscripcionEliminada);

    } catch (error) {
        await t.rollback();
        console.error("Error al eliminar la inscripción:", error);
        return res.status(500).json({ message: "Error en el servidor al eliminar la inscripción" });
    }
};

const getInscripcionesByMatricula = async (req, res) => {

    try {
        const matricula = req.params.matricula

        if (!matricula || matricula === "undefined" || matricula.trim() === "") {

            return res.status(400).json({ message: "No se seleccionó estudiante" });
        }
        console.log("este es el id", matricula)
        const inscripciones = await Inscripcion.findAll({
            where: {
                ID_matricula: matricula
            },
            include:
                [{
                    model: Asignacion,
                    include: [
                        {
                            model: Materia,
                            as: "materiaDetalle",
                        },
                        {
                            model: Docente,
                            attributes: ['nroCedula', 'primer_nombre', 'primer_apellido']
                        }
                    ]
                }]

        })

        const toMin = (hora) => {
            if (!hora) return null;
            const [h, m] = hora.split(":").map(Number);
            return h * 60 + m;
        };

        const obtenerRangoPorDia = (asignacion, dia) => {
            const index = asignacion.dias.indexOf(dia);
            if (index === -1) return null;

            const tieneSegundoHorario = asignacion.hora1 && asignacion.hora2;

            if (!tieneSegundoHorario) {
                return {
                    inicio: toMin(asignacion.horaInicio),
                    fin: toMin(asignacion.horaFin),
                    horaInicio: asignacion.horaInicio,
                    horaFin: asignacion.horaFin
                };
            }

            if (index === 0) {
                return {
                    inicio: toMin(asignacion.horaInicio),
                    fin: toMin(asignacion.horaFin),
                    horaInicio: asignacion.horaInicio,
                    horaFin: asignacion.horaFin
                };
            }

            if (index === 1) {
                return {
                    inicio: toMin(asignacion.hora1),
                    fin: toMin(asignacion.hora2),
                    horaInicio: asignacion.hora1,
                    horaFin: asignacion.hora2
                };
            }

            return null;
        };

        // Aplanamos los datos de las inscripciones
        const inscripcionesFinal = inscripciones.map((inscripcion) => {
            const inscripcionPlain = inscripcion.get({ plain: true });

            if (inscripcionPlain.Asignacion) {
                const asignacionPlain = inscripcionPlain.Asignacion;

                if (asignacionPlain.materiaDetalle) {
                    asignacionPlain.Materia = asignacionPlain.materiaDetalle;
                    delete asignacionPlain.materiaDetalle;
                }

                if (asignacionPlain.dias && Array.isArray(asignacionPlain.dias) && asignacionPlain.dias.length === 2) {
                    const primerDia = asignacionPlain.dias[0];
                    const segundoDia = asignacionPlain.dias[1];
                    const rango1 = obtenerRangoPorDia(asignacionPlain, primerDia);
                    const rango2 = obtenerRangoPorDia(asignacionPlain, segundoDia);

                    if (rango1 && rango2) {
                        asignacionPlain.rangoPorDia = {
                            [primerDia]: { horaInicio: rango1.horaInicio, horaFin: rango1.horaFin },
                            [segundoDia]: { horaInicio: rango2.horaInicio, horaFin: rango2.horaFin }
                        };
                    }
                }

                inscripcionPlain.Asignacion = asignacionPlain;
            }

            return inscripcionPlain;
        });

        return res.status(200).json(inscripcionesFinal)
    } catch (error) {
        console.error("Error al obtener la inscripción", error)
        return res.status(500).json({ message: `Error al obtener la inscripción en el servidor:` })
    }
}
const getEstudiantesPorAsignacion = async (req, res) => {
    const { id_asignacion } = req.params;

    try {
        const inscripciones = await Inscripcion.findAll({
            where: { ID_asignacion: id_asignacion },
            include: [{
                model: Matricula,
                attributes: ['nivel'],
                include: [{
                    model: Estudiante,
                    attributes: ['ID', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido']
                }]
            }, {
                model: Asignacion,
                include: [{
                    model: Materia,
                    as: 'materiaDetalle',
                    attributes: ['nivel']
                }]
            }]
        });

        const estudiantes = inscripciones
            .map((insc) => {
                const est = insc.Matricula?.Estudiante;
                if (!est) return null;

                // Fallback: si la matrícula viene sin nivel, usar el nivel de la materia de la asignación.
                const nivel = insc.Matricula?.nivel || insc.Asignacion?.materiaDetalle?.nivel || "";

                const nombreCompleto = [
                    est.primer_apellido,
                    est.segundo_apellido ?? '',
                    est.primer_nombre,
                    est.segundo_nombre ?? ''
                ].join(' ');

                return {
                    idInscripcion: insc.ID,
                    idEstudiante: est.ID,
                    nombreCompleto,
                    nivel
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto))
            .map((est, index) => ({
                nro: index + 1,
                idInscripcion: est.idInscripcion,
                idEstudiante: est.idEstudiante,
                nombre: est.nombreCompleto,
                nivel: est.nivel
            }));

        return res.status(200).json(estudiantes);
    } catch (error) {
        console.error("Error al obtener estudiantes por asignación", error);
        return res.status(500).json({ message: "Error en el servidor" });
    }
};
const getInscripcionesIndividualesDocente = async (req, res) => {
    try {
        console.log("estoy aca")
        const docente = req.params.docente
        console.log("este es docente", docente)
        const periodo = req.params.periodo
        let { page, limit } = req.query;
        console.log("esto es todo", docente, periodo, page, limit)
        page = parseInt(page)
        limit = parseInt(limit)
        console.log("este es el periodfgggo", periodo)
        const { count, rows: inscripciones } = await Inscripcion.findAndCountAll({
            limit,
            offset: (page - 1) * limit,
            include: [
                {
                    model: Asignacion,
                    include: [{
                        model: Materia,
                        as: "materiaDetalle",
                        where: {
                            tipo: "individual"
                        }
                    },
                    {
                        model: Docente,
                        attributes: ["primer_nombre", "primer_apellido"]
                    }

                    ],
                    where: {
                        nroCedula_docente: docente
                    }
                },
                {
                    model: Matricula,
                    where: {
                        ID_periodo_academico: periodo
                    },
                    include: [{
                        model: Estudiante,
                    }]
                }
            ]
        })
        console.log("estas son las inscripciones", inscripciones)
        const inscripcionesFinal = inscripciones.map((inscripcion) => {
            const inscripcionPlain = inscripcion.get({ plain: true }); // Convertimos la inscripción a un objeto plano

            // Aplanamos las asignaciones dentro de la inscripción
            if (inscripcionPlain.Asignacion) {
                // Ya estamos trabajando con un objeto plano, no necesitamos llamar a get
                const asignacionPlain = inscripcionPlain.Asignacion;

                // Renombramos "materiaDetalle" a "Materia" si existe
                if (asignacionPlain.materiaDetalle) {
                    asignacionPlain.Materia = asignacionPlain.materiaDetalle;
                    delete asignacionPlain.materiaDetalle; // Eliminamos la propiedad materiaDetalle
                }

                inscripcionPlain.Asignacion = asignacionPlain;
            }

            return inscripcionPlain;
        });
        return res.status(200).json({
            data: inscripcionesFinal,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalRows: count
        });
    } catch (error) {
        console.error("Error al obtener las inscripciones", error)
        return res.status(500).json({ message: `Error al obtener las inscripciones en el servidor:` })
    }
}
const getInscripcionesIndividualesByNivel = async (req, res) => {
    try {
        const nivel = req.params.nivel
        const periodo = req.params.periodo
        let { page = 1, limit = 10 } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const offset = (page - 1) * limit;

        const { count, rows: inscripciones } = await Inscripcion.findAndCountAll({
            distinct: true,
            limit,
            offset,
            include: [
                {
                    model: Asignacion,
                    required: true,
                    include: [
                        {
                            model: Materia,
                            as: "materiaDetalle",
                            required: true,
                            where: {
                                nivel: nivel,
                                tipo: "individual"
                            }
                        },
                        {
                            model: Docente,
                            attributes: ["primer_nombre", "primer_apellido"]
                        }
                    ]
                },
                {
                    model: Matricula,
                    required: true,
                    where: {
                        ID_periodo_academico: periodo
                    },
                    include: [{ model: Estudiante }]
                }
            ]
        });


        const inscripcionesFinal = inscripciones.map((inscripcion) => {
            const inscripcionPlain = inscripcion.get({ plain: true }); // Convertimos la inscripción a un objeto plano

            // Aplanamos las asignaciones dentro de la inscripción
            if (inscripcionPlain.Asignacion) {
                // Ya estamos trabajando con un objeto plano, no necesitamos llamar a get
                const asignacionPlain = inscripcionPlain.Asignacion;

                // Renombramos "materiaDetalle" a "Materia" si existe
                if (asignacionPlain.materiaDetalle) {
                    asignacionPlain.Materia = asignacionPlain.materiaDetalle;
                    delete asignacionPlain.materiaDetalle; // Eliminamos la propiedad materiaDetalle
                }

                inscripcionPlain.Asignacion = asignacionPlain;
            }

            return inscripcionPlain;
        });
        return res.status(200).json({
            data: inscripcionesFinal,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalRows: count
        });
    } catch (error) {
        console.error("Error al obtener las inscripciones", error)
        return res.status(500).json({ message: `Error al obtener las inscripciones en el servidor:` })
    }
}



module.exports = {
    createInscripcion,
    updateInscripcion,
    deleteInscripcion,
    getInscripcion,
    getEstudiantesPorAsignacion,
    getInscripcionesByMatricula,
    getInscripcionesIndividualesDocente,
    getInscripcionesIndividualesByNivel

}