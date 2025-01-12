// gameEngine/gameState.js
export const games = new Map();

export function initializeGame(gameId, creator, media) {
    // Préparer les cartes (doubles des médias pour les paires)
    const cards = [...media, ...media].map((item, index) => ({
        id: index,
        mediaId: item.id,
        url: item.url,
        type: item.type,
        isFlipped: false,
        isMatched: false
    }));

    const gameState = {
        gameId,
        cards: shuffleArray(cards),
        players: {
            [creator.id]: {
                id: creator.id,
                username: creator.username,
                score: 0
            }
        },
        currentTurn: creator.id,
        selectedCards: [],
        status: 'waiting'
    };
    console.log('État initial du jeu:', gameState);
    games.set(gameId, gameState);
    return gameState;
}

export function addPlayer(gameId, player) {
    const game = games.get(gameId);
    if (!game) return null;

    game.players[player.id] = {
        id: player.id,
        username: player.username,
        score: 0,
        isActive: false
    };

    game.status = 'playing';
    return game;
}

export function handleCardFlip(gameId, playerId, cardIndex) {
    const game = games.get(gameId);
    if (!game) return { success: false, error: 'Partie non trouvée' };

    // Vérifier si c'est le tour du joueur
    if (game.currentTurn !== playerId) {
        return { success: false, error: 'Ce n\'est pas votre tour' };
    }

    // Vérifier si la carte peut être retournée
    const card = game.cards[cardIndex];
    if (card.isFlipped || card.isMatched) {
        return { success: false, error: 'Cette carte ne peut pas être retournée' };
    }

    // Retourner la carte
    card.isFlipped = true;
    game.selectedCards.push(cardIndex);

    const gameStateCopy = { ...game };

      // Si c'est la deuxième carte
      if (game.selectedCards.length === 2) {
        const [firstIndex, secondIndex] = game.selectedCards;
        const firstCard = game.cards[firstIndex];
        const secondCard = game.cards[secondIndex];

        if (firstCard.mediaId === secondCard.mediaId) {
            // Match !
            firstCard.isMatched = true;
            secondCard.isMatched = true;
            game.players[playerId].score += 1;
            game.selectedCards = [];


             
            // Vérifier si la partie est terminée
            const gameStatus = isGameFinished(game);
            if (gameStatus.finished) {
                game.status = 'finished';
                game.winners = gameStatus.winners;
                game.isDraw = gameStatus.isDraw;
            }

            return { 
                success: true, 
                state: { ...game },
                gameOver: gameStatus.finished
            };

            //return { success: true, state: gameStateCopy };
        } else {
            // Pas de match
            // On retourne immédiatement un état avec les cartes retournées
            return { 
                success: true, 
                state: gameStateCopy,
                action: 'mismatch',
                data: {
                    firstIndex,
                    secondIndex,
                    nextTurn: getNextPlayer(game, playerId)
                }
            };
        }
    }

    return { success: true, state: { ...game } };
}

function getNextPlayer(game, currentPlayerId) {
    const playerIds = Object.keys(game.players);
    const currentIndex = playerIds.indexOf(currentPlayerId);
    return playerIds[(currentIndex + 1) % playerIds.length];
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

export function getGameState(gameId) {
    return games.get(gameId);
}

function isGameFinished(game) {
    // Vérifie si toutes les cartes sont matched
    const allMatched = game.cards.every(card => card.isMatched);
    
    if (allMatched) {
        // Déterminer le gagnant
        const players = Object.values(game.players);
        const winner = players.reduce((highest, player) => 
            player.score > highest.score ? player : highest
        );
        
        // En cas d'égalité, tout le monde est gagnant !
        const winners = players.filter(player => player.score === winner.score);
        
        return {
            finished: true,
            winners: winners,
            isDraw: winners.length > 1
        };
    }
    
    return { finished: false };
}