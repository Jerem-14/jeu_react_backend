import { createGame, updateGame, deleteGame } from "../controllers/games.js";
export function gamesRoutes(app) {
	//création d'un jeu
	app.post(
		"/game",
		{ preHandler: [app.authenticate] },
		async (request, reply) => {
			reply.send(await createGame(request.body.userId));
		}
	);
	//rejoindre un jeu
	app.patch(
		"/game/:action/:gameId",
		{ preHandler: [app.authenticate] },
		async (request, reply) => {
			reply.send(await updateGame(request));
		}
	);
	app.delete(
        "/game/:gameId",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
			console.log('Token décodé:', request.user); // Ajoutons ce log
        const userId = request.user.id;
        console.log('UserId extrait:', userId); // Et celui-ci
            reply.send(await deleteGame(request.params.gameId, userId));
        }
    );
}
