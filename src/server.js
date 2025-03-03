import chalk from "chalk";
import fs from 'fs/promises';
//pour fastify
import fastify from "fastify";
import fastifyBcrypt from "fastify-bcrypt";
import cors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyJWT from "@fastify/jwt";
import socketioServer from "fastify-socket.io";
import { setupSocketHandlers } from './gameEngine/socketHandlers.js';

//file upload
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const UPLOAD_DIR = join(__dirname, '../uploads');
await fs.mkdir(UPLOAD_DIR, { recursive: true });
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
await app.register(socketioServer, {
	cors: {
		origin: ["http://localhost:5173", "https://jeu-react-backend.onrender.com", "https://meme-on-rit-neon.vercel.app"],
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
		credentials: true,
		allowedHeaders: ["Content-Type", "Authorization"]
	},
	//transports: ['polling', 'websocket'],
	transports: ['websocket', 'polling'],
    path: '/socket.io/',
    // Retirons les configurations problématiques
    pingTimeout: 30000,
    pingInterval: 25000,
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true,
    }
})
    .register(fastifyBcrypt, {
        saltWorkFactor: 12,
    })
    .register(cors, {
        origin: ["http://localhost:5173", "https://jeu-react-backend.onrender.com", "https://meme-on-rit-neon.vercel.app"],
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
        prefix: '/uploads/',
        decorateReply: false
    });

	app.ready(() => {
		console.log('Socket.IO est initialisé');
		
		// Écouteur d'événements pour la connexion Socket.IO
		app.io.on('connection', (socket) => {
			console.log('Nouvelle connexion Socket.IO:', socket.id);
			
			socket.on('disconnect', () => {
				console.log('Déconnexion Socket.IO:', socket.id);
			});
			
			socket.on('error', (error) => {
				console.error('Erreur Socket.IO:', error);
			});
		});
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
/* app.ready(() => {
    console.log('Socket.IO est initialisé et prêt');
    console.log('Routes disponibles:', app.printRoutes());
}); */
//gestion utilisateur
usersRoutes(app, blacklistedTokens);
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
         const port = process.env.PORT || 3000;
         const isDevelopment = process.env.NODE_ENV !== 'PROD';
         await app.listen({ 
             port: port,
             host: '0.0.0.0'  // Très important pour Render !
         });
         if (isDevelopment) {
            console.log(
                "Serveur Fastify lancé sur " + chalk.blue(`http://localhost:${port}`)
            );
            console.log(
                chalk.bgYellow(
                    `Accéder à la documentation sur http://localhost:${port}/documentation`
                )
            );
        } else {
            console.log(`Serveur démarré sur le port ${port}`);
            console.log(`Documentation disponible sur /documentation`);
        }

        // Configuration des gestionnaires de socket
        setupSocketHandlers(app.io);

    } catch (err) {
        console.log(err);
        process.exit(1);
    }
};

start();