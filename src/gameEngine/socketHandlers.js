// gameEngine/socketHandlers.js
import { games, handleCardFlip, initializeGame, addPlayer, getGameState } from './gameState.js';
import Media from '../models/media.js';
import Game from '../models/games.js';
import User from '../models/users.js';



// Nouvelle fonction pour sauvegarder l'état
async function saveGameState(gameId) {
    try {
        const currentState = games.get(gameId);
        if (!currentState) return;

        await Game.update({
            currentState: currentState,
            lastUpdate: new Date()
        }, {
            where: { id: gameId }
        });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'état:', error);
    }
}

// Nouvelle fonction pour restaurer l'état
async function restoreGameState(gameId) {
    try {
        const gameRecord = await Game.findByPk(gameId);
        if (!gameRecord || !gameRecord.currentState) return null;

        const savedState = gameRecord.currentState;
        games.set(gameId, savedState);
        return savedState;
    } catch (error) {
        console.error('Erreur lors de la restauration de l\'état:', error);
        return null;
    }
}



export function setupSocketHandlers(io) {
    // Map pour suivre les connexions socket-utilisateur
    const userSockets = new Map();

    io.on('connection', (socket) => {
        console.log('New connection:', socket.id);

        socket.on('createGame', async ({ gameId, creator }) => {
            try {
                console.log('Creating game:', { gameId, creator });
                
                // Stocker l'association socket-utilisateur
                userSockets.set(creator.id, socket.id);
                
                const mediaResult = await Media.findAll({
                    where: { type: 'image' },
                    limit: 8
                });
                console.log('Médias récupérés:', mediaResult.length);
                
                const state = initializeGame(gameId, creator, mediaResult);
                
                // Rejoindre la room
                socket.join(gameId);
                
                // Émettre les événements
                socket.emit('gameCreated', state);
                io.to(gameId).emit('gameStateUpdate', state);
                
                // Log de debug
                console.log(`Partie ${gameId} créée par ${creator.username}`);
                console.log('État initial du jeu:', state);
            } catch (error) {
                console.error('Error creating game:', error);
                socket.emit('gameError', { 
                    message: 'Erreur lors de la création de la partie',
                    details: error.message });
            }
        });

        socket.on('joinGame', ({ gameId, player }) => {
            console.log('Tentative de jointure reçue:', { gameId, player });
            try {
                console.log(`Joueur ${player?.id} tente de rejoindre la partie ${gameId}`);
                
                if (!player || !gameId) {
                    console.error('Données manquantes:', { player, gameId });
                    socket.emit('gameError', { message: 'Données invalides' });
                    return;
                }
        
                const state = addPlayer(gameId, player);
                console.log('État retourné par addPlayer:', state);
        
                if (state) {
                    socket.join(gameId);
                    io.to(gameId).emit('gameStateUpdate', state);
                    console.log('État du jeu mis à jour:', state);
                } else {
                    console.log('Partie non trouvée:', gameId);
                    socket.emit('gameError', { message: 'Partie non trouvée' });
                }
            } catch (error) {
                console.error('Erreur lors de la jonction à la partie:', error);
                socket.emit('gameError', { message: error.message });
            }
        });

        socket.on('rejoinGame', async ({ gameId, userId }) => {
            try {
                const savedState = await restoreGameState(gameId);
                if (savedState) {
                    socket.join(gameId);
                    socket.emit('gameStateUpdate', savedState);
                }
            } catch (error) {
                console.error('Erreur lors de la reconnexion:', error);
            }
        });

        socket.on('initiateGameStart', ({ gameId }) => {
            try {
                console.log('Démarrage de la partie:', gameId);
                io.to(gameId).emit('gameStartConfirmed', { gameId });
            } catch (error) {
                console.error('Erreur lors du démarrage de la partie:', error);
                socket.emit('gameError', { message: error.message });
            }
        });

        socket.on('flipCard', async ({ gameId, playerId, cardIndex }) => {
            console.log('Tentative de retournement de carte:', { gameId, playerId, cardIndex });
            try {
                const result = handleCardFlip(gameId, playerId, cardIndex);
                if (result.success) {
                    // Émettre l'état actuel
                    io.to(gameId).emit('gameStateUpdate', result.state);

                    await saveGameState(gameId); //sauvegarde apres chaque coup
        
                    // Si la partie est terminée
                    if (result.gameOver) {
                        try {
                            const winners = result.state.winners;
                            const isDraw = winners.length > 1;
                    
                            const players = Object.values(result.state.players);
                            //console.log('État complet:', result.state);  

                            const gameData = await Game.findByPk(gameId);
                            if (!gameData) {
                                throw new Error('Partie non trouvée');
                            }
                    
                            // Utilisons l'ID du créateur depuis la base de données
                            const creator = players.find(p => p.id === gameData.creator);
                            const joiner = players.find(p => p.id !== gameData.creator);
                    
                            /* console.log('Game data:', {
                                dbCreatorId: gameData.creator,
                                players: players,
                                foundCreator: creator,
                                foundJoiner: joiner
                            }); */
                    
                            if (!creator || !joiner) {
                                console.error('Détails des joueurs:', {
                                    players,
                                    creatorId: gameData.creator,
                                    creatorFound: creator,
                                    joinerFound: joiner
                                });
                                throw new Error('Impossible de déterminer les joueurs');
                            }


                            console.log('Modèle User disponible:', {
                                modelExists: !!User,
                                modelProperties: Object.keys(User)
                            });
                            
                        // Juste avant la mise à jour du créateur
                        //console.log('Tentative de mise à jour des meilleurs scores...');

                        // Récupération des utilisateurs
                        const creatorUser = await User.findByPk(creator.id);
                        const joinerUser = await User.findByPk(joiner.id);

                        // Logs avant mise à jour
                        /* console.log('Données des utilisateurs avant mise à jour:', {
                            creator: {
                                id: creator.id,
                                currentScore: creator.score,
                                bestScroreInDB: creatorUser?.bestScrore
                            },
                            joiner: {
                                id: joiner.id,
                                currentScore: joiner.score,
                                bestScroreInDB: joinerUser?.bestScrore
                            }
                        }); */

                        // Mise à jour du créateur
                        if (creatorUser) {
                            if (creatorUser.bestScrore === null || creator.score > creatorUser.bestScrore) {
                                try {
                                    await creatorUser.update({ bestScrore: creator.score });
                                    console.log('Score créateur mis à jour:', creator.score);
                                } catch (updateError) {
                                    console.error('Erreur mise à jour créateur:', updateError);
                                }
                            }
                        }

                        // Mise à jour du joiner
                        if (joinerUser) {
                            if (joinerUser.bestScrore === null || joiner.score > joinerUser.bestScrore) {
                                try {
                                    await joinerUser.update({ bestScrore: joiner.score });
                                    console.log('Score joiner mis à jour:', joiner.score);
                                } catch (updateError) {
                                    console.error('Erreur mise à jour joiner:', updateError);
                                }
                            }
                        }



                        // Après les mises à jour
                        const verificationCreator = await User.findByPk(creator.id);
                        const verificationJoiner = await User.findByPk(joiner.id);

                        /* console.log('Vérification après mise à jour:', {
                            creator: {
                                id: creator.id,
                                nouveauScore: verificationCreator?.bestScrore
                            },
                            joiner: {
                                id: joiner.id,
                                nouveauScore: verificationJoiner?.bestScrore
                            }
                        }); */
                    
                            const updateData = {
                                state: 'finished',
                                winner: isDraw ? null : winners[0].id,
                                winnerScore: Math.max(creator.score, joiner.score),
                                player1Score: creator.score,
                                player2Score: joiner.score
                            };
                    
                            console.log('Données de mise à jour:', updateData);
                    
                            await Game.update(updateData, {
                                where: { id: gameId }
                            });
                    
                            io.to(gameId).emit('gameOver', {
                                winners: result.state.winners,
                                isDraw: result.state.isDraw,
                                finalScores: {
                                    creator: {
                                        id: creator.id,
                                        username: creator.username,
                                        score: creator.score
                                    },
                                    joiner: {
                                        id: joiner.id,
                                        username: joiner.username,
                                        score: joiner.score
                                    }
                                }
                            });
                    
                        } catch (dbError) {
                            console.error('Détails de l\'erreur:', {
                                message: dbError.message,
                                stack: dbError.stack,
                                name: dbError.name,
                                additionalInfo: {
                                    gameId,
                                    playersState: result.state.players
                                }
                            });
                            socket.emit('gameError', { 
                                message: `Erreur lors de la sauvegarde des résultats : ${dbError.message}`
                            });
                        }
                    }

                    // Si c'est un mismatch, programmer le retournement des cartes
                    if (result.action === 'mismatch') {
                        setTimeout(async () => {
                            const game = games.get(gameId);
                            if (!game) return;
        
                            // Retourner les cartes
                            const { firstIndex, secondIndex, nextTurn } = result.data;
                            game.cards[firstIndex].isFlipped = false;
                            game.cards[secondIndex].isFlipped = false;
                            game.selectedCards = [];
                            game.currentTurn = nextTurn;
        
                            // Émettre le nouvel état
                            io.to(gameId).emit('gameStateUpdate', game);
                            await saveGameState(gameId);
                        }, 1000);
                    }
                } else {
                    socket.emit('gameError', { message: result.error });
                }
            } catch (error) {
                console.error('Erreur lors du retournement de carte:', error);
                socket.emit('gameError', { message: error.message });
            }
        });

        const rematchRequests = new Map();

socket.on('requestRematch', async ({ gameId, player }) => {
    try {
        console.log('Demande de revanche reçue:', { gameId, player });
        
        const game = games.get(gameId);
        if (!game) {
            throw new Error('Partie non trouvée');
        }

        // Trouver l'autre joueur
        const otherPlayerId = Object.keys(game.players)
            .find(id => id !== player.id);
            
        if (!otherPlayerId) {
            throw new Error('Autre joueur non trouvé');
        }

        // Vérifier s'il y a déjà une demande en cours
        const existingRequest = rematchRequests.get(gameId);
        if (existingRequest && existingRequest.fromId !== player.id) {
            // Les deux joueurs ont demandé une revanche, on peut commencer
            await handleRematchAccepted(gameId);
            rematchRequests.delete(gameId);
        } else {
            // Enregistrer la nouvelle demande
            rematchRequests.set(gameId, {
                fromId: player.id,
                timestamp: Date.now()
            });

            // Envoyer la demande à l'autre joueur
            const otherPlayerSocketId = Array.from(socket.adapter.rooms.get(gameId) || [])
                .find(sid => io.sockets.sockets.get(sid).userId === otherPlayerId);

            if (otherPlayerSocketId) {
                io.to(otherPlayerSocketId).emit('rematchRequested', {
                    gameId,
                    player
                });
            }

            // Nettoyer la demande après 30 secondes
            setTimeout(() => {
                if (rematchRequests.has(gameId)) {
                    rematchRequests.delete(gameId);
                    io.to(gameId).emit('rematchDeclined');
                }
            }, 30000);
        }
    } catch (error) {
        console.error('Erreur lors de la demande de revanche:', error);
        socket.emit('gameError', { message: error.message });
    }
});

socket.on('acceptRematch', async ({ gameId, player }) => {
    try {
        await handleRematchAccepted(gameId);
        rematchRequests.delete(gameId);
    } catch (error) {
        console.error('Erreur lors de l\'acceptation de la revanche:', error);
        socket.emit('gameError', { message: error.message });
    }
});

socket.on('declineRematch', ({ gameId }) => {
    rematchRequests.delete(gameId);
    io.to(gameId).emit('rematchDeclined');
});
        
async function handleRematchAccepted(gameId) {
    try {
        // Récupérer de nouvelles cartes
        const mediaResult = await Media.findAll({
            where: { type: 'image' },
            limit: 8,
            order: sequelize.literal('RAND()')
        });

        // Récupérer l'ancienne partie pour avoir les joueurs
        const oldGame = games.get(gameId);
        const players = Object.values(oldGame.players);

        // Créer la nouvelle partie
        const newGameId = crypto.randomUUID();
        const newState = initializeGame(newGameId, players[0], mediaResult);
        addPlayer(newGameId, players[1]);

        // Faire rejoindre la nouvelle room aux joueurs
        io.to(gameId).emit('rematchStarted', {
            gameId: newGameId,
            state: games.get(newGameId)
        });
    } catch (error) {
        console.error('Erreur lors de la création de la revanche:', error);
        throw error;
    }
}

        socket.on('disconnect', () => {
            // Nettoyer les associations socket-utilisateur
            for (const [userId, socketId] of userSockets.entries()) {
                if (socketId === socket.id) {
                    userSockets.delete(userId);
                    break;
                }
            }
            console.log('Client disconnected:', socket.id);
        });
    });
}