// gameEngine/socketHandlers.js
import * as gameState from './gameState.js';
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
                
                const state = gameState.initializeGame(gameId, creator, mediaResult);
                
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
        
                const state = gameState.addPlayer(gameId, player);
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
                const game = gameState.handleCardFlip(gameId, playerId, cardIndex);
                if (game.success) {
                    io.to(gameId).emit('gameStateUpdate', game.state);
                } else {
                    socket.emit('gameError', { message: game.error });
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