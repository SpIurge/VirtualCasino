let playerCards = [];
let dealerCards = [];
let cpuPlayers = [];
let deckId = null;

// TEMPORARY PLAYERS 
// I haven't bothered to connect the database to this file yet - Lyn
cpuPlayers = [
    {
        name: "CPU 1",
        domId: "cpu1CardNumber",
        cards: [],
        surrendered: false,
        doubled: false,
        stats: {
            confidence: 0.3,
            risk: 0.2,
            surrenderRate: 0.4
        }
    },
    {
        name: "CPU 2",
        domId: "cpu2CardNumber",
        cards: [],
        surrendered: false,
        doubled: false,
        stats: {
            confidence: 0.5,
            risk: 0.4,
            surrenderRate: 0.2
        }
    },
    {
        name: "CPU 3",
        domId: "cpu3CardNumber",
        cards: [],
        surrendered: false,
        doubled: false,
        stats: {
            confidence: 0.8,
            risk: 0.7,
            surrenderRate: 0.05
        }
    }
];


// Site: https://deckofcardsapi.com/
const deckAPI = "https://deckofcardsapi.com/api/deck";

document.addEventListener("DOMContentLoaded", initGame);



// UI Functions
function updateDOM() {
    document.getElementById("playerCardNumber").textContent = playerCards.length;
    document.getElementById("playerScore").textContent = getScore(playerCards);

    document.getElementById("dealerCardNumber").textContent = dealerCards.length;

    for (let cpu of cpuPlayers) {
        document.getElementById(cpu.domId).textContent = cpu.cards.length;
    }
}

function setGameInfo(message) {
    document.getElementById("gameInfo").textContent = message;
}



// Deck of Cards API Functions
async function newDeck() {
    let deck = null;
    let url = deckAPI + "/new/shuffle/?deck_count=1";
    let response = await fetch(url);

    try {
        deck = await response.json();
    } catch (error) {
        console.log("Deck API error:", error);
    }

    return deck;
}

async function startingDraw(deckId) {
    let response = await fetch(`${deckAPI}/${deckId}/draw/?count=2`);
    return await response.json();
}

async function hit(deckId) {
    let response = await fetch(`${deckAPI}/${deckId}/draw/?count=1`);
    return await response.json();
}



// Score Functions
function getScore(cards) {
    let score = 0;
    let aceCount = 0;

    for (let card of cards) {
        if (["KING", "QUEEN", "JACK"].includes(card.value)) {
            score += 10;
        } else if (card.value === "ACE") {
            score += 11;
            aceCount++;
        } else {
            score += parseInt(card.value);
        }
    }

    while (score > 21 && aceCount > 0) {
        score -= 10;
        aceCount--;
    }

    return score;
}

function checkBlackjack(cards) {
    return getScore(cards) === 21 && cards.length === 2;
}



// Dealer & CPU Logic
async function dealerPlay(deckId, dealerCards) {
    while (getScore(dealerCards) < 17) {
        let draw = await hit(deckId);
        dealerCards.push(draw.cards[0]);
    }
    return dealerCards;
}

function cpuDecision(cpu, dealerUpValue) {
    const score = getScore(cpu.cards);
    const { confidence, risk, surrenderRate } = cpu.stats;

    const dealerStrong = dealerUpValue >= 10;

    if (score <= 15 && dealerStrong && Math.random() < surrenderRate) {
        return "surrender";
    }

    const canDouble = cpu.cards.length === 2;
    const goodDouble = score >= 9 && score <= 11;

    if (canDouble && goodDouble && Math.random() < risk) {
        return "double";
    }

    const standThreshold = 13 + Math.floor(confidence * 6);
    if (score >= standThreshold) {
        return "stand";
    }

    return "hit";
}

async function cpuTurn(cpu, dealerUpValue) {
    let action = cpuDecision(cpu, dealerUpValue);

    if (action === "surrender") {
        cpu.surrendered = true;
        return;
    }

    if (action === "double") {
        let draw = await hit(deckId);
        cpu.cards.push(draw.cards[0]);
        cpu.doubled = true;
        return;
    }

    while (action === "hit") {
        let draw = await hit(deckId);
        cpu.cards.push(draw.cards[0]);

        if (getScore(cpu.cards) > 21) break;

        action = cpuDecision(cpu, dealerUpValue);
    }
}

async function cpuTurns(dealerUpValue) {
    for (let cpu of cpuPlayers) {
        await cpuTurn(cpu, dealerUpValue);
        updateDOM();

        // Allow browser to load so CPU updates appear live
        // Had an issue where the cpu cards didn't update
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}



// Player Actions
async function playerHit() {
    let draw = await hit(deckId);
    playerCards.push(draw.cards[0]);
    updateDOM();

    if (getScore(playerCards) > 21) {
        setGameInfo("Player busts!");
        disablePlayerButtons();
        await finishRound();
    }
}

async function playerStand() {
    disablePlayerButtons();
    await finishRound();
}

async function playerDouble() {
    if (playerCards.length !== 2) {
        setGameInfo("You can only double down on your first two cards!");
        return;
    }

    let draw = await hit(deckId);
    playerCards.push(draw.cards[0]);
    updateDOM();

    disablePlayerButtons();
    await finishRound();
}

function playerSurrender() {
    disablePlayerButtons();
    setGameInfo("Player surrendered. Dealer wins.");
}



// Button Helpers
function disablePlayerButtons() {
    document.getElementById("hitBtn").disabled = true;
    document.getElementById("standBtn").disabled = true;
    document.getElementById("doubleBtn").disabled = true;
    document.getElementById("surrenderBtn").disabled = true;
}

function enablePlayerButtons() {
    document.getElementById("hitBtn").disabled = false;
    document.getElementById("standBtn").disabled = false;
    document.getElementById("doubleBtn").disabled = false;
    document.getElementById("surrenderBtn").disabled = false;
}



// Round Calculations
function outcomeText(name, score, dealerScore, surrendered) {
    if (surrendered) return `${name} surrendered.\n`;
    if (score > 21) return `${name} busts.\n`;
    if (dealerScore > 21) return `${name} wins — dealer busts!\n`;
    if (score > dealerScore) return `${name} wins!\n`;
    if (score < dealerScore) return `${name} loses.\n`;
    return `${name} pushes.\n`;
}

function checkWinners() {
    const playerScore = getScore(playerCards);
    const dealerScore = getScore(dealerCards);

    let result = `Dealer Score: ${dealerScore}\nPlayer Score: ${playerScore}\n\nCPU Results:\n`;

    for (let cpu of cpuPlayers) {
        let score = getScore(cpu.cards);
        result += outcomeText(cpu.name, score, dealerScore, cpu.surrendered);
    }

    result += `\nPlayer Outcome:\n`;
    result += outcomeText("Player", playerScore, dealerScore, false);

    setGameInfo(result);
}

async function finishRound() {
    const dealerUpValue = cardValueNum(dealerCards[0]);

    await cpuTurns(dealerUpValue);

    dealerCards = await dealerPlay(deckId, dealerCards);
    updateDOM();

    checkWinners();
}



// Game Logic
async function initGame() {
    const deck = await newDeck();
    deckId = deck.deck_id;

    startRound();
}

async function startRound() {
    playerCards = [];
    dealerCards = [];

    for (let cpu of cpuPlayers) {
        cpu.cards = [];
        cpu.surrendered = false;
        cpu.doubled = false;
    }

    enablePlayerButtons();

    let pDraw = await startingDraw(deckId);
    let dDraw = await startingDraw(deckId);

    playerCards.push(...pDraw.cards);
    dealerCards.push(...dDraw.cards);

    for (let cpu of cpuPlayers) {
        let cDraw = await startingDraw(deckId);
        cpu.cards.push(...cDraw.cards);
    }

    updateDOM();

    setGameInfo("Your turn! Choose: Hit, Stand, Double, or Surrender.");
}


// Helper used by finishRound()
function cardValueNum(card) {
    if (["KING", "QUEEN", "JACK"].includes(card.value)) return 10;
    if (card.value === "ACE") return 11;
    return parseInt(card.value);
}