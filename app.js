const API_URL = "/api/balance";
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






/* =====================================================
   BLACKJACK
   ===================================================== */

const blackjackDeal = document.getElementById("blackjackDeal");

if (blackjackDeal) {

    let blackjackDeck = [];
    let playerHand = [];
    let dealerHand = [];

    let blackjackGameOver = true;


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


    // Start game
    function startBlackjack() {

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
            dealerTurn();
        }
    }


    // Hit
    function blackjackHit() {

        if (blackjackGameOver) {
            return;
        }

        playerHand.push(blackjackDeck.pop());

        displayBlackjackCards();

        const playerTotal = getBlackjackValue(playerHand);

        if (playerTotal > 21) {

            blackjackGameOver = true;

            document.getElementById("blackjackMessage").textContent =
                "You busted! Dealer wins.";

            document.getElementById("blackjackHit").disabled = true;
            document.getElementById("blackjackStand").disabled = true;

            displayBlackjackCards();
        }

        else if (playerTotal === 21) {
            dealerTurn();
        }
    }


    // Stand
    function blackjackStand() {

        if (blackjackGameOver) {
            return;
        }

        dealerTurn();
    }


    // Dealer's turn
    function dealerTurn() {

        blackjackGameOver = true;

        document.getElementById("blackjackHit").disabled = true;
        document.getElementById("blackjackStand").disabled = true;

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

        document.getElementById("blackjackMessage").textContent = message;

        displayBlackjackCards();
    }


    blackjackDeal.addEventListener("click", startBlackjack);

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


    function getRouletteColor(number) {

        if (number === 0 || number === "00") {
            return "green";
        }

        if (redNumbers.includes(number)) {
            return "red";
        }

        return "black";
    }


    function spinRoulette() {

        const selectedColor =
            document.getElementById("rouletteColor").value;

        const betInput =
            document.getElementById("rouletteBet");

        const bet = Number(betInput.value);


        // Make sure a valid bet was entered
        if (isNaN(bet) || bet < 0 || betInput.value === "") {

            document.getElementById("rouletteMessage").textContent =
                "Please enter a valid bet amount.";

            return;
        }


        // If the game has already finished, reset it
        if (rouletteFinished) {

            resetRoulette();

            return;
        }


        rouletteButton.disabled = true;

        document.getElementById("rouletteMessage").textContent = "";

        const resultElement =
            document.getElementById("rouletteResult");

        resultElement.innerHTML =
            "<p class='spinning-text'>Spinning...</p>";


        // Delay before revealing result
        setTimeout(() => {

            // Generate number from 0-37
            const randomNumber = Math.floor(Math.random() * 38);

            let displayedNumber;

            if (randomNumber === 0) {
                displayedNumber = 0;
            }

            else if (randomNumber === 37) {
                displayedNumber = "00";
            }

            else {
                displayedNumber = randomNumber;
            }


            const resultColor =
                getRouletteColor(displayedNumber);


            resultElement.innerHTML = `
                <div class="roulette-number ${resultColor}">
                    ${displayedNumber}
                </div>

                <p>
                    Result: <strong>${resultColor.toUpperCase()}</strong>
                </p>
            `;


            // Determine whether player won
            if (selectedColor === resultColor) {

                // Green pays 17:1 in roulette
                // Red/black pays 1:1

                if (selectedColor === "green") {

                    const winnings = bet * 17;

                    document.getElementById("rouletteMessage").textContent =
                        `You won $${winnings.toFixed(2)}! Green hit!`;

                } else {

                    const winnings = bet;

                    document.getElementById("rouletteMessage").textContent =
                        `You won $${winnings.toFixed(2)}!`;
                }

            } else {

                document.getElementById("rouletteMessage").textContent =
                    `You lost your $${bet.toFixed(2)} bet.`;
            }


            rouletteFinished = true;

            rouletteButton.disabled = false;

            rouletteButton.textContent = "Retry";

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
    }


    rouletteButton.addEventListener("click", spinRoulette);
}
