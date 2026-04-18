const Inscripcion = require('../models/inscripcion.model');
const Representante = require('../models/representante.model');
const Docente = require('../models/docente.model');
const Asignacion = require('../models/asignacion.model');
const jwt = require('jsonwebtoken');
module.exports.OwnerInscription = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log("Voy a eliminar con este rol", decoded.rol)
            // Verificar que el rol sea válido
            if (decoded.rol !== "representante" && decoded.rol !== "docente") {
                return res.status(403).json({ message: "No autorizado, se requiere ser representante o docente" });
            }
           
            // Buscar usuario
            let user = await Representante.findOne({ where: { nroCedula: decoded.id }, attributes: { exclude: ["password"] }, raw: true });
            if (!user) {
                user = await Docente.findOne({ where: { nroCedula: decoded.id }, attributes: { exclude: ["password"] }, raw: true });
                console.log("ESte es el docente", user )
                const inscripcionID = req.params.id;
                const inscripcion = await Inscripcion.findByPk(inscripcionID, {
                    include: {
                        model: Asignacion,
                        include: {
                            model: Docente
                        }
                    }
                });
                if(inscripcion.Asignacion.Docente.nroCedula !== user.nroCedula && user.rol !== "Administrador"){
                    return res.status(404).json({ message: "Este curso no te pertenece" })
                }
                if (!user) {
                    return res.status(400).json({ message: "Usuario no encontrado" });
                }
            }

            req.user = user;
            req.user.rol = decoded.rol;

            return next();
        } catch (error) {
            console.error("Error en el middleware representante:", error.message);
            return res.status(401).json({ message: "Token inválido o expirado" });
        }
    }

    return res.status(401).json({ message: "No autorizado, token no encontrado" });
};