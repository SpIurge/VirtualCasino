let playerCards = [];
let dealerCards = [];
let cpuPlayers = [];
let deckId = null;

// ======================= CPU DATA ==========================
const cpuDataElement = document.getElementById("cpu-data");
const selectedCpus = JSON.parse(cpuDataElement.dataset.cpus);

cpuPlayers = selectedCpus.map((cpu, index) => ({
    name: cpu.name,
    domId: `cpu${index + 1}CardNumber`,
    cards: [],
    surrendered: false,
    doubled: false,
    stats: {
        confidence: cpu.confidence,
        risk: cpu.risk,
        surrenderRate: cpu.surrenderRate
    }
}));

// ======================= MODAL SYSTEM ======================
function showResultModal(message, payload) {
    const modal = document.getElementById("resultModal");
    const modalMessage = document.getElementById("modalMessage");
    const continueBtn = document.getElementById("modalContinueBtn");

    modalMessage.textContent = message;
    modal.style.display = "flex";

    continueBtn.onclick = async () => {
        const res = await fetch("/api/roundResult", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            window.location.href = "/account";
        } else {
            alert("Error saving game result.");
            modal.style.display = "none";
        }
    };
}


// ======================= DOM UPDATES ========================
document.addEventListener("DOMContentLoaded", initGame);

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



// ======================= DECK OF CARDS API ========================
const deckAPI = "https://deckofcardsapi.com/api/deck";

async function newDeck() {
    let url = deckAPI + "/new/shuffle/?deck_count=1";
    let response = await fetch(url);

    try {
        return await response.json();
    } catch (error) {
        console.log("Deck API error:", error);
        return null;
    }
}

async function startingDraw(deckId) {
    let response = await fetch(`${deckAPI}/${deckId}/draw/?count=2`);
    return await response.json();
}

async function hit(deckId) {
    let response = await fetch(`${deckAPI}/${deckId}/draw/?count=1`);
    return await response.json();
}



// ======================= SCORE FUNCTIONS ========================
function getScore(cards) {
    let score = 0, aceCount = 0;

    for (let card of cards) {
        if (["KING", "QUEEN", "JACK"].includes(card.value)) score += 10;
        else if (card.value === "ACE") { score += 11; aceCount++; }
        else score += parseInt(card.value);
    }

    while (score > 21 && aceCount--) score -= 10;
    return score;
}

function checkBlackjack(cards) {
    return getScore(cards) === 21 && cards.length === 2;
}



// ======================= DEALER + CPU LOGIC ========================
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

    if (score <= 15 && dealerStrong && Math.random() < surrenderRate) return "surrender";

    const canDouble = cpu.cards.length === 2;
    const goodDouble = score >= 9 && score <= 11;
    if (canDouble && goodDouble && Math.random() < risk) return "double";

    const standThreshold = 13 + Math.floor(confidence * 6);
    if (score >= standThreshold) return "stand";

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
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}



// ======================= PLAYER ACTIONS ========================
async function playerHit() {
    let draw = await hit(deckId);
    playerCards.push(draw.cards[0]);
    let playerImageContainer = document.getElementById("playerCards");
    let newImg = document.createElement("img");
    newImg.src = draw.cards[0].image;
    newImg.width = 80;
    playerImageContainer.append(newImg);
    updateDOM();

    if (getScore(playerCards) > 21) {
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
    let playerImageContainer = document.getElementById("playerCards");
    let newImg = document.createElement("img");
    newImg.src = draw.cards[0].image;
    newImg.width = 80;
    playerImageContainer.append(newImg);
    updateDOM();

    disablePlayerButtons();
    await finishRound();
}

function playerSurrender() {
    disablePlayerButtons();
    setGameInfo("Player surrendered.");
}



// ======================= BUTTON STATE ========================
function disablePlayerButtons() {
    hitBtn.disabled = true;
    standBtn.disabled = true;
    doubleBtn.disabled = true;
    surrenderBtn.disabled = true;
}

function enablePlayerButtons() {
    hitBtn.disabled = false;
    standBtn.disabled = false;
    doubleBtn.disabled = false;
    surrenderBtn.disabled = false;
}



// ======================= ROUND OUTCOME & MODAL ========================
function getPlayerOutcome(bet) {
    const playerScore = getScore(playerCards);
    const dealerScore = getScore(dealerCards);

    if (playerScore > 21) return { result: "loss", profit: -bet };
    if (dealerScore > 21) return { result: "win", profit: bet };
    if (playerScore > dealerScore) return { result: "win", profit: bet };
    if (playerScore < dealerScore) return { result: "loss", profit: -bet };
    return { result: "push", profit: 0 };
}

async function finishRound() {
    const dealerUpValue = cardValueNum(dealerCards[0]);

    await cpuTurns(dealerUpValue);

    dealerCards = await dealerPlay(deckId, dealerCards);

    for (let cpu of cpuPlayers) {
        const imgContainer = document.getElementById("cpu" + cpu.id + "Cards");
        imgContainer.replaceChildren();

        for (let card of cpu.cards) {
            const newImg = document.createElement("img");
            newImg.src = card.image;
            newImg.width = 80;
            imgContainer.append(newImg);
        }
    }

    const dealerImgContainer = document.getElementById("dealerCards");
    dealerImgContainer.replaceChildren();

    for (let card of dealerCards) {
        const newImg = document.createElement("img");
        newImg.src = card.image;
        newImg.width = 80;
        dealerImgContainer.append(newImg);
    }

    const betDataElement = document.getElementById("bet-data");
    const bet = Number(betDataElement.dataset.bet);

    const { result, profit } = getPlayerOutcome(bet);

    const summary =
        `Dealer Score: ${getScore(dealerCards)}\n` +
        `Player Score: ${getScore(playerCards)}\n\n` +
        `Result: ${result.toUpperCase()}\n` +
        `Profit: ${profit}`;

    showResultModal(summary, {
        dealerId: null,
        result,
        betAmount: bet,
        profitChange: profit
    });
}



// ======================= GAME START ========================
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

    let pImgContainer = document.getElementById("playerCards");
    let dImgContainer = document.getElementById("dealerCards");

    let playerImg1 = document.createElement("img");
    playerImg1.src = pDraw.cards[0].image;
    playerImg1.width = 80;
    pImgContainer.append(playerImg1);
    let playerImg2 = document.createElement("img");
    playerImg2.src = pDraw.cards[1].image;
    playerImg2.width = 80;
    pImgContainer.append(playerImg2);

    let dealerImg1 = document.createElement("img");
    dealerImg1.src = dDraw.cards[0].image;
    dealerImg1.width = 80;
    dImgContainer.append(dealerImg1);
    let dealerImg2 = document.createElement("img");
    dealerImg2.src = dDraw.cards[1].image;
    dealerImg2.src = "https://deckofcardsapi.com/static/img/back.png";
    dealerImg2.width = 80;
    dImgContainer.append(dealerImg2);

    for (let cpu of cpuPlayers) {
        let cDraw = await startingDraw(deckId);

        let imgContainer = document.getElementById("cpu" + cpu.id + "Cards");
        let newImg = document.createElement("img");
        newImg.src = "https://deckofcardsapi.com/static/img/back.png";
        newImg.width = 80;
        imgContainer.append(newImg);

        let newImg2 = document.createElement("img");
        newImg2.src = "https://deckofcardsapi.com/static/img/back.png";
        newImg2.width = 80;
        imgContainer.append(newImg2);
        cpu.cards.push(...cDraw.cards);
    }

    updateDOM();
    setGameInfo("Your turn!");
}



// ======================= HELPERS ========================
function cardValueNum(card) {
    if (["KING", "QUEEN", "JACK"].includes(card.value)) return 10;
    if (card.value === "ACE") return 11;
    return parseInt(card.value);
}