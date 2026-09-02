const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/sequelize.config')
const Docente = require('./docente.model')
const Periodo_Academico = require('./periodo_academico.model')
const Materia = require('./materia.model')


const Asignacion = sequelize.define("Asignacion", {
   ID: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  paralelo: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "",
    validate: {
      notNull: { msg: "El paralelo es requerido" },
      len: { args: [0, 50], msg: "El paralelo debe tener entre 1 y 50 caracteres" },
    }
  },

  horaInicio: {
    type: DataTypes.TIME,
    allowNull: false,
    validate: {
      notNull: { msg: "La hora de inicio es requerida" },
      notEmpty: { msg: "La hora de inicio no debe estar vacía" },
      is: {
        args: /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
        msg: "La hora de inicio debe estar en formato HH:MM o HH:MM:SS"
      }
    },
    get() {
      const v = this.getDataValue("horaInicio");
      return v ? v.slice(0, 5) : null;
    }
  },

  horaFin: {
    type: DataTypes.TIME,
    allowNull: false,
    validate: {
      notNull: { msg: "La hora de fin es requerida" },
      notEmpty: { msg: "La hora de fin no debe estar vacía" },
      is: {
        args: /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
        msg: "La hora de fin debe estar en formato HH:MM o HH:MM:SS"
      },
      validarOrden(value) {
        if (this.horaInicio && value <= this.horaInicio) {
          throw new Error("La hora de fin debe ser mayor que la hora de inicio");
        }
      }
    },
    get() {
      const v = this.getDataValue("horaFin");
      return v ? v.slice(0, 5) : null;
    }
  },

  hora1: {
    type: DataTypes.TIME,
    allowNull: true,
    validate: {
      formatoHora(value) {
        if (value === null) return;

        if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) {
          throw new Error("La hora 1 debe estar en formato HH:MM o HH:MM:SS");
        }
      }
    },
    get() {
      const v = this.getDataValue("hora1");
      return v ? v.slice(0, 5) : null;
    }
  },

  hora2: {
    type: DataTypes.TIME,
    allowNull: true,
    validate: {
      formatoHora(value) {
        if (value === null) return;

        if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) {
          throw new Error("La hora 2 debe estar en formato HH:MM o HH:MM:SS");
        }
      }
    },
    get() {
      const v = this.getDataValue("hora2");
      return v ? v.slice(0, 5) : null;
    }
  },

  dias: {
    type: DataTypes.JSON,
    allowNull: false,
    validate: {
      isArrayOfValidDays(value) {
        const validDays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

        if (!Array.isArray(value)) {
          throw new Error("El campo 'dias' debe ser un array");
        }

        if (value.length < 1 || value.length > 2) {
          throw new Error("Debe seleccionar entre 1 y 2 días");
        }

        for (const day of value) {
          if (!validDays.includes(day)) {
            throw new Error(`"${day}" no es un día válido`);
          }
        }
      }
    }
  },

  cupos: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      notNull: { msg: "No se permiten valores nulos" },
      isInt: { msg: "Debe ser un número entero" },
    }
  }

}, {
  tableName: "asignaciones",
  validate: {
    horasValidas() {
      if (!this.hora1 || !this.hora2) return;

      if (this.hora1 >= this.hora2) {
        throw new Error("La hora 1 debe ser menor que la hora 2");
      }
    }
  }
    })
Docente.belongsToMany(Materia, { through: { model: Asignacion, unique: false }, foreignKey: { name: "ID_docente", allowNull: false } })
Materia.belongsToMany(Docente, { through: { model: Asignacion, unique: false }, foreignKey: { name: "ID_materia", allowNull: false } })



// Permite incluir directamente datos de Docente y Materia desde Asignación
Asignacion.belongsTo(Docente, { foreignKey: "ID_docente", targetKey: "ID" });
Asignacion.belongsTo(Materia, { as: "materiaDetalle", foreignKey: "ID_materia", targetKey: "ID" });
//no borrar as materiaDetalle se necesita para el getAll de asignacion
// Permite incluir directamente datos de Materia desde Asignación
// Relación Asignacion -> Periodo_Academico (belongsTo)
Asignacion.belongsTo(Periodo_Academico, {
    foreignKey: {
        name: "ID_periodo_academico",
        allowNull: false // Obligatorio tener un periodo académico
    },
    onDelete: 'RESTRICT' // Evita borrar periodos con asignaciones
});

// Relación Periodo_Academico -> Asignacion (hasMany)
Periodo_Academico.hasMany(Asignacion, {
    foreignKey: {
        name: "ID_periodo_academico",
        allowNull: false
    },
    onDelete: 'RESTRICT'
});

module.exports = Asignacion;