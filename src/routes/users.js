import {
	getUserById,
	getUsers,
	getUserStats,
	loginUser,
	registerUser,
	verifyEmailToken,
	getUserGames,
	updateUser
} from "../controllers/users.js";

export function usersRoutes(app, blacklistedTokens ) {
	app.post("/login", async (request, reply) => {
		reply.send(await loginUser(request.body, app));
	}).post(
		"/logout",
		{ preHandler: [app.authenticate] },
		async (request, reply) => {
			const token = request.headers["authorization"].split(" ")[1]; // Récupérer le token depuis l'en-tête Authorization

			// Ajouter le token à la liste noire
			blacklistedTokens.push(token);

			reply.send({ logout: true });
		}
	);
	//inscription
	app.post("/register", async (request, reply) => {
		reply.send(await registerUser(request.body, app.bcrypt));
	});
	//récupération de la liste des utilisateurs
	app.get("/users", async (request, reply) => {
		reply.send(await getUsers());
	});
	//récupération d'un utilisateur par son id
	app.get("/users/:id", async (request, reply) => {
		reply.send(await getUserById(request.params.id));
	});
	app.get("/verify", async (request, reply) => {
		const token = request.query.token;
		await verifyEmailToken(token, reply); // Passe l'objet reply pour gérer la redirection
	});
	app.get("/users/:id/stats", async (request, reply) => {
		// Calculate stats from games table
		const stats = await getUserStats(request.params.id);
		reply.send(stats);
	});
	app.get("/users/:id/games", async (request, reply) => {
		reply.send(await getUserGames(request.params.id));
	});
	app.patch("/users/:id", 
		{ preHandler: [app.authenticate] },
		async (request, reply) => {
			reply.send(await updateUser(request.params.id, request.body));
		}
	);
}
