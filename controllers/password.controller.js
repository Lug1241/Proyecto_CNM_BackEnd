const bcrypt = require("bcryptjs")
const { validationResult } = require('express-validator');
const Representante = require('../models/representante.model');
const Docente = require('../models/docente.model');
const crypto = require('crypto');
const { Op } = require('sequelize');
require("dotenv").config();
const { check } = require('express-validator');
const { enviarRecoverLink } = require("../utils/enivarCorreo")

module.exports.validatePasswordChange = [
  check('newPassword')
    .isLength({ min: 8 }).withMessage('Debe tener al menos 8 caracteres')
    .matches(/[A-Z]/).withMessage('Debe contener al menos una letra mayúscula')
    .matches(/[0-9]/).withMessage('Debe contener al menos un número')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Debe contener al menos un carácter especial'),
];
module.exports.changePassword = async (req, res) => {
  const rol = req.user.rol
  console.log("este es el rol",rol)
  console.log("este es el rol",rol)
  try {

    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    let user
    const { currentPassword, newPassword } = req.body;

    if (rol === "docente") {
      user = await Docente.findByPk(req.user.nroCedula);

    } else if (rol === "representante") {
      user = await Representante.findByPk(req.user.ID);
    }
    else {
      return res.status(400).json({ message: "Tipo de usuario no válido" });
    }

    // Verificar la contraseña actual
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Contraseña actual incorrecta" });

    // Hashear y guardar nueva contraseña
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    // 👇 NUEVO: bajar el flag de primera vez / provisional
    user.debe_cambiar_password = false;
    await user.save();

    return res.json({ message: "Contraseña actualizada con éxito" });
  } catch (error) {
    console.log("este es el error", error)
    return res.status(400).json({ mesage: "error en el servidor" })
  }

}
// controllers/authController.js


exports.requestPasswordReset = async (req, res) => {

  try {
    console.log("este es el email", req.body)
    const email = req.body.email
    let user
    user = await Docente.findOne({ where: { email: email } });
    console.log("este es el user", user)
    if (!user) {
      user = await Representante.findOne({ where: { email: email } });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    }





    // Generar token y hash
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 15); // 15 min

    // Guardar en DB
    user.resetToken = tokenHash;
    user.resetTokenExpires = expires;
    await user.save();

    // Link de recuperación
    const resetLink = `${process.env.URL_FRONT_END}/reset-password?token=${token}`;

    // Aquí enviarías el correo real


    // await sendEmail(user.email, "Recupera tu contraseña", resetLink);
    enviarRecoverLink(user.email, resetLink)

    return res.json({ message: 'Enlace de recuperación ha sido enviado, revise su correo' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};
exports.resetPassword = async (req, res) => {
  console.log("dice la peticio´n")

  try {
    const { token, newPassword } = req.body;
    console.log("este es el body", req.body)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("entre aca")
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    let user
    user = await Docente.findOne({
      where: {
        resetToken: tokenHash,
        resetTokenExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      user = await Representante.findOne({
        where: {
          resetToken: tokenHash,
          resetTokenExpires: { [Op.gt]: new Date() },
        },
      })
    }
    if (!user) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    user.resetToken = null;
    user.resetTokenExpires = null;

    await user.save();

    return res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.log("este es el error", err);
    return res.status(500).json({ message: 'Error al cambiar la contraseña' });
  }
};

