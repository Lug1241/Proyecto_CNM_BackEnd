// Controlador para ESTUDIANTE
const path = require("path");
const Estudiante = require('../models/estudiante.model');
const Representantes = require('../models/representante.model')
const Matricula = require('../models/matricula.models')
const PeriodoAcademico = require('../models/periodo_academico.model')
const { Op, Sequelize } = require("sequelize");
const fs = require("fs");
const { registrarLog } = require('../utils/registrarLogs')
const crearEstudiante = async (request, res) => {
    const usuario = request.body;
    console.log("llego este usuario", usuario)
    try {
        // Verificar que el objeto usuario exista y tenga contenido
        if (!usuario || Object.keys(usuario).length === 0) {
            return res.status(400).json({
                message: 'No se proporcionaron datos del usuario'
            });
        }


        // Verificar que el estudiante no exista
        const estudianteEncontrado = await Estudiante.findOne({ where: { nroCedula: usuario.nroCedula } });
        console.log("este es el estudiante encontrado", estudianteEncontrado)
        if (estudianteEncontrado) {
            return res.status(409).json({ message: 'El estudiante ya existe' });
        }
        const copiaCedulaPath = request.files.copiaCedula ? request.files.copiaCedula[0].path : null;
        const matriculaIERPath = request.files.matricula_IER ? request.files.matricula_IER[0].path : null;
        usuario.cedula_PDF = copiaCedulaPath
        usuario.matricula_IER_PDF = matriculaIERPath
        const anioActual = parseInt(new Date().getFullYear());
        usuario.anioMatricula = anioActual

        console.log("esta es la objeto", usuario)

        const result = await Estudiante.create(usuario)

        return res.status(201).json(result);

    } catch (error) {
        console.log("este fue el error", error)
        if (error.name === "SequelizeValidationError") {
            console.log("Estos son los errores", error);

            const errEncontrado = error.errors.find(err =>
                err.validatorKey === "notEmpty" ||
                err.validatorKey === "isNumeric" ||
                err.validatorKey === "len" ||
                err.validatorKey === "is" ||
                err.validatorKey === "isOnlyLetters" ||
                err.validatorKey === "isIn" ||
                err.validatorKey === "is_null"
            );

            if (errEncontrado) {
                return res.status(400).json({ message: errEncontrado.message });
            }
        }

        if (error.name === "SequelizeUniqueConstraintError") {
            return res.status(400).json({ message: error.message })
        }
        return res.status(500).json({ message: `Error al crear estudiante en el servidor:` })

    }
}

/**
 * Obtener los estudiantes a cargo de un representante
 */
const getRepresentanteEstudiante = async (request, response) => {
    const nroCedula_representante = request.params.cedula;

    if (!nroCedula_representante || nroCedula_representante.trim() === '') {
        return response.status(400).json({ message: 'El número de cédula del representante es requerido' });
    }

    try {
        const estudiantes = await Estudiante.findAll({
            where: { nroCedula_representante },
            attributes: [
                'ID',
                'nroCedula',
                'primer_nombre',
                'segundo_nombre',
                'primer_apellido',
                'segundo_apellido',
                'jornada',
                'especialidad',
                'nivel',
                'fecha_nacimiento',
                'genero'
            ]
        });

        if (estudiantes.length === 0) {
            return response.status(404).json({ message: 'No se encontraron estudiantes para este representante' });
        }

        return response.status(200).json(estudiantes);

    } catch (error) {
        console.log('Error al obtener los estudiantes del representante:', error);
        if (error.name === 'SequelizeValidationError') {
            const mensajes = error.errors.map(err => err.message);
            return response.status(400).json({ message: mensajes });
        }
        return response.status(500).json({ message: 'Error interno del servidor al obtener los estudiantes' });

    }
}

/**
 * Obtener un estudiante por su cédula
 */
const getEstudiante = async (request, response) => {
    const ID = request.params.ID;

    try {
        const estudiante = await Estudiante.findByPk(ID);



        return response.status(200).json(estudiante);

    } catch (error) {
        console.log('Error al obtener el estudiante:', error);
        if (error.name === 'SequelizeValidationError') {
            const mensajes = error.errors.map(err => err.message);
            return response.status(400).json({ message: mensajes });
        }
        return response.status(500).json({ message: 'Error al obtener el estudiante en el servidor' });
    }
}
const getEstudianteByCedula = async (request, response) => {
    const cedula = request.params.cedula;

    try {
        const estudiante = await Estudiante.findOne({ where: { nroCedula: cedula } });

        return response.status(200).json(estudiante);

    } catch (error) {
        console.log('Error al obtener el estudiante:', error);
        if (error.name === 'SequelizeValidationError') {
            const mensajes = error.errors.map(err => err.message);
            return response.status(400).json({ message: mensajes });
        }
        return response.status(500).json({ message: 'Error al obtener el estudiante en el servidor' });
    }
}

/**
 * Obtener todos los estudiantes
 */
const getAllEstudiantes = async (request, response) => {
    try {
        let { page = 1, limit = 10, search = '' } = request.query;

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
                // Una sola palabra, buscar en nombre o apellido
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

        const { count, rows: estudiantes } = await Estudiante.findAndCountAll({
            limit,
            offset: (page - 1) * limit,
            where: whereConditions
        });

        return response.status(200).json({
            estudiantes,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalRows: count
        });

    } catch (error) {
        console.log('Error al obtener todos los estudiantes:', error);
        return response.status(500).json({ message: 'Error al obtener los estudiantes en el servidor' });
    }
};
const getEstudiantesByApellido = async (request, response) => {
    try {
        let { page = 1, limit = 10, search } = request.query;

        // Si no viene search, NO devuelve nada
        if (!search || search.trim() === '') {
            return response.status(200).json({
                estudiantes: [],
                totalPages: 0,
                currentPage: Number(page),
                totalRows: 0
            });
        }

        page = parseInt(page);
        limit = parseInt(limit);

        const apellido = search.trim().toLowerCase();

        const whereConditions = {
            [Op.and]: [
                Sequelize.where(
                    Sequelize.fn("LOWER", Sequelize.col("primer_apellido")),
                    { [Op.like]: `%${apellido}%` }
                )
            ]
        };

        const { count, rows: estudiantes } = await Estudiante.findAndCountAll({
            where: whereConditions,
            limit,
            offset: (page - 1) * limit
        });

        return response.status(200).json({
            estudiantes,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalRows: count
        });

    } catch (error) {
        console.log('Error al buscar estudiantes:', error);
        return response.status(500).json({
            message: 'Error al obtener los estudiantes en el servidor'
        });
    }
};


const getEstudiantesByNivel = async (request, response) => {
    try {
        const { nivel } = request.params
        console.log("este es el nivel", nivel)
        let { page, limit } = request.query;
        page = parseInt(page)
        limit = parseInt(limit)
        if (page && limit) {
            const { count, rows: estudiantes } = await Estudiante.findAndCountAll({
                limit,
                offset: (page - 1) * limit,
                where: {
                    nivel: nivel
                }
            }


            )

            return response.status(200).json({
                data: estudiantes,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                totalRows: count
            });
        }
        const estudiantes = await Estudiante.findAll({
            where: {
                nivel: nivel
            },
            include: [
                {
                    model: Representantes,
                    attributes: ["cedula_PDF", "croquis_PDF"]

                }
            ]
        })
        if (estudiantes.length == 0) return response.status(404).json({ message: "No se encontro ningún estudiante" })
        const result = estudiantes.map(estudiante => estudiante.get({ plain: true }))
        console.log("este es el result", result)
        return response.status(200).json(result)

    } catch (error) {
        console.log('Error al obtener todos los estudiantes:', error);
        if (error.name === 'SequelizeValidationError') {
            const mensajes = error.errors.map(err => err.message);
            return response.status(400).json({ message: mensajes });
        }
        return response.status(500).json({ message: 'Error al obtener los estudiantes en el servidor' });
    }
}
const getEstudiantesByMatricula = async (request, response) => {
    try {
        const { nivel, idPeriodo } = request.params;
        let { page, limit } = request.query;

        // 1. LOG DE ENTRADA: Vemos exactamente qué está recibiendo el servidor
        registrarLog(`[INICIO] Búsqueda. Nivel: "${nivel}", Periodo: "${idPeriodo}", Page: "${page}", Limit: "${limit}"`, { tipo: 'INFO', archivo: 'estudiantes.log' });

        page = parseInt(page);
        limit = parseInt(limit);

        // 2. LOG DE CONDICIONES: Imprimimos el objeto WHERE para verificar que Sequelize lo armó bien
        const whereConditions = {
            nivel: nivel,
            ...(idPeriodo && { ID_periodo_academico: idPeriodo })
        };
        registrarLog(`[CONDICIONES] SQL WHERE para Matricula: ${JSON.stringify(whereConditions)}`, { tipo: 'INFO', archivo: 'estudiantes.log' });

        const matriculaInclude = {
            model: Matricula,
            where: whereConditions,
            attributes: ['ID', 'nivel', 'ID_periodo_academico']
        };

        if (page && limit) {
            registrarLog(`[SQL] Ejecutando búsqueda CON paginación...`, { tipo: 'INFO', archivo: 'estudiantes.log' });

            const { count, rows: estudiantes } = await Estudiante.findAndCountAll({
                limit,
                offset: (page - 1) * limit,
                include: [matriculaInclude],
                distinct: true
            });

            // 3. LOG DE RESULTADOS PAGINADOS
            registrarLog(`[RESULTADO] Búsqueda paginada terminada. Filas: ${estudiantes.length}, Total Count: ${count}`, { tipo: 'INFO', archivo: 'estudiantes.log' });

            return response.status(200).json({
                data: estudiantes,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                totalRows: count
            });
        }

        registrarLog(`[SQL] Ejecutando búsqueda SIN paginación...`, { tipo: 'INFO', archivo: 'estudiantes.log' });

        // Búsqueda sin paginación
        const estudiantes = await Estudiante.findAll({
            include: [
                matriculaInclude,
                {
                    model: Representantes,
                    attributes: ["cedula_PDF", "croquis_PDF"]
                }
            ]
        });

        // 4. LOG DE RESULTADOS NO PAGINADOS (Aquí es donde se detona tu 404)
        registrarLog(`[RESULTADO] Búsqueda sin paginación terminada. Registros encontrados: ${estudiantes.length}`, { tipo: 'INFO', archivo: 'estudiantes.log' });

        if (estudiantes.length === 0) {
            registrarLog(`[404] Retornando 404. No existe cruce entre Estudiante y Matricula para Nivel: "${nivel}" y Periodo: "${idPeriodo}".`, { tipo: 'WARN', archivo: 'estudiantes.log' });
            return response.status(404).json({ message: "No se encontró ningún estudiante para este nivel y período." });
        }

        const result = estudiantes.map(estudiante => estudiante.get({ plain: true }));
        return response.status(200).json(result);

    } catch (error) {
        // 5. LOG DE ERRORES REALES
        registrarLog(`[ERROR] Falló la petición: ${error.message}`, { tipo: 'ERROR', archivo: 'estudiantes.log' });
        console.log('Error al obtener todos los estudiantes:', error);

        if (error.name === 'SequelizeValidationError') {
            const mensajes = error.errors.map(err => err.message);
            return response.status(400).json({ message: mensajes });
        }
        return response.status(500).json({ message: 'Error al obtener los estudiantes en el servidor' });
    }
}

// }

/**
 * Actualizar un estudiante
 */
const updateEstudiante = async (request, response) => {
    const ID = request.params.ID;
    const usuario = request.body;


    try {
        // Verificar que el estudiante existe
        const estudianteExistente = await Estudiante.findByPk(ID);
        if (!estudianteExistente) {
            return response.status(404).json({ message: 'El estudiante no existe' });
        }
        const periodoActivo = await PeriodoAcademico.findOne({ where: { estado: 'Activo' }, raw: true  } );
        let anioLectivo = "S-F"; // Sin fecha por defecto
        if (periodoActivo && periodoActivo.descripcion) {
            anioLectivo = periodoActivo.descripcion.replace('Periodo', '').trim();
        }
        if (request.files) {
            // Extraemos la cédula del body para el nombre
            const cedula = usuario.nroCedula || "sin-cedula";

            for (const fieldname in request.files) {
                const archivoInformacion = request.files[fieldname][0]; // Obtenemos el archivo subido

                // Construimos el nuevo nombre: 1726313255_copiaCedula_2025-2026.pdf
                const nuevoNombreArchivo = `${cedula}_${fieldname}_${anioLectivo}.pdf`;

                // Construimos las rutas absolutas para renombrar el archivo en el disco
                const rutaAntigua = archivoInformacion.path; // ej: uploads/Estudiantes/1692123456789-tmp.pdf
                const rutaNueva = path.join(archivoInformacion.destination, nuevoNombreArchivo);

                // Renombramos el archivo físicamente (esto reemplazará un archivo viejo si se llama igual, lo cual es perfecto)
                fs.renameSync(rutaAntigua, rutaNueva);

                // 3. Guardamos la RUTA RELATIVA en el objeto que irá a la Base de Datos
                // Asumiendo que tu carpeta de destino se llamaba 'Estudiantes'
                const rutaParaBD = `uploads/Estudiantes/${nuevoNombreArchivo}`;

                if (fieldname === "copiaCedula") {
                    usuario.cedula_PDF = rutaParaBD;
                } else if (fieldname === "matricula_IER") {
                    usuario.matricula_IER_PDF = rutaParaBD; // O el nombre que tenga este campo en tu BD
                }
                console.log("hello")
            }
        }
        console.log("1. Lo que Sequelize acepta:", Object.keys(Estudiante.getAttributes()));
        console.log("2. Lo que le estoy enviando:", usuario.matricula_IER_PDF);
        // Actualizar el estudiante
        const [updatedRows] = await Estudiante.update(usuario, {
            where: { ID }
        });

        if (updatedRows === 0) {
            return response.status(400).json({ message: 'No se pudo actualizar el estudiante' });
        }

        // Obtener y retornar el estudiante actualizado
        const estudianteActualizado = await Estudiante.findByPk(ID);


        return response.status(200).json(

            estudianteActualizado
        );

    } catch (error) {
        console.log('Error al actualizar el estudiante:', error);
        if (error.name === "SequelizeValidationError") {
            console.log("Estos son los errores", error);

            const errEncontrado = error.errors.find(err =>
                err.validatorKey === "notEmpty" ||
                err.validatorKey === "isNumeric" ||
                err.validatorKey === "len" ||
                err.validatorKey === "is" ||
                err.validatorKey === "isOnlyLetters" ||
                err.validatorKey === "isIn" ||
                err.validatorKey === "is_null"
            );

            if (errEncontrado) {
                return response.status(400).json({ message: errEncontrado.message });
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
        console.log("ESTE ES EL ERROR", error.name)
        return response.status(500).json({ message: `Error al editar estudiante en el servidor:` })

    }
}

/**
 * Eliminar un estudiante
 */
const deleteEstudiante = async (request, response) => {
    const ID = request.params.ID;



    try {
        const estudiante = await Estudiante.findByPk(ID);
        if (!estudiante) {
            return response.status(404).json({ message: 'Estudiante no encontrado' });
        }

        const rowsDeleted = await Estudiante.destroy({ where: { ID } });

        if (rowsDeleted > 0) {
            return response.status(200).json({
                estudiante
            });
        } else {
            return response.status(400).json({
                message: 'No se pudo eliminar el estudiante'
            });
        }
    } catch (error) {
        console.log('Error al eliminar el estudiante:', error);
        if (error.name === 'SequelizeError') {
            const mensajes = error.errors.map(err => err.message);
            return response.status(400).json({ message: mensajes });
        }
        return response.status(500).json({
            message: 'Error al eliminar el estudiante en el servidor'
        });
    }
}

/**
 * Verificar si un estudiante tiene la matrícula IER actualizada (PDF cargado)
 * Esto es requerido antes de poder realizar la matriculación
 */
const verificarMatriculaIER = async (request, response) => {
    const ID = request.params.id;

    try {
        const estudiante = await Estudiante.findByPk(ID);

        if (!estudiante) {
            return response.status(404).json({
                message: 'Estudiante no encontrado',
                datosActualizados: false
            });
        }
        const periodoActivo = await PeriodoAcademico.findOne({ where: { estado: 'Activo' }, raw: true  } );
        let anioLectivo = "S-F"; // Sin fecha por defecto
        if (periodoActivo && periodoActivo.descripcion) {
            anioLectivo = periodoActivo.descripcion.replace('Periodo', '').trim();
        }
        // Verificar si tiene el PDF de matrícula IER cargado
        const tieneMatriculaIER = estudiante.matricula_IER_PDF && estudiante.matricula_IER_PDF.trim() !== '' &&
            estudiante.matricula_IER_PDF.includes(anioLectivo);

        if (tieneMatriculaIER) {
            return response.status(200).json({
                datosActualizados: true,
                message: 'El estudiante tiene los documentos actualizados'
            });
        } else {
            return response.status(200).json({
                datosActualizados: false,
                message: 'El estudiante debe actualizar su documentación (Matrícula IER) antes de matricularse'
            });
        }

    } catch (error) {
        console.log('Error al verificar matrícula IER del estudiante:', error);
        return response.status(500).json({
            message: 'Error al verificar la documentación del estudiante en el servidor',
            datosActualizados: false
        });
    }
}

module.exports = {
    crearEstudiante,
    getEstudiante,
    getAllEstudiantes,
    updateEstudiante,
    deleteEstudiante,
    getRepresentanteEstudiante,
    getEstudianteByCedula,
    getEstudiantesByNivel,
    verificarMatriculaIER,
    getEstudiantesByApellido,
    getEstudiantesByMatricula
};