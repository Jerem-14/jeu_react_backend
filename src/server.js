import chalk from "chalk";
//pour fastify
import fastify from "fastify";
import fastifyBcrypt from "fastify-bcrypt";
import cors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyJWT from "@fastify/jwt";
import socketioServer from "fastify-socket.io";

//file upload
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


//routes
import { usersRoutes } from "./routes/users.js";
import { gamesRoutes } from "./routes/games.js";
import { mediaRoutes } from "./routes/media.js";
//bdd
import { sequelize } from "./bdd.js";

//Test de la connexion
try {
	sequelize.authenticate();
	console.log(chalk.grey("Connecté à la base de données MySQL!"));
} catch (error) {
	console.error("Impossible de se connecter, erreur suivante :", error);
}

/**
 * API
 * avec fastify
 */
let blacklistedTokens = [];
const app = fastify();
//Ajout du plugin fastify-bcrypt pour le hash du mdp
await app
	.register(fastifyBcrypt, {
		saltWorkFactor: 12,
	})
	.register(cors, {
		origin: ["http://localhost:5173"],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Accept"],
        exposedHeaders: ["Content-Range", "X-Content-Range"],
        credentials: true,
        maxAge: 86400,
        preflight: true,
        preflightContinue: true
	})
	.register(fastifySwagger, {
		openapi: {
			openapi: "3.0.0",
			info: {
				title: "Documentation de l'API du jeu de Memory",
				description:
					"API développée pour un exercice avec React avec Fastify et Sequelize",
				version: "0.1.0",
			},
		},
	})
	.register(fastifySwaggerUi, {
		routePrefix: "/documentation",
		theme: {
			title: "Docs - Memory Game API",
		},
		uiConfig: {
			docExpansion: "list",
			deepLinking: false,
		},
		uiHooks: {
			onRequest: function (request, reply, next) {
				next();
			},
			preHandler: function (request, reply, next) {
				next();
			},
		},
		staticCSP: true,
		transformStaticCSP: (header) => header,
		transformSpecification: (swaggerObject, request, reply) => {
			return swaggerObject;
		},
		transformSpecificationClone: true,
	})
	.register(fastifyJWT, {
		secret: "unanneaupourlesgouvernertous",
	})
	.register(fastifyStatic, {
		root: join(__dirname, '../uploads'),
		prefix: '/uploads/'
	})
	.register(socketioServer, {
		cors: {
			origin: "http://localhost:5173",  // Your React app URL
			methods: ["GET", "POST"],
			credentials: true
		},
		path: '/socket.io' // Add this explicitly
	});
/**********
 * Routes
 **********/
app.get("/", (request, reply) => {
	reply.send({ documentationURL: "http://localhost:3000/documentation" });
});
// Fonction pour décoder et vérifier le token
app.decorate("authenticate", async (request, reply) => {
	try {
		const token = request.headers["authorization"].split(" ")[1];

		// Vérifier si le token est dans la liste noire
		if (blacklistedTokens.includes(token)) {
			return reply
				.status(401)
				.send({ error: "Token invalide ou expiré" });
		}
		await request.jwtVerify();
	} catch (err) {
		reply.send(err);
	}
});
//gestion utilisateur
usersRoutes(app,blacklistedTokens);
//gestion des jeux
gamesRoutes(app);
//gestion des medias
mediaRoutes(app);

/**********
 * START
 **********/
const start = async () => {
	try {
		await sequelize
			.sync({ alter: true })
			.then(() => {
				console.log(chalk.green("Base de données synchronisée."));
			})
			.catch((error) => {
				console.error(
					"Erreur de synchronisation de la base de données :",
					error
				);
			});
		await app.listen({ port: 3000 });
		console.log(
			"Serveur Fastify lancé sur " + chalk.blue("http://localhost:3000")
		);
		console.log(
			chalk.bgYellow(
				"Accéder à la documentation sur http://localhost:3000/documentation"
			)
		);


		// Configurer Socket.IO après le démarrage du serveur
        app.io.on('connection', (socket) => {
            console.log('New user connected');

            // Événement pour créer une room
            socket.on('createRoom', (roomName, userId) => {
                socket.join(roomName);
                socket.emit('roomCreated', roomName);
                console.log(`User ${userId} create a new room: ${roomName}`);
            });

			socket.on('initiateGameStart', (data) => {
				console.log('Game start initiated:', data);
				// Émettre l'événement à tous les joueurs dans la room
				app.io.to(data.gameId).emit('gameStartConfirmed', {
					gameId: data.gameId
				});
			});

            // Événement pour rejoindre une room
            /* socket.on('joinRoom', (roomName) => {
                socket.join(roomName);
                socket.emit('roomJoined', roomName);
                console.log(`User joined room: ${roomName}`);
            }); */

			// Update the socket.io connection handler
			socket.on('joinRoom', (data) => {
				console.log('Join room data received:', data);  // Debug log
				const { roomId, username, userId } = data;
				
				socket.join(roomId);
				
				// Debug log
				console.log(`Emitting playerJoined event to room ${roomId} with data:`, {
					username,
					userId
				});
				
				socket.to(roomId).emit('playerJoined', { 
					username,
					userId
				});
			});

            socket.on('disconnect', () => {
                console.log('User disconnected');
            });
        });


	} catch (err) {
		console.log(err);
		process.exit(1);
	}

};
start();
