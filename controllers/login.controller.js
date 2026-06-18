const bcrypt = require('bcryptjs');
const Representante = require('../models/representante.model');
const Docente = require('../models/docente.model');
const generateToken = require('../utils/generarToken');

module.exports.login = async (req, res) => {
    const { nroCedula, password } = req.body;
    try {
        let user = null;
        let rol = null;
        let type = null;
        let subRol = null; 
        // Buscar en la tabla de Representantes
        user = await Representante.findOne({ where: { nroCedula } });
        if (user) {
            rol = 'representante'; 
            type = 'representante';
        }
        // Si no se encontró, buscar en la tabla de Docentes
        if (!user) {
            user = await Docente.findOne({ where: { nroCedula } });
            if (user) {
                subRol = user.rol;  
                rol = 'docente';
                type = 'docente';
                user.dataValues.subRol = subRol;
            }
        }

        // Si el usuario no existe en ninguna de las tablas
        if (!user) {
            console.log("caigo aca")
            return res.status(404).json({ message: 'Cédula  incorrecta' });
        }
        console.log("este es el usuario que no puede ingresar", user)
        // Verificar la password
        let isMatch = false;
        if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
            console.log("CONTRASENA DEL BODY:", JSON.stringify(password));
            console.log("HASH DESDE LA BD:   ", JSON.stringify(user.password));
            isMatch = await bcrypt.compare(password, user.password);
        } else{
            isMatch = password === user.password;
        }

        if (!isMatch) {
            console.log("caigo por aca")
            return res.status(401).json({ message: 'contraseña incorrecta' });
        }

        // Excluir la password de la respuesta
        const { password: pwd, ...userWithoutpassword } = user.toJSON();

        // 👇 Tomamos el flag del modelo (viene de docentes o representantes)
        const debeCambiarPassword = user.debe_cambiar_password;
        
        // Devolver la info que necesites
        return res.status(200).json({
            ...userWithoutpassword,
            rol,      // "docente" o "representante"
            subRol,   // "profesor", "coordinador", etc.
            type,
            debeCambiarPassword,
            token: generateToken({ id: user.nroCedula, rol, type, subRol })
        });

    } catch (error) {
        console.error('Error en el login:', error);
        return res.status(500).json({ message: 'Error en el servidor' });
    }
};
