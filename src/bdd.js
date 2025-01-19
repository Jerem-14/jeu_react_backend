import { Sequelize } from "@sequelize/core";
import { MySqlDialect } from "@sequelize/mysql";
import dotenv from "dotenv";

dotenv.config();

const isDevelopment = process.env.NODE_ENV !== 'PROD';
/**
 * Connexion à la base de données
 */
export const sequelize = new Sequelize({
    dialect: MySqlDialect,
    database: process.env.DB_NAME || "database_name",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 3306,
    ...(isDevelopment ? {} : {
        ssl: {
            require: true,
            rejectUnauthorized: true
        }
    }),
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    connectTimeout: 60000
});