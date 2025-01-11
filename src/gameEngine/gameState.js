// gameEngine/gameState.js
const games = new Map();

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
    if (!game) return { success: false, error: 'Game not found' };

    // Vérifier si c'est le tour du joueur
    if (game.currentTurn !== playerId) {
        return { success: false, error: 'Not your turn' };
    }

    // Vérifier si la carte peut être retournée
    if (game.cards[cardIndex].isMatched || game.cards[cardIndex].isFlipped) {
        return { success: false, error: 'Invalid move' };
    }

    // Retourner la carte
    game.cards[cardIndex].isFlipped = true;
    game.selectedCards.push(cardIndex);

    // Si c'est la deuxième carte
    if (game.selectedCards.length === 2) {
        const [firstCard, secondCard] = game.selectedCards.map(index => game.cards[index]);
        
        // Vérifier si c'est une paire
        if (firstCard.mediaId === secondCard.mediaId) {
            // Marquer les cartes comme trouvées
            firstCard.isMatched = true;
            secondCard.isMatched = true;
            game.players[playerId].score += 1;
        } else {
            // Programmer le retournement des cartes
            setTimeout(() => {
                firstCard.isFlipped = false;
                secondCard.isFlipped = false;
                // Changer de tour
                game.currentTurn = getNextPlayer(game, playerId);
            }, 1000);
        }
        game.selectedCards = [];
    }

    // Vérifier si le jeu est terminé
    if (game.cards.every(card => card.isMatched)) {
        game.status = 'finished';
    }

    return { success: true, game };
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