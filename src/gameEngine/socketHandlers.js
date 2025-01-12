// gameEngine/socketHandlers.js
import { games, handleCardFlip, initializeGame, addPlayer, getGameState } from './gameState.js';
import Media from '../models/media.js';  // Ajout de l'import correct

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

        socket.on('flipCard', ({ gameId, playerId, cardIndex }) => {
            console.log('Tentative de retournement de carte:', { gameId, playerId, cardIndex });
            try {
                const result = handleCardFlip(gameId, playerId, cardIndex);
                if (result.success) {
                    // Émettre l'état actuel
                    io.to(gameId).emit('gameStateUpdate', result.state);
        
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