import Game from "../models/games.js";
import User from "../models/users.js";

export async function createGame(userId) {
	if (!userId) {
		return { error: "L'identifiant du joueur est manquant" };
	}
	const datas = await Game.create({ creator: userId });
	console.log(datas.dataValues.id);
	return { gameId: datas.dataValues.id };
}

export async function updateGame(request) {
	console.log(request.params);
	const userId = request.body.userId;

	if (request.params.length < 2) {
		return { error: "Il manque des paramètres" };
	}
	const { action, gameId } = request.params;
	if (!userId) {
		return { error: "L'identifiant du joueur est manquant" };
	} else if (!gameId) {
		return { error: "L'identifiant de la partie est manquant" };
	}
	const game = await Game.findByPk(gameId);
	if (!game) {
		return { error: "La partie n'existe pas." };
	}

	if (game.dataValues.state == "finished") {
		return { error: "Cette partie est déjà terminée !" };
	}

	switch (action) {
		case "join":
			if (game.dataValues.player != null) {
				return { error: "Il y a déjà 2 joueurs dans cette partie !" };
			}
			if (game.dataValues.state != "pending") {
				return { error: "Cette partie n'est plus en attente." };
			}
			await game.setPlayer2(userId);
		case "start":
			//update state
			game.state = "playing";

			break;
		case "finish":
			game.state = "finished";
			if (!request.body.score) {
				return { error: "Le score est manquant." };
			}
			game.winnerScore = request.body.score;
			game.winner = request.body.winner;
			break;
		default:
			return { error: "Action inconnue" };
	}
	game.save();
	return game;
}

export async function deleteGame(gameId, userId) {
    try {

		if (!userId) {
            return { 
                success: false, 
                error: "Utilisateur non identifié" 
            };
        }


        if (!gameId) {
            return { success: false, error: "L'identifiant de la partie est manquant" };
        }

        const game = await Game.findByPk(gameId);

		console.log('Comparaison des IDs:', {
            gameCreator: game.creator,
            gamePlayer: game.player,
            requestUserId: userId,
        });
        
        if (!game) {
            return { success: false, error: "La partie n'existe pas" };
        }


        // Vérification que l'utilisateur est bien un des joueurs de la partie
        if (game.creator !== userId && game.player !== userId) {
            return { success: false, error: "Vous n'êtes pas autorisé à supprimer cette partie" };
        }

        // On ne peut supprimer que les parties en cours ou en attente
        if (game.state === 'finished') {
            return { success: false, error: "Impossible de supprimer une partie terminée" };
        }

        await game.destroy();
        return { success: true, message: "Partie supprimée avec succès" };
    } catch (error) {
        console.error('Erreur lors de la suppression de la partie:', error);
        return { success: false, error: "Erreur lors de la suppression de la partie" };
    }
}
