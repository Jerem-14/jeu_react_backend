import { DataTypes } from "@sequelize/core";
import { sequelize } from "../bdd.js";


const Media = sequelize.define("media", {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    type: {
        type: DataTypes.ENUM("image", "video"),
        allowNull: false,
    },
    url: {
        type: DataTypes.STRING,
        get() {
            return `${process.env.BASE_URL}${this.getDataValue('url')}`;
        }
    },
    filename: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    format: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    tags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    }
});

export default Media;