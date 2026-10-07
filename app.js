const API_URL = "/api/balance";




/*
const refreshButton = userInfo.getElementById("refreshButton");
function showMessage(text){message.textContent=text;}


//GET balance
async function loadBalance(){
  try {
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error("Failed to load balance");
  const balance = await response.json();
  renderBalance(balance);
  } catch (error) {
    showMessage(error.message);
  }
}
*/
// Logout
const logoutButton = document.getElementById("logoutButton");

logoutButton.addEventListener("click", async () => {

    await fetch("/api/logout", {
        method: "POST"
    });

    window.location.href = "/";
});



async function loadUser() {
    
    const response = await fetch("/api/me");

    if (!response.ok) {
        window.location.href = "/";
        return;
    }

    const data = await response.json();

    document.getElementById("userName").textContent = data.name;
    currentUserName = data.name;
    loadBalance();
    loadGameAccess();
    loadGameHistory();
}

let currentUserName = "";

async function loadBalance() {
    const response = await fetch(API_URL);
    if (!response.ok) return null;
    const data = await response.json();
    document.getElementById("chipBalance").textContent = data.balance;
    return Number(data.balance);
}

async function loadGameAccess() {
    try {
        const response = await fetch("/api/game-access", { credentials: "same-origin" });
        if (!response.ok) throw new Error("Could not load game access.");
        const data = await response.json();
        window.dispatchEvent(new CustomEvent("game-access-updated", {
            detail: { blockedGames: Array.isArray(data.blocked_games) ? data.blocked_games : [] }
        }));
    } catch {
        window.dispatchEvent(new CustomEvent("game-access-updated", {
            detail: { blockedGames: ["Blackjack", "Roulette"] }
        }));
    }
}

async function gameRequest(endpoint, payload) {
    const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || "Could not update your game balance.");
    }
    return data;
}

function updateBalanceDisplay(balance) {
    document.getElementById("chipBalance").textContent = balance;
}

let currentHistoryPage = 1;
let totalHistoryPages = 1;

async function loadGameHistory(page = currentHistoryPage) {
    const historyBody = document.getElementById("historyBody");
    try {
        const response = await fetch(`/api/game-history?page=${page}`, { credentials: "same-origin" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load bet history.");

        currentHistoryPage = data.page;
        totalHistoryPages = data.total_pages;
        document.getElementById("historyPageStatus").textContent =
            `Page ${currentHistoryPage} of ${totalHistoryPages}`;
        document.getElementById("historyPrevious").disabled = currentHistoryPage <= 1;
        document.getElementById("historyNext").disabled = currentHistoryPage >= totalHistoryPages;

        historyBody.replaceChildren();
        if (!data.bets.length) {
            const row = historyBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 4;
            cell.textContent = "No settled bets yet.";
            return;
        }

        for (const bet of data.bets) {
            const row = historyBody.insertRow();
            row.insertCell().textContent = bet.game || "Unknown";
            row.insertCell().textContent = Number(bet.amount || 0).toLocaleString("en-US");

            const resultCell = row.insertCell();
            const outcome = ["win", "loss", "push"].includes(bet.outcome) ? bet.outcome : "loss";
            resultCell.textContent = outcome[0].toUpperCase() + outcome.slice(1);
            if (outcome === "win") resultCell.className = "history-win";
            if (outcome === "loss") resultCell.className = "history-loss";

            row.insertCell().textContent = Number(bet.payout || 0).toLocaleString("en-US");
        }
    } catch (error) {
        historyBody.replaceChildren();
        document.getElementById("historyPageStatus").textContent = "History unavailable";
        document.getElementById("historyPrevious").disabled = true;
        document.getElementById("historyNext").disabled = true;
        const row = historyBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4;
        cell.textContent = error.message || "Could not load bet history.";
    }
}

document.getElementById("historyPrevious").addEventListener("click", () => {
    if (currentHistoryPage > 1) loadGameHistory(currentHistoryPage - 1);
});

document.getElementById("historyNext").addEventListener("click", () => {
    if (currentHistoryPage < totalHistoryPages) loadGameHistory(currentHistoryPage + 1);
});

loadUser();
window.setInterval(loadGameAccess, 5000);


/* =====================================================
   ADD FUNDS
   ===================================================== */

const addFundsButton = document.getElementById("addFundsButton");
const addFundsPanel = document.getElementById("addFundsPanel");
const fundsPlayer = document.getElementById("fundsPlayer");
const fundsAmount = document.getElementById("fundsAmount");
const fundsMessage = document.getElementById("fundsMessage");

addFundsButton.addEventListener("click", async () => {
    addFundsPanel.hidden = !addFundsPanel.hidden;
    if (addFundsPanel.hidden) return;

    fundsMessage.textContent = "";
    const response = await fetch("/api/players");
    if (!response.ok) {
        fundsMessage.textContent = "Could not load players.";
        return;
    }
    const data = await response.json();
    fundsPlayer.innerHTML = "";
    const allowedPlayers = Array.isArray(data.players) ? data.players : [];
    allowedPlayers.forEach(player => {
        const option = document.createElement("option");
        option.value = player.id;
        option.textContent = `${player.name} (${player.email})`;
        fundsPlayer.appendChild(option);
    });
    if (fundsPlayer.options.length > 0) {
        fundsPlayer.value = fundsPlayer.options[0].value;
    }
});

document.getElementById("fundsCancel").addEventListener("click", () => {
    addFundsPanel.hidden = true;
});

document.getElementById("fundsSubmit").addEventListener("click", async () => {
    const amount = Number(fundsAmount.value);
    if (!fundsPlayer.value || !Number.isInteger(amount) || amount <= 0) {
        fundsMessage.textContent = "Enter a positive whole number.";
        return;
    }

    const response = await fetch("/api/add-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount })
    });
    const data = await response.json();

    if (!response.ok) {
        fundsMessage.textContent = data.error || "Failed to add funds.";
        return;
    }

    fundsMessage.textContent = `Added ${amount} chips to ${data.name}.`;
    fundsAmount.value = "";
    loadBalance();
});




/* =====================================================
   BLACKJACK
   ===================================================== */

const blackjackDeal = document.getElementById("blackjackDeal");

if (blackjackDeal) {
    const blackjackWagerInput = document.getElementById("blackjackWager");
    const blackjackWagerButton = document.getElementById("blackjackWagerButton");
    const blackjackWagerStatus = document.getElementById("blackjackWagerStatus");

    let blackjackDeck = [];
    let playerHand = [];
    let dealerHand = [];
    let blackjackWager = 0;
    let blackjackBetId = null;
    let blackjackPendingOutcome = null;
    let blackjackAccessRestricted = true;
    let blackjackWagerRequestPending = false;

    let blackjackGameOver = true;

    function syncBlackjackWagerAccess() {
        blackjackWagerButton.disabled = blackjackAccessRestricted || blackjackWager > 0 || blackjackWagerRequestPending;
        if (blackjackWager <= 0) {
            blackjackWagerStatus.textContent = blackjackAccessRestricted
                ? "Blackjack access is restricted by an admin."
                : "No wager added.";
        }
    }

    window.addEventListener("game-access-updated", event => {
        blackjackAccessRestricted = event.detail.blockedGames.includes("Blackjack");
        syncBlackjackWagerAccess();
    });
    syncBlackjackWagerAccess();


    // Create a new deck
    function createBlackjackDeck() {

        const deck = [];

        // Cards 2-9
        for (let i = 2; i <= 9; i++) {
            for (let j = 0; j < 4; j++) {
                deck.push(i);
            }
        }

        // Four 10s + four Jacks + four Queens + four Kings
        // All have a value of 10.
        for (let i = 0; i < 16; i++) {
            deck.push(10);
        }

        // Four aces
        for (let i = 0; i < 4; i++) {
            deck.push(11);
        }

        return deck;
    }


    // Shuffle deck
    function shuffleDeck(deck) {

        for (let i = deck.length - 1; i > 0; i--) {

            const j = Math.floor(Math.random() * (i + 1));

            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        return deck;
    }


    // Calculate hand value
    function getBlackjackValue(hand) {

        let total = hand.reduce((sum, card) => sum + card, 0);

        let aces = hand.filter(card => card === 11).length;

        // Turn aces from 11 into 1 if necessary
        while (total > 21 && aces > 0) {

            total -= 10;
            aces--;
        }

        return total;
    }


    // Display cards
    function displayBlackjackCards() {

        const playerCards = document.getElementById("playerCards");
        const dealerCards = document.getElementById("dealerCards");

        playerCards.innerHTML = "";
        dealerCards.innerHTML = "";


        // Player cards
        playerHand.forEach(card => {

            const cardElement = document.createElement("div");

            cardElement.className = "playing-card";
            cardElement.textContent = card === 11 ? "A" : card;

            playerCards.appendChild(cardElement);
        });


        // Dealer cards
        dealerHand.forEach((card, index) => {

            const cardElement = document.createElement("div");

            cardElement.className = "playing-card";

            // Hide dealer's second card while player is playing
            if (index === 1 && !blackjackGameOver) {
                cardElement.textContent = "?";
            } else {
                cardElement.textContent = card === 11 ? "A" : card;
            }

            dealerCards.appendChild(cardElement);
        });


        document.getElementById("playerTotal").textContent =
            getBlackjackValue(playerHand);


        if (blackjackGameOver) {
            document.getElementById("dealerTotal").textContent =
                getBlackjackValue(dealerHand);
        } else {
            document.getElementById("dealerTotal").textContent = "?";
        }
    }


    async function addBlackjackWager() {
        if (!blackjackGameOver) {
            document.getElementById("blackjackMessage").textContent =
                "You can change your wager after this hand is over.";
            return;
        }

        const amount = Number(blackjackWagerInput.value);
        if (blackjackWagerInput.value === "" || !Number.isSafeInteger(amount) || amount <= 0) {
            document.getElementById("blackjackMessage").textContent =
                "Enter a positive whole-number wager.";
            return;
        }

        blackjackWagerRequestPending = true;
        syncBlackjackWagerAccess();
        blackjackDeal.disabled = true;

        try {
            const wager = await gameRequest("/api/games/wager", {
                game: "Blackjack",
                amount
            });
            blackjackWager = amount;
            blackjackBetId = wager.bet_id;
            updateBalanceDisplay(wager.balance);
            blackjackWagerStatus.textContent = `Current wager: ${amount} chips`;
            blackjackWagerInput.value = "";
            document.getElementById("blackjackMessage").textContent =
                "Wager added. Deal when you are ready.";
        } catch (error) {
            document.getElementById("blackjackMessage").textContent = error.message;
        } finally {
            blackjackWagerRequestPending = false;
            syncBlackjackWagerAccess();
            blackjackDeal.disabled = false;
        }
    }


    // Start game
    async function startBlackjack() {
        if (!blackjackGameOver) {
            return;
        }

        if (blackjackBetId && blackjackPendingOutcome) {
            await finishBlackjackHand(blackjackPendingOutcome);
            return;
        }

        if (blackjackWager <= 0 || !blackjackBetId) {
            document.getElementById("blackjackMessage").textContent =
                "Add a wager before dealing.";
            return;
        }

        blackjackDeal.disabled = true;
        blackjackWagerButton.disabled = true;

        blackjackDeck = shuffleDeck(createBlackjackDeck());

        playerHand = [
            blackjackDeck.pop(),
            blackjackDeck.pop()
        ];

        dealerHand = [
            blackjackDeck.pop(),
            blackjackDeck.pop()
        ];

        blackjackGameOver = false;

        document.getElementById("blackjackMessage").textContent =
            "Your turn!";

        document.getElementById("blackjackHit").disabled = false;
        document.getElementById("blackjackStand").disabled = false;

        blackjackDeal.textContent = "New Game";

        displayBlackjackCards();

        // Check for natural blackjack
        if (getBlackjackValue(playerHand) === 21) {
            await dealerTurn();
        }
    }


    async function finishBlackjackHand(outcome) {
        blackjackGameOver = true;
        blackjackPendingOutcome = outcome;
        document.getElementById("blackjackHit").disabled = true;
        document.getElementById("blackjackStand").disabled = true;
        blackjackDeal.disabled = true;
        blackjackWagerButton.disabled = true;

        try {
            const settlement = await gameRequest("/api/games/settle", {
                bet_id: blackjackBetId,
                outcome
            });
            updateBalanceDisplay(settlement.balance);
            await loadGameHistory(1);
            blackjackBetId = null;
            blackjackPendingOutcome = null;
            blackjackWager = 0;
            blackjackWagerStatus.textContent = "No wager added.";
            blackjackDeal.disabled = false;
            syncBlackjackWagerAccess();
            blackjackDeal.textContent = "New Game";
            return settlement;
        } catch (error) {
            document.getElementById("blackjackMessage").textContent =
                `${error.message} Use Retry Settlement to try again.`;
            blackjackDeal.textContent = "Retry Settlement";
            blackjackDeal.disabled = false;
            syncBlackjackWagerAccess();
            return null;
        }
    }


    // Hit
    async function blackjackHit() {

        if (blackjackGameOver) {
            return;
        }

        playerHand.push(blackjackDeck.pop());

        displayBlackjackCards();

        const playerTotal = getBlackjackValue(playerHand);

        if (playerTotal > 21) {

            const settlement = await finishBlackjackHand("loss");
            if (!settlement) return;

            document.getElementById("blackjackMessage").textContent =
                "You busted! Dealer wins.";

            displayBlackjackCards();
        }

        else if (playerTotal === 21) {
            await dealerTurn();
        }
    }


    // Stand
    async function blackjackStand() {

        if (blackjackGameOver) {
            return;
        }

        await dealerTurn();
    }


    // Dealer's turn
    async function dealerTurn() {

        // Dealer must hit below 17
        while (getBlackjackValue(dealerHand) < 17) {
            dealerHand.push(blackjackDeck.pop());
        }

        const playerTotal = getBlackjackValue(playerHand);
        const dealerTotal = getBlackjackValue(dealerHand);

        let message = "";

        if (playerTotal > 21) {

            message = "You busted! Dealer wins.";

        } else if (dealerTotal > 21) {

            message = "Dealer busted! You win!";

        } else if (playerTotal > dealerTotal) {

            message = "You win!";

        } else if (dealerTotal > playerTotal) {

            message = "Dealer wins.";

        } else {

            message = "It's a tie!";
        }

        const outcome = message === "You win!" || message === "Dealer busted! You win!"
            ? "win"
            : message === "It's a tie!" ? "push" : "loss";
        const settlement = await finishBlackjackHand(outcome);
        if (!settlement) return;

        if (settlement.net_winnings > 0) {
            message += ` You won ${settlement.net_winnings} chips.`;
        } else if (outcome === "push") {
            message += " Your wager was returned.";
        }

        document.getElementById("blackjackMessage").textContent = message;

        displayBlackjackCards();
    }


    blackjackDeal.addEventListener("click", startBlackjack);
    blackjackWagerButton.addEventListener("click", addBlackjackWager);

    document
        .getElementById("blackjackHit")
        .addEventListener("click", blackjackHit);

    document
        .getElementById("blackjackStand")
        .addEventListener("click", blackjackStand);
}



/* =====================================================
   ROULETTE
   ===================================================== */

const rouletteButton = document.getElementById("rouletteButton");

if (rouletteButton) {

    /*
        American Roulette:

        0  = Green
        00 = Green

        1-36:
        18 Red
        18 Black

        Total = 38 slots
    */

    const redNumbers = [
        1, 3, 5, 7, 9,
        12, 14, 16, 18,
        19, 21, 23, 25, 27,
        30, 32, 34, 36
    ];

    const blackNumbers = [
        2, 4, 6, 8, 10,
        11, 13, 15, 17,
        20, 22, 24, 26, 28,
        29, 31, 33, 35
    ];


    let rouletteFinished = false;
    let rouletteBetId = null;
    let rouletteAccessRestricted = true;
    let rouletteSpinning = false;
    let rouletteSettlementPending = false;

    function syncRouletteAccess() {
        rouletteButton.disabled = rouletteSpinning || rouletteSettlementPending || (rouletteAccessRestricted && !rouletteBetId);
        rouletteButton.title = rouletteAccessRestricted && !rouletteBetId
            ? "Access to Roulette is restricted by an admin."
            : "";
    }

    window.addEventListener("game-access-updated", event => {
        rouletteAccessRestricted = event.detail.blockedGames.includes("Roulette");
        syncRouletteAccess();
    });
    syncRouletteAccess();


    function getRouletteColor(number) {

        if (number === 0 || number === "00") {
            return "green";
        }

        if (redNumbers.includes(number)) {
            return "red";
        }

        return "black";
    }


    async function settleRouletteBet() {
        rouletteSettlementPending = true;
        syncRouletteAccess();
        try {
            const settlement = await gameRequest("/api/games/settle", {
                bet_id: rouletteBetId
            });
            updateBalanceDisplay(settlement.balance);
            await loadGameHistory(1);
            document.getElementById("rouletteMessage").textContent =
                settlement.outcome === "win"
                    ? `You won ${settlement.net_winnings} chips!`
                    : "You lost your wager.";
            rouletteBetId = null;
            rouletteButton.textContent = "Retry";
        } catch (error) {
            document.getElementById("rouletteMessage").textContent =
                `${error.message} Click Retry settlement to try again.`;
            rouletteButton.textContent = "Retry settlement";
        } finally {
            rouletteFinished = true;
            rouletteSettlementPending = false;
            syncRouletteAccess();
        }
    }


    async function spinRoulette() {
        if (rouletteFinished) {
            if (rouletteBetId) {
                rouletteButton.disabled = true;
                await settleRouletteBet();
                return;
            }
            resetRoulette();
            return;
        }

        const selectedColor = document.getElementById("rouletteColor").value;
        const betInput = document.getElementById("rouletteBet");
        const bet = Number(betInput.value);

        if (!Number.isSafeInteger(bet) || bet < 1 || betInput.value === "") {
            document.getElementById("rouletteMessage").textContent =
                "Please enter a valid bet amount.";
            return;
        }

        rouletteSpinning = true;
        syncRouletteAccess();

        let wager;
        try {
            wager = await gameRequest("/api/games/wager", {
                game: "Roulette",
                amount: bet,
                choice: selectedColor
            });
        } catch (error) {
            document.getElementById("rouletteMessage").textContent = error.message;
            rouletteSpinning = false;
            syncRouletteAccess();
            return;
        }

        rouletteBetId = wager.bet_id;
        updateBalanceDisplay(wager.balance);
        document.getElementById("rouletteMessage").textContent = "";

        const resultElement = document.getElementById("rouletteResult");
        resultElement.innerHTML = "<p class='spinning-text'>Spinning...</p>";

        setTimeout(async () => {
            const displayedNumber = wager.result;
            const resultColor = wager.result_color;

            resultElement.innerHTML = `
                <div class="roulette-number ${resultColor}">
                    ${displayedNumber}
                </div>
                <p>Result: <strong>${resultColor.toUpperCase()}</strong></p>
            `;

            rouletteFinished = true;
            rouletteSpinning = false;
            await settleRouletteBet();
        }, 2000);
    }


    function resetRoulette() {

        document.getElementById("rouletteColor").value = "red";

        document.getElementById("rouletteBet").value = "";

        document.getElementById("rouletteResult").innerHTML =
            "<p>Make your choice and spin!</p>";

        document.getElementById("rouletteMessage").textContent = "";

        rouletteButton.textContent = "Spin";

        rouletteFinished = false;
        rouletteSpinning = false;
        rouletteSettlementPending = false;
        syncRouletteAccess();
    }


    rouletteButton.addEventListener("click", spinRoulette);
}


const refreshLeaderboardButton = document.getElementById("refreshLeaderboard");
const leaderboardList = document.getElementById("leaderboardList");

async function refreshLeaderboard() {
    const response = await fetch("api/get-leaderboard");
    if (!response.ok) {
        leaderboardList.innerHTML = "<li>Failed to load leaderboard.</li>";
        return;
    }
    const data = await response.json();
    leaderboardList.innerHTML = data.players.map(player => `<li>${player.name}: ${player.score}</li>`).join("");
}

refreshLeaderboardButton.addEventListener("click", async () => {
    await refreshLeaderboard();
});

refreshLeaderboard();
