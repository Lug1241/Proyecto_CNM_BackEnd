require('dotenv').config();
const { Sequelize } = require('sequelize')
const username = process.env.DB_USERNAME;
const password = process.env.DB_PASSWORD;
const db_name = process.env.DB_NAME;
const hostName = 'localhost'


const sequelize = new Sequelize(db_name, username, password, {
    host: hostName,
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306,
});
const conexion =async()=>{
    try {
        await sequelize.sync()// Sincroniza los modelos con la base de datos);
        return 'Base de datos sincronizada';
    } catch (error) {
        return'Error al sincronizar la BDD ' + error;
    }
}

module.exports={sequelize, conexion}
