import User from "../models/users.js";
import Game from "../models/games.js";
import { Op } from "sequelize";
import CryptoJS from "crypto-js";
import { generateEmailTemplate } from '../emailTemplates/verifyEmailTemplate.mjml.js';
import { sendConfirmationEmail } from '../services/generateVerifyEmailService.js'


async function generateID(id) {
	const { count } = await findAndCountAllUsersById(id);
	if (count > 0) {
		id = id.substring(0, 5);
		const { count } = await findAndCountAllUsersById(id);
		id = id + (count + 1);
	}
	return id;
}

export async function getUsers() {
	return await User.findAll();
}
export async function getUserById(id) {
	return await User.findByPk(id);
}
export async function findAndCountAllUsersById(id) {
	return await User.findAndCountAll({
		where: {
			id: {
				[Op.like]: `${id}%`,
			},
		},
	});
}
export async function findAndCountAllUsersByEmail(email) {
	return await User.findAndCountAll({
		where: {
			email: {
				[Op.eq]: email,
			},
		},
	});
}
export async function findAndCountAllUsersByUsername(username) {
	return await User.findAndCountAll({
		where: {
			username: {
				[Op.eq]: username,
			},
		},
	});
}
export async function registerUser(userDatas, bcrypt) {
	if (!userDatas) {
		return { error: "Aucune donnée à enregistrer" };
	}
	const { firstname, lastname, username, email, password } = userDatas;
	if (!firstname || !lastname || !username || !email || !password) {
		return { error: "Tous les champs sont obligatoires" };
	}
	//vérification que l'email n'est pas déjà utilisé
	const { count: emailCount } = await findAndCountAllUsersByEmail(email);
	if (emailCount > 0) {
		return { error: "L'adresse email est déjà utilisée." };
	}

	//vérification que le pseudo n'est pas déjà utilisé
	const { count: usernameCount } = await findAndCountAllUsersByUsername(
		username
	);
	if (usernameCount > 0) {
		return { error: "Le nom d'utilisateur est déjà utilisé." };
	}
	//création de l'identifiant
	let id = await generateID(
		(lastname.substring(0, 3) + firstname.substring(0, 3)).toUpperCase()
	);

	// Fonction pour générer un token de 18 caractères
	const generateRandomToken = () => {
		const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let token = '';
		for (let i = 0; i < 18; i++) {
			const randomIndex = Math.floor(Math.random() * characters.length);
			token += characters[randomIndex];
		}
		return token;
	};

	// Génération du token
	const token = generateRandomToken();
	

	//hashage du mot de passe
	const hashedPassword = await bcrypt.hash(password);
	//création de l'utilisateur dans la base de données
	const user = {
		id,
		firstname,
		lastname,
		username,
		email,
		password: hashedPassword,
		token
	};

	await User.create(user);

	console.log('Environment:', process.env.NODE_ENV);
	console.log("BASE_URL:", process.env.BASE_URL);

	const urlMail = process.env.BASE_URL + "/verify?token=" + token 
	const emailHtml = generateEmailTemplate(urlMail);
	sendConfirmationEmail(email, emailHtml);


	return {success: "Register ok & email envoyé"}
}
export async function loginUser(userDatas, app) {
	if (!userDatas) {
		return {
            success: false,
            error: {
                type: 'MISSING_DATA',
                message: "Aucune donnée n'a été envoyée"
            }
        };
	}
	const { email, password } = userDatas;
	if (!email || !password) {
		return {
            success: false,
            error: {
                type: 'MISSING_FIELDS',
                message: "Tous les champs sont obligatoires"
            }
        };
	}
	//vérification que l'email est utilisé
	const { count, rows } = await findAndCountAllUsersByEmail(email);
	if (count === 0) {
		return {
            success: false,
            error: {
                type: 'USER_NOT_FOUND',
                message: "Il n'y a pas d'utilisateur associé à cette adresse email."
            }
        };
	} else if (rows[0].verified === false) {
		return {
            success: false,
            error: {
                type: 'ACCOUNT_NOT_VERIFIED',
                message: "Votre compte n'est pas encore vérifié. Veuillez vérifier votre boîte mail."
            }
        };
	}
	//récupération de l'utilisateur
	const user = await User.findOne({
		where: {
			email: {
				[Op.eq]: email,
			},
		},
	});
	//comparaison des mots de passe
	const match = await app.bcrypt.compare(password, user.password);
	if (!match) {
		return {
            success: false,
            error: {
                type: 'INVALID_PASSWORD',
                message: "Mot de passe incorrect"
            }
        };
	}
	// Générer le JWT après une authentification réussie
	const token = app.jwt.sign(
		{ id: user.id, username: user.username },
		{ expiresIn: "3h" }
	);
	return { success: true, data: { token, userId: user.id, username: user.username } };
}

export async function verifyEmailToken(token, reply){

	const user = await User.findOne( { where: {token:token}})

	if(!user){
		console.log("Pas le bon utilisateur");
        reply.redirect(process.env.BASE_URL + '/login?error=invalid_token'); // Redirection vers la page de login avec un message d'erreur
        return;
		
	}

	await User.update({verified: true}, {where: {id:user.id}});
	reply.redirect(process.env.BASE_URL + '/login?verified=true'); // Redirection vers la page de login
}

// Add to controllers/users.js
export async function calculateUserStats(userId) {
	const games = await Game.findAll({
	  where: {
		[Op.or]: [
		  { creator: userId },
		  { player: userId }
		],
		state: 'finished'
	  }
	});
	
	let stats = {
	  totalGames: games.length,
	  wins: 0,
	  losses: 0,
	  ties: 0
	};
	
	games.forEach(game => {
	  if (game.winner === userId) {
		stats.wins++;
	  } else if (game.winner === null) {
		stats.ties++;
	  } else {
		stats.losses++;
	  }
	});
	
	stats.winRate = stats.totalGames > 0 
	  ? Math.round((stats.wins / stats.totalGames) * 100) 
	  : 0;
	  
	return stats;
  }

  export async function getUserGames(userId) {
	try {
	  const games = await Game.findAll({
		where: {
		  [Op.or]: [
			{ creator: userId },
			{ player: userId }
		  ]
		},
		include: [
		  { model: User, as: 'player1', attributes: ['username'] },
		  { model: User, as: 'player2', attributes: ['username'] },
		  { model: User, as: 'winPlayer', attributes: ['username'] }
		],
		order: [['createdAt', 'DESC']],
		limit: 10 // Get last 10 games
	  });
  
	  return { success: true, data: games };
	} catch (error) {
	  return { success: false, error: error.message };
	}
  }

  export async function getUserStats(userId) {
    try {
        const games = await Game.findAll({
            where: {
                [Op.or]: [
                    { creator: userId },
                    { player: userId }
                ],
                state: 'finished'
            }
        });

        const stats = {
            totalGames: games.length,
            wins: 0,
            losses: 0,
            ties: 0,
            bestScore: 0,
            winRate: 0
        };

        games.forEach(game => {
            // Mise à jour du meilleur score
            if (game.winnerScore > stats.bestScore && game.winner === userId) {
                stats.bestScore = game.winnerScore;
            }

            // Comptage des résultats
            if (game.winner === userId) {
                stats.wins++;
            } else if (game.winner === null) {
                stats.ties++;
            } else {
                stats.losses++;
            }
        });

        // Calcul du taux de victoire
        stats.winRate = stats.totalGames > 0 
            ? Math.round((stats.wins / stats.totalGames) * 100) 
            : 0;

        return stats;
    } catch (error) {
        return { error: "Erreur lors de la récupération des statistiques" };
    }
}

  export async function updateUser(userId, userData) {
    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return { error: "User not found" };
        }

        // Verify username uniqueness if it's being changed
        if (userData.username && userData.username !== user.username) {
            const { count } = await findAndCountAllUsersByUsername(userData.username);
            if (count > 0) {
                return { error: "Username already taken" };
            }
        }

        await user.update({
            username: userData.username || user.username,
            firstname: userData.firstname || user.firstname,
            lastname: userData.lastname || user.lastname
        });

        return { success: true, data: user };
    } catch (error) {
        return { error: error.message };
    }
}