const Representante = require('../models/representante.model');
const Periodo_Academico = require('../models/periodo_academico.model');
const crypto = require("crypto")
const {enviarContrasenia}=require("../utils/enivarCorreo")
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
// Create REPRESENTANTE
const crearRepresentante = async (request, response) => {
    const usuario = request.body;

    try {
        // Verificar si el representante existe
        const representanteEncontrado = await Representante.findByPk(usuario.nroCedula);
        if (representanteEncontrado) {
            return response.status(409).json({ message: 'El representante ya existe!' }); // 409 conflict
        }
        const provicional = crypto.randomBytes(8).toString('hex').slice(0, 8);
        usuario.password = provicional
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(usuario.password, salt);
        usuario.password=hashedPassword
        const copiaCedulaPath = request.files.copiaCedula ? request.files.copiaCedula[0].path : null;
        const croquisPath = request.files.croquis ? request.files.croquis[0].path : null;
        console.log("Estos son los paths: ",copiaCedulaPath, croquisPath)

        usuario.cedula_PDF = copiaCedulaPath;
        usuario.croquis_PDF = croquisPath;
        // 👇 OBLIGAR A CAMBIAR CONTRASEÑA EN EL PRIMER LOGIN
        usuario.debe_cambiar_password = true;
        const nuevoRepresentante = await Representante.create(usuario);
        await enviarContrasenia(nuevoRepresentante.email,provicional)
        const { password: _, ...result } = nuevoRepresentante.toJSON();
        

        return response.status(201).json(result);

    } catch (error) {
        console.log('Error al crear el representante:', error);
        if (error.name === "SequelizeValidationError") {
            console.log("Estos son los errores", error);

            const errEncontrado = error.errors.find(err =>
                err.validatorKey === "notEmpty" ||
                err.validatorKey === "isNumeric" ||
                err.validatorKey === "len" ||
                err.validatorKey === "isEmail" ||
                err.validatorKey === "is" ||
                err.validatorKey ==="isOnlyLetters" ||
                err.validatorKey ==="is_null"
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
              return response.status(400).json({ message: `${errEncontrado.path} debe ser único` });
            }
      
          }
        return response.status(500).json({ message: 'Error al crear el representante en el servidor' });
    }
}

// Read REPRESENTANTE
const getRepresentante = async (request, response) => {
    const nroCedula = request.params.cedula;
    try {
        const representante = await Representante.findOne({
            where: { nroCedula }
        });
        if (!representante)
            return response.status(404).json({ message: 'Representante no encontrado' });

        const { password: _, ...result } = representante.toJSON(); // Omite la contrasena
        return response.status(200).json(result);

    } catch (error) {
        console.log('Error al obtener el representante');
        if (error.name === 'SequelizeValidationError') {
            const mensajes = error.errors.map(err => err.message);
            return response.status(400).json({ message: mensajes });
        }

        return response.status(500).json({ message: 'Error al obtener el representante en el servidor' });
    }
}

// Read todos los representantes
const getAllRepresentantes = async (request, response) => {
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
                                    Sequelize.fn("LOWER", Sequelize.col("nombre")),
                                    { [Op.like]: `%${term1}%` }
                                ),
                                Sequelize.where(
                                    Sequelize.fn("LOWER", Sequelize.col("apellido")),
                                    { [Op.like]: `%${term2}%` }
                                )
                            ]
                        },
                        {
                            [Op.and]: [
                                Sequelize.where(
                                    Sequelize.fn("LOWER", Sequelize.col("nombre")),
                                    { [Op.like]: `%${term2}%` }
                                ),
                                Sequelize.where(
                                    Sequelize.fn("LOWER", Sequelize.col("apellido")),
                                    { [Op.like]: `%${term1}%` }
                                )
                            ]
                        }
                    ]
                };
            } else {
                // Una sola palabra, buscar en ambos campos
                whereConditions = {
                    [Op.or]: [
                        Sequelize.where(
                            Sequelize.fn("LOWER", Sequelize.col("nombre")),
                            { [Op.like]: `%${terms[0]}%` }
                        ),
                        Sequelize.where(
                            Sequelize.fn("LOWER", Sequelize.col("apellido")),
                            { [Op.like]: `%${terms[0]}%` }
                        )
                    ]
                };
            }
        }

        const { count, rows: representantes } = await Representante.findAndCountAll({
            limit,
            offset: (page - 1) * limit,
            where: whereConditions
        });

        const result = representantes.map(rep => {
            const { password: _, ...rest } = rep.toJSON();
            return rest;
        });

        return response.status(200).json({
            representantes: result,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalRows: count
        });

    } catch (error) {
        console.log('Error al obtener los representantes:', error);
        return response.status(500).json({ message: 'Error al obtener los representantes en el servidor' });
    }
};

// Update REPRESENTANTE
const updateRepresentante = async (request, response) => {
    const nroCedula = request.params.cedula;
    const usuario = request.body;

    try {
        // Verificar que el objeto usuario exista y tenga contenido
        if (!usuario || Object.keys(usuario).length === 0) {
            return response.status(400).json({
                message: 'No se proporcionaron datos del usuario'
            });
        }

        // Verificar si el representante existe
        const representanteExistente = await Representante.findOne( {where:{nroCedula: nroCedula }});
        if (!representanteExistente) {
            return response.status(404).json({ message: 'Representante no encontrado' });
        }
        
        // Si se está actualizando la password, hashearla
        if (usuario.password) {
            const salt = await bcrypt.genSalt(10);
            usuario.password = await bcrypt.hash(usuario.password, salt);
        }
        if(usuario.email!==representanteExistente.email){
            const provicional = crypto.randomBytes(8).toString('hex').slice(0, 8);
            usuario.password = provicional
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(usuario.password, salt);
            usuario.password=hashedPassword
            enviarContrasenia(usuario.email,provicional)
            
        }
        const periodoActivo = await Periodo_Academico.findOne({ where: { estado: 'Activo' }, raw: true  } );
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
                const rutaParaBD = `uploads/Representantes/${nuevoNombreArchivo}`;

                if (fieldname === "copiaCedula") {
                    usuario.cedula_PDF = rutaParaBD;
                } else if (fieldname === "croquis") {
                    usuario.croquis_PDF = rutaParaBD; // O el nombre que tenga este campo en tu BD
                }
            }
        }
        // Actualizar el representante
        const [updatedRows] = await Representante.update(usuario, {
            where: { nroCedula: nroCedula }
        });

        if (updatedRows === 0) {
            return response.status(400).json({ message: 'No se pudo actualizar el usuario!' });
        }

        // Obtener y retornar el representante actualizado
        const representanteActualizado = await Representante.findByPk(representanteExistente.ID);
        
        const { password: _, ...result } = representanteActualizado.toJSON();

        return response.status(200).json(result);

    } catch (error) {
        console.log('Error al actualizar el representante:', error);
        if (error.name === "SequelizeValidationError") {
            console.log("Estos son los errores", error);

            const errEncontrado = error.errors.find(err =>
                err.validatorKey === "notEmpty" ||
                err.validatorKey === "isNumeric" ||
                err.validatorKey === "len" ||
                err.validatorKey === "isEmail" ||
                err.validatorKey ==="isOnlyLetters" ||
                err.validatorKey==="is" ||
                err.validatorKey ==="is_null"
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
              return response.status(400).json({ message: `${errEncontrado.path} debe ser único` });
            }
      
          }
        return response.status(500).json({ message: 'Error al actualizar el representante en el servidor' });
    }
}

// Delete REPRESENTANTE
const deleteRepresentante = async (request, response) => {
    const nroCedula = request.params.cedula;

    try {
        const representante = await Representante.findOne({where: {nroCedula: nroCedula}});

        if (!representante)
            return response.status(404).json({ message: 'Representante no encontrado' });

        const rowsDeleted = await Representante.destroy({ where: { nroCedula } });

        if (rowsDeleted > 0) {
            return response.status(200).json({
                message: 'Usuario eliminado exitosamente',
                cedula: nroCedula
            });
        } else {
            return response.status(400).json({
                message: 'No se pudo eliminar el usuario'
            });
        }

    } catch (error) {
        console.log('Error al eliminar el representante:', error);

        return response.status(500).json({
            message: 'Error al eliminar el representante en el servidor'
        });
    }
}



module.exports = {
    crearRepresentante,
    getRepresentante,
    getAllRepresentantes,
    updateRepresentante,
    deleteRepresentante
}