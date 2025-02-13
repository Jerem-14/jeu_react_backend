import { DataTypes } from "@sequelize/core";
import { sequelize } from "../bdd.js";
import User from "./users.js";

const Game = sequelize.define("game", {
	id: {
		type: DataTypes.UUID,
		primaryKey: true,
		defaultValue: DataTypes.UUIDV4,
	},
	winnerScore: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
	state: {
		type: DataTypes.ENUM("pending", "playing", "finished"),
		allowNull: false,
		defaultValue: "pending",
	},
	// Nouvel attribut pour stocker l'état du jeu
    currentState: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Stocke l\'état actuel du jeu (cartes, scores, tour actuel)'
    },
    // Attribut pour suivre la dernière mise à jour
    lastUpdate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
    }
});
Game.belongsTo(User, { targetKey: "id", foreignKey: "creator", as: "player1" });
Game.belongsTo(User, {
	allowNull: true,
	targetKey: "id",
	foreignKey: "player",
	as: "player2",
});
Game.belongsTo(User, {
	allowNull: true,
	targetKey: "id",
	foreignKey: "winner",
	as: "winPlayer",
});

export default Game;
