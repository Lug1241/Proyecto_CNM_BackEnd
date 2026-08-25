const bcrypt = require('bcryptjs');
const Representante = require('../models/representante.model');
const Docente = require('../models/docente.model');
const generateToken = require('../utils/generarToken');

// Asegúrate de importar 'registrarLog' en la parte superior si está en otro archivo, 
// o simplemente úsalo si está en el mismo archivo.
// const { registrarLog } = require('./ruta-a-tu-archivo-de-logs');

module.exports.login = async (req, res) => {
    const { nroCedula, password } = req.body;
    
    // 1. Log: Intento inicial
    await registrarLog(`Intento de login iniciado para la cédula: ${nroCedula}`, { tipo: 'INFO', archivo: 'auth.log' });

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
            // 2. Log: Usuario no encontrado (404)
            await registrarLog(`Fallo de login - Cédula no encontrada: ${nroCedula}`, { tipo: 'WARN', archivo: 'auth.log' });
            return res.status(404).json({ message: 'Cédula incorrecta' });
        }

        // Verificar la password
        let isMatch = false;
        if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            isMatch = password === user.password;
        }

        if (!isMatch) {
            // 3. Log: Contraseña incorrecta (401)
            await registrarLog(`Fallo de login - Contraseña incorrecta para la cédula: ${nroCedula}`, { tipo: 'WARN', archivo: 'auth.log' });
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }

        // 4. Log: Login exitoso (200)
        await registrarLog(`Login exitoso - Cédula: ${nroCedula} | Rol: ${rol}${subRol ? ` | SubRol: ${subRol}` : ''}`, { tipo: 'INFO', archivo: 'auth.log' });

        // Excluir la password de la respuesta
        const { password: pwd, ...userWithoutpassword } = user.toJSON();

        // Tomamos el flag del modelo (viene de docentes o representantes)
        const debeCambiarPassword = user.debe_cambiar_password;
        
        // Devolver la info que necesites
        return res.status(200).json({
            ...userWithoutpassword,
            rol,      // "docente" o "representante"
            subRol,   // "vicerrector", "secretaria", "administrador" o null
            type,
            debeCambiarPassword,
            token: generateToken({ id: user.nroCedula, rol, type, subRol })
        });

    } catch (error) {
        // 5. Log: Error en el servidor (500)
        await registrarLog(`Error interno en login para cédula ${nroCedula}: ${error.message}\nStack: ${error.stack}`, { tipo: 'ERROR', archivo: 'auth.log' });
        console.error('Error en el login:', error);
        return res.status(500).json({ message: 'Error en el servidor' });
    }
};
