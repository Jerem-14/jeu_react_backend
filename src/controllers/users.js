import User from "../models/users.js";
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

	const urlMail = "http://localhost:3000/verify?token=" + token 
	const emailHtml = generateEmailTemplate(urlMail);
	sendConfirmationEmail(email, emailHtml);


	return {success: "Register ok & email envoyé"}
}
export async function loginUser(userDatas, app) {
	if (!userDatas) {
		return { error: "Aucune donnée n'a été envoyée" };
	}
	const { email, password } = userDatas;
	if (!email || !password) {
		return { error: "Tous les champs sont obligatoires" };
	}
	//vérification que l'email est utilisé
	const { count, rows } = await findAndCountAllUsersByEmail(email);
	if (count === 0) {
		return {
			error: "Il n'y a pas d'utilisateur associé à cette adresse email.",
		};
	} else if (rows[0].verified === false) {
		return {
			error: "Votre compte n'est pas encore vérifié. Veuillez vérifier votre boîte mail.",
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
		return { error: "Mot de passe incorrect" };
	}
	// Générer le JWT après une authentification réussie
	const token = app.jwt.sign(
		{ id: user.id, username: user.username },
		{ expiresIn: "3h" }
	);
	return { token };
}

export async function verifyEmailToken(token, reply){

	const user = await User.findOne( { where: {token:token}})

	if(!user){
		console.log("Pas le bon utilisateur");
        reply.redirect('http://localhost:5173/login?error=invalid_token'); // Redirection vers la page de login avec un message d'erreur
        return;
		
	}

	await User.update({verified: true}, {where: {id:user.id}});
	reply.redirect('http://localhost:5173/login?verified=true'); // Redirection vers la page de login
}