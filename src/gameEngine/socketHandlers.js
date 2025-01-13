// gameEngine/socketHandlers.js
import { games, handleCardFlip, initializeGame, addPlayer, getGameState } from './gameState.js';
import Media from '../models/media.js';
import Game from '../models/games.js';

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
        
                    // Si la partie est terminée
                    if (result.gameOver) {
                        try {
                            // Déterminer le gagnant et son score
                            const winners = result.state.winners;
                            const isDraw = winners.length > 1;
                    
                            // On calcule le score le plus élevé une seule fois
                            const highestScore = Math.max(
                                ...Object.values(result.state.players)
                                    .map(player => player.score)
                            );
                    
                            // Mettre à jour la base de données
                            await Game.update({
                                state: 'finished',
                                winner: isDraw ? null : winners[0].id,
                                winnerScore: highestScore
                            }, {
                                where: { id: gameId }
                            });
                    
                            console.log('Base de données mise à jour avec succès:', {
                                gameId,
                                winner: isDraw ? 'Match nul' : winners[0].id,
                                winnerScore: highestScore
                            });
                    
                            // Émettre l'événement gameOver comme avant
                            io.to(gameId).emit('gameOver', {
                                winners: result.state.winners,
                                isDraw: result.state.isDraw,
                                finalScores: result.state.players
                            });
                        } catch (dbError) {
                            console.error('Erreur lors de la mise à jour de la base de données:', dbError);
                            socket.emit('gameError', { 
                                message: 'Erreur lors de la sauvegarde des résultats'
                            });
                        }
                    }

                    // Si c'est un mismatch, programmer le retournement des cartes
                    if (result.action === 'mismatch') {
                        setTimeout(() => {
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